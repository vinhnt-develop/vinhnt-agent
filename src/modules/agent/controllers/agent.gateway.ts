import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AgentService } from '../services';
import { AgentRunTrackingService } from '../services/agent-run-tracking.service';
import { extractActualErrorMessage } from '@/shared/error-utils';

/** Maximum age (ms) for runError entries before automatic cleanup. */
const RUN_ERROR_TTL_MS = 5 * 60 * 1000;

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/agent',
})
export class AgentGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AgentGateway.name);
  private unsubscribe?: () => void;

  /** Track error messages per runId with timestamp for TTL cleanup. */
  private runErrors = new Map<string, { error: string; timestamp: number }>();

  /** Map runId → socket ID for targeted event emission. */
  private runToClient = new Map<string, string>();

  constructor(
    private readonly agentService: AgentService,
    private readonly trackingService: AgentRunTrackingService,
  ) {}

  onModuleInit() {
    const eventBus = this.agentService.getEventBus();
    this.unsubscribe = eventBus.subscribeAll((event) => {
      const runId = (event as any).aggregateId as string | undefined;
      if (!runId) return;

      // Route event to the specific client subscribed to this run
      const clientId = this.runToClient.get(runId);
      if (!clientId) return;

      const transformed = this.transformEvent(event, runId);
      if (transformed) {
        this.server?.to(clientId).emit('run:event', transformed);
      }

      // Track errors per runId from EventBus
      if (event.type === 'run.completed' && (event as any).data?.status === 'failed') {
        const error = (event as any).data?.error;
        if (error) {
          this.runErrors.set(runId, { error, timestamp: Date.now() });
        }
      }
    });

    // Periodic cleanup of stale runErrors entries
    setInterval(() => this.cleanupRunErrors(), 60_000);

    this.logger.log('AgentGateway subscribed to EventBus');
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up runToClient mappings for this client
    for (const [runId, clientId] of this.runToClient.entries()) {
      if (clientId === client.id) {
        this.runToClient.delete(runId);
      }
    }
  }

  @SubscribeMessage('run')
  async handleRun(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string;
      prompt: string;
      model?: string;
      provider?: string;
      workspaceId?: string;
    },
  ) {
    this.logger.log(
      `Run requested by ${client.id} for session ${data.sessionId}`,
    );

    try {
      const { handle, runId } = await this.agentService.runAgentStreaming(data);
      const runStartedAt = Date.now();

      // Map runId → client for EventBus routing
      this.runToClient.set(runId, client.id);

      client.emit('run:started', { runId });

      // Stream events to client + track tool executions
      for await (const event of handle.events()) {
        client.emit('run:event', event);

        if (event.type === 'tool.invoked') {
          this.trackingService.startToolExecution({
            runId,
            sessionId: data.sessionId,
            toolName: event.data?.toolName || 'unknown',
            toolInput: event.data?.input,
          });
        } else if (event.type === 'tool.completed') {
          this.trackingService.completeToolExecution({
            runId,
            toolName: event.data?.toolName || 'unknown',
            toolOutput: event.data?.output,
            status: 'completed',
          });
        } else if (event.type === 'tool.failed') {
          this.trackingService.completeToolExecution({
            runId,
            toolName: event.data?.toolName || 'unknown',
            status: 'failed',
            errorMessage: event.data?.error,
          });
        }
      }

      const result = await handle.completed;
      const durationMs = Date.now() - runStartedAt;

      // Get error from EventBus tracking (emitFail puts error there)
      const trackedEntry = this.runErrors.get(runId);
      const trackedError = trackedEntry?.error;
      if (trackedEntry) this.runErrors.delete(runId);

      // Check if the run failed
      const hasError = !result || (result as any).error || (result as any).status === 'failed' || trackedError;
      
      if (hasError) {
        const rawError = trackedError || (result as any)?.error || (result as any)?.output || 'Agent run failed';
        const errorMsg = extractActualErrorMessage(rawError);
        
        this.logger.error(`Run failed for session ${data.sessionId}:`, errorMsg);
        
        this.trackingService.completeRun({
          runId,
          status: 'failed',
          durationMs,
          errorMessage: errorMsg,
        });

        client.emit('run:error', {
          error: errorMsg,
        });
      } else {
        this.trackingService.completeRun({
          runId,
          status: 'succeeded',
          inputTokens: result?.usage?.promptTokens,
          outputTokens: result?.usage?.completionTokens,
          totalCost: result?.cost,
          durationMs,
          toolCallsCount: result?.toolCalls?.length,
        });

        client.emit('run:completed', result);
      }
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Run failed for ${client.id}`, errorMsg);
      client.emit('run:error', {
        error: errorMsg,
      });
    }
  }

  @SubscribeMessage('cancel')
  async handleCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runId: string },
  ) {
    this.logger.log(`Cancel requested by ${client.id} for run ${data.runId}`);
    await this.agentService.cancelRun(data.runId);
    client.emit('run:cancelled', { runId: data.runId });
  }

  @SubscribeMessage('messages')
  async handleMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const messages = await this.agentService.getSessionMessages(data.sessionId);
    client.emit('messages', messages);
  }

  /**
   * Transform SDK EventBus events into webui-compatible format.
   * Maps token.streamed → text, preserves tool events, etc.
   */
  private transformEvent(event: any, runId: string): Record<string, unknown> | null {
    const type = event.type as string;
    const data = event.data;

    switch (type) {
      case 'token.streamed':
        return {
          type: 'text',
          content: data?.content ?? data?.delta ?? '',
          runId,
        };
      case 'tool.invoked':
        return {
          type: 'tool.invoked',
          toolName: data?.toolName,
          input: data?.input,
          runId,
        };
      case 'tool.completed':
        return {
          type: 'tool.completed',
          toolName: data?.toolName,
          output: data?.output,
          runId,
        };
      case 'tool.failed':
        return {
          type: 'tool.failed',
          toolName: data?.toolName,
          error: data?.error,
          runId,
        };
      case 'thinking.content':
        return {
          type: 'thinking',
          content: data?.content,
          runId,
        };
      default:
        // Forward other run-relevant events as-is
        if (type.startsWith('run.') || type.startsWith('step.') || type.startsWith('tool.') || type.startsWith('thinking.')) {
          return { type, data, runId };
        }
        return null;
    }
  }

  /** Remove runErrors entries older than TTL. */
  private cleanupRunErrors() {
    const now = Date.now();
    for (const [runId, entry] of this.runErrors.entries()) {
      if (now - entry.timestamp > RUN_ERROR_TTL_MS) {
        this.runErrors.delete(runId);
      }
    }
  }
}
