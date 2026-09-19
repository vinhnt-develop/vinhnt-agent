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
  toolCalls: TrajectoryToolCall[];
  events: TrajectoryEvent[];
  stats: TrajectoryStats;
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

    // Get events for all runs in this session
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

    // Get messages for context breakdown
    const messages = await this.sessionRepository.findMessages(sessionId);

    const stats = this.computeStats(runs, toolCalls, messages);

    return {
      session: {
        id: session.id,
        title: session.title ?? undefined,
        model: session.model ?? undefined,
        provider: session.provider ?? undefined,
      },
      runs: runs.map((r: any) => ({
        runId: r.id,
        status: r.status,
        model: r.model,
        provider: r.provider,
        inputTokens: r.inputTokens || 0,
        outputTokens: r.outputTokens || 0,
        reasoningTokens: r.reasoningTokens || 0,
        totalCost: r.totalCost || 0,
        durationMs: r.durationMs || 0,
        toolCallsCount: r.toolCallsCount || 0,
        errorMessage: r.errorMessage,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
      })),
      toolCalls: toolCalls.map((t: any) => ({
        id: t.id,
        runId: t.runId,
        toolName: t.toolName,
        toolInput: t.toolInput || {},
        toolOutput: t.toolOutput || {},
        status: t.status,
        errorMessage: t.errorMessage,
        durationMs: t.durationMs || 0,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
      })),
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

  private computeStats(runs: any[], toolCalls: any[], messages: any[]): TrajectoryStats {
    const totalRuns = runs.length;
    const totalToolCalls = toolCalls.length;
    const totalInputTokens = runs.reduce((sum: number, r: any) => sum + (r.inputTokens || 0), 0);
    const totalOutputTokens = runs.reduce((sum: number, r: any) => sum + (r.outputTokens || 0), 0);
    const totalReasoningTokens = runs.reduce((sum: number, r: any) => sum + (r.reasoningTokens || 0), 0);
    const totalCost = runs.reduce((sum: number, r: any) => sum + (r.totalCost || 0), 0);
    const totalDurationMs = runs.reduce((sum: number, r: any) => sum + (r.durationMs || 0), 0);
    const succeededRuns = runs.filter((r: any) => r.status === 'succeeded').length;
    const failedRuns = runs.filter((r: any) => r.status === 'failed').length;
    const avgDurationMs = totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0;

    // Calculate context breakdown from messages
    let userTokens = 0;
    let assistantTokens = 0;
    let otherTokens = 0;

    for (const msg of messages) {
      const msgTokens = (msg.inputTokens || 0) + (msg.outputTokens || 0) + (msg.reasoningTokens || 0);
      if (msg.role === 'user') {
        userTokens += msgTokens;
      } else if (msg.role === 'assistant') {
        assistantTokens += msgTokens;
      } else {
        otherTokens += msgTokens;
      }
    }

    // Tool call tokens from tool executions
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
