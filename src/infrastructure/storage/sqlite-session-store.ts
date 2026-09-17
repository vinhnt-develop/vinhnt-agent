import { Injectable, Logger, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { sessions, messages } from '@/modules/session/schemas/session.schema';
import { eq, like, desc, sql, count, sum } from 'drizzle-orm';
import type {
  SessionStore,
  AddMessageOptions,
  SessionUpdates,
  MessageSeqUpdates,
  Session,
  Message,
  SessionStats,
  SessionId,
  MessageId,
  AgentId,
  ToolCallId,
} from '@vinhnt-sdk/schema';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { v4 as uuid } from 'uuid';

function toSession(row: any): Session {
  return {
    id: row.id as SessionId,
    title: row.title || '',
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
    isActive: row.isActive === 1 || row.isActive === true || row.is_active === 1 || row.is_active === true,
    model: row.model || undefined,
    provider: row.provider || undefined,
    cost: row.cost || undefined,
    inputTokens: row.inputTokens ?? row.input_tokens ?? undefined,
    outputTokens: row.outputTokens ?? row.output_tokens ?? undefined,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
  };
}

function toMessage(row: any): Message {
  const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {});
  return {
    id: row.id as MessageId,
    sessionId: (row.sessionId || row.session_id) as SessionId,
    role: row.role,
    content: row.content || '',
    toolCallId: (row.toolCallId || row.tool_call_id) as ToolCallId | undefined,
    tokens: {
      input: row.inputTokens ?? row.input_tokens ?? 0,
      output: row.outputTokens ?? row.output_tokens ?? 0,
      reasoning: row.reasoningTokens ?? row.reasoning_tokens ?? 0,
    },
    model: row.model || undefined,
    provider: row.provider || undefined,
    cost: row.cost || undefined,
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    admittedSeq: meta.admittedSeq,
    promotedSeq: meta.promotedSeq,
  };
}

@Injectable()
export class SqliteSessionStore implements SessionStore {
  private readonly logger = new Logger(SqliteSessionStore.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: any,
  ) {}

  async createSession(title?: string, parentSessionId?: string): Promise<Session> {
    const id = uuid() as SessionId;
    const now = new Date().toISOString();

    this.db.insert(sessions).values({
      id,
      title: title || '',
      isActive: true,
      metadata: { parentSessionId },
      createdAt: now,
      updatedAt: now,
    }).run();

    return {
      id,
      title: title || '',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      parentSessionId: parentSessionId as SessionId | undefined,
      metadata: { parentSessionId },
    };
  }

  async forkSession(sourceSessionId: string, title?: string): Promise<Session> {
    const source = await this.getSession(sourceSessionId);
    if (!source) throw new Error(`Source session not found: ${sourceSessionId}`);
    return this.createSession(title || `Fork of ${source.title}`, sourceSessionId);
  }

  async getSession(id: string): Promise<Session | null> {
    const result = this.db.select().from(sessions).where(eq(sessions.id, id)).get();
    if (!result) return null;
    return toSession(result);
  }

  async listSessions(limit?: number, offset?: number): Promise<readonly Session[]> {
    let query = this.db.select().from(sessions).where(sql`${sessions.deletedAt} IS NULL`).orderBy(desc(sessions.createdAt));

    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);

