import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION, type DatabaseConnection } from '@/infrastructure/database';
import { agentRuns } from '@/modules/agent/schemas/agent.schema';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class AgentRunRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DatabaseConnection) {}

  create(data: {
    id: string;
    sessionId: string;
    status?: string;
    triggerType?: string;
    model?: string;
    provider?: string;
    startedAt?: string;
  }) {
    return this.db
      .insert(agentRuns)
      .values({
        id: data.id,
        sessionId: data.sessionId,
        status: data.status || 'running',
        triggerType: data.triggerType || 'http',
        model: data.model,
        provider: data.provider,
        startedAt: data.startedAt || new Date().toISOString(),
      })
      .returning()
      .get();
  }

  update(id: string, data: {
    status?: string;
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
    completedAt?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.db
      .update(agentRuns)
      .set(data)
      .where(eq(agentRuns.id, id))
      .returning()
      .get();
  }

  findById(id: string) {
    return this.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, id))
      .get();
  }

  findBySessionId(sessionId: string) {
    return this.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.sessionId, sessionId))
      .orderBy(sql`${agentRuns.createdAt} DESC`)
      .all();
  }

  incrementToolCallsCount(id: string) {
    return this.db
      .update(agentRuns)
      .set({
        toolCallsCount: sql`COALESCE(${agentRuns.toolCallsCount}, 0) + 1`,
      })
      .where(eq(agentRuns.id, id))
      .run();
  }

  cleanupStaleRuns(sessionId: string, staleThresholdMs = 5 * 60 * 1000) {
    const threshold = new Date(Date.now() - staleThresholdMs).toISOString();
    return this.db
      .update(agentRuns)
      .set({
        status: 'failed',
        errorMessage: 'Run timed out (stale)',
        completedAt: sql`datetime('now')`,
      })
      .where(
        sql`${agentRuns.sessionId} = ${sessionId} AND ${agentRuns.status} = 'running' AND ${agentRuns.startedAt} < ${threshold}`
      )
      .run();
  }
}
