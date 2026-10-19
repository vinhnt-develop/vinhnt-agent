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
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { AgentService } from '../services';
import { AgentRunTrackingService } from '../services/agent-run-tracking.service';
import { AgentSettingsService } from '../services/agent-settings.service';
import {
  extractBearerOrCookie,
  verifyAccessToken,
} from '@/common/guards/jwt-auth.guard';
import { extractActualErrorMessage } from '@/shared/error-utils';
import { ProjectPathService } from '@/shared/project-path.service';
import { SessionRepository } from '@/modules/session/repositories/session.repository';
import { SdkError, isSdkError } from '@vinhnt-sdk/schema';
import type { PermissionMode } from '@/shared/permission-mode';

/** Maximum age (ms) for runError entries before automatic cleanup. */
const RUN_ERROR_TTL_MS = 5 * 60 * 1000;

@WebSocketGateway({
  // P3.1: same origin policy as REST (env APP_CORS_ORIGIN; dev fallback =
  // webui on 2026) + credentials so the access_token cookie rides the
  // handshake. Real protection is the JWT check in handleConnection.
  cors: {
    origin: (process.env.APP_CORS_ORIGIN || 'http://localhost:2026')
      .split(',')
      .map((s) => s.trim()),
    credentials: true,
  },
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

  /** `${runId}:${toolId}` → invoke timestamp (durationMs for tool.* events). */
  private toolStartTimes = new Map<string, number>();

  /** `${runId}:${toolId}` → duration computed at completion, consumed by transform. */
  private toolResultDurations = new Map<string, number>();

  /** toolName → { source, risk } lazy catalog (TTL-refreshed). */
  private toolMetaCache: Map<string, { source: string; risk?: string }> | null =
    null;
  private toolMetaCacheAt = 0;

  constructor(
    private readonly agentService: AgentService,
    private readonly trackingService: AgentRunTrackingService,
    private readonly settingsService: AgentSettingsService,
    private readonly sessionRepository: SessionRepository,
    private readonly projectPathService: ProjectPathService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const eventBus = this.agentService.getEventBus();
    this.unsubscribe = eventBus.subscribeAll((event) => {
      try {
        const runId = (event as any).aggregateId as string | undefined;
        if (!runId) return;

        // Tool events flow through the EventBus (handle.events() only yields
        // agent.started/completed/error) — persist tool_executions here so
        // both WS and HTTP runs are tracked. Must run before the clientId
        // check below: rows are needed even when no client is attached.
        this.trackToolEvent(event, runId);
        // P6.1: usage facts (token.counted/model.cost/run.completed) must be
        // captured for HTTP runs too — runs without a WS client still need the
        // full terminal payload (reasoning/cache tokens, cost, stopReason).
        this.trackUsageEvent(event, runId);

        const clientId = this.runToClient.get(runId);
        if (!clientId) return;

        const sessionId = this.runToSession.get(runId);
        const transformed = this.transformEvent(event, runId, sessionId);
        if (transformed) {
          this.server?.to(clientId).emit('run:event', transformed);
        }

        // Derive a snapshot-style todo event from the todowrite tool output so
        // the UI can track the live task list (the SDK tool returns the full
        // `todos` list on every call — last-write-wins, no deltas).
        const todoUpdate = this.deriveTodoUpdate(event, runId, sessionId);
        if (todoUpdate) {
          this.server?.to(clientId).emit('run:event', todoUpdate);
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

  private trackToolEvent(event: { type?: string; data?: unknown }, runId: string): void {
    const type = event.type;
    if (type !== 'tool.invoked' && type !== 'tool.completed' && type !== 'tool.failed') return;
    const data = (event.data ?? {}) as Record<string, unknown>;
    const toolName = (data.toolName as string) || 'unknown';
    const toolCallId = (data.toolId as string) || undefined;
    const key = `${runId}:${toolCallId || toolName}`;

    if (type === 'tool.invoked') {
      this.toolStartTimes.set(key, Date.now());
      this.trackingService.startToolExecution({
        runId,
        toolCallId,
        toolName,
        toolInput: data.input as Record<string, unknown> | undefined,
      });
    } else {
      // Record duration for the WS transform (consumed once; purged if no client).
      const start = this.toolStartTimes.get(key);
      if (start !== undefined) {
        this.toolResultDurations.set(key, Date.now() - start);
        this.toolStartTimes.delete(key);
      }
      if (type === 'tool.completed') {
        this.trackingService.completeToolExecution({
          runId,
          toolName,
          toolOutput: data.output,
          status: 'completed',
        });
      } else {
        this.trackingService.completeToolExecution({
          runId,
          toolName,
          status: 'failed',
          errorMessage: data.error as string | undefined,
        });
      }
    }
  }

  private trackUsageEvent(event: { type?: string; data?: unknown }, runId: string): void {
    const type = event.type;
    if (type !== 'token.counted' && type !== 'model.cost' && type !== 'run.completed') return;
    const data = (event.data ?? {}) as Record<string, unknown>;
    if (type === 'token.counted') {
      this.trackingService.recordRunUsage(runId, {
        inputTokens: data.inputTokens as number | undefined,
        outputTokens: data.outputTokens as number | undefined,
        reasoningTokens: data.reasoningTokens as number | undefined,
        cacheReadTokens: data.cacheReadTokens as number | undefined,
        cacheWriteTokens: data.cacheWriteTokens as number | undefined,
        model: data.model as string | undefined,
        provider: data.provider as string | undefined,
      });
    } else if (type === 'model.cost') {
      this.trackingService.recordRunUsage(runId, {
        totalCost: data.cost as number | undefined,
        model: data.model as string | undefined,
        provider: data.provider as string | undefined,
      });
    } else {
      this.trackingService.recordRunUsage(runId, {
        stopReason: data.stopReason as string | undefined,
        provider: data.provider as string | undefined,
      });
    }
  }

  handleConnection(client: Socket) {
    // P3.1: WS handshake must carry a valid api access token (cookie
    // access_token / Authorization header / ?token=). Fail closed.
    const secret = this.configService.get<string>('auth.secret');
    if (!secret) {
      this.logger.warn(`Rejected WS connection (AUTH_NOT_CONFIGURED): ${client.id}`);
      client.disconnect(true);
      return;
    }
    const handshake = client.handshake;
    const queryToken = typeof handshake.query?.token === 'string' ? handshake.query.token : undefined;
    const cookieHeader = typeof handshake.headers.cookie === 'string' ? handshake.headers.cookie : undefined;
    const token =
      extractBearerOrCookie(handshake.headers.authorization, cookieHeader) ?? queryToken;
    if (!token) {
      this.logger.warn(`Rejected unauthenticated WS connection: ${client.id}`);
      client.disconnect(true);
      return;
    }
    try {
      verifyAccessToken(token, secret);
    } catch {
      this.logger.warn(`Rejected WS connection with invalid token: ${client.id}`);
      client.disconnect(true);
      return;
    }
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
      // P4.2: the client no longer sends `settings` — a client snapshot goes
      // stale the moment the user hits Save in Settings (it used to pin
      // maxTokens at 4096 even after Settings showed 16000). Kernel params
      // always come from the server-side saved settings; only explicit
      // per-run fields (permissionMode, selection, model) come from the client.
      permissionMode?: PermissionMode;
      selection?: {
        tools?: Array<{ id: string; name?: string; enabled?: boolean }>;
        knowledge?: Array<{ id: string; key?: string; enabled?: boolean }>;
      };
    },
  ) {
    const runStartedAt = Date.now();
    let eventCount = 0;
    let runId: string | undefined;

    const savedSettings = this.settingsService.getSettings();

    this.logger.log(
      `Run requested | client=${client.id} session=${data.sessionId} model=${data.model ?? 'default'} temperature=${savedSettings.temperature}`,
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

      const result = await this.agentService.runAgentStreaming({
        ...data,
        settings: savedSettings,
        projectPath: await this.projectPathService.resolve(data.sessionId),
        permissionMode: data.permissionMode,
      });
      runId = result.runId;
      const handle = result.handle;

      this.runToClient.set(runId, client.id);
      this.runToSession.set(runId, data.sessionId);

      client.emit('run:started', { runId, sessionId: data.sessionId });

      for await (const event of handle.events()) {
        eventCount++;
        // Tool.* events are persisted via onModuleInit's eventBus
        // subscription (handle.events() only yields agent.started/completed/
        // error) — no tracking here to avoid double-inserting rows.
      }

      const completed = await handle.completed;
      const durationMs = Date.now() - runStartedAt;

      const trackedEntry = this.runErrors.get(runId);
      const trackedError = trackedEntry?.error;
      if (trackedEntry) this.runErrors.delete(runId);

      const completedStatus = (completed as any)?.status as string | undefined;
      const isCancelled =
        completedStatus === 'cancelled' ||
        (completed as any)?.cancelled === true ||
        handle.isCancelled === true;

      const hasError =
        !completed ||
        (completed as any).error ||
        completedStatus === 'failed' ||
        trackedError;

      // User cancel wins over hasError: an aborted run unwinds with an
      // AbortError ("Run cancelled"), which previously flipped the status to
      // 'failed' right after cancelRun persisted 'cancelled'.
      if (isCancelled) {
        this.logger.log(
          `Run CANCELLED | runId=${runId} session=${data.sessionId} duration=${durationMs}ms events=${eventCount}`,
        );
        this.trackingService.completeRunFromResult({
          runId,
          status: 'cancelled',
          result: completed,
          durationMs,
          errorMessage: 'Run cancelled by user',
          stopReason: 'cancelled',
        });
        client.emit('run:cancelled', {
          runId,
          sessionId: data.sessionId,
        });
      } else if (hasError) {
        const rawError =
          trackedError ||
          (completed as any)?.error ||
          (completed as any)?.output ||
          'Agent run failed';
        const errorMsg = extractActualErrorMessage(rawError);

        this.logger.error(
          `Run FAILED | runId=${runId} session=${data.sessionId} duration=${durationMs}ms events=${eventCount} tools=${this.trackingService.getToolCallsCount(runId) ?? 0} error=${errorMsg}`,
        );

        this.trackingService.completeRunFromResult({
          runId,
          status: 'failed',
          result: completed,
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

        // P0.4: carry the structured code/retryable across the wire so the UI
        // can branch on stable codes instead of string-matching messages.
        const errCode = isSdkError(rawError) ? rawError.code : trackedEntry?.code;
        const errRetryable = isSdkError(rawError)
          ? rawError.retryable
          : trackedEntry?.retryable;
        client.emit('run:error', {
          error: errorMsg,
          sessionId: data.sessionId,
          runId,
          ...(errCode !== undefined ? { code: errCode } : {}),
          ...(errRetryable !== undefined ? { retryable: errRetryable } : {}),
        });
      } else {
        // P6.1: single payload builder — persists the full usage set (WS path
        // used to drop reasoning/cache tokens + cost + stopReason here), then
        // reuses the same values for the client emit.
        const payload = this.trackingService.completeRunFromResult({
          runId,
          result: completed,
          durationMs,
        });
        this.logger.log(
          `Run OK | runId=${runId} session=${data.sessionId} duration=${durationMs}ms events=${eventCount} tools=${this.trackingService.getToolCallsCount(runId) ?? 0} tokens=${payload.inputTokens ?? 0}+${payload.outputTokens ?? 0}`,
        );

        client.emit('run:completed', {
          ...completed,
          sessionId: data.sessionId,
          inputTokens: payload.inputTokens,
          outputTokens: payload.outputTokens,
          reasoningTokens: payload.reasoningTokens,
          cacheReadTokens: payload.cacheReadTokens,
          cacheWriteTokens: payload.cacheWriteTokens,
          totalTokens: payload.totalTokens,
          totalCost: payload.totalCost,
          stopReason: payload.stopReason,
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
        this.trackingService.completeRunFromResult({
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
        // P0.4: structured error info on the throw path as well.
        ...(isSdkError(error) ? { code: error.code, retryable: error.retryable } : {}),
      });
    }
  }

  /**
   * P3.3: re-attach a live run to a new socket after a disconnect/reconnect.
   * Events are routed via runToClient (socket-id keyed); handleDisconnect
   * drops the mapping, so a mid-run blip orphans the run and the UI spins
   * forever. The client emits run:attach with the sessionId; we rebind any
   * still-active run (or answer runId: null when it already finished while
   * the client was away — the client then finalizes from REST).
   */
  @SubscribeMessage('run:attach')
  handleAttach(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId?: string },
  ) {
    const sessionId = data.sessionId;
    if (!sessionId) {
      client.emit('run:attach', { sessionId, runId: null });
      return;
    }
    const active = this.trackingService.findActiveRunForSession(sessionId);
    if (!active) {
      this.logger.log(`Attach: no active run for session ${sessionId}`);
      client.emit('run:attach', { sessionId, runId: null });
      return;
    }
    // P4.2: only rebind when THIS process holds a live handle. A DB row that
    // says 'running' after a restart is an orphan — the UI would spin forever
    // waiting for events that will never come. Answer resumable:true so the
    // client can offer Resume (POST /agent/resume) instead of hanging.
    if (!this.agentService.isRunActive(active.id)) {
      this.logger.log(
        `Attach: run ${active.id} for session ${sessionId} is in DB but not live in this process — marking resumable`,
      );
      client.emit('run:attach', { sessionId, runId: null, resumable: true, resumableRunId: active.id });
      return;
    }
    this.runToClient.set(active.id, client.id);
    this.runToSession.set(active.id, sessionId);
    this.logger.log(`Attach: run ${active.id} rebound to ${client.id}`);
    client.emit('run:attach', { sessionId, runId: active.id });
  }

  /**
   * P4.2: resume a crashed/interrupted run over WS. Reuses the same
   * AgentService.resumeRun path as REST; events flow through the existing
   * EventBus subscription (onModuleInit) so no new streaming plumbing.
   */
  @SubscribeMessage('run:resume')
  async handleResume(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runId: string; prompt?: string; model?: string; provider?: string; permissionMode?: PermissionMode },
  ) {
    try {
      if (!data?.runId) {
        client.emit('run:error', { error: 'runId is required to resume' });
        return;
      }
      this.logger.log(`Resume requested by ${client.id} for run ${data.runId}`);
      const settings = this.settingsService.getSettings();
      const result = await this.agentService.resumeRun({
        runId: data.runId,
        prompt: data.prompt ?? '',
        model: data.model,
        provider: data.provider,
        permissionMode: data.permissionMode,
        settings,
      });
      if (result.status === 'failed') {
        client.emit('run:error', { runId: data.runId, error: result.output ?? result.error ?? 'Resume failed' });
        return;
      }
      // Bind this client to the resumed run so subsequent events route here.
      this.runToClient.set(data.runId, client.id);
      const sessionId = (result as { sessionId?: string }).sessionId;
      if (sessionId) this.runToSession.set(data.runId, sessionId);
      client.emit('run:resumed', { runId: data.runId, sessionId, status: result.status });
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Resume failed for run ${data.runId}: ${errorMsg}`);
      client.emit('run:error', { runId: data.runId, error: errorMsg });
    }
  }

  @SubscribeMessage('cancel')
  async handleCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runId?: string; sessionId?: string },
  ) {
    try {
      this.logger.log(
        `Cancel requested by ${client.id} for ${data.runId ? `run ${data.runId}` : `session ${data.sessionId}`}`,
      );
      const result = await this.agentService.cancelActiveRun({
        runId: data.runId,
        sessionId: data.sessionId,
      });
      const runId = result.runId ?? data.runId;
      const sessionId = (runId ? this.runToSession.get(runId) : undefined) ?? data.sessionId;

      if (result.status === 'cancelled') {
        client.emit('run:cancelled', { runId, sessionId });
      } else if (result.status === 'succeeded' || result.status === 'failed') {
        // Answer from persisted status so the client gets an honest,
        // idempotent reply instead of a scary error after a successful Stop.
        client.emit('run:error', {
          error: `Run already ${result.status} — cannot cancel`,
          runId,
          sessionId,
        });
      } else {
        client.emit('run:error', {
          error: 'Run not found or already completed — cannot cancel',
          runId,
          sessionId,
        });
      }
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Cancel failed for run ${data.runId}: ${errorMsg}`);
      client.emit('run:error', { error: errorMsg, runId: data.runId, sessionId: data.sessionId });
    }
  }

  /**
   * Steer a live run over the socket (queue/steer): the message is injected
   * into the running kernel and drained at the next step boundary. The ack
   * tells the client whether it landed; on failure the client starts a fresh
   * run instead of losing the text.
   */
  @SubscribeMessage('run:input')
  async handleRunInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId?: string; runId?: string; message: string },
  ): Promise<{
    ok: boolean;
    queued: boolean;
    runId?: string;
    status: string;
    error?: string;
  }> {
    try {
      if (!data?.message || typeof data.message !== 'string') {
        return { ok: false, queued: false, status: 'empty', error: 'message is required' };
      }
      const result = await this.agentService.sendRunInput({
        sessionId: data.sessionId,
        runId: data.runId,
        message: data.message,
      });
      this.logger.log(
        `run:input from ${client.id} → status=${result.status} run=${result.runId ?? 'n/a'}`,
      );
      return {
        ok: result.queued,
        queued: result.queued,
        runId: result.runId,
        status: result.status,
      };
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`run:input failed: ${errorMsg}`);
      return { ok: false, queued: false, status: 'error', error: errorMsg };
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

  /**
   * Resolve a pending tool-approval request over the socket (mirror of
   * `POST /agent/permissions/:id/reply`). The returned value is delivered as
   * the Socket.IO ack; the authoritative `permission.replied` run event still
   * streams via the normal fan-out.
   */
  @SubscribeMessage('permission.reply')
  handlePermissionReply(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { id: string; reply: 'once' | 'always' | 'reject'; reason?: string },
  ): { ok: true; id: string } | { ok: false; error: string } {
    try {
      if (!data?.id) return { ok: false, error: 'id is required' };
      if (!data.reply || !['once', 'always', 'reject'].includes(data.reply)) {
        return { ok: false, error: 'reply must be one of: once, always, reject' };
      }
      if (data.reason !== undefined && typeof data.reason !== 'string') {
        return { ok: false, error: 'reason must be a string when provided' };
      }
      const store = this.agentService.getAgentToolkit().getApprovalStore();
      if (!store.getRequest(data.id)) {
        return { ok: false, error: 'Permission request not found or already resolved' };
      }
      store.resolveRequest(data.id, data.reply, data.reason);
      this.logger.log(`Permission ${data.id} resolved via WS from ${client.id}: ${data.reply}`);
      return { ok: true, id: data.id };
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Permission reply failed for ${data?.id}: ${errorMsg}`);
      return { ok: false, error: errorMsg };
    }
  }

  /**
   * Answer a pending agent question over the socket (mirror of
   * `POST /agent/questions/:id/reply`).
   */
  @SubscribeMessage('question.reply')
  handleQuestionReply(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      id: string;
      action: 'accept' | 'decline' | 'cancel';
      answers?: Array<{ header: string; selected: string[]; text?: string }>;
    },
  ): { ok: true; id: string } | { ok: false; error: string } {
    try {
      if (!data?.id) return { ok: false, error: 'id is required' };
      if (!data.action || !['accept', 'decline', 'cancel'].includes(data.action)) {
        return { ok: false, error: 'action must be one of: accept, decline, cancel' };
      }
      if (data.action === 'accept' && (!data.answers || data.answers.length === 0)) {
        return { ok: false, error: 'answers are required when action is "accept"' };
      }
      const store = this.agentService.getAgentToolkit().getQuestionStore();
      if (!store.getRequest(data.id)) {
        return { ok: false, error: 'Question request not found or already resolved' };
      }
      store.resolveRequest(data.id, {
        action: data.action,
        ...(data.answers ? { answers: data.answers } : {}),
      });
      this.logger.log(`Question ${data.id} resolved via WS from ${client.id}: ${data.action}`);
      return { ok: true, id: data.id };
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Question reply failed for ${data?.id}: ${errorMsg}`);
      return { ok: false, error: errorMsg };
    }
  }

  /**
   * Decide a pending agent plan over the socket (mirror of
   * `POST /agent/plans/:id/decision`).
   */
  @SubscribeMessage('plan.decision')
  handlePlanDecision(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      id: string;
      decision: 'approve' | 'request_changes' | 'cancel';
      feedback?: string;
    },
  ): { ok: true; id: string } | { ok: false; error: string } {
    try {
      if (!data?.id) return { ok: false, error: 'id is required' };
      if (!data.decision || !['approve', 'request_changes', 'cancel'].includes(data.decision)) {
        return { ok: false, error: 'decision must be one of: approve, request_changes, cancel' };
      }
      const store = this.agentService.getAgentToolkit().getPlanApprovalStore();
      if (!store.getRequest(data.id)) {
        return { ok: false, error: 'Plan request not found or already resolved' };
      }
      store.resolveRequest(data.id, {
        decision: data.decision,
        ...(data.feedback ? { feedback: data.feedback } : {}),
      });
      this.logger.log(`Plan ${data.id} decided via WS from ${client.id}: ${data.decision}`);
      return { ok: true, id: data.id };
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Plan decision failed for ${data?.id}: ${errorMsg}`);
      return { ok: false, error: errorMsg };
    }
  }

  /**
   * Turn a completed `todowrite` tool call into a `todo.updated` snapshot event
   * for the UI. The SDK tool returns the full task list in its output, so this
   * is a pure projection — no new state, last-write-wins.
   */
  private deriveTodoUpdate(
    event: any,
    runId: string,
    sessionId?: string,
  ): Record<string, unknown> | null {
    if (event?.type !== 'tool.completed') return null;
    const data = event.data as Record<string, unknown> | undefined;
    if (!data || data.toolName !== 'todowrite') return null;
    const output = data.output as { todos?: unknown } | undefined;
    if (!output || !Array.isArray(output.todos)) return null;
    return {
      type: 'todo.updated',
      todos: output.todos,
      ...(sessionId ? { runId, sessionId } : { runId }),
    };
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
      case 'tool.invoked': {
        const toolId = data?.toolId as string | undefined;
        const meta = this.getToolMeta(String(data?.toolName ?? ''));
        return {
          type: 'tool.invoked',
          toolName: data?.toolName,
          toolId,
          input: data?.input,
          ...meta,
          // E3: prefer provenance carried by the SDK event; catalog is fallback.
          ...(data?.source !== undefined ? { source: data.source } : {}),
          ...(data?.risk !== undefined ? { risk: data.risk } : {}),
          ...base,
        };
      }
      case 'tool.completed': {
        const toolId = data?.toolId as string | undefined;
        const meta = this.getToolMeta(String(data?.toolName ?? ''));
        return {
          type: 'tool.completed',
          toolName: data?.toolName,
          toolId,
          output: data?.output,
          // Prefer SDK-computed duration (E3); timing-map is fallback.
          durationMs:
            data?.durationMs ??
            this.takeToolDuration(runId, toolId, data?.toolName),
          ...meta,
          ...(data?.source !== undefined ? { source: data.source } : {}),
          ...(data?.risk !== undefined ? { risk: data.risk } : {}),
          ...base,
        };
      }
      case 'tool.failed': {
        const toolId = data?.toolId as string | undefined;
        const meta = this.getToolMeta(String(data?.toolName ?? ''));
        return {
          type: 'tool.failed',
          toolName: data?.toolName,
          toolId,
          error: data?.error,
          // Prefer SDK-computed duration (E3); timing-map is fallback.
          durationMs:
            data?.durationMs ??
            this.takeToolDuration(runId, toolId, data?.toolName),
          ...meta,
          ...(data?.source !== undefined ? { source: data.source } : {}),
          ...(data?.risk !== undefined ? { risk: data.risk } : {}),
          ...base,
        };
      }
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
          type.startsWith('thinking.') ||
          type.startsWith('llm.') ||
          type.startsWith('permission.') ||
          type.startsWith('question.') ||
          type.startsWith('plan.') ||
          type === 'todo.updated' ||
          type === 'token.counted' ||
          type === 'model.cost' ||
          type === 'agent.handoff' ||
          type === 'context.compressed'
        ) {
          return { type, data, ...base, ...(event?.id ? { id: event.id } : {}) };
        }
        return null;
    }
  }

  /**
   * Lazy tool catalog: toolName → { source, risk }, refreshed every 15s so
   * MCP/custom tool registration is picked up without a restart.
   */
  private getToolMeta(
    toolName: string,
  ): { source?: string; risk?: string } {
    const now = Date.now();
    if (!this.toolMetaCache || now - this.toolMetaCacheAt > 15_000) {
      const cache = new Map<string, { source: string; risk?: string }>();
      try {
        const defs = (this.agentService
          .getAgentToolkit()
          .getToolsAsDefinitions() ?? []) as Array<{
          id?: string;
          name?: string;
          risk?: string;
          metadata?: { source?: string };
        }>;
        for (const t of defs) {
          const id = String(t.id || t.name || '');
          if (!id) continue;
          cache.set(id, {
            source:
              (t.metadata?.source as string) ||
              (id.startsWith('custom_')
                ? 'custom'
                : id.startsWith('mcp__')
                  ? 'mcp'
                  : 'system'),
            risk: t.risk,
          });
        }
      } catch {
        // toolkit unavailable — fall through with empty cache
      }
      this.toolMetaCache = cache;
      this.toolMetaCacheAt = now;
    }
    const hit = toolName ? this.toolMetaCache.get(toolName) : undefined;
    return hit ? { ...hit } : {};
  }

  /** Consume a completion duration recorded by trackToolEvent (once). */
  private takeToolDuration(
    runId: string,
    toolId?: string,
    toolName?: unknown,
  ): number | undefined {
    const key = `${runId}:${toolId || String(toolName || '')}`;
    const dur = this.toolResultDurations.get(key);
    if (dur !== undefined) {
      this.toolResultDurations.delete(key);
      return dur;
    }
    return undefined;
  }

  private cleanupRunErrors() {
    const now = Date.now();
    for (const [runId, entry] of this.runErrors.entries()) {
      if (now - entry.timestamp > RUN_ERROR_TTL_MS) {
        this.runErrors.delete(runId);
      }
    }
    // Purge orphaned tool timing entries (no client attached / event lost).
    for (const [key, ts] of this.toolStartTimes.entries()) {
      if (now - ts > RUN_ERROR_TTL_MS) this.toolStartTimes.delete(key);
    }
    for (const [key, ts] of this.toolResultDurations.entries()) {
      if (now - ts > RUN_ERROR_TTL_MS) this.toolResultDurations.delete(key);
    }
  }
}