    const results = query.all();
    return results.map(toSession);
  }

  async updateSession(id: string, updates: SessionUpdates): Promise<void> {
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive ? 1 : 0;
    if (updates.model !== undefined) updateData.model = updates.model;
    if (updates.provider !== undefined) updateData.provider = updates.provider;
    if (updates.cost !== undefined) updateData.cost = updates.cost;
    if (updates.inputTokens !== undefined) updateData.inputTokens = updates.inputTokens;
    if (updates.outputTokens !== undefined) updateData.outputTokens = updates.outputTokens;

    this.db.update(sessions).set(updateData).where(eq(sessions.id, id)).run();
  }

  async deleteSession(id: string): Promise<void> {
    this.db.update(sessions).set({ deletedAt: new Date().toISOString() }).where(eq(sessions.id, id)).run();
  }

  async addMessage(sessionId: string, message: AddMessageOptions): Promise<Message>;
  async addMessage(sessionId: string, role: string, content: string, toolCallId?: string, tokens?: { input: number; output: number; reasoning?: number }, model?: string, cost?: number, admittedSeq?: number): Promise<Message>;
  async addMessage(sessionId: string, messageOrRole: AddMessageOptions | string, content?: string, toolCallId?: string, tokens?: { input: number; output: number; reasoning?: number }, model?: string, cost?: number, admittedSeq?: number): Promise<Message> {
    const msg: AddMessageOptions = typeof messageOrRole === 'string'
      ? { role: messageOrRole, content: content || '', toolCallId, tokens, model, cost, admittedSeq }
      : messageOrRole;

    const msgId = uuid() as MessageId;
    const now = new Date().toISOString();

    this.db.insert(messages).values({
      id: msgId,
      sessionId,
      role: msg.role,
      content: msg.content || '',
      toolCallId: msg.toolCallId,
      inputTokens: msg.tokens?.input || 0,
      outputTokens: msg.tokens?.output || 0,
      reasoningTokens: msg.tokens?.reasoning || 0,
      model: msg.model,
      provider: msg.provider,
      cost: msg.cost,
      metadata: { admittedSeq: msg.admittedSeq },
      createdAt: now,
    }).run();

    return {
      id: msgId,
      sessionId: sessionId as SessionId,
      role: msg.role,
      content: msg.content || '',
      toolCallId: msg.toolCallId as ToolCallId | undefined,
      tokens: msg.tokens,
      model: msg.model,
      provider: msg.provider,
      cost: msg.cost,
      createdAt: now,
      admittedSeq: msg.admittedSeq,
    };
  }

  async updateMessage(sessionId: string, messageId: string, updates: MessageSeqUpdates): Promise<void> {
    const existing = this.db.select().from(messages).where(eq(messages.id, messageId)).get();
    if (!existing) return;

    const meta = typeof existing.metadata === 'string' ? JSON.parse(existing.metadata || '{}') : (existing.metadata || {});
    if (updates.admittedSeq !== undefined) meta.admittedSeq = updates.admittedSeq;
    if (updates.promotedSeq !== undefined) meta.promotedSeq = updates.promotedSeq;

    this.db.update(messages).set({ metadata: meta }).where(eq(messages.id, messageId)).run();
  }

  async listMessages(sessionId: string, options?: { limit?: number; offset?: number; role?: string }): Promise<readonly Message[]> {
    let conditions = eq(messages.sessionId, sessionId);
    if (options?.role) {
      conditions = sql`${conditions} AND ${messages.role} = ${options.role}`;
    }

    let query = this.db.select().from(messages).where(conditions).orderBy(messages.createdAt);

    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);

    const results = query.all();
    return results.map(toMessage);
  }

  async searchMessages(query: string, options?: { sessionId?: string; limit?: number }): Promise<readonly Message[]> {
    let conditions = like(messages.content, `%${query}%`);
    if (options?.sessionId) {
      conditions = sql`${conditions} AND ${messages.sessionId} = ${options.sessionId}`;
    }

    let q = this.db.select().from(messages).where(conditions).orderBy(messages.createdAt);
    if (options?.limit) q = q.limit(options.limit);

    const results = q.all();
    return results.map(toMessage);
  }

  async getSessionStats(): Promise<SessionStats> {
    const totalResult = this.db.select({ count: count() }).from(sessions).where(sql`${sessions.deletedAt} IS NULL`).get();
    const totalMessagesResult = this.db.select({ count: count() }).from(messages).get();
    const costResult = this.db.select({ total: sum(sessions.cost) }).from(sessions).where(sql`${sessions.deletedAt} IS NULL`).get();
    const tokensResult = this.db.select({
      input: sum(sessions.inputTokens),
      output: sum(sessions.outputTokens),
    }).from(sessions).where(sql`${sessions.deletedAt} IS NULL`).get();

    return {
      totalSessions: Number(totalResult?.count) || 0,
      totalCost: Number(costResult?.total) || 0,
      totalInputTokens: Number(tokensResult?.input) || 0,
      totalOutputTokens: Number(tokensResult?.output) || 0,
      totalMessages: Number(totalMessagesResult?.count) || 0,
      sessionsByDate: [],
      costByModel: [],
    };
  }
}
