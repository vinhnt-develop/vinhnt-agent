import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentRunRepository } from '@/modules/agent/repositories/agent-run.repository';
import { ToolExecutionRepository } from '@/modules/agent/repositories/tool-execution.repository';
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION, type DatabaseConnection } from '@/infrastructure/database';
import { runEvents } from '@/modules/agent/schemas/agent.schema';
import { messages } from '@/modules/session/schemas/session.schema';
import { eq, sql } from 'drizzle-orm';
import { SessionRepository } from '../repositories/session.repository';
import type { ContentPart } from '@vinhnt-sdk/schema';

export interface TrajectoryTurn {
  runId: string;
  status: string;
  model?: string;
  provider?: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens?: number;
  stopReason?: string;
  totalCost: number;
  durationMs: number;
  toolCallsCount: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  parentRunId?: string;
  steps: TrajectoryStep[];
  messages: TrajectoryMessage[];
  contextCompressed?: {
    originalCount?: number;
    compressedCount?: number;
    summary?: string;
  };
}

export interface TrajectoryStep {
  stepNumber: number;
  status: 'completed' | 'failed' | 'timeout';
  toolCalls: TrajectoryToolCall[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  thinkingContent?: string;
  llmRequest?: {
    model?: string;
    provider?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    messageCount?: number;
    toolCount?: number;
    systemPromptLength?: number;
    systemPrompt?: string;
    messages?: Array<{
      role: string;
      content: string;
      toolCalls?: Array<{ id: string; name: string; arguments: string }>;
      toolCallId?: string;
    }>;
    tools?: Array<{
      name: string;
      id?: string;
      description: string;
      parameters?: Record<string, unknown>;
      risk?: string;
      source?: string;
      metadata?: Record<string, unknown>;
      annotations?: Record<string, unknown>;
    }>;
    selection?: {
      tools?: Array<{ id: string; name?: string; enabled?: boolean }>;
      knowledge?: Array<{ id: string; key?: string; enabled?: boolean }>;
      plugins?: string[];
    };
    agent?: {
      id?: string;
      name?: string;
    };
  };
  llmResponse?: {
    content?: string;
    toolCalls?: Array<{ id: string; name: string; arguments: string }>;
    finishReason?: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      reasoningTokens?: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    };
    durationMs?: number;
    model?: string;
    provider?: string;
    step?: number;
  };
  llmRetry?: {
    attempt?: number;
    delayMs?: number;
    reason?: string;
  };
  contextCompressed?: {
    originalCount?: number;
    compressedCount?: number;
    summary?: string;
  };
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

export interface TrajectoryMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  contentBlocks?: readonly ContentPart[];
  model?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  toolCallId?: string;
  createdAt?: string;
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
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalAllTokens: number;
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
  allMessages: TrajectoryMessage[];
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

    // Clean up stale zombie runs (running for > 5 min with no completion)
    this.agentRunRepository.cleanupStaleRuns(sessionId);

    const runs = this.agentRunRepository.findBySessionId(sessionId);
    const toolCalls = this.toolExecutionRepository.findBySessionId(sessionId);

    let events: TrajectoryEvent[] = [];
    if (runs.length > 0) {
      const runIds = runs.map((r: any) => r.id);
      events = this.db
        .select()
        .from(runEvents)
        .where(sql`${runEvents.runId} IN ${runIds}`)
        .orderBy(sql`${runEvents.sequence} ASC, ${runEvents.occurredAt} ASC`)
        .all() as TrajectoryEvent[];
    }

