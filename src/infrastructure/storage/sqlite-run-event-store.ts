import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { runEvents } from '@/modules/agent/schemas/agent.schema';
import { sessions } from '@/modules/session/schemas/session.schema';
import { eq, sql, desc } from 'drizzle-orm';
import type { RunEventStore, RunEvent, RunEventSnapshot, RunEventListener, RunId, TraceId, SessionUpdates } from '@vinhnt-sdk/schema';
import { v4 as uuid } from 'uuid';

@Injectable()
export class SqliteRunEventStore implements RunEventStore {
  private listeners: RunEventListener[] = [];

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: any,
  ) {}

  async append(event: RunEvent): Promise<void> {
    // Respect persist flag — ephemeral events (persist=false) are live-only
    if (event.persist === false) {
      for (const listener of this.listeners) { listener(event); }
      return;
    }

    this.db.insert(runEvents).values({
      runId: event.runId,
      type: event.type,
      sequence: event.sequence,
      data: event.data,
      traceId: event.traceId,
      occurredAt: event.occurredAt,
    }).run();

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  async appendTransactional(event: RunEvent, sessionUpdate?: { sessionId: string; updates: SessionUpdates }): Promise<void> {
    // Respect persist flag — ephemeral events (persist=false) are live-only
    if (event.persist === false) {
      for (const listener of this.listeners) { listener(event); }
      return;
    }

    this.db.transaction((tx: any) => {
      tx.insert(runEvents).values({
        runId: event.runId,
        type: event.type,
        sequence: event.sequence,
        data: event.data,
        traceId: event.traceId,
        occurredAt: event.occurredAt,
      }).run();

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

      for (const listener of this.listeners) {
        listener(event);
      }
    });
  }

  async exists(eventId: string): Promise<boolean> {
    const result = this.db.select().from(runEvents)
      .where(eq(runEvents.runId, eventId))
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
    const seq = await this.getNextSequence(event.runId);
    await this.append({ ...event, sequence: seq });
    return seq;
  }

  async saveSnapshot(runId: string, state: Record<string, unknown>): Promise<void> {
    const seq = await this.getNextSequence(runId);
    await this.append({
      id: uuid(),
      runId: runId as RunId,
      sequence: seq,
      type: 'snapshot',
      data: state,
      traceId: '' as TraceId,
      occurredAt: new Date().toISOString(),
    });
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
