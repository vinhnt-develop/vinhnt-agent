import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AgentRunRepository } from '../repositories/agent-run.repository';
import { ToolExecutionRepository } from '../repositories/tool-execution.repository';

interface PendingToolExecution {
  id: string;
  startedAt: number;
  toolName: string;
  runId?: string;
}

/** Per-run usage facts observed on the EventBus before terminal completion. */
interface RunUsageAccum {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalCost?: number;
  model?: string;
  provider?: string;
  stopReason?: string;
}

/**
 * Structural view of a `handle.completed` result — the SDK's AgentRunResult
 * nests metrics under `usage`, but call sites historically also read flat
 * legacy fields, so both are accepted.
 */
interface CompletedRunResultLike {
  status?: string;
  cancelled?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  durationMs?: number;
  stopReason?: string;
  usage?: {
    totalSteps?: number;
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalTokens?: number;
    cost?: number;
    toolCallsCount?: number;
    model?: string;
    provider?: string;
    stopReason?: string;
  };
}

/** Full terminal payload every call site funnels through (P6.1). */
export interface CompleteRunPayload {
  runId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens?: number;
  totalCost?: number;
  durationMs?: number;
  toolCallsCount?: number;
  errorMessage?: string;
  stopReason?: string;
  metadata?: Record<string, unknown>;
  model?: string;
  provider?: string;
}

/**
 * First non-zero numeric source. `0` means "provider didn't report" (LM
 * Studio user-message limitation) — fall through, matching the `||` chains
 * the call sites used before consolidation.
 */
function firstNonZero(...values: Array<number | undefined>): number | undefined {
  for (const value of values) {
    if (value) return value;
  }
  return undefined;
}

