import type { RunEvent, RunId, TraceId } from '@vinhnt-sdk/schema';
import type { RunEventStore, RunEventSnapshot, RunEventListener } from '@vinhnt-sdk/session';
import { getDatabase } from './database.js';

export class LocalRunEventStore implements RunEventStore {
  private listeners: RunEventListener[] = [];

  constructor(private dataDir: string) {}

  private db() {
    return getDatabase(this.dataDir);
  }

  async append(event: RunEvent): Promise<void> {
    this.db()
      .prepare(
        `INSERT INTO run_events (run_id, type, sequence, data, trace_id, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.runId,
        event.type,
        event.sequence,
        JSON.stringify(event.data || {}),
        event.traceId,
        event.occurredAt,
      );

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  async exists(eventId: string): Promise<boolean> {
    const row = this.db()
      .prepare(`SELECT 1 FROM run_events WHERE run_id = ? LIMIT 1`)
      .get(eventId) as any;
    return !!row;
  }

  async list(runId: string, afterSequence?: number): Promise<readonly RunEvent[]> {
    let query = `SELECT * FROM run_events WHERE run_id = ?`;
    const params: any[] = [runId];

    if (afterSequence !== undefined) {
      query += ` AND sequence > ?`;
      params.push(afterSequence);
    }

    query += ` ORDER BY sequence ASC`;

    const rows = this.db().prepare(query).all(...params) as any[];

    return rows.map((row) => ({
      id: String(row.id),
      runId: row.run_id as RunId,
      sequence: row.sequence,
      type: row.type,
      data: JSON.parse(row.data || '{}'),
      traceId: row.trace_id as TraceId,
      occurredAt: row.occurred_at,
    }));
  }

  async listRunIds(): Promise<string[]> {
    const rows = this.db()
      .prepare(`SELECT DISTINCT run_id FROM run_events ORDER BY occurred_at DESC`)
      .all() as any[];
    return rows.map((row) => row.run_id);
  }

  async getNextSequence(aggregateId: string): Promise<number> {
    const row = this.db()
      .prepare(
        `SELECT COALESCE(MAX(sequence), -1) + 1 as next_seq FROM run_events WHERE run_id = ?`,
      )
      .get(aggregateId) as any;
    return row.next_seq;
  }

  async saveSnapshot(runId: string, state: Record<string, unknown>): Promise<void> {
    // Local implementation: store as a special run event
    await this.append({
      id: crypto.randomUUID(),
      runId: runId as RunId,
      sequence: await this.getNextSequence(runId),
      type: 'snapshot',
      data: state,
      traceId: '' as TraceId,
      occurredAt: new Date().toISOString(),
    });
  }

  async getSnapshot(runId: string): Promise<RunEventSnapshot | null> {
    const row = this.db()
      .prepare(
        `SELECT * FROM run_events WHERE run_id = ? AND type = 'snapshot' ORDER BY sequence DESC LIMIT 1`,
      )
      .get(runId) as any;

    if (!row) return null;

    return {
      runId: row.run_id,
      sequence: row.sequence,
      state: JSON.parse(row.data || '{}'),
      occurredAt: row.occurred_at,
    };
  }

  async getSnapshotAfterSequence(runId: string, sequence: number): Promise<RunEventSnapshot | null> {
    const row = this.db()
      .prepare(
        `SELECT * FROM run_events WHERE run_id = ? AND type = 'snapshot' AND sequence > ? ORDER BY sequence DESC LIMIT 1`,
      )
      .get(runId, sequence) as any;

    if (!row) return null;

    return {
      runId: row.run_id,
      sequence: row.sequence,
      state: JSON.parse(row.data || '{}'),
      occurredAt: row.occurred_at,
    };
  }

  subscribe(listener: RunEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
