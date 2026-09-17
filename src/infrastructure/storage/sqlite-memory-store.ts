import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { memories } from '@/modules/agent/schemas/agent.schema';
import { eq, sql } from 'drizzle-orm';
import type { MemoryStore, MemoryItem, MemoryTier } from '@vinhnt-sdk/knowledge';
import { v4 as uuid } from 'uuid';

function toMemoryItem(row: any): MemoryItem {
  return {
    id: row.id,
    sessionId: row.sessionId || '',
    tier: row.tier || 'working',
    key: row.key,
    value: row.value,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : (row.tags || []),
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || new Date().toISOString(),
  };
}

@Injectable()
export class SqliteMemoryStore implements MemoryStore {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: any,
  ) {}

  async get(key: string, sessionId: string): Promise<MemoryItem | undefined> {
    const result = this.db.select().from(memories)
      .where(sql`${memories.key} = ${key} AND ${memories.sessionId} = ${sessionId}`)
      .orderBy(sql`${memories.updatedAt} DESC`)
      .limit(1)
      .get();

    return result ? toMemoryItem(result) : undefined;
  }

  async set(item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryItem> {
    const id = uuid();
    const now = new Date().toISOString();

    const existing = this.db.select().from(memories)
      .where(sql`${memories.key} = ${item.key} AND ${memories.sessionId} = ${item.sessionId} AND ${memories.tier} = ${item.tier}`)
      .get();

    if (existing) {
      this.db.update(memories).set({
        value: item.value,
        tags: item.tags || [],
        updatedAt: now,
      }).where(eq(memories.id, existing.id)).run();

      return {
        ...item,
        id: existing.id,
        createdAt: existing.createdAt || now,
        updatedAt: now,
      };
    }

    this.db.insert(memories).values({
      id,
      sessionId: item.sessionId,
      tier: item.tier,
      key: item.key,
      value: item.value,
      tags: item.tags || [],
      createdAt: now,
      updatedAt: now,
    }).run();

    return {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async delete(key: string, sessionId: string): Promise<void> {
    this.db.delete(memories).where(sql`${memories.key} = ${key} AND ${memories.sessionId} = ${sessionId}`).run();
  }

  async deleteAll(sessionId: string): Promise<void> {
    this.db.delete(memories).where(eq(memories.sessionId, sessionId)).run();
  }

  async search(query: string, sessionId: string): Promise<MemoryItem[]> {
    const results = this.db.select().from(memories)
      .where(sql`(${memories.key} LIKE ${'%' + query + '%'} OR ${memories.value} LIKE ${'%' + query + '%'}) AND ${memories.sessionId} = ${sessionId}`)
      .orderBy(sql`${memories.updatedAt} DESC`)
      .all();

    return results.map(toMemoryItem);
  }

  async listByTier(tier: MemoryTier, sessionId: string): Promise<MemoryItem[]> {
    const results = this.db.select().from(memories)
      .where(sql`${memories.tier} = ${tier} AND ${memories.sessionId} = ${sessionId}`)
      .orderBy(sql`${memories.updatedAt} DESC`)
      .all();

    return results.map(toMemoryItem);
  }

  async list(sessionId?: string): Promise<MemoryItem[]> {
    let query = this.db.select().from(memories);
    if (sessionId) {
      query = query.where(eq(memories.sessionId, sessionId)) as any;
    }
    const results = query.orderBy(sql`${memories.updatedAt} DESC`).all();
    return results.map(toMemoryItem);
  }

  async count(): Promise<number> {
    const result = this.db.select({ count: sql<number>`count(*)` }).from(memories).get();
    return result?.count || 0;
  }
}
