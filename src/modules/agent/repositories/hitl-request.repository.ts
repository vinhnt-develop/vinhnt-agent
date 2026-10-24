import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION, type DatabaseConnection } from '@/infrastructure/database';
import { agentRuns, hitlRequests } from '../schemas/agent.schema';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';

export type HitlKind = 'approval' | 'question' | 'plan' | 'elicitation';
export type HitlStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export interface HitlRecordInput {
  id: string;
  kind: HitlKind;
  runId: string;
  sessionId?: string;
  payload: unknown;
  expiresAt?: number;
}

@Injectable()
export class HitlRequestRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DatabaseConnection) {}

  create(data: HitlRecordInput): void {
    this.db
      .insert(hitlRequests)
      .values({
        id: data.id,
        kind: data.kind,
        runId: data.runId,
        sessionId: data.sessionId,
        status: 'pending',
        payload: data.payload,
        expiresAt: data.expiresAt,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing()
      .run();
  }

  settle(
    kind: HitlKind,
    id: string,
    status: Exclude<HitlStatus, 'pending'>,
    reply?: unknown,
    errorMessage?: string,
  ): void {
    this.db
      .update(hitlRequests)
      .set({
        status,
        reply,
        errorMessage,
        resolvedAt: new Date().toISOString(),
      })
      .where(and(eq(hitlRequests.id, id), eq(hitlRequests.kind, kind)))
      .run();
  }

  /** Settle only if still pending, so a late timeout cannot overwrite a reply. */
  settleIfPending(
    kind: HitlKind,
    id: string,
    status: Exclude<HitlStatus, 'pending'>,
    errorMessage?: string,
  ): void {
    this.db
      .update(hitlRequests)
      .set({
        status,
        errorMessage,
        resolvedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(hitlRequests.id, id),
          eq(hitlRequests.kind, kind),
          eq(hitlRequests.status, 'pending'),
        ),
      )
      .run();
  }

  findPending(runId?: string) {
    const where = runId
      ? and(eq(hitlRequests.status, 'pending'), eq(hitlRequests.runId, runId))
      : eq(hitlRequests.status, 'pending');
    return this.db.select().from(hitlRequests).where(where).all();
  }

  /**
   * Pending rows whose run can still be resumed. Used at boot to rebuild
   * actionable HITL cards instead of showing requests for terminal runs.
   */
  findPendingWithResumableRuns() {
    return this.db
      .select({
        id: hitlRequests.id,
        kind: hitlRequests.kind,
        runId: hitlRequests.runId,
        sessionId: hitlRequests.sessionId,
        payload: hitlRequests.payload,
      })
      .from(hitlRequests)
      .innerJoin(agentRuns, eq(agentRuns.id, hitlRequests.runId))
      .where(
        and(
          eq(hitlRequests.status, 'pending'),
          inArray(agentRuns.status, ['running', 'interrupted', 'pending']),
        ),
      )
      .all();
  }

  /** Expire pending rows that cannot be tied back to a resumable run. */
  expirePendingNotIn(keepIds: string[], errorMessage = 'Parent run is no longer resumable'): number {
    const where =
      keepIds.length > 0
        ? and(
            eq(hitlRequests.status, 'pending'),
            notInArray(hitlRequests.id, keepIds),
          )
        : eq(hitlRequests.status, 'pending');
    const result = this.db
      .update(hitlRequests)
      .set({
        status: 'expired',
        errorMessage,
        resolvedAt: new Date().toISOString(),
      })
      .where(where)
      .run();
    return result.changes;
  }

  /**
   * At boot no in-memory waiter can exist, so every pending row is orphaned.
   * Mark them expired instead of leaving an actionable UI card that can never
   * resume. Runs themselves remain `interrupted` for explicit /agent/resume.
   */
  expireAllPending(errorMessage = 'Agent restarted before a reply was received'): number {
    const result = this.db
      .update(hitlRequests)
      .set({
        status: 'expired',
        errorMessage,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(hitlRequests.status, 'pending'))
      .run();
    return result.changes;
  }

  countPending(): number {
    const [{ count }] = this.db
      .select({ count: sql<number>`count(*)` })
      .from(hitlRequests)
      .where(eq(hitlRequests.status, 'pending'))
      .all();
    return count;
  }
}
