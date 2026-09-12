import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { toolExecutions } from '@/modules/agent/schemas/agent.schema';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class ToolExecutionRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: any) {}

  create(data: {
    id: string;
    runId?: string;
    sessionId?: string;
    messageId?: string;
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