    const allMessages = this.getAllMessages(sessionId);
    const hierarchicalRuns = this.buildHierarchicalRuns(runs, toolCalls, events, allMessages);
    const stats = this.computeStats(hierarchicalRuns, toolCalls, allMessages);

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
      allMessages: allMessages.map((m: any) => this.mapMessage(m)),
    };
  }

  private getAllMessages(sessionId: string): any[] {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(sql`${messages.createdAt} ASC`)
      .all();
  }

  private mapMessage(msg: any): TrajectoryMessage {
    return {
      role: msg.role,
      content: msg.content || '',
      contentBlocks: msg.contentBlocks ?? undefined,
      model: msg.model ?? undefined,
      provider: msg.provider ?? undefined,
      inputTokens: msg.inputTokens ?? undefined,
      outputTokens: msg.outputTokens ?? undefined,
      cost: msg.cost ?? undefined,
      toolCallId: msg.toolCallId ?? undefined,
      createdAt: msg.createdAt ?? undefined,
    };
  }

  private mapMessagesToRun(runMessages: any[]): TrajectoryMessage[] {
    return runMessages.map((m) => this.mapMessage(m));
  }

  private buildHierarchicalRuns(
    runs: any[],
    toolCalls: any[],
    events: TrajectoryEvent[],
    allMessages: any[],
  ): TrajectoryTurn[] {
    const eventsByRun = this.groupEventsByRunId(events);
    const toolCallsByRunId = this.groupToolCallsByRunId(toolCalls);

    return runs.map((run: any) => {
      const runEvents = eventsByRun.get(run.id) || [];
      const runToolCalls = toolCallsByRunId.get(run.id) || [];
      const stepBoundaries = this.extractStepBoundaries(runEvents);
      const steps = this.buildSteps(stepBoundaries, runToolCalls);

      // Extract event data for each step
      this.attachEventDataToSteps(steps, runEvents);

      const runStart = run.startedAt ? new Date(run.startedAt).getTime() : 0;
      const runEnd = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
      const runMessages = allMessages.filter((m: any) => {
        if (!m.createdAt) return false;
        const msgTime = new Date(m.createdAt).getTime();
        return msgTime >= runStart && msgTime <= runEnd;
      });

      // Extract run-level events
      const contextCompressedEvent = runEvents.find(e => e.type === 'context.compressed');
      const contextCompressed = contextCompressedEvent ? {
        originalCount: contextCompressedEvent.data?.originalCount as number | undefined,
        compressedCount: contextCompressedEvent.data?.compressedCount as number | undefined,
        summary: contextCompressedEvent.data?.summary as string | undefined,
      } : undefined;

      return {
        runId: run.id,
        status: run.status,
        model: run.model,
        provider: run.provider,
        inputTokens: run.inputTokens || 0,
        outputTokens: run.outputTokens || 0,
        reasoningTokens: run.reasoningTokens || 0,
        cacheReadTokens: run.cacheReadTokens || 0,
        cacheWriteTokens: run.cacheWriteTokens || 0,
        totalTokens: run.totalTokens || 0,
        stopReason: run.stopReason,
        totalCost: run.totalCost || 0,
        durationMs: run.durationMs || 0,
        toolCallsCount: run.toolCallsCount || runToolCalls.length,
        errorMessage: run.errorMessage,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        parentRunId: run.metadata?.parentRunId,
        steps,
        messages: this.mapMessagesToRun(runMessages),
        contextCompressed,
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

  private attachEventDataToSteps(steps: TrajectoryStep[], runEvents: TrajectoryEvent[]): void {
    if (steps.length === 0) return;

    const llmRequestEvents = runEvents.filter(e => e.type === 'llm.request');
    const llmResponseEvents = runEvents.filter(e => e.type === 'llm.response');
    const thinkingCompletedEvents = runEvents.filter(e => e.type === 'thinking.completed');
    const llmRetryEvents = runEvents.filter(e => e.type === 'llm.retry');

    // Map stepNumber -> event by data.step (fallback: sequential order for first step)
    const requestByStep = new Map<number, TrajectoryEvent>();
    llmRequestEvents.forEach((e, i) => {
      const s = typeof e.data?.step === 'number' ? e.data.step : i;
      if (!requestByStep.has(s)) requestByStep.set(s, e);
    });
    const responseByStep = new Map<number, TrajectoryEvent>();
    llmResponseEvents.forEach((e, i) => {
      const s = typeof e.data?.step === 'number' ? e.data.step : i;
      if (!responseByStep.has(s)) responseByStep.set(s, e);
    });

    for (const step of steps) {
      const requestEvent = requestByStep.get(step.stepNumber);
      if (requestEvent) {
        const d = requestEvent.data ?? {};
        const params = (d.params ?? {}) as Record<string, unknown>;
        const prompt = (d.prompt ?? {}) as Record<string, unknown>;
        // Legacy flat fields (pre-grouping) still readable from old rows
        const tools = Array.isArray(d.tools)
          ? (d.tools as Array<Record<string, unknown>>).map((t) => {
              const origin = (t.origin ?? {}) as Record<string, unknown>;
              return {
                name: String(t.name ?? ''),
                description: String(t.description ?? ''),
                parameters: t.parameters as Record<string, unknown> | undefined,
                id: (origin.id ?? t.id) as string | undefined,
                risk: (origin.risk ?? t.risk) as string | undefined,
                source: (origin.metadata as { source?: string } | undefined)?.source
                  ?? (t.metadata as { source?: string } | undefined)?.source,
                metadata: (origin.metadata ?? t.metadata) as Record<string, unknown> | undefined,
                annotations: (origin.annotations ?? t.annotations) as Record<string, unknown> | undefined,
              };
            })
          : undefined;
        step.llmRequest = {
          model: d.model as string | undefined,
          provider: d.provider as string | undefined,
          temperature: (params.temperature ?? d.temperature) as number | undefined,
          maxTokens: (params.maxTokens ?? d.maxTokens) as number | undefined,
          topP: (params.topP ?? d.topP) as number | undefined,
          messageCount: (prompt.messageCount ?? d.messageCount) as number | undefined,
          toolCount: (prompt.toolCount ?? d.toolCount) as number | undefined,
          systemPromptLength: (prompt.systemPromptLength ?? d.systemPromptLength) as number | undefined,
          systemPrompt: (prompt.systemPrompt ?? d.systemPrompt) as string | undefined,
          messages: d.messages as Array<{ role: string; content: string; toolCalls?: Array<{ id: string; name: string; arguments: string }>; toolCallId?: string }> | undefined,
          tools,
          selection: d.selection as { tools?: Array<{ id: string; name?: string; enabled?: boolean }>; knowledge?: Array<{ id: string; key?: string; enabled?: boolean }>; plugins?: string[] } | undefined,
          agent: d.agent as { id?: string; name?: string } | undefined,
        };
      }

      const responseEvent = responseByStep.get(step.stepNumber);
      if (responseEvent) {
        const usage = responseEvent.data?.usage as { inputTokens: number; outputTokens: number; reasoningTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number } | undefined;
        step.llmResponse = {
          content: responseEvent.data?.content as string | undefined,
          toolCalls: responseEvent.data?.toolCalls as Array<{ id: string; name: string; arguments: string }> | undefined,
          finishReason: responseEvent.data?.finishReason as string | undefined,
          usage,
          durationMs: responseEvent.data?.durationMs as number | undefined,
          model: responseEvent.data?.model as string | undefined,
          provider: responseEvent.data?.provider as string | undefined,
          step: responseEvent.data?.step as number | undefined,
        };
        // Populate step tokens from llm.response usage
        if (usage) {
          step.inputTokens = usage.inputTokens || 0;
          step.outputTokens = usage.outputTokens || 0;
        }
      }

      // Helper to compute step time bounds
      const stepStart = step.toolCalls.length > 0 && step.toolCalls[0].startedAt
        ? new Date(step.toolCalls[0].startedAt).getTime()
        : 0;
      const lastToolCall = step.toolCalls.length > 0 ? step.toolCalls[step.toolCalls.length - 1] : undefined;
      const stepEnd = lastToolCall?.completedAt
        ? new Date(lastToolCall.completedAt).getTime()
        : Date.now();

      // Attach thinking content to steps (from thinking.completed event)
      const thinkingEvent = thinkingCompletedEvents.find(e => {
        const s = typeof e.data?.step === 'number' ? e.data.step : undefined;
        if (s !== undefined) return s === step.stepNumber;
        const eventTime = e.occurredAt ? new Date(e.occurredAt).getTime() : 0;
        return eventTime >= stepStart && eventTime <= stepEnd;
      });

      if (thinkingEvent) {
        step.thinkingContent = thinkingEvent.data?.content as string | undefined;
      }

      // Attach LLM retry data to steps
      const retryEvent = llmRetryEvents.find(e => {
        const s = typeof e.data?.step === 'number' ? e.data.step : undefined;
        if (s !== undefined) return s === step.stepNumber;
        const eventTime = e.occurredAt ? new Date(e.occurredAt).getTime() : 0;
        return eventTime >= stepStart && eventTime <= stepEnd;
      });

      if (retryEvent) {
        step.llmRetry = {
          attempt: retryEvent.data?.attempt as number | undefined,
          delayMs: retryEvent.data?.delayMs as number | undefined,
          reason: retryEvent.data?.reason as string | undefined,
        };
      }
    }
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
    const totalCacheReadTokens = runs.reduce((sum, r) => sum + (r.cacheReadTokens || 0), 0);
    const totalCacheWriteTokens = runs.reduce((sum, r) => sum + (r.cacheWriteTokens || 0), 0);
    const totalAllTokens = runs.reduce((sum, r) => sum + (r.totalTokens || 0), 0);
    const totalCost = runs.reduce((sum, r) => sum + r.totalCost, 0);
    const totalDurationMs = runs.reduce((sum, r) => sum + r.durationMs, 0);
    const succeededRuns = runs.filter((r) => r.status === 'succeeded').length;
    const failedRuns = runs.filter((r) => r.status === 'failed').length;
    const avgDurationMs = totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0;

    let userTokens = 0;
    let assistantTokens = 0;
    let otherTokens = 0;

    for (const msg of messages) {
      let msgTokens =
        (msg.inputTokens || 0) + (msg.outputTokens || 0) + (msg.reasoningTokens || 0);
      // Estimate tokens from content length when provider reports 0 (e.g. LM Studio)
      if (msgTokens === 0 && msg.content) {
        msgTokens = Math.ceil(msg.content.length / 4);
      }
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
      totalCacheReadTokens,
      totalCacheWriteTokens,
      totalAllTokens,
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
