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
    errorMessage?: string | null;
    stopReason?: string | null;
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
    // Only mark stale if NO run_events activity in the window — a long LM Studio
    // generation can exceed 5 min wall-clock while still actively streaming tokens.
    // Checking startedAt alone false-fails live runs (green check + "stale" leftover).
    return this.db
      .update(agentRuns)
      .set({
        status: 'failed',
        errorMessage: 'Run timed out (stale)',
        completedAt: sql`datetime('now')`,
        durationMs: sql`CAST((julianday('now') - julianday(${agentRuns.startedAt})) * 86400000 AS INTEGER)`,
        stopReason: 'stale_timeout',
      })
      .where(
        sql`${agentRuns.sessionId} = ${sessionId}
            AND ${agentRuns.status} = 'running'
            AND ${agentRuns.startedAt} < ${threshold}
            AND NOT EXISTS (
              SELECT 1 FROM run_events re
              WHERE re.run_id = ${agentRuns.id}
                AND re.occurred_at >= ${threshold}
            )`
      )
      .run();
  }

  /** Clear stale errorMessage when a later completeRun overwrites status. */
  clearErrorMessage(id: string) {
    return this.db
      .update(agentRuns)
      .set({ errorMessage: null, stopReason: null })
      .where(eq(agentRuns.id, id))
      .run();
  }
}
