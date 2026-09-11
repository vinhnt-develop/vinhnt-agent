import type {
  SessionId,
  MessageId,
  Session,
  Message,
  SessionStats,
  SessionUpdates,
  MessageSeqUpdates,
  AddMessageOptions,
} from '@vinhnt-sdk/schema';
import type { SessionStore } from '@vinhnt-sdk/session';
import { getDatabase } from './database.js';
import { v4 as uuid } from 'uuid';

export class LocalSessionStore implements SessionStore {
  constructor(private dataDir: string) {}

  private db() {
    return getDatabase(this.dataDir);
  }

  async createSession(title?: string, parentSessionId?: string): Promise<Session> {
    const sessionId = uuid() as SessionId;
    const now = new Date().toISOString();

    this.db()
      .prepare(
        `INSERT INTO sessions (id, title, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(sessionId, title || null, JSON.stringify({ parentSessionId }), now, now);

    return {
      id: sessionId,
      title: title || '',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      parentSessionId: parentSessionId as any,
      metadata: { parentSessionId },
    };
  }

  async forkSession(sourceSessionId: string, title?: string): Promise<Session> {
    const source = await this.getSession(sourceSessionId);
    if (!source) throw new Error(`Source session not found: ${sourceSessionId}`);
    return this.createSession(title || `Fork of ${source.title}`, sourceSessionId);
  }

  async getSession(id: string): Promise<Session | null> {
    const row = this.db()
      .prepare(`SELECT * FROM sessions WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as any;

    if (!row) return null;

    return {
      id: row.id as SessionId,
      title: row.title || '',
      isActive: row.is_active === 1,
      model: row.model,
      provider: row.provider,
      cost: row.cost,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }

  async listSessions(limit?: number, offset?: number): Promise<readonly Session[]> {
    let query = `SELECT * FROM sessions WHERE deleted_at IS NULL ORDER BY created_at DESC`;
    const params: any[] = [];

    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset) {
      query += ` OFFSET ?`;
      params.push(offset);
    }

    const rows = this.db().prepare(query).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id as SessionId,
      title: row.title || '',
      isActive: row.is_active === 1,
      model: row.model,
      provider: row.provider,
      cost: row.cost,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata || '{}'),
    }));
  }

  async updateSession(id: string, updates: SessionUpdates): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];

    if (updates.title !== undefined) {
      sets.push('title = ?');
      params.push(updates.title);
    }
    if (updates.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }
    if (updates.model !== undefined) {
      sets.push('model = ?');
      params.push(updates.model);
    }
    if (updates.provider !== undefined) {
      sets.push('provider = ?');
      params.push(updates.provider);
    }
    if (updates.cost !== undefined) {
      sets.push('cost = ?');
      params.push(updates.cost);
    }
    if (updates.inputTokens !== undefined) {
      sets.push('input_tokens = ?');
      params.push(updates.inputTokens);
    }
    if (updates.outputTokens !== undefined) {
      sets.push('output_tokens = ?');
      params.push(updates.outputTokens);
    }

    if (sets.length === 0) return;

    sets.push('updated_at = datetime(\'now\')');
    params.push(id);

    this.db().prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  async deleteSession(id: string): Promise<void> {
    this.db()
      .prepare(`UPDATE sessions SET deleted_at = datetime('now') WHERE id = ?`)
      .run(id);
  }

  async addMessage(sessionId: string, message: AddMessageOptions): Promise<Message>;
  async addMessage(sessionId: string, role: string, content: string, toolCallId?: string, tokens?: { input: number; output: number; reasoning?: number }, model?: string, cost?: number, admittedSeq?: number): Promise<Message>;
  async addMessage(
    sessionId: string,
    messageOrRole: AddMessageOptions | string,
    content?: string,
    toolCallId?: string,
    tokens?: { input: number; output: number; reasoning?: number },
    model?: string,
    cost?: number,
    admittedSeq?: number,
  ): Promise<Message> {
    // Support both overloads
    const msg: AddMessageOptions = typeof messageOrRole === 'string'
      ? { role: messageOrRole, content: content || '', toolCallId, tokens, model, cost, admittedSeq }
      : messageOrRole;

    const msgId = uuid() as MessageId;
    const now = new Date().toISOString();

    this.db()
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, tool_call_id, input_tokens, output_tokens, reasoning_tokens, model, provider, cost, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        msgId,
        sessionId,
        msg.role,
        msg.content || '',
        msg.toolCallId || null,
        msg.tokens?.input || 0,
        msg.tokens?.output || 0,
        msg.tokens?.reasoning || 0,
        msg.model || null,
        msg.provider || null,
        msg.cost || 0,
        JSON.stringify({ admittedSeq: msg.admittedSeq }),
        now,
      );

    return {
      id: msgId,
      sessionId: sessionId as SessionId,
      role: msg.role,
      content: msg.content || '',
      toolCallId: msg.toolCallId as any,
      tokens: msg.tokens,
      model: msg.model,
      provider: msg.provider,
      cost: msg.cost,
      createdAt: now,
      admittedSeq: msg.admittedSeq,
    };
  }

  async updateMessage(sessionId: string, messageId: string, updates: MessageSeqUpdates): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];

    if (updates.admittedSeq !== undefined) {
      sets.push('metadata = json_set(COALESCE(metadata, \'{}\'), \'$.admittedSeq\', ?)');
      params.push(updates.admittedSeq);
    }
    if (updates.promotedSeq !== undefined) {
      sets.push('metadata = json_set(COALESCE(metadata, \'{}\'), \'$.promotedSeq\', ?)');
      params.push(updates.promotedSeq);
    }

    if (sets.length === 0) return;
    params.push(sessionId, messageId);

    this.db().prepare(`UPDATE messages SET ${sets.join(', ')} WHERE session_id = ? AND id = ?`).run(...params);
  }

  async listMessages(sessionId: string, options?: { limit?: number; offset?: number; role?: string }): Promise<readonly Message[]> {
    let query = `SELECT * FROM messages WHERE session_id = ?`;
    const params: any[] = [sessionId];

    if (options?.role) {
      query += ` AND role = ?`;
      params.push(options.role);
    }

    query += ` ORDER BY created_at ASC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }
    if (options?.offset) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    const rows = this.db().prepare(query).all(...params) as any[];

    return rows.map((row) => {
      const meta = JSON.parse(row.metadata || '{}');
      return {
        id: row.id as MessageId,
        sessionId: row.session_id as SessionId,
        role: row.role,
        content: row.content,
        toolCallId: row.tool_call_id,
        tokens: {
          input: row.input_tokens,
          output: row.output_tokens,
          reasoning: row.reasoning_tokens,
        },
        model: row.model,
        provider: row.provider,
        cost: row.cost,
        createdAt: row.created_at,
        admittedSeq: meta.admittedSeq,
        promotedSeq: meta.promotedSeq,
      };
    });
  }

  async searchMessages(query: string, options?: { sessionId?: string; limit?: number }): Promise<readonly Message[]> {
    let sql = `SELECT * FROM messages WHERE content LIKE ?`;
    const params: any[] = [`%${query}%`];

    if (options?.sessionId) {
      sql += ` AND session_id = ?`;
      params.push(options.sessionId);
    }

    sql += ` ORDER BY created_at ASC`;

    if (options?.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = this.db().prepare(sql).all(...params) as any[];

    return rows.map((row) => {
      const meta = JSON.parse(row.metadata || '{}');
      return {
        id: row.id as MessageId,
        sessionId: row.session_id as SessionId,
        role: row.role,
        content: row.content,
        toolCallId: row.tool_call_id,
        tokens: {
          input: row.input_tokens,
          output: row.output_tokens,
          reasoning: row.reasoning_tokens,
        },
        model: row.model,
        provider: row.provider,
        cost: row.cost,
        createdAt: row.created_at,
        admittedSeq: meta.admittedSeq,
        promotedSeq: meta.promotedSeq,
      };
    });
  }

  async getSessionStats(): Promise<SessionStats> {
    const total = this.db().prepare(`SELECT COUNT(*) as count FROM sessions WHERE deleted_at IS NULL`).get() as any;
    const totalMessages = this.db().prepare(`SELECT COUNT(*) as count FROM messages`).get() as any;
    const costRow = this.db().prepare(`SELECT COALESCE(SUM(cost), 0) as total_cost FROM sessions WHERE deleted_at IS NULL`).get() as any;
    const tokensRow = this.db().prepare(`SELECT COALESCE(SUM(input_tokens), 0) as input, COALESCE(SUM(output_tokens), 0) as output FROM sessions WHERE deleted_at IS NULL`).get() as any;

    return {
      totalSessions: total.count,
      totalCost: costRow.total_cost,
      totalInputTokens: tokensRow.input,
      totalOutputTokens: tokensRow.output,
      totalMessages: totalMessages.count,
      sessionsByDate: [],
      costByModel: [],
    };
  }
}
