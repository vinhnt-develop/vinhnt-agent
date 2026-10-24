import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { RunEvent, RunId, TraceId } from '@vinhnt-sdk/schema';
import { SqliteRunEventStore } from './sqlite-run-event-store';

function makeStore() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE run_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      sequence INTEGER NOT NULL DEFAULT 0,
      data TEXT DEFAULT '{}',
      trace_id TEXT,
      occurred_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      is_active INTEGER DEFAULT 1,
      model TEXT,
      provider TEXT,
      cost REAL DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      directory TEXT,
      git_branch TEXT,
      version TEXT,
      parent_id TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE TABLE session_surfaces (
      session_id TEXT NOT NULL,
      surface_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
      PRIMARY KEY (session_id, surface_id)
    );
  `);
  const db = drizzle(sqlite);
  return { sqlite, store: new SqliteRunEventStore(db) };
}

function makeEvent(runId: string, id = 'evt', sequence?: number): RunEvent {
  return {
    id,
    runId: runId as RunId,
    sequence: sequence as number,
    type: 'test.event',
    data: { ok: true },
    traceId: 'tr' as TraceId,
    occurredAt: new Date().toISOString(),
  };
}

describe('SqliteRunEventStore sequence allocation', () => {
  it('allocates unique, contiguous sequences for concurrent appendWithSequence', async () => {
    const { store } = makeStore();

    const sequences = await Promise.all(
      Array.from({ length: 50 }, (_, i) => store.appendWithSequence(makeEvent('run_1', `e${i}`))),
    );

    expect(new Set(sequences).size).toBe(50);
    expect([...sequences].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i));
  });

  it('keeps sequences independent per aggregate', async () => {
    const { store } = makeStore();

    expect(await store.appendWithSequence(makeEvent('run_a'))).toBe(0);
    expect(await store.appendWithSequence(makeEvent('run_b'))).toBe(0);
    expect(await store.appendWithSequence(makeEvent('run_a'))).toBe(1);
  });

  it('allocates a sequence in append() even when the caller omits one', async () => {
    const { store } = makeStore();

    await store.append(makeEvent('run_auto'));
    await store.append(makeEvent('run_auto'));

    const events = await store.list('run_auto');
    expect(events.map((e) => e.sequence)).toEqual([0, 1]);
    expect(await store.getNextSequence('run_auto')).toBe(2);
  });

  it('does not persist events flagged persist=false but still notifies listeners', async () => {
    const { store } = makeStore();
    const seen: string[] = [];
    store.subscribe((e) => seen.push(e.id));

    await store.append({ ...makeEvent('run_eph'), persist: false });

    expect(seen).toEqual(['evt']);
    expect(await store.list('run_eph')).toHaveLength(0);
  });
});

describe('SqliteRunEventStore snapshots', () => {
  it('allocates a sequence for snapshots and returns the latest', async () => {
    const { store } = makeStore();

    await store.saveSnapshot('run_s', { step: 1 });
    await store.append(makeEvent('run_s', 'e0', 1));
    await store.saveSnapshot('run_s', { step: 2 });

    const snapshot = await store.getSnapshot('run_s');
    expect(snapshot?.sequence).toBe(2);
    expect(snapshot?.state).toEqual({ step: 2 });

    const afterSeq0 = await store.getSnapshotAfterSequence('run_s', 0);
    expect(afterSeq0?.sequence).toBe(2);
    expect(await store.getSnapshotAfterSequence('run_s', 2)).toBeNull();
  });
});

describe('SqliteRunEventStore appendTransactional', () => {
  it('writes the event and the session update in one atomic transaction', async () => {
    const { sqlite, store } = makeStore();
    sqlite.prepare('INSERT INTO sessions (id, title) VALUES (?, ?)').run('ses_1', 'old');

    await store.appendTransactional(makeEvent('run_tx', 'e0', 0), {
      sessionId: 'ses_1',
      updates: { title: 'new', isActive: false },
    });

    const row = sqlite.prepare('SELECT title, is_active FROM sessions WHERE id = ?').get('ses_1') as {
      title: string;
      is_active: number;
    };
    expect(row.title).toBe('new');
    expect(row.is_active).toBe(0);
    expect(await store.list('run_tx')).toHaveLength(1);
  });
});

describe('SqliteRunEventStore sessions surfaces', () => {
  it('upserts and deletes ui.surface snapshots by session', async () => {
    const { sqlite, store } = makeStore();

    await store.append({
      ...makeEvent('run_ui'),
      type: 'ui.surface',
      data: {
        sessionId: 'ses_ui',
        surfaceId: 'revenue',
        action: 'upsert',
        surface: { surfaceId: 'revenue', components: [{ type: 'text', text: 'v1' }] },
      },
    });

    let row = sqlite.prepare('SELECT payload FROM session_surfaces WHERE session_id = ? AND surface_id = ?')
      .get('ses_ui', 'revenue') as { payload: string };
    expect(JSON.parse(row.payload).components[0].text).toBe('v1');

    await store.append({
      ...makeEvent('run_ui'),
      type: 'ui.surface',
      data: {
        sessionId: 'ses_ui',
        surfaceId: 'revenue',
        action: 'upsert',
        surface: { surfaceId: 'revenue', components: [{ type: 'text', text: 'v2' }] },
      },
    });

    row = sqlite.prepare('SELECT payload FROM session_surfaces WHERE session_id = ? AND surface_id = ?')
      .get('ses_ui', 'revenue') as { payload: string };
    expect(JSON.parse(row.payload).components[0].text).toBe('v2');
    expect(
      sqlite.prepare('SELECT count(*) AS c FROM session_surfaces').get() as { c: number },
    ).toEqual({ c: 1 });

    await store.append({
      ...makeEvent('run_ui'),
      type: 'ui.surface',
      data: { sessionId: 'ses_ui', surfaceId: 'revenue', action: 'delete' },
    });

    expect(
      sqlite.prepare('SELECT count(*) AS c FROM session_surfaces').get() as { c: number },
    ).toEqual({ c: 0 });
  });

  it('persists ui.surface appended inside a session transaction', async () => {
    const { sqlite, store } = makeStore();
    sqlite.prepare('INSERT INTO sessions (id, title) VALUES (?, ?)').run('ses_tx', 'old');

    await store.appendTransactional(
      {
        ...makeEvent('run_ui_tx'),
        type: 'ui.surface',
        data: {
          sessionId: 'ses_tx',
          surfaceId: 'summary',
          action: 'upsert',
          surface: { surfaceId: 'summary', components: [{ type: 'text', text: 'ok' }] },
        },
      },
      { sessionId: 'ses_tx', updates: { title: 'new' } },
    );

    const row = sqlite
      .prepare('SELECT payload FROM session_surfaces WHERE session_id = ? AND surface_id = ?')
      .get('ses_tx', 'summary') as { payload: string };
    expect(JSON.parse(row.payload).surfaceId).toBe('summary');
    expect(await store.list('run_ui_tx')).toHaveLength(1);
  });
});

describe('SqliteRunEventStore.exists', () => {
  it('resolves by row id, not by run id', async () => {
    const { store } = makeStore();
    await store.append(makeEvent('run_exists', 'e0', 0));

    const [event] = await store.list('run_exists');
    expect(await store.exists(event.id)).toBe(true);
    expect(await store.exists('run_exists')).toBe(false);
    expect(await store.exists('not-a-number')).toBe(false);
  });
});
