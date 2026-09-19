import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentRunRepository } from '@/modules/agent/repositories/agent-run.repository';
import { ToolExecutionRepository } from '@/modules/agent/repositories/tool-execution.repository';
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION, type DatabaseConnection } from '@/infrastructure/database';
import { runEvents } from '@/modules/agent/schemas/agent.schema';
import { eq, sql } from 'drizzle-orm';
import { SessionRepository } from '../repositories/session.repository';

export interface TrajectoryTurn {
  runId: string;
  status: string;
  model?: string;
  provider?: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalCost: number;
  durationMs: number;
  toolCallsCount: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  parentRunId?: string;
  steps: TrajectoryStep[];
}

export interface TrajectoryStep {
  stepNumber: number;
  status: 'completed' | 'failed' | 'timeout';
  toolCalls: TrajectoryToolCall[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface TrajectoryToolCall {
  id: string;
  runId?: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: Record<string, unknown>;
  status: string;
  errorMessage?: string;
  durationMs: number;
  startedAt?: string;
  completedAt?: string;
  stepNumber: number;
}

export interface TrajectoryEvent {
  id: number;
  runId: string;
  type: string;
  sequence: number;
  data: Record<string, unknown>;
  traceId?: string;
  occurredAt?: string;
}

export interface ContextBreakdown {
  userTokens: number;
  assistantTokens: number;
  toolCallTokens: number;
  otherTokens: number;
  userPercent: number;
  assistantPercent: number;
  toolCallPercent: number;
  otherPercent: number;
}

export interface TrajectoryStats {
  totalRuns: number;
  totalToolCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalCost: number;
  totalDurationMs: number;
  succeededRuns: number;
  failedRuns: number;
  avgDurationMs: number;
  contextBreakdown: ContextBreakdown;
}

export interface TrajectoryResponse {
  session: { id: string; title?: string; model?: string; provider?: string };
  runs: TrajectoryTurn[];
  events: TrajectoryEvent[];
  stats: TrajectoryStats;
}

interface StepBoundary {
  stepNumber: number;
  startedAt: string;
  completedAt?: string;
  status: 'completed' | 'failed' | 'timeout';
}

@Injectable()
export class TrajectoryService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DatabaseConnection,
    private readonly agentRunRepository: AgentRunRepository,
    private readonly toolExecutionRepository: ToolExecutionRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async getTrajectory(sessionId: string): Promise<TrajectoryResponse> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const runs = this.agentRunRepository.findBySessionId(sessionId);
    const toolCalls = this.toolExecutionRepository.findBySessionId(sessionId);

    let events: TrajectoryEvent[] = [];
    if (runs.length > 0) {
      const runIds = runs.map((r: any) => r.id);
      events = this.db
        .select()
        .from(runEvents)
        .where(sql`${runEvents.runId} IN ${runIds}`)
        .orderBy(sql`${runEvents.occurredAt} ASC`)
        .all() as TrajectoryEvent[];
    }

    const messages = await this.sessionRepository.findMessages(sessionId);

    const hierarchicalRuns = this.buildHierarchicalRuns(runs, toolCalls, events);
    const stats = this.computeStats(hierarchicalRuns, toolCalls, messages);

    return {
      session: {
        id: session.id,
        title: session.title ?? undefined,
        model: session.model ?? undefined,
        provider: session.provider ?? undefined,
      },
      runs: hierarchicalRuns,
      events: events.map((e: any) => ({
        id: e.id,
        runId: e.runId,
        type: e.type,
        sequence: e.sequence,
        data: e.data || {},
        traceId: e.traceId,
        occurredAt: e.occurredAt,
      })),
      stats,
    };
  }

  private buildHierarchicalRuns(
    runs: any[],
    toolCalls: any[],
    events: TrajectoryEvent[],
  ): TrajectoryTurn[] {
    const eventsByRun = this.groupEventsByRunId(events);
    const toolCallsByRunId = this.groupToolCallsByRunId(toolCalls);

    return runs.map((run: any) => {
      const runEvents = eventsByRun.get(run.id) || [];
      const runToolCalls = toolCallsByRunId.get(run.id) || [];
      const stepBoundaries = this.extractStepBoundaries(runEvents);
      const steps = this.buildSteps(stepBoundaries, runToolCalls);

      return {
        runId: run.id,
        status: run.status,
        model: run.model,
        provider: run.provider,
        inputTokens: run.inputTokens || 0,
        outputTokens: run.outputTokens || 0,
        reasoningTokens: run.reasoningTokens || 0,
        totalCost: run.totalCost || 0,
        durationMs: run.durationMs || 0,
        toolCallsCount: run.toolCallsCount || runToolCalls.length,
        errorMessage: run.errorMessage,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        parentRunId: run.metadata?.parentRunId,
        steps,
      };
    });
  }

