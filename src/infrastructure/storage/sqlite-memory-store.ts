import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { memories } from '@/modules/agent/schemas/agent.schema';
import { eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { MemoryStore, MemoryItem, MemoryTier } from '@vinhnt-sdk/knowledge';
import { v4 as uuid } from 'uuid';

type MemoryScope = 'session' | 'user' | 'app';

interface MemoryScopeFilter {
  userId?: string;
  appId?: string;
  scopes?: readonly MemoryScope[];
}

type ScopedMemoryItem = MemoryItem & {
  scope?: MemoryScope;
  userId?: string;
  appId?: string;
};

type MemoryWrite = Omit<ScopedMemoryItem, 'id' | 'createdAt' | 'updatedAt'>;

function toMemoryItem(row: any): ScopedMemoryItem {
  return {
    id: row.id,
    sessionId: row.sessionId || '',
    tier: row.tier || 'working',
    key: row.key,
    value: row.value,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : (row.tags || []),
    scope: (row.scope || 'session') as MemoryScope,
    userId: row.userId ?? undefined,
    appId: row.appId ?? undefined,
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || new Date().toISOString(),
  };
}

const SCOPE_ORDER = sql`CASE ${memories.scope} WHEN 'session' THEN 0 WHEN 'user' THEN 1 ELSE 2 END ASC, ${memories.updatedAt} DESC`;

@Injectable()
export class SqliteMemoryStore implements MemoryStore {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: any,
  ) {}

  private scopeCondition(sessionId?: string, filter?: MemoryScopeFilter) {
    if (!sessionId && !filter) return sql`1 = 1`;

    const scopes = new Set<MemoryScope>(filter?.scopes ?? ['session', 'user', 'app']);
    const parts: SQL[] = [];
    if (sessionId && scopes.has('session')) {
      parts.push(sql`((${memories.scope} = 'session' OR ${memories.scope} IS NULL) AND ${memories.sessionId} = ${sessionId})`);
    }
    if (filter?.userId && scopes.has('user')) {
      parts.push(sql`(${memories.scope} = 'user' AND ${memories.userId} = ${filter.userId})`);
    }
    if (filter?.appId && scopes.has('app')) {
      parts.push(sql`(${memories.scope} = 'app' AND ${memories.appId} = ${filter.appId})`);
    }
    if (parts.length === 0) return sql`0 = 1`;
    return sql`(${sql.join(parts, sql` OR `)})`;
  }

  async get(key: string, sessionId: string, scope?: MemoryScopeFilter): Promise<ScopedMemoryItem | undefined> {
    const result = this.db.select().from(memories)
      .where(sql`${memories.key} = ${key} AND ${this.scopeCondition(sessionId, scope)}`)
      .orderBy(SCOPE_ORDER)
      .limit(1)
      .get();

    return result ? toMemoryItem(result) : undefined;
  }

  async set(item: MemoryWrite): Promise<ScopedMemoryItem> {
    const id = uuid();
    const now = new Date().toISOString();
    const scope = item.scope ?? 'session';
    if (scope === 'user' && item.userId === undefined) {
      throw new Error('user-scoped memory requires userId');
    }
    if (scope === 'app' && item.appId === undefined) {
      throw new Error('app-scoped memory requires appId');
    }
    const owner = scope === 'session'
      ? sql`(${memories.scope} = 'session' OR ${memories.scope} IS NULL) AND ${memories.sessionId} = ${item.sessionId}`
      : scope === 'user'
        ? sql`${memories.scope} = 'user' AND ${memories.userId} = ${item.userId ?? ''}`
        : sql`${memories.scope} = 'app' AND ${memories.appId} = ${item.appId ?? ''}`;

    const existing = this.db.select().from(memories)
      .where(sql`${memories.key} = ${item.key} AND ${memories.tier} = ${item.tier} AND ${owner}`)
      .get();

    if (existing) {
      this.db.update(memories).set({
        value: item.value,
        tags: item.tags || [],
        updatedAt: now,
      }).where(eq(memories.id, existing.id)).run();

      return {
        ...toMemoryItem(existing),
        value: item.value,
        tags: item.tags || [],
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
      scope,
      userId: item.userId,
      appId: item.appId,
      createdAt: now,
      updatedAt: now,
    }).run();

    return {
      ...item,
      scope,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async delete(key: string, sessionId: string, scope?: MemoryScopeFilter): Promise<void> {
    this.db.delete(memories)
      .where(sql`${memories.key} = ${key} AND ${this.scopeCondition(sessionId, scope)}`)
      .run();
  }

  async deleteAll(sessionId: string): Promise<void> {
    this.db.delete(memories)
      .where(sql`(${memories.scope} = 'session' OR ${memories.scope} IS NULL) AND ${memories.sessionId} = ${sessionId}`)
      .run();
  }

  async search(query: string, sessionId: string, scope?: MemoryScopeFilter): Promise<ScopedMemoryItem[]> {
    const results = this.db.select().from(memories)
      .where(sql`(${memories.key} LIKE ${'%' + query + '%'} OR ${memories.value} LIKE ${'%' + query + '%'}) AND ${this.scopeCondition(sessionId, scope)}`)
      .orderBy(SCOPE_ORDER)
      .all();

    return results.map(toMemoryItem);
  }

  async listByTier(tier: MemoryTier, sessionId: string, scope?: MemoryScopeFilter): Promise<ScopedMemoryItem[]> {
    const results = this.db.select().from(memories)
      .where(sql`${memories.tier} = ${tier} AND ${this.scopeCondition(sessionId, scope)}`)
      .orderBy(SCOPE_ORDER)
      .all();

    return results.map(toMemoryItem);
  }

  async list(
    sessionId?: string,
    options?: { tier?: MemoryTier; limit?: number; offset?: number; scope?: MemoryScopeFilter },
  ): Promise<ScopedMemoryItem[]> {
    const conditions = [this.scopeCondition(sessionId, options?.scope)];
    if (options?.tier) conditions.push(sql`${memories.tier} = ${options.tier}`);

    let query: any = this.db.select().from(memories)
      .where(sql.join(conditions, sql` AND `))
      .orderBy(SCOPE_ORDER);
    if (options?.limit !== undefined) query = query.limit(options.limit);
    if (options?.offset !== undefined) query = query.offset(options.offset);
    return query.all().map(toMemoryItem);
  }

  async count(sessionId?: string, tier?: MemoryTier, scope?: MemoryScopeFilter): Promise<number> {
    const conditions = [this.scopeCondition(sessionId, scope)];
    if (tier) conditions.push(sql`${memories.tier} = ${tier}`);
    const result = this.db.select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(sql.join(conditions, sql` AND `))
      .get();
    return result?.count || 0;
  }
}
