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
import { AgentSettingsService, KernelSettings } from '../services/agent-settings.service';
import { SessionRepository } from '@/modules/session/repositories/session.repository';
import { extractActualErrorMessage } from '@/shared/error-utils';
import { SdkError, isSdkError } from '@vinhnt-sdk/schema';

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
  private errorCleanupInterval?: ReturnType<typeof setInterval>;

  /** Track error messages per runId with timestamp for TTL cleanup. */
  private runErrors = new Map<
    string,
    {
      error: string;
      timestamp: number;
      code?: string;
      retryable?: boolean;
    }
  >();

  /** Map runId → socket ID for targeted event emission. */
  private runToClient = new Map<string, string>();

  /** Map runId → sessionId for client-side filtering. */
  private runToSession = new Map<string, string>();

  constructor(
    private readonly agentService: AgentService,
    private readonly trackingService: AgentRunTrackingService,
    private readonly settingsService: AgentSettingsService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  onModuleInit() {
    const eventBus = this.agentService.getEventBus();
    this.unsubscribe = eventBus.subscribeAll((event) => {
      try {
        const runId = (event as any).aggregateId as string | undefined;
        if (!runId) return;

        const clientId = this.runToClient.get(runId);
        if (!clientId) return;

        const sessionId = this.runToSession.get(runId);
        const transformed = this.transformEvent(event, runId, sessionId);
        if (transformed) {
          this.server?.to(clientId).emit('run:event', transformed);
        }

        if (event.type === 'run.completed' && (event as any).data?.status === 'failed') {
          const error = (event as any).data?.error;
          if (error) {
            this.runErrors.set(runId, { error, timestamp: Date.now() });
          }
        }
      } catch (err) {
        this.logger.error('Error processing event bus message', err);
      }
    });

    this.errorCleanupInterval = setInterval(() => this.cleanupRunErrors(), 60_000);

    this.logger.log('AgentGateway subscribed to EventBus');
  }

  onModuleDestroy() {
    this.unsubscribe?.();
    if (this.errorCleanupInterval) {
      clearInterval(this.errorCleanupInterval);
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    for (const [runId, clientId] of this.runToClient.entries()) {
      if (clientId === client.id) {
        this.runToClient.delete(runId);
        this.runToSession.delete(runId);
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
      settings?: Partial<KernelSettings>;
    },
  ) {
    const runStartedAt = Date.now();
    let eventCount = 0;
    let toolCallCount = 0;
    let runId: string | undefined;

    // Merge request settings with saved settings
    const savedSettings = this.settingsService.getSettings();
    const mergedSettings = { ...savedSettings, ...data.settings };

    this.logger.log(
      `Run requested | client=${client.id} session=${data.sessionId} model=${data.model ?? 'default'} temperature=${mergedSettings.temperature}`,
    );

    try {
      if (!data.sessionId) {
        client.emit('run:error', {
          error: 'sessionId is required',
          sessionId: data.sessionId,
        });
        return;
      }

      const session = await this.sessionRepository.findById(data.sessionId);
      if (!session) {
        client.emit('run:error', {
          error: 'Session not found',
          sessionId: data.sessionId,
        });
        return;
      }

      const result = await this.agentService.runAgentStreaming({ ...data, settings: mergedSettings });
      runId = result.runId;
      const handle = result.handle;

      this.runToClient.set(runId, client.id);
      this.runToSession.set(runId, data.sessionId);

      client.emit('run:started', { runId, sessionId: data.sessionId });

      for await (const event of handle.events()) {
        eventCount++;

        if (event.type === 'tool.invoked') {
          toolCallCount++;
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

      const completed = await handle.completed;
      const durationMs = Date.now() - runStartedAt;

      const trackedEntry = this.runErrors.get(runId);
      const trackedError = trackedEntry?.error;
      if (trackedEntry) this.runErrors.delete(runId);

      const hasError =
        !completed ||
        (completed as any).error ||
        (completed as any).status === 'failed' ||
        trackedError;

      if (hasError) {
        const rawError =
          trackedError ||
          (completed as any)?.error ||
          (completed as any)?.output ||
          'Agent run failed';
        const errorMsg = extractActualErrorMessage(rawError);

        this.logger.error(
          `Run FAILED | runId=${runId} session=${data.sessionId} duration=${durationMs}ms events=${eventCount} tools=${toolCallCount} error=${errorMsg}`,
        );

        this.trackingService.completeRun({
          runId,
          status: 'failed',
          durationMs,
          errorMessage: errorMsg,
        });

        if (isSdkError(rawError)) {
          this.runErrors.set(runId, {
            error: errorMsg,
            code: rawError.code,
            retryable: rawError.retryable,
            timestamp: Date.now(),
          });
        } else {
          this.runErrors.set(runId, { error: errorMsg, timestamp: Date.now() });
        }

        client.emit('run:error', {
          error: errorMsg,
          sessionId: data.sessionId,
          runId,
        });
      } else {
        const inputTokens = completed?.usage?.inputTokens ?? 0;
        const outputTokens = completed?.usage?.outputTokens ?? 0;
        this.logger.log(
          `Run OK | runId=${runId} session=${data.sessionId} duration=${durationMs}ms events=${eventCount} tools=${toolCallCount} tokens=${inputTokens}+${outputTokens}`,
        );

        this.trackingService.completeRun({
          runId,
          status: 'succeeded',
          inputTokens: completed?.usage?.inputTokens,
          outputTokens: completed?.usage?.outputTokens,
          totalCost: completed?.usage?.cost,
          durationMs: completed?.usage?.durationMs ?? durationMs,
          toolCallsCount: completed?.usage?.toolCallsCount,
        });

        client.emit('run:completed', {
          ...completed,
          sessionId: data.sessionId,
          reasoningTokens: (completed as any)?.usage?.reasoningTokens,
          cacheReadTokens: (completed as any)?.usage?.cacheReadTokens,
          cacheWriteTokens: (completed as any)?.usage?.cacheWriteTokens,
          totalTokens: (completed as any)?.usage?.totalTokens,
          stopReason: (completed as any)?.stopReason,
        });
      }

      this.runToClient.delete(runId);
      this.runToSession.delete(runId);
    } catch (error) {
      const durationMs = Date.now() - runStartedAt;
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(
        `Run ERROR | client=${client.id} session=${data.sessionId} duration=${durationMs}ms error=${errorMsg}`,
      );
      if (runId) {
        // Mark run as failed in DB (prevents stuck "running" state)
        this.trackingService.completeRun({
          runId,
          status: 'failed',
          durationMs,
          errorMessage: errorMsg,
        });
        this.runToClient.delete(runId);
        this.runToSession.delete(runId);
        if (isSdkError(error)) {
          this.runErrors.set(runId, {
            error: errorMsg,
            code: error.code,
            retryable: error.retryable,
            timestamp: Date.now(),
          });
        } else {
          this.runErrors.set(runId, { error: errorMsg, timestamp: Date.now() });
        }
      }
      client.emit('run:error', {
        error: errorMsg,
        sessionId: data.sessionId,
        runId,
      });
    }
  }

  @SubscribeMessage('cancel')
  async handleCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runId: string },
  ) {
    try {
      this.logger.log(`Cancel requested by ${client.id} for run ${data.runId}`);
      const sessionId = this.runToSession.get(data.runId);
      await this.agentService.cancelRun(data.runId);
      client.emit('run:cancelled', { runId: data.runId, sessionId });
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Cancel failed for run ${data.runId}: ${errorMsg}`);
      client.emit('run:error', { error: errorMsg, runId: data.runId });
    }
  }

  @SubscribeMessage('messages')
  async handleMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    try {
      const messages = await this.agentService.getSessionMessages(data.sessionId);
      client.emit('messages', messages);
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Failed to get messages for session ${data.sessionId}: ${errorMsg}`);
      client.emit('run:error', { error: errorMsg, sessionId: data.sessionId });
    }
  }

  private transformEvent(
    event: any,
    runId: string,
    sessionId?: string,
  ): Record<string, unknown> | null {
    const type = event.type as string;
    const data = event.data;
    const base = sessionId ? { runId, sessionId } : { runId };

    switch (type) {
      case 'token.streamed':
        return {
          type: 'text',
          content: data?.content ?? data?.delta ?? '',
          ...base,
        };
      case 'tool.invoked':
        return {
          type: 'tool.invoked',
          toolName: data?.toolName,
          input: data?.input,
          ...base,
        };
      case 'tool.completed':
        return {
          type: 'tool.completed',
          toolName: data?.toolName,
          output: data?.output,
          ...base,
        };
      case 'tool.failed':
        return {
          type: 'tool.failed',
          toolName: data?.toolName,
          error: data?.error,
          ...base,
        };
      case 'thinking.content':
        return {
          type: 'thinking',
          content: data?.content,
          ...base,
        };
      default:
        if (
          type.startsWith('run.') ||
          type.startsWith('step.') ||
          type.startsWith('tool.') ||
          type.startsWith('thinking.')
        ) {
          return { type, data, ...base };
        }
        return null;
    }
  }

  private cleanupRunErrors() {
    const now = Date.now();
    for (const [runId, entry] of this.runErrors.entries()) {
      if (now - entry.timestamp > RUN_ERROR_TTL_MS) {
        this.runErrors.delete(runId);
      }
    }
  }
}
