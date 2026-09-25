import { Injectable, Logger } from '@nestjs/common';
import { AgentRunRepository } from '../repositories/agent-run.repository';
import { ToolExecutionRepository } from '../repositories/tool-execution.repository';

interface PendingToolExecution {
  id: string;
  startedAt: number;
  toolName: string;
}

@Injectable()
export class AgentRunTrackingService {
  private readonly logger = new Logger(AgentRunTrackingService.name);
  /** Pending tool executions keyed by unique invocation ID. */
  private readonly pendingToolExecutions = new Map<string, PendingToolExecution>();
  /** runId → sessionId (so tool rows get a session even if caller omits it). */
  private readonly runSessions = new Map<string, string>();
  /** runId → tool invocations observed so far (fallback for tool_calls_count). */
  private readonly runToolCounts = new Map<string, number>();

  constructor(
    private readonly agentRunRepository: AgentRunRepository,
    private readonly toolExecutionRepository: ToolExecutionRepository,
  ) {}

  startRun(data: {
    runId: string;
    sessionId: string;
    model?: string;
    provider?: string;
    triggerType?: string;
  }): void {
    try {
      this.runSessions.set(data.runId, data.sessionId);
      this.agentRunRepository.create({
        id: data.runId,
        sessionId: data.sessionId,
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
      this.runSessions.delete(data.runId);
      this.runToolCounts.delete(data.runId);
      this.logger.debug(`Agent run completed: ${data.runId} status=${data.status}`);
    } catch (error) {
      this.logger.warn(`Failed to track run completion: ${error}`);
    }
  }

  /** Tool invocations observed so far for a run (undefined if unknown). */
  getToolCallsCount(runId: string): number | undefined {
    return this.runToolCounts.get(runId);
  }

  startToolExecution(data: {
    runId?: string;
    sessionId?: string;
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