  private groupEventsByRunId(events: TrajectoryEvent[]): Map<string, TrajectoryEvent[]> {
    const map = new Map<string, TrajectoryEvent[]>();
    for (const event of events) {
      const existing = map.get(event.runId) || [];
      existing.push(event);
      map.set(event.runId, existing);
    }
    return map;
  }

  private groupToolCallsByRunId(toolCalls: any[]): Map<string, any[]> {
    const map = new Map<string, any[]>();
    for (const tc of toolCalls) {
      if (!tc.runId) continue;
      const existing = map.get(tc.runId) || [];
      existing.push(tc);
      map.set(tc.runId, existing);
    }
    return map;
  }

  private extractStepBoundaries(events: TrajectoryEvent[]): StepBoundary[] {
    const stepMap = new Map<number, StepBoundary>();

    for (const event of events) {
      if (event.type === 'step.started') {
        const stepNum = typeof event.data?.step === 'number' ? event.data.step : event.sequence;
        stepMap.set(stepNum, {
          stepNumber: stepNum,
          startedAt: event.occurredAt || new Date().toISOString(),
          status: 'completed',
        });
      } else if (event.type === 'step.completed') {
        const stepNum = typeof event.data?.step === 'number' ? event.data.step : event.sequence;
        const existing = stepMap.get(stepNum);
        if (existing) {
          existing.completedAt = event.occurredAt;
          existing.status = 'completed';
        }
      } else if (event.type === 'step.failed') {
        const stepNum = typeof event.data?.step === 'number' ? event.data.step : event.sequence;
        const existing = stepMap.get(stepNum);
        if (existing) {
          existing.completedAt = event.occurredAt;
          existing.status = 'failed';
        }
      } else if (event.type === 'step.timeout') {
        const stepNum = typeof event.data?.step === 'number' ? event.data.step : event.sequence;
        const existing = stepMap.get(stepNum);
        if (existing) {
          existing.completedAt = event.occurredAt;
          existing.status = 'timeout';
        }
      }
    }

    return Array.from(stepMap.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  }

  private buildSteps(stepBoundaries: StepBoundary[], toolCalls: any[]): TrajectoryStep[] {
    const steps: TrajectoryStep[] = [];

    if (stepBoundaries.length === 0) {
      const defaultStep: TrajectoryStep = {
        stepNumber: 0,
        status: 'completed',
        toolCalls: toolCalls.map((tc, idx) => this.mapToolCall(tc, 0)),
        inputTokens: 0,
        outputTokens: 0,
        durationMs: toolCalls.reduce((sum, tc) => sum + (tc.durationMs || 0), 0),
      };
      steps.push(defaultStep);
      return steps;
    }

    for (const boundary of stepBoundaries) {
      const stepToolCalls = this.assignToolCallsToStep(boundary, toolCalls);
      const mappedToolCalls = stepToolCalls.map((tc) => this.mapToolCall(tc, boundary.stepNumber));

      const stepDurationMs = this.computeStepDuration(boundary, stepToolCalls);

      steps.push({
        stepNumber: boundary.stepNumber,
        status: boundary.status,
        toolCalls: mappedToolCalls,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: stepDurationMs,
      });
    }

    const assignedToolCallIds = new Set(
      steps.flatMap((s) => s.toolCalls.map((tc) => tc.id)),
    );
    const unassignedToolCalls = toolCalls.filter((tc) => !assignedToolCallIds.has(tc.id));

    if (unassignedToolCalls.length > 0) {
      const lastStep = steps[steps.length - 1];
      for (const tc of unassignedToolCalls) {
        lastStep.toolCalls.push(this.mapToolCall(tc, lastStep.stepNumber));
      }
      lastStep.durationMs += unassignedToolCalls.reduce((sum, tc) => sum + (tc.durationMs || 0), 0);
    }

    return steps;
  }

  private assignToolCallsToStep(boundary: StepBoundary, toolCalls: any[]): any[] {
    const stepStart = boundary.startedAt ? new Date(boundary.startedAt).getTime() : 0;
    const stepEnd = boundary.completedAt
      ? new Date(boundary.completedAt).getTime()
      : Date.now();

    return toolCalls.filter((tc) => {
      if (!tc.startedAt) return false;
      const tcStart = new Date(tc.startedAt).getTime();
      return tcStart >= stepStart && tcStart < stepEnd;
    });
  }

  private computeStepDuration(boundary: StepBoundary, toolCalls: any[]): number {
    if (boundary.startedAt && boundary.completedAt) {
      return (
        new Date(boundary.completedAt).getTime() -
        new Date(boundary.startedAt).getTime()
      );
    }
    return toolCalls.reduce((sum, tc) => sum + (tc.durationMs || 0), 0);
  }

  private mapToolCall(tc: any, stepNumber: number): TrajectoryToolCall {
    return {
      id: tc.id,
      runId: tc.runId,
      toolName: tc.toolName,
      toolInput: tc.toolInput || {},
      toolOutput: tc.toolOutput || {},
      status: tc.status,
      errorMessage: tc.errorMessage,
      durationMs: tc.durationMs || 0,
      startedAt: tc.startedAt,
      completedAt: tc.completedAt,
      stepNumber,
    };
  }

  private computeStats(
    runs: TrajectoryTurn[],
    toolCalls: any[],
    messages: any[],
  ): TrajectoryStats {
    const totalRuns = runs.length;
    const totalToolCalls = toolCalls.length;
    const totalInputTokens = runs.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = runs.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalReasoningTokens = runs.reduce((sum, r) => sum + r.reasoningTokens, 0);
    const totalCost = runs.reduce((sum, r) => sum + r.totalCost, 0);
    const totalDurationMs = runs.reduce((sum, r) => sum + r.durationMs, 0);
    const succeededRuns = runs.filter((r) => r.status === 'succeeded').length;
    const failedRuns = runs.filter((r) => r.status === 'failed').length;
    const avgDurationMs = totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0;

    let userTokens = 0;
    let assistantTokens = 0;
    let otherTokens = 0;

    for (const msg of messages) {
      const msgTokens =
        (msg.inputTokens || 0) + (msg.outputTokens || 0) + (msg.reasoningTokens || 0);
      if (msg.role === 'user') {
        userTokens += msgTokens;
      } else if (msg.role === 'assistant') {
        assistantTokens += msgTokens;
      } else {
        otherTokens += msgTokens;
      }
    }

    const toolCallTokens = toolCalls.reduce((sum: number, tc: any) => {
      const inputTokens = tc.toolInput ? JSON.stringify(tc.toolInput).length / 4 : 0;
      const outputTokens = tc.toolOutput ? JSON.stringify(tc.toolOutput).length / 4 : 0;
      return sum + Math.ceil(inputTokens) + Math.ceil(outputTokens);
    }, 0);

    const totalContextTokens = userTokens + assistantTokens + toolCallTokens + otherTokens;
    const userPercent = totalContextTokens > 0 ? Math.round((userTokens / totalContextTokens) * 100) : 0;
    const assistantPercent = totalContextTokens > 0 ? Math.round((assistantTokens / totalContextTokens) * 100) : 0;
    const toolCallPercent = totalContextTokens > 0 ? Math.round((toolCallTokens / totalContextTokens) * 100) : 0;
    const otherPercent = totalContextTokens > 0 ? Math.round((otherTokens / totalContextTokens) * 100) : 0;

    return {
      totalRuns,
      totalToolCalls,
      totalInputTokens,
      totalOutputTokens,
      totalReasoningTokens,
      totalCost,
      totalDurationMs,
      succeededRuns,
      failedRuns,
      avgDurationMs,
      contextBreakdown: {
        userTokens,
        assistantTokens,
        toolCallTokens,
        otherTokens,
        userPercent,
        assistantPercent,
        toolCallPercent,
        otherPercent,
      },
    };
  }
}
