import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '@/infrastructure/database/schema';
import { SqliteMemoryStore } from './sqlite-memory-store';

const BASE = { tier: 'long-term', tags: [] as string[] };

describe('SqliteMemoryStore scopes (P1.2)', () => {
  let sqlite: Database.Database;
  let store: SqliteMemoryStore;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    sqlite.prepare('INSERT INTO sessions (id, title) VALUES (?, ?)').run('s1', 'Session 1');
    sqlite.prepare('INSERT INTO sessions (id, title) VALUES (?, ?)').run('s2', 'Session 2');
    store = new SqliteMemoryStore(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('recalls a user-scoped fact from another session', async () => {
    await store.set({
      ...BASE,
      key: 'timezone',
      value: 'Asia/Ho_Chi_Minh',
      sessionId: 's1',
      scope: 'user',
      userId: 'u1',
    });

    const found = await store.search('timezone', 's2', { userId: 'u1' });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      key: 'timezone',
      value: 'Asia/Ho_Chi_Minh',
      scope: 'user',
      userId: 'u1',
    });
  });

  it('does not leak user, app, or session scoped facts', async () => {
    await store.set({ ...BASE, key: 'session-fact', value: 's1', sessionId: 's1' });
    await store.set({ ...BASE, key: 'user-fact', value: 'u1', sessionId: 's1', scope: 'user', userId: 'u1' });
    await store.set({ ...BASE, key: 'app-fact', value: 'a1', sessionId: 's1', scope: 'app', appId: 'a1' });

    expect(await store.search('fact', 's2', { userId: 'u2' })).toEqual([]);
    expect(await store.search('fact', 's2', { userId: 'u2', appId: 'a2' })).toEqual([]);
    expect(await store.search('fact', 's2')).toEqual([]);
    expect((await store.get('user-fact', 's2', { userId: 'u1' }))?.value).toBe('u1');
    expect((await store.get('app-fact', 's2', { appId: 'a1' }))?.value).toBe('a1');
  });

  it('rejects scoped writes without their owner id', async () => {
    await expect(store.set({ ...BASE, key: 'k', value: 'v', sessionId: 's1', scope: 'user' })).rejects.toThrow('userId');
    await expect(store.set({ ...BASE, key: 'k', value: 'v', sessionId: 's1', scope: 'app' })).rejects.toThrow('appId');
  });

  it('resolves session > user > app for the same key and tier', async () => {
    await store.set({ ...BASE, key: 'k', value: 'app', sessionId: 's1', scope: 'app', appId: 'a1' });
    await store.set({ ...BASE, key: 'k', value: 'user', sessionId: 's1', scope: 'user', userId: 'u1' });
    await store.set({ ...BASE, key: 'k', value: 'session', sessionId: 's1' });

    const scope = { userId: 'u1', appId: 'a1' };
    expect((await store.get('k', 's1', scope))?.value).toBe('session');
    expect((await store.get('k', 's2', scope))?.value).toBe('user');
    expect((await store.get('k', 's2', { appId: 'a1' }))?.value).toBe('app');
  });

  it('keeps scopes independent and deleteAll removes only the session scope', async () => {
    await store.set({ ...BASE, key: 'k', value: 'session', sessionId: 's1' });
    await store.set({ ...BASE, key: 'k', value: 'user', sessionId: 's1', scope: 'user', userId: 'u1' });
    await store.set({ ...BASE, key: 'k', value: 'app', sessionId: 's1', scope: 'app', appId: 'a1' });

    expect(await store.count('s1', 'long-term', { userId: 'u1', appId: 'a1' })).toBe(3);
    await store.deleteAll('s1');
    expect(await store.count('s1', 'long-term', { userId: 'u1', appId: 'a1' })).toBe(2);
    expect((await store.get('k', 's1', { userId: 'u1', appId: 'a1' }))?.value).toBe('user');
  });
});
