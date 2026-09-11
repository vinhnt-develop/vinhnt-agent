import type { MemoryItem, MemoryStore, MemoryTier } from '@vinhnt-sdk/knowledge';
import { getDatabase } from './database.js';
import { v4 as uuid } from 'uuid';

export class LocalMemoryStore implements MemoryStore {
  constructor(private dataDir: string) {}

  private db() {
    return getDatabase(this.dataDir);
  }

  async get(key: string, sessionId: string): Promise<MemoryItem | undefined> {
    const row = this.db()
      .prepare(`SELECT * FROM memories WHERE key = ? AND session_id = ? ORDER BY updated_at DESC LIMIT 1`)
      .get(key, sessionId) as any;

    if (!row) return undefined;

    return {
      id: row.id,
      sessionId: row.session_id,
      tier: row.tier,
      key: row.key,
      value: row.value,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async set(item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryItem> {
    const id = uuid();
    const now = new Date().toISOString();

    const existing = this.db()
      .prepare(`SELECT id FROM memories WHERE key = ? AND session_id = ? AND tier = ?`)
      .get(item.key, item.sessionId, item.tier) as any;

    if (existing) {
      this.db()
        .prepare(`UPDATE memories SET value = ?, tags = ?, updated_at = ? WHERE id = ?`)
        .run(item.value, JSON.stringify(item.tags || []), now, existing.id);

      return {
        ...item,
        id: existing.id,
        createdAt: now,
        updatedAt: now,
      };
    }

    this.db()
      .prepare(
        `INSERT INTO memories (id, session_id, tier, key, value, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, item.sessionId, item.tier, item.key, item.value, JSON.stringify(item.tags || []), now, now);

    return {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async delete(key: string, sessionId: string): Promise<void> {
    this.db().prepare(`DELETE FROM memories WHERE key = ? AND session_id = ?`).run(key, sessionId);
  }

  async search(query: string, sessionId: string): Promise<MemoryItem[]> {
    const rows = this.db()
      .prepare(
        `SELECT * FROM memories WHERE (key LIKE ? OR value LIKE ?) AND session_id = ? ORDER BY updated_at DESC`,
      )
      .all(`%${query}%`, `%${query}%`, sessionId) as any[];

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      tier: row.tier,
      key: row.key,
      value: row.value,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listByTier(tier: MemoryTier, sessionId: string): Promise<MemoryItem[]> {
    const rows = this.db()
      .prepare(`SELECT * FROM memories WHERE tier = ? AND session_id = ? ORDER BY updated_at DESC`)
      .all(tier, sessionId) as any[];

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      tier: row.tier,
      key: row.key,
      value: row.value,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async list(sessionId?: string): Promise<MemoryItem[]> {
    let query = `SELECT * FROM memories`;
    const params: any[] = [];

    if (sessionId) {
      query += ` WHERE session_id = ?`;
      params.push(sessionId);
    }

    query += ` ORDER BY updated_at DESC`;

    const rows = this.db().prepare(query).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      tier: row.tier,
      key: row.key,
      value: row.value,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async count(): Promise<number> {
    const row = this.db().prepare(`SELECT COUNT(*) as count FROM memories`).get() as any;
    return row.count;
  }
}
