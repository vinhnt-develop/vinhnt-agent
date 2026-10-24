import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { runEvents } from '@/modules/agent/schemas/agent.schema';
import { sessions, sessionSurfaces } from '@/modules/session/schemas/session.schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import type { RunEventStore, RunEvent, RunEventSnapshot, RunEventListener, RunId, TraceId, SessionUpdates } from '@vinhnt-sdk/schema';
import { v4 as uuid } from 'uuid';

/** The subset of a RunEvent actually written to the row. */
type PersistableEvent = Pick<RunEvent, 'runId' | 'type' | 'data' | 'traceId' | 'occurredAt'>;

@Injectable()
export class SqliteRunEventStore implements RunEventStore {
  private listeners: RunEventListener[] = [];

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: any,
  ) {}

  /**
   * Allocate the next sequence for an aggregate inside an OPEN transaction.
   * Because better-sqlite3 transactions run synchronously, the MAX() read and
   * the following INSERT cannot interleave — this is what makes concurrent
   * `append`/`appendWithSequence` calls (which `await` between calls) allocate
   * unique sequences instead of colliding on a stale MAX.
   */
  private nextSequenceInTx(tx: any, runId: string): number {
    const row = tx
      .select({ nextSeq: sql<number>`COALESCE(MAX(${runEvents.sequence}), -1) + 1` })
      .from(runEvents)
      .where(eq(runEvents.runId, runId))
      .get();
    return row?.nextSeq ?? 0;
  }

  private insertInTx(tx: any, event: PersistableEvent, sequence: number): void {
    tx.insert(runEvents)
      .values({
        runId: event.runId,
        type: event.type,
        sequence,
        data: event.data,
        traceId: event.traceId,
        occurredAt: event.occurredAt,
      })
      .run();
    this.persistSurfaceInTx(tx, event);
  }

  private persistSurfaceInTx(tx: any, event: PersistableEvent): void {
    if (event.type !== 'ui.surface') return;
    const data = (event.data ?? {}) as {
      sessionId?: string;
      surfaceId?: string;
      action?: 'upsert' | 'delete';
      surface?: unknown;
    };
    if (!data.sessionId || !data.surfaceId) return;

    if (data.action === 'delete' || !data.surface) {
      tx.delete(sessionSurfaces)
        .where(and(
          eq(sessionSurfaces.sessionId, data.sessionId),
          eq(sessionSurfaces.surfaceId, data.surfaceId),
        ))
        .run();
      return;
    }

    tx.insert(sessionSurfaces)
      .values({
        sessionId: data.sessionId,
        surfaceId: data.surfaceId,
        payload: data.surface,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [sessionSurfaces.sessionId, sessionSurfaces.surfaceId],
        set: {
          payload: data.surface,
          updatedAt: new Date().toISOString(),
        },
      })
      .run();
  }

  /** Allocate a sequence and insert the row in a single atomic transaction. */
  private allocateAndInsert(event: PersistableEvent, explicit?: number): number {
    let sequence = explicit ?? 0;
    this.db.transaction((tx: any) => {
      sequence = explicit ?? this.nextSequenceInTx(tx, event.runId);
      this.insertInTx(tx, event, sequence);
    });
    return sequence;
  }

  private notify(event: RunEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  async append(event: RunEvent): Promise<void> {
    // Respect persist flag — ephemeral events (persist=false) are live-only.
    if (event.persist === false) {
      this.notify(event);
      return;
    }

    // Defense-in-depth: callers that skip sequence allocation (e.g. permission
    // events) must not fall through to the SQLite default 0 — that corrupts
    // trajectory ordering and breaks cursor replay. Allocation + insert happen
    // in one synchronous transaction so concurrent appends never collide.
    const explicit = typeof event.sequence === 'number' ? event.sequence : undefined;
    this.allocateAndInsert(event, explicit);

    this.notify(event);
  }

  async appendTransactional(event: RunEvent, sessionUpdate?: { sessionId: string; updates: SessionUpdates }): Promise<void> {
    // Respect persist flag — ephemeral events (persist=false) are live-only.
    if (event.persist === false) {
      this.notify(event);
      return;
    }

    const explicit = typeof event.sequence === 'number' ? event.sequence : undefined;
    this.db.transaction((tx: any) => {
      const sequence = explicit ?? this.nextSequenceInTx(tx, event.runId);
      this.insertInTx(tx, event, sequence);

      if (sessionUpdate) {
        const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
        if (sessionUpdate.updates.title !== undefined) updateData.title = sessionUpdate.updates.title;
        if (sessionUpdate.updates.isActive !== undefined) updateData.isActive = sessionUpdate.updates.isActive ? 1 : 0;
        if (sessionUpdate.updates.model !== undefined) updateData.model = sessionUpdate.updates.model;
        if (sessionUpdate.updates.provider !== undefined) updateData.provider = sessionUpdate.updates.provider;
        if (sessionUpdate.updates.cost !== undefined) updateData.cost = sessionUpdate.updates.cost;
        if (sessionUpdate.updates.inputTokens !== undefined) updateData.inputTokens = sessionUpdate.updates.inputTokens;
        if (sessionUpdate.updates.outputTokens !== undefined) updateData.outputTokens = sessionUpdate.updates.outputTokens;
        if (sessionUpdate.updates.location !== undefined) updateData.location = sessionUpdate.updates.location;
        if (sessionUpdate.updates.agentId !== undefined) updateData.agentId = sessionUpdate.updates.agentId;

        tx.update(sessions).set(updateData).where(eq(sessions.id, sessionUpdate.sessionId)).run();
      }
    });

    // Notify only after the transaction commits.
    this.notify(event);
  }

  async exists(eventId: string): Promise<boolean> {
    // run_events.id is the autoincrement row id (RunEvent.id is its string form).
    const numericId = Number(eventId);
    if (!Number.isInteger(numericId)) return false;
    const result = this.db.select({ id: runEvents.id }).from(runEvents)
      .where(eq(runEvents.id, numericId))
      .limit(1)
      .get();
    return !!result;
  }

  async list(runId: string, afterSequence?: number): Promise<readonly RunEvent[]> {
    let conditions = eq(runEvents.runId, runId);
    if (afterSequence !== undefined) {
      conditions = sql`${conditions} AND ${runEvents.sequence} > ${afterSequence}`;
    }

    const results = this.db.select().from(runEvents)
      .where(conditions)
      .orderBy(runEvents.sequence)
      .all();

    return results.map((row: any) => ({
      id: String(row.id),
      runId: row.runId as RunId,
      sequence: row.sequence,
      type: row.type,
      data: typeof row.data === 'string' ? JSON.parse(row.data || '{}') : row.data,
      traceId: row.traceId as TraceId,
      occurredAt: row.occurredAt || new Date().toISOString(),
    }));
  }

  async listRunIds(): Promise<string[]> {
    const results = this.db.selectDistinct({ runId: runEvents.runId })
      .from(runEvents)
      .orderBy(desc(runEvents.occurredAt))
      .all();
    return results.map((r: any) => r.runId);
  }

  async getNextSequence(aggregateId: string): Promise<number> {
    const result = this.db.select({
      nextSeq: sql<number>`COALESCE(MAX(${runEvents.sequence}), -1) + 1`,
    }).from(runEvents)
      .where(eq(runEvents.runId, aggregateId))
      .get();
    return result?.nextSeq || 0;
  }

  async appendWithSequence(event: RunEvent): Promise<number> {
    if (event.persist === false) {
      this.notify(event);
      return this.getNextSequence(event.runId);
    }
    const explicit = typeof event.sequence === 'number' ? event.sequence : undefined;
    const sequence = this.allocateAndInsert(event, explicit);
    this.notify({ ...event, sequence });
    return sequence;
  }

  async saveSnapshot(runId: string, state: Record<string, unknown>): Promise<void> {
    const snapshot: PersistableEvent & { id: string } = {
      id: uuid(),
      runId: runId as RunId,
      type: 'snapshot',
      data: state,
      traceId: '' as TraceId,
      occurredAt: new Date().toISOString(),
    };
    const sequence = this.allocateAndInsert(snapshot);
    this.notify({ ...snapshot, sequence });
  }

  async getSnapshot(runId: string): Promise<RunEventSnapshot | null> {
    const result = this.db.select().from(runEvents)
      .where(sql`${runEvents.runId} = ${runId} AND ${runEvents.type} = 'snapshot'`)
      .orderBy(desc(runEvents.sequence))
      .limit(1)
      .get();

    if (!result) return null;

    return {
      runId: result.runId,
      sequence: result.sequence,
      state: typeof result.data === 'string' ? JSON.parse(result.data || '{}') : result.data,
      occurredAt: result.occurredAt || new Date().toISOString(),
    };
  }

  async getSnapshotAfterSequence(runId: string, sequence: number): Promise<RunEventSnapshot | null> {
    const result = this.db.select().from(runEvents)
      .where(sql`${runEvents.runId} = ${runId} AND ${runEvents.type} = 'snapshot' AND ${runEvents.sequence} > ${sequence}`)
      .orderBy(desc(runEvents.sequence))
      .limit(1)
      .get();

    if (!result) return null;

    return {
      runId: result.runId,
      sequence: result.sequence,
      state: typeof result.data === 'string' ? JSON.parse(result.data || '{}') : result.data,
      occurredAt: result.occurredAt || new Date().toISOString(),
    };
  }

  subscribe(listener: RunEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
