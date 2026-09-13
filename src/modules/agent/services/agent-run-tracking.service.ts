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
    totalCost?: number;
    durationMs?: number;
    toolCallsCount?: number;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): void {
    try {
      this.agentRunRepository.update(data.runId, {
        status: data.status,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        reasoningTokens: data.reasoningTokens,
        totalCost: data.totalCost,
        durationMs: data.durationMs,
        toolCallsCount: data.toolCallsCount,
        errorMessage: data.errorMessage,
        completedAt: new Date().toISOString(),
        metadata: data.metadata,
      });
      this.logger.debug(`Agent run completed: ${data.runId} status=${data.status}`);
    } catch (error) {
      this.logger.warn(`Failed to track run completion: ${error}`);
    }
  }

  startToolExecution(data: {
    runId?: string;
    sessionId?: string;
    toolName: string;
    toolInput?: Record<string, unknown>;
  }): string | null {
    try {
      const id = crypto.randomUUID();
      this.toolExecutionRepository.create({
        id,
        runId: data.runId,
        sessionId: data.sessionId,
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

      if (!oldestKey) return;
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
