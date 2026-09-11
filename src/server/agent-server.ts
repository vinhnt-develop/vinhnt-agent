import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { AgentRunner } from '../agent/agent-runner.js';
import { logger } from '../common/logger.js';
import type { AgentConfig } from '../config/index.js';

export class AgentServer {
  private app: express.Express;
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private activeSessions = new Map<string, WebSocket>();

  constructor(
    private config: AgentConfig,
    private runner: AgentRunner,
  ) {
    this.app = express();
    this.app.use(cors({ origin: true, credentials: true }));
    this.app.use(express.json({ limit: '10mb' }));
    this.setupRoutes();
  }

  private setupRoutes() {
    const router = express.Router();

    // Health check
    router.get('/health', (_req, res) => {
      res.json({ status: 'ok', agent: 'vinhnt-agent', version: '0.1.0' });
    });

    // Session CRUD
    router.get('/sessions', async (_req, res) => {
      const sessions = await this.runner.getSessionStore().listSessions();
      res.json({ data: sessions });
    });

    router.post('/sessions', async (req, res) => {
      const { title } = req.body;
      const session = await this.runner.getSessionStore().createSession(title);
      res.json({ data: session });
    });

    router.get('/sessions/:id', async (req, res) => {
      const session = await this.runner.getSessionStore().getSession(req.params.id as any);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json({ data: session });
    });

    router.delete('/sessions/:id', async (req, res) => {
      await this.runner.getSessionStore().deleteSession(req.params.id as any);
      res.json({ success: true });
    });

    // Messages
    router.get('/sessions/:id/messages', async (req, res) => {
      const messages = await this.runner.getSessionStore().listMessages(req.params.id as any);
      res.json({ data: messages });
    });

    // Agent run (REST sync)
    router.post('/agent/run', async (req, res) => {
      const { sessionId, prompt, model, provider } = req.body;

      if (!sessionId || !prompt) {
        res.status(400).json({ error: 'sessionId and prompt are required' });
        return;
      }

      const result = await this.runner.runAgent({
        sessionId,
        prompt,
        model,
        provider,
      });

      res.json({ data: result });
    });

    // Agent run (WebSocket streaming)
    router.post('/agent/stream', async (req, res) => {
      const { sessionId, prompt, model, provider } = req.body;

      if (!sessionId || !prompt) {
        res.status(400).json({ error: 'sessionId and prompt are required' });
        return;
      }

      // For REST streaming, we'll use SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const handle = await this.runner.runAgentStreaming({
          sessionId,
          prompt,
          model,
          provider,
        });

        // Stream events
        handle.on?.('data', (chunk: any) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        });

        handle.on?.('end', () => {
          res.write('data: [DONE]\n\n');
          res.end();
        });

        handle.on?.('error', (err: any) => {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        });
      } catch (error) {
        res.write(
          `data: ${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n\n`,
        );
        res.end();
      }
    });

    // Cancel run
    router.post('/agent/cancel', async (req, res) => {
      const { runId } = req.body;
      await this.runner.cancelRun(runId);
      res.json({ success: true });
    });

    // Tools
    router.get('/tools', (_req, res) => {
      const tools = this.runner.getToolkit().getToolsAsDefinitions();
      res.json({ data: tools });
    });

    // Memory
    router.get('/memories', async (_req, res) => {
      const memories = await this.runner.getMemoryStore().list();
      res.json({ data: memories });
    });

    router.post('/memories', async (req, res) => {
      const { key, value, tier, tags, sessionId } = req.body;
      const entry = await this.runner.getMemoryStore().set({
        key,
        value,
        tier: tier || 'working',
        tags: tags || [],
        sessionId: sessionId || 'local',
      });
      res.json({ data: entry });
    });

    this.app.use('/api/v1', router);
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(
        this.config.server.port,
        this.config.server.host,
        () => {
          logger.info(
            `Agent server listening on ${this.config.server.host}:${this.config.server.port}`,
          );
          this.setupWebSocket();
          resolve();
        },
      );
    });
  }

  private setupWebSocket() {
    if (!this.server) return;

    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      logger.info('WebSocket client connected');

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());

          switch (msg.type) {
            case 'run': {
              const { sessionId, prompt, model, provider } = msg;

              // Track active session
              if (sessionId) {
                this.activeSessions.set(sessionId, ws);
              }

              const handle = await this.runner.runAgentStreaming({
                sessionId,
                prompt,
                model,
                provider,
              });

              handle.on?.('data', (chunk: any) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'chunk', data: chunk }));
                }
              });

              handle.on?.('end', () => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'done' }));
                }
                if (sessionId) {
                  this.activeSessions.delete(sessionId);
                }
              });

              handle.on?.('error', (err: any) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: 'error',
                      error: err.message,
                    }),
                  );
                }
                if (sessionId) {
                  this.activeSessions.delete(sessionId);
                }
              });

              break;
            }

            case 'cancel': {
              const { runId } = msg;
              await this.runner.cancelRun(runId);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'cancelled', runId }));
              }
              break;
            }

            case 'ping': {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'pong' }));
              }
              break;
            }
          }
        } catch (error) {
          logger.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
        // Clean up active sessions for this connection
        for (const [sessionId, client] of this.activeSessions) {
          if (client === ws) {
            this.activeSessions.delete(sessionId);
          }
        }
      });
    });
  }

  async stop(): Promise<void> {
    this.wss?.close();
    return new Promise((resolve) => {
      this.server?.close(() => resolve());
    });
  }
}
