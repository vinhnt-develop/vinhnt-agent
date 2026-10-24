import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION, type DatabaseConnection } from '@/infrastructure/database';
import { sessions, messages, sessionSurfaces } from '../schemas/session.schema';
import { agentRuns, toolExecutions } from '@/modules/agent/schemas/agent.schema';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class SessionRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DatabaseConnection) {}

  async findById(id: string) {
    return this.db
      .select()
      .from(sessions)
      .where(sql`${sessions.id} = ${id} AND ${sessions.deletedAt} IS NULL`)
      .get();
  }

  async findByProjectId(projectId: string) {
    return this.db
      .select()
      .from(sessions)
      .where(sql`${sessions.projectId} = ${projectId} AND ${sessions.deletedAt} IS NULL`)
      .orderBy(desc(sessions.createdAt))
      .all();
  }

  async findByProjectIdWithPagination(projectId: string, dto: PaginationDto) {
    const offset = (dto.page! - 1) * dto.limit!;
    const where = sql`${sessions.projectId} = ${projectId} AND ${sessions.deletedAt} IS NULL`;

    const rows = this.db
      .select()
      .from(sessions)
      .where(where)
      .orderBy(desc(sessions.createdAt))
      .limit(dto.limit!)
      .offset(offset)
      .all();

    const [{ count: total }] = this.db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(where)
      .all();

    return { data: rows, total, page: dto.page!, limit: dto.limit! };
  }

  async create(data: { title?: string; projectId?: string; model?: string; provider?: string; gitBranch?: string; version?: string; parentId?: string }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(sessions).values({
      id,
      title: data.title,
      projectId: data.projectId,
      model: data.model,
      provider: data.provider,
      gitBranch: data.gitBranch,
      version: data.version,
      parentId: data.parentId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    return this.findById(id);
  }

  async update(id: string, data: { title?: string; isActive?: boolean; model?: string; provider?: string }) {
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.provider !== undefined) updateData.provider = data.provider;

    this.db.update(sessions).set(updateData).where(eq(sessions.id, id)).run();
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.db.update(sessions).set({ deletedAt: new Date().toISOString() }).where(eq(sessions.id, id)).run();
  }

  async findSurfaces(sessionId: string) {
    return this.db
      .select()
      .from(sessionSurfaces)
      .where(eq(sessionSurfaces.sessionId, sessionId))
      .orderBy(asc(sessionSurfaces.updatedAt), asc(sessionSurfaces.surfaceId))
      .all();
  }

  async deleteSurface(sessionId: string, surfaceId: string) {
    return this.db
      .delete(sessionSurfaces)
      .where(and(
        eq(sessionSurfaces.sessionId, sessionId),
        eq(sessionSurfaces.surfaceId, surfaceId),
      ))
      .run();
  }

  async deleteSurfaces(sessionId: string) {
    return this.db
      .delete(sessionSurfaces)
      .where(eq(sessionSurfaces.sessionId, sessionId))
      .run();
  }

  async addMessage(data: { sessionId: string; role: string; content?: string; toolCallId?: string; contentBlocks?: unknown[] }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(messages).values({
      id,
      sessionId: data.sessionId,
      role: data.role,
      content: data.content ?? '',
      toolCallId: data.toolCallId,
      contentBlocks: data.contentBlocks ?? [],
      createdAt: now,
    }).run();

    return this.db.select().from(messages).where(eq(messages.id, id)).get();
  }

  async findMessages(sessionId: string, limit = 10) {
    const rows = this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(sql`${messages.createdAt} DESC`)
      .limit(limit)
      .all();
    return rows.reverse();
  }

  async findMessagesWithPagination(
    sessionId: string,
    dto: PaginationDto & { order?: 'asc' | 'desc' },
  ) {
    const page = dto.page || 1;
    const limit = dto.limit || 100;
    const offset = (page - 1) * limit;
    const order = dto.order === 'desc' ? 'desc' : 'asc';

    const rows = this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(
        order === 'desc'
          ? desc(messages.createdAt)
          : asc(messages.createdAt),
        order === 'desc' ? desc(messages.id) : asc(messages.id),
      )
      .limit(limit)
      .offset(offset)
      .all();

    const [{ count: total }] = this.db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .all();

    // Enrich role='tool' rows with their execution (toolName/duration/status)
    // so the chat can render a real tool chip — messages only store toolCallId.
    const toolCallIds = rows
      .filter((r) => r.role === 'tool' && r.toolCallId)
      .map((r) => r.toolCallId as string);
    let data = rows;
    if (toolCallIds.length > 0) {
      const execs = this.db
        .select({
          toolCallId: toolExecutions.toolCallId,
          toolName: toolExecutions.toolName,
          durationMs: toolExecutions.durationMs,
          status: toolExecutions.status,
        })
        .from(toolExecutions)
        .where(inArray(toolExecutions.toolCallId, toolCallIds))
        .all();
      const byCallId = new Map(
        execs
          .filter((e) => e.toolCallId)
          .map((e) => [e.toolCallId as string, e]),
      );
      if (byCallId.size > 0) {
        data = rows.map((r) => {
          if (r.role !== 'tool' || !r.toolCallId) return r;
          const exec = byCallId.get(r.toolCallId);
          if (!exec) return r;
          return {
            ...r,
            metadata: {
              ...((r.metadata as Record<string, unknown> | null) ?? {}),
              toolName: exec.toolName,
              toolDurationMs: exec.durationMs ?? 0,
              toolStatus: exec.status ?? 'completed',
            },
          };
        });
      }
    }

    return { data, total, page, limit, order };
  }

  /**
   * All messages in stable chronological order. Fork uses the full list so a
   * cut point can be resolved before copying; IDs break timestamp ties.
   */
  async findAllMessages(sessionId: string) {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt), asc(messages.id))
      .all();
  }

  /**
   * Copy a session and the selected message prefix into a new child session.
   * Only INSERTs are issued: the source session and its messages are never
   * mutated, so a fork is always safe to abandon.
   */
  async fork(data: {
    source: typeof sessions.$inferSelect;
    messageRows: Array<typeof messages.$inferSelect>;
    title?: string;
    forkPointMessageId?: string;
  }) {
    const id = uuid();
    const now = new Date().toISOString();
    const sourceMetadata =
      data.source.metadata &&
      typeof data.source.metadata === 'object' &&
      !Array.isArray(data.source.metadata)
        ? (data.source.metadata as Record<string, unknown>)
        : {};

    this.db.transaction((tx) => {
      tx.insert(sessions).values({
        id,
        projectId: data.source.projectId,
        title: data.title,
        isActive: true,
        model: data.source.model,
        provider: data.source.provider,
        gitBranch: data.source.gitBranch,
        version: data.source.version,
        parentId: data.source.id,
        metadata: {
          ...sourceMetadata,
          forkedFromSessionId: data.source.id,
          forkedAt: now,
          forkedMessageCount: data.messageRows.length,
          ...(data.forkPointMessageId !== undefined
            ? { forkPointMessageId: data.forkPointMessageId }
            : {}),
        },
        createdAt: now,
        updatedAt: now,
      }).run();

      // Keep well below SQLite's bound-variable limit for large forks.
      for (let offset = 0; offset < data.messageRows.length; offset += 100) {
        const chunk = data.messageRows.slice(offset, offset + 100);
        tx.insert(messages).values(
          chunk.map((row) => ({
            id: uuid(),
            sessionId: id,
            role: row.role,
            content: row.content ?? '',
            toolCallId: row.toolCallId,
            contentBlocks: row.contentBlocks ?? [],
            inputTokens: row.inputTokens ?? 0,
            outputTokens: row.outputTokens ?? 0,
            reasoningTokens: row.reasoningTokens ?? 0,
            model: row.model,
            provider: row.provider,
            cost: row.cost ?? 0,
            metadata: row.metadata ?? {},
            createdAt: row.createdAt ?? now,
          })),
        ).run();
      }
    });

    return {
      session: await this.findById(id),
      copiedMessageCount: data.messageRows.length,
    };
  }

  async findForksWithPagination(parentId: string, dto: PaginationDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;
    const where = sql`${sessions.parentId} = ${parentId} AND ${sessions.deletedAt} IS NULL`;

    const data = this.db
      .select()
      .from(sessions)
      .where(where)
      .orderBy(desc(sessions.createdAt), desc(sessions.id))
      .limit(limit)
      .offset(offset)
      .all();

    const [{ count: total }] = this.db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(where)
      .all();

    return { data, total: Number(total), page, limit };
  }

  /**
   * Compact, DB-only summary for a session: message role counts and first/last
   * timestamps, plus run status/token/cost aggregates. Avoids replaying the
   * full event log for list/summary surfaces.
   */
  async findSummary(sessionId: string) {
    const messageStats = this.db
      .select({
        messageCount: sql<number>`count(*)`,
        userMessageCount: sql<number>`coalesce(sum(case when ${messages.role} = 'user' then 1 else 0 end), 0)`,
        assistantMessageCount: sql<number>`coalesce(sum(case when ${messages.role} = 'assistant' then 1 else 0 end), 0)`,
        toolMessageCount: sql<number>`coalesce(sum(case when ${messages.role} = 'tool' then 1 else 0 end), 0)`,
        systemMessageCount: sql<number>`coalesce(sum(case when ${messages.role} = 'system' then 1 else 0 end), 0)`,
        firstMessageAt: sql<string | null>`min(${messages.createdAt})`,
        lastMessageAt: sql<string | null>`max(${messages.createdAt})`,
      })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .get();

    const runStats = this.db
      .select({
        runCount: sql<number>`count(*)`,
        inputTokens: sql<number>`coalesce(sum(${agentRuns.inputTokens}), 0)`,
        outputTokens: sql<number>`coalesce(sum(${agentRuns.outputTokens}), 0)`,
        reasoningTokens: sql<number>`coalesce(sum(${agentRuns.reasoningTokens}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${agentRuns.totalTokens}), 0)`,
        cost: sql<number>`coalesce(sum(${agentRuns.totalCost}), 0)`,
        toolCallsCount: sql<number>`coalesce(sum(${agentRuns.toolCallsCount}), 0)`,
        lastRunAt: sql<string | null>`max(coalesce(${agentRuns.completedAt}, ${agentRuns.startedAt}, ${agentRuns.createdAt}))`,
      })
      .from(agentRuns)
      .where(eq(agentRuns.sessionId, sessionId))
      .get();

    const statusRows = this.db
      .select({
        status: agentRuns.status,
        count: sql<number>`count(*)`,
      })
      .from(agentRuns)
      .where(eq(agentRuns.sessionId, sessionId))
      .groupBy(agentRuns.status)
      .all();

    const runStatusCounts: Record<string, number> = {
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      interrupted: 0,
    };
    for (const row of statusRows) {
      const key = row.status ?? 'pending';
      runStatusCounts[key] = Number(row.count);
    }

    return {
      messageCount: Number(messageStats?.messageCount ?? 0),
      userMessageCount: Number(messageStats?.userMessageCount ?? 0),
      assistantMessageCount: Number(messageStats?.assistantMessageCount ?? 0),
      toolMessageCount: Number(messageStats?.toolMessageCount ?? 0),
      systemMessageCount: Number(messageStats?.systemMessageCount ?? 0),
      firstMessageAt: messageStats?.firstMessageAt ?? null,
      lastMessageAt: messageStats?.lastMessageAt ?? null,
      runCount: Number(runStats?.runCount ?? 0),
      runStatusCounts,
      inputTokens: Number(runStats?.inputTokens ?? 0),
      outputTokens: Number(runStats?.outputTokens ?? 0),
      reasoningTokens: Number(runStats?.reasoningTokens ?? 0),
      totalTokens: Number(runStats?.totalTokens ?? 0),
      cost: Number(runStats?.cost ?? 0),
      toolCallsCount: Number(runStats?.toolCallsCount ?? 0),
      lastRunAt: runStats?.lastRunAt ?? null,
    };
  }
}