@Injectable()
export class AgentRunTrackingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AgentRunTrackingService.name);
  /** Pending tool executions keyed by unique invocation ID. */
  private readonly pendingToolExecutions = new Map<string, PendingToolExecution>();
  /** runId → sessionId (so tool rows get a session even if caller omits it). */
  private readonly runSessions = new Map<string, string>();
  /** runId → tool invocations observed so far (fallback for tool_calls_count). */
  private readonly runToolCounts = new Map<string, number>();
  /** runId → usage facts from token.counted / model.cost / run.completed events. */
  private readonly runUsageAccums = new Map<string, RunUsageAccum>();
  /** Sub-agent runs observed through the bus (parentRunId present). */
  private readonly childRunIds = new Set<string>();

  constructor(
    private readonly agentRunRepository: AgentRunRepository,
    private readonly toolExecutionRepository: ToolExecutionRepository,
  ) {}

  /**
   * Boot reconciliation: no run can be live before the app serves traffic, so
   * any row still 'running' is a crash remnant. Keep agent runs resumable
   * ('interrupted') while closing their tool rows so the timeline stops
   * spinning.
   */
  onApplicationBootstrap(): void {
    try {
      const running = this.agentRunRepository.findRunning();
      if (running.length === 0) return;
      this.agentRunRepository.interruptAllRunning();
      this.toolExecutionRepository.failAllRunning();
      this.logger.warn(
        `Marked ${running.length} orphan run(s) interrupted after restart; resumable via /agent/resume`,
      );
    } catch (error) {
      this.logger.warn(`Boot run reconciliation failed: ${error}`);
    }
  }

  /**
   * Concurrency guard for a session: reap stale 'running' zombies first (so a
   * stuck row can't block the session forever), then return the live run that
   * must block a new one. Returns null when a new run may start.
   */
  findActiveRunForSession(sessionId: string): { id: string } | null {
    this.agentRunRepository.cleanupStaleRuns(sessionId);
    const active = this.agentRunRepository.findActiveBySessionId(sessionId);
    return active ? { id: active.id } : null;
  }

  /** Persisted status of a run ('running' | 'succeeded' | 'failed' | 'cancelled' | ...). */
  getRunStatus(runId: string): string | undefined {
    try {
      return this.agentRunRepository.findById(runId)?.status ?? undefined;
    } catch (error) {
      this.logger.warn(`Failed to read run status for ${runId}: ${error}`);
      return undefined;
    }
  }

  /** Full persisted row for a run (for resume validation). */
  getRunRow(runId: string): { id: string; sessionId: string | null; status: string | null; startedAt?: string | null; model?: string | null; provider?: string | null; toolCallsCount?: number | null } | undefined {
    try {
      return this.agentRunRepository.findById(runId);
    } catch (error) {
      this.logger.warn(`Failed to read run row for ${runId}: ${error}`);
      return undefined;
    }
  }

  /** All runs still marked 'running' in the DB (boot recovery / resumable list). */
  findRunningRuns(): Array<{ id: string; sessionId: string | null; status: string | null; model?: string | null; provider?: string | null }> {
    try {
      return this.agentRunRepository.findRunning();
    } catch (error) {
      this.logger.warn(`Failed to list running runs: ${error}`);
      return [];
    }
  }

  /** Latest interrupted run for a session, if it can still be resumed. */
  findInterruptedRunForSession(
    sessionId: string,
  ): { id: string; sessionId: string | null; status: string | null; startedAt?: string | null; model?: string | null; provider?: string | null } | undefined {
    try {
      return this.agentRunRepository.findInterruptedBySessionId(sessionId);
    } catch (error) {
      this.logger.warn(`Failed to find interrupted run for ${sessionId}: ${error}`);
      return undefined;
    }
  }

  /** Flip an interrupted run back to 'running' before resuming its kernel. */
  markRunRunning(runId: string): void {
    try {
      this.agentRunRepository.markRunning(runId);
    } catch (error) {
      this.logger.warn(`Failed to mark run ${runId} running: ${error}`);
    }
  }

  /** Clear older interrupted runs when a fresh run starts in the session. */
  dismissInterruptedRuns(sessionId: string): void {
    try {
      this.agentRunRepository.dismissInterruptedForSession(sessionId);
    } catch (error) {
      this.logger.warn(`Failed to dismiss interrupted runs for ${sessionId}: ${error}`);
    }
  }

  startRun(data: {
    runId: string;
    sessionId: string;
    parentRunId?: string;
    agentId?: string;
    traceId?: string;
    model?: string;
    provider?: string;
    triggerType?: string;
  }): void {
    try {
      this.dismissInterruptedRuns(data.sessionId);
      this.runSessions.set(data.runId, data.sessionId);
      this.agentRunRepository.create({
        id: data.runId,
        sessionId: data.sessionId,
        parentRunId: data.parentRunId,
        agentId: data.agentId,
        traceId: data.traceId,
        status: 'running',
        triggerType: data.triggerType || 'http',
        model: data.model,
        provider: data.provider,
        startedAt: new Date().toISOString(),
      });
      this.logger.debug(`Agent run started: ${data.runId}`);
    } catch (error) {
      this.logger.warn(`Failed to track run start: ${error}`);
    }
  }

  /**
   * Persist a sub-agent run discovered from `run.started`. Top-level runs are
   * created by AgentService before the kernel emits; children only exist on the
   * bus, so this is the writer that makes the Agent tree durable.
   */
  startChildRun(data: {
    runId: string;
    sessionId?: string;
    parentRunId: string;
    agentId?: string;
    traceId?: string;
    model?: string;
    provider?: string;
    /** P1.1 execution contract; persisted as agent_runs.metadata.subAgent. */
    subAgent?: Record<string, unknown>;
  }): void {
    if (!data.sessionId) {
      this.logger.warn(`Skipping child run ${data.runId}: missing sessionId`);
      return;
    }
    try {
      this.runSessions.set(data.runId, data.sessionId);
      this.agentRunRepository.createIfAbsent({
        id: data.runId,
        sessionId: data.sessionId,
        parentRunId: data.parentRunId,
        agentId: data.agentId,
        traceId: data.traceId,
        status: 'running',
        triggerType: 'subagent',
        model: data.model,
        provider: data.provider,
        startedAt: new Date().toISOString(),
        ...(data.subAgent ? { metadata: { subAgent: data.subAgent } } : {}),
      });
      this.childRunIds.add(data.runId);
      this.logger.debug(`Child run started: ${data.runId} parent=${data.parentRunId}`);
    } catch (error) {
      this.logger.warn(`Failed to track child run start: ${error}`);
    }
  }

  /** Complete a sub-agent row created by {@link startChildRun}. */
  completeChildRun(data: {
    runId: string;
    result?: unknown;
    status?: 'succeeded' | 'failed' | 'cancelled';
    errorMessage?: string;
    stopReason?: string;
  }): boolean {
    if (!this.childRunIds.has(data.runId)) return false;
    try {
      this.completeRunFromResult(data);
      this.logger.debug(`Child run completed: ${data.runId}`);
      return true;
    } finally {
      this.childRunIds.delete(data.runId);
    }
  }

  completeRun(data: {
    runId: string;
    status: 'succeeded' | 'failed' | 'cancelled';
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalTokens?: number;
    totalCost?: number;
    durationMs?: number;
    toolCallsCount?: number;
    errorMessage?: string;
    stopReason?: string;
    errorMetadata?: { code?: string; retryable?: boolean };
    metadata?: Record<string, unknown>;
  }): void {
    try {
      const metadata = {
        ...data.metadata,
        ...(data.errorMetadata ? { errorMetadata: data.errorMetadata } : {}),
      };

      // Update model/provider from actual API response (metadata.model/provider)
      // This ensures trajectory shows the real model used, not just the config default
      const actualModel = data.metadata?.model as string | undefined;
      const actualProvider = data.metadata?.provider as string | undefined;

      // handle.completed.usage.toolCallsCount is undefined today (SDK never
      // sets it) — fall back to the count observed from tool.* events.
      const toolCallsCount = data.toolCallsCount ?? this.runToolCounts.get(data.runId) ?? 0;

      const updatePayload: Record<string, unknown> = {
        status: data.status,
        ...(actualModel ? { model: actualModel } : {}),
        ...(actualProvider ? { provider: actualProvider } : {}),
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        reasoningTokens: data.reasoningTokens,
        cacheReadTokens: data.cacheReadTokens,
        cacheWriteTokens: data.cacheWriteTokens,
        totalTokens: data.totalTokens,
        totalCost: data.totalCost,
        durationMs: data.durationMs,
        toolCallsCount,
        errorMessage: data.errorMessage,
        stopReason: data.stopReason,
        completedAt: new Date().toISOString(),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };

      // Success overwrites any prior "Run timed out (stale)" leftover —
      // otherwise UI shows green check + stale error forever.
      if (data.status === 'succeeded' && data.errorMessage === undefined) {
        updatePayload.errorMessage = null;
        updatePayload.stopReason = data.stopReason ?? null;
      }

      this.agentRunRepository.update(data.runId, updatePayload as never);

      // A cancelled run can leave tool rows stuck at 'running' (the tool
      // never resumes to emit tool.completed) — close them so the timeline
      // doesn't show permanently pulsing steps.
      if (data.status === 'cancelled' || data.status === 'failed') {
        try {
          this.toolExecutionRepository.cancelRunningByRunId(
            data.runId,
            data.status === 'cancelled' ? 'cancelled' : 'failed',
            data.status === 'cancelled' ? 'Run cancelled by user' : 'Run failed',
          );
        } catch (error) {
          this.logger.warn(`Failed to close running tool rows for ${data.runId}: ${error}`);
        }
        for (const [key, entry] of this.pendingToolExecutions) {
          if (entry.runId === data.runId) this.pendingToolExecutions.delete(key);
        }
      }

      this.runSessions.delete(data.runId);
      this.runToolCounts.delete(data.runId);
      this.runUsageAccums.delete(data.runId);
      this.logger.debug(`Agent run completed: ${data.runId} status=${data.status}`);
    } catch (error) {
      this.logger.warn(`Failed to track run completion: ${error}`);
    }
  }

  /**
   * Accumulate per-run usage facts observed on the EventBus (token.counted /
   * model.cost / run.completed) so terminal completion can persist reasoning +
   * cache tokens, cost and stopReason on BOTH WS and HTTP paths (P6.1).
   * Numeric fields SUM across per-call events; model/provider/stopReason are
   * last-wins. Cleared by completeRun.
   */
  recordRunUsage(
    runId: string,
    data: {
      inputTokens?: number;
      outputTokens?: number;
      reasoningTokens?: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
      totalCost?: number;
      model?: string;
      provider?: string;
      stopReason?: string;
    },
  ): void {
    try {
      if (Object.values(data).every((value) => value === undefined)) return;
      const current = this.runUsageAccums.get(runId) ?? {};
      const sum = (a?: number, b?: number): number | undefined =>
        b === undefined ? a : a === undefined ? b : a + b;
      this.runUsageAccums.set(runId, {
        inputTokens: sum(current.inputTokens, data.inputTokens),
        outputTokens: sum(current.outputTokens, data.outputTokens),
        reasoningTokens: sum(current.reasoningTokens, data.reasoningTokens),
        cacheReadTokens: sum(current.cacheReadTokens, data.cacheReadTokens),
        cacheWriteTokens: sum(current.cacheWriteTokens, data.cacheWriteTokens),
        totalCost: sum(current.totalCost, data.totalCost),
        model: data.model ?? current.model,
        provider: data.provider ?? current.provider,
        stopReason: data.stopReason ?? current.stopReason,
      });
    } catch (error) {
      this.logger.warn(`Failed to accumulate run usage for ${runId}: ${error}`);
    }
  }

  /**
   * Single terminal-completion entry point (P6.1) — every call site in
   * AgentService/AgentGateway funnels here so WS and HTTP runs persist the
   * SAME full payload instead of partial subsets (the WS path used to drop
   * reasoning/cache tokens, cost and stopReason entirely).
   *
   * Per-field source priority (first hit wins):
   *   kernel `usage` → EventBus aggregates (token.counted/model.cost/run.completed)
   *   → fallback (last-assistant message, HTTP path) → undefined.
   *
   * Returns the payload that was persisted (callers reuse it for the WS
   * `run:completed` emit / HTTP response instead of re-reading `result`).
   */
  completeRunFromResult(data: {
    runId: string;
    /** Explicit terminal status; derived from `result` when omitted. */
    status?: 'succeeded' | 'failed' | 'cancelled';
    /** `handle.completed` value — omitted on catch paths where it is out of scope. */
    result?: unknown;
    /** Wall-clock duration fallback when neither usage nor result carry one. */
    durationMs?: number;
    errorMessage?: string;
    stopReason?: string;
    /** Session last-assistant-message values (HTTP path) — lowest-priority source. */
    fallback?: {
      inputTokens?: number;
      outputTokens?: number;
      reasoningTokens?: number;
      cost?: number;
      model?: string;
      provider?: string;
    };
    metadata?: Record<string, unknown>;
  }): CompleteRunPayload {
    const result = (data.result ?? {}) as CompletedRunResultLike;
    const usage = result.usage;
    const accum = this.runUsageAccums.get(data.runId);
    const fallback = data.fallback;

    const status: 'succeeded' | 'failed' | 'cancelled' =
      data.status ??
      (result.status === 'cancelled' || result.cancelled === true
        ? 'cancelled'
        : result.status === 'failed'
          ? 'failed'
          : 'succeeded');

    const inputTokens = firstNonZero(
      usage?.inputTokens,
      result.inputTokens,
      accum?.inputTokens,
      fallback?.inputTokens,
    );
    const outputTokens = firstNonZero(
      usage?.outputTokens,
      result.outputTokens,
      accum?.outputTokens,
      fallback?.outputTokens,
    );
    const reasoningTokens = firstNonZero(
      usage?.reasoningTokens,
      result.reasoningTokens,
      accum?.reasoningTokens,
      fallback?.reasoningTokens,
    );
    const cacheReadTokens = firstNonZero(usage?.cacheReadTokens, accum?.cacheReadTokens);
    const cacheWriteTokens = firstNonZero(usage?.cacheWriteTokens, accum?.cacheWriteTokens);
    const hasTokens =
      inputTokens !== undefined || outputTokens !== undefined || reasoningTokens !== undefined;
    const totalTokens =
      usage?.totalTokens ??
      (hasTokens
        ? (inputTokens ?? 0) + (outputTokens ?? 0) + (reasoningTokens ?? 0)
        : undefined);
    const totalCost = firstNonZero(usage?.cost, accum?.totalCost, fallback?.cost);
    const model = usage?.model ?? accum?.model ?? fallback?.model;
    const provider = usage?.provider ?? accum?.provider ?? fallback?.provider;
    const stopReason =
      data.stopReason ??
      usage?.stopReason ??
      accum?.stopReason ??
      (status === 'cancelled' ? 'cancelled' : undefined);
    // Kernel-measured loop duration beats wall-clock (post-processing skew).
    const durationMs = usage?.durationMs ?? result.durationMs ?? data.durationMs;

    const payload: CompleteRunPayload = {
      runId: data.runId,
      status,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cacheReadTokens,
      cacheWriteTokens,
      totalTokens,
      totalCost,
      durationMs,
      toolCallsCount: usage?.toolCallsCount,
      errorMessage: data.errorMessage,
      stopReason,
      metadata: {
        ...data.metadata,
        ...(model ? { model } : {}),
        ...(provider ? { provider } : {}),
      },
      model,
      provider,
    };
    this.completeRun(payload);
    return payload;
  }

  /** Tool invocations observed so far for a run (undefined if unknown). */
  getToolCallsCount(runId: string): number | undefined {
    return this.runToolCounts.get(runId);
  }

  /**
   * Seed the in-memory tool counter from the persisted row before resuming.
   * Without this, a resumed run that executes tools reports only the calls made
   * after the restart and overwrites the pre-crash count with a smaller value.
   */
  seedToolCallsCount(runId: string, count?: number | null): void {
    if (!count || count < 1) return;
    this.runToolCounts.set(runId, count);
  }

  startToolExecution(data: {
    runId?: string;
    sessionId?: string;
    toolCallId?: string;
    toolName: string;
    toolInput?: Record<string, unknown>;
  }): string | null {
    try {
      if (data.runId) {
        this.runToolCounts.set(data.runId, (this.runToolCounts.get(data.runId) ?? 0) + 1);
      }
      const id = crypto.randomUUID();
      this.toolExecutionRepository.create({
        id,
        runId: data.runId,
        sessionId: data.sessionId ?? (data.runId ? this.runSessions.get(data.runId) : undefined),
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        toolInput: data.toolInput,
        status: 'running',
        startedAt: new Date().toISOString(),
      });
      // Use unique ID as key — supports concurrent calls of the same tool
      this.pendingToolExecutions.set(id, {
        id,
        startedAt: Date.now(),
        toolName: data.toolName,
        runId: data.runId,
      });
      this.logger.debug(`Tool execution started: ${data.toolName} id=${id}`);
      return id;
    } catch (error) {
      this.logger.warn(`Failed to track tool start: ${error}`);
      return null;
    }
  }

  completeToolExecution(data: {
    runId?: string;
    toolName: string;
    toolOutput?: unknown;
    status?: 'completed' | 'failed';
    errorMessage?: string;
  }): void {
    try {
      // Find the oldest pending execution for this toolName (FIFO)
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, entry] of this.pendingToolExecutions) {
        if (entry.toolName === data.toolName && entry.startedAt < oldestTime) {
          oldestTime = entry.startedAt;
          oldestKey = key;
        }
      }

      if (!oldestKey) {
        // tool.failed can arrive without a matching tool.invoked (e.g. the
        // executor denies external paths before emitting invoked) — record an
        // orphan failed row so the attempt is not silently dropped.
        if (data.status === 'failed') {
          const id = crypto.randomUUID();
          this.toolExecutionRepository.create({
            id,
            runId: data.runId,
            sessionId: data.runId ? this.runSessions.get(data.runId) : undefined,
            toolName: data.toolName,
            status: 'failed',
            startedAt: new Date().toISOString(),
          });
          this.toolExecutionRepository.update(id, {
            status: 'failed',
            errorMessage: data.errorMessage,
            durationMs: 0,
            completedAt: new Date().toISOString(),
          });
          if (data.runId) {
            this.runToolCounts.set(data.runId, (this.runToolCounts.get(data.runId) ?? 0) + 1);
          }
          this.logger.debug(`Tool failed without invoked (orphan row): ${data.toolName} id=${id}`);
        }
        return;
      }
      const pending = this.pendingToolExecutions.get(oldestKey)!;

      const durationMs = Date.now() - pending.startedAt;
      this.toolExecutionRepository.update(pending.id, {
        status: data.status || 'completed',
        toolOutput: typeof data.toolOutput === 'object' ? data.toolOutput as Record<string, unknown> : { result: data.toolOutput },
        errorMessage: data.errorMessage,
        durationMs,
        completedAt: new Date().toISOString(),
      });
      this.pendingToolExecutions.delete(oldestKey);
      this.logger.debug(`Tool execution completed: ${data.toolName} duration=${durationMs}ms`);
    } catch (error) {
      this.logger.warn(`Failed to track tool completion: ${error}`);
    }
  }
}
