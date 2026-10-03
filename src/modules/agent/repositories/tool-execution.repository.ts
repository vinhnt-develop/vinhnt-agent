import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION, type DatabaseConnection } from '@/infrastructure/database';
import { toolExecutions } from '@/modules/agent/schemas/agent.schema';
import { eq, and, sql } from 'drizzle-orm';

@Injectable()
export class ToolExecutionRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DatabaseConnection) {}

  create(data: {
    id: string;
    runId?: string;
    sessionId?: string;
    messageId?: string;
    toolCallId?: string;
    toolName: string;
    toolInput?: Record<string, unknown>;
    status?: string;
    startedAt?: string;
  }) {
    return this.db
      .insert(toolExecutions)
      .values({
        id: data.id,
        runId: data.runId,
        sessionId: data.sessionId,
        messageId: data.messageId,
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        toolInput: data.toolInput || {},
        status: data.status || 'running',
        startedAt: data.startedAt || new Date().toISOString(),
      })
      .returning()
      .get();
  }

  update(id: string, data: {
    status?: string;
    toolOutput?: Record<string, unknown>;
    errorMessage?: string;
    durationMs?: number;
    completedAt?: string;
  }) {
    return this.db
      .update(toolExecutions)
      .set(data)
      .where(eq(toolExecutions.id, id))
      .returning()
      .get();
  }

  findById(id: string) {
    return this.db
      .select()
      .from(toolExecutions)
      .where(eq(toolExecutions.id, id))
      .get();
  }

  /** Close still-running tool rows for a cancelled/failed run. */
  cancelRunningByRunId(runId: string, status: string, errorMessage: string) {
    return this.db
      .update(toolExecutions)
      .set({ status, errorMessage, completedAt: new Date().toISOString() })
      .where(
        and(
          eq(toolExecutions.runId, runId),
          eq(toolExecutions.status, 'running'),
        ),
      )
      .run();
  }

  findByRunId(runId: string) {
    return this.db
      .select()
      .from(toolExecutions)
      .where(eq(toolExecutions.runId, runId))
      .orderBy(sql`${toolExecutions.startedAt} ASC`)
      .all();
  }

  findBySessionId(sessionId: string) {
    return this.db
      .select()
      .from(toolExecutions)
      .where(eq(toolExecutions.sessionId, sessionId))
      .orderBy(sql`${toolExecutions.startedAt} ASC`)
      .all();
  }
}
