import { InMemoryApprovalStore } from '@vinhnt-sdk/permission';
import {
  InMemoryPlanApprovalStore,
  InMemoryQuestionStore,
} from '@vinhnt-sdk/tools';
import type { HitlRequestRepository } from '../repositories/hitl-request.repository';

/**
 * SDK HITL stores keep every request ever raised (including resolved ones) in
 * their `requests` arrays, so `pendingRequests()` can resurrect answered cards
 * after a reconnect. These store subclasses track settlement and expose only
 * requests that are still blocking a run.
 */
type ApprovalRequest = Parameters<
  InMemoryApprovalStore['awaitReplyWithReason']
>[0];
type ApprovalResult = Awaited<
  ReturnType<InMemoryApprovalStore['awaitReplyWithReason']>
>;

export class SessionApprovalStore extends InMemoryApprovalStore {
  private readonly settled = new Set<string>();
  private readonly persisted = new Map<string, ApprovalRequest>();
  private readonly decisions = new Map<string, ApprovalResult>();

  constructor(private readonly hitlRepository?: HitlRequestRepository) {
    super();
  }

  rehydrate(records: ReadonlyArray<{ id: string; payload: unknown }>): void {
    for (const record of records) {
      this.persisted.set(record.id, record.payload as ApprovalRequest);
    }
  }

  override async awaitReplyWithReason(
    ...args: Parameters<InMemoryApprovalStore['awaitReplyWithReason']>
  ): Promise<
    Awaited<ReturnType<InMemoryApprovalStore['awaitReplyWithReason']>>
  > {
    const [request, opts] = args;
    const key = this.decisionKey(request);
    const cached = this.decisions.get(key);
    if (cached) {
      this.decisions.delete(key);
      this.persisted.delete(request.id);
      this.settled.add(request.id);
      this.record(request, opts);
      this.settle(request.id, cached.reply === 'reject' ? 'rejected' : 'approved', cached);
      return cached;
    }
    try {
      this.record(request, opts);
      this.persisted.delete(request.id);
      return await super.awaitReplyWithReason(...args);
    } finally {
      this.settled.add(request.id);
      this.expireIfPending(request.id);
    }
  }

  override resolveRequest(
    ...args: Parameters<InMemoryApprovalStore['resolveRequest']>
  ): void {
    const [id, reply, reason] = args;
    const orphan = this.persisted.get(id);
    if (orphan) {
      this.decisions.set(
        this.decisionKey(orphan),
        reason !== undefined ? { reply, reason } : { reply },
      );
      this.persisted.delete(id);
      this.settled.add(id);
      this.settle(id, reply === 'reject' ? 'rejected' : 'approved', {
        reply,
        ...(reason !== undefined ? { reason } : {}),
      });
      return;
    }
    super.resolveRequest(...args);
    this.settled.add(id);
    this.settle(id, reply === 'reject' ? 'rejected' : 'approved', {
      reply,
      ...(reason !== undefined ? { reason } : {}),
    });
  }

  override cancelRequest(
    ...args: Parameters<InMemoryApprovalStore['cancelRequest']>
  ): void {
    const id = args[0];
    const orphan = this.persisted.get(id);
    if (orphan) {
      this.decisions.set(this.decisionKey(orphan), { reply: 'reject' });
      this.persisted.delete(id);
      this.settled.add(id);
      this.settle(id, 'cancelled');
      return;
    }
    super.cancelRequest(...args);
    this.settled.add(id);
    this.settle(id, 'cancelled');
  }

  private decisionKey(request: ApprovalRequest): string {
    return `${request.runId}:${request.toolName}`;
  }

  private record(
    request: Parameters<InMemoryApprovalStore['awaitReplyWithReason']>[0],
    opts?: Parameters<InMemoryApprovalStore['awaitReplyWithReason']>[1],
  ): void {
    try {
      this.hitlRepository?.create({
        id: request.id,
        kind: 'approval',
        runId: request.runId,
        payload: request,
        expiresAt: opts?.timeoutMs !== undefined ? Date.now() + opts.timeoutMs : undefined,
      });
    } catch {
      // HITL must not fail because the audit row could not be written.
    }
  }

  private settle(
    id: string,
    status: 'approved' | 'rejected' | 'cancelled',
    reply?: unknown,
  ): void {
    try {
      this.hitlRepository?.settle('approval', id, status, reply);
    } catch {
      // Keep the in-memory decision authoritative for the live run.
    }
  }

  private expireIfPending(id: string): void {
    try {
      this.hitlRepository?.settleIfPending(
        'approval',
        id,
        'expired',
        'Approval timed out or the run was cancelled',
      );
    } catch {
      // Persistence is best-effort; the run already has its terminal result.
    }
  }

  override getRequest(
    ...args: Parameters<InMemoryApprovalStore['getRequest']>
  ): ReturnType<InMemoryApprovalStore['getRequest']> {
    return super.getRequest(...args) ?? this.persisted.get(args[0]);
  }

  override pendingRequests(
    ...args: Parameters<InMemoryApprovalStore['pendingRequests']>
  ): ReturnType<InMemoryApprovalStore['pendingRequests']> {
    const live = super.pendingRequests(...args).filter((r) => !this.settled.has(r.id));
    const runId = args[0];
    const restored = [...this.persisted.values()].filter(
      (r) => !this.settled.has(r.id) && (!runId || r.runId === runId),
    );
    const seen = new Set(live.map((r) => r.id));
    return [...live, ...restored.filter((r) => !seen.has(r.id))];
  }
}

type QuestionRequest = Parameters<InMemoryQuestionStore['awaitReply']>[0];
type QuestionResult = Awaited<ReturnType<InMemoryQuestionStore['awaitReply']>>;

export class SessionQuestionStore extends InMemoryQuestionStore {
  private readonly settled = new Set<string>();
  private readonly persisted = new Map<string, QuestionRequest>();
  private readonly decisions = new Map<string, QuestionResult>();

  constructor(private readonly hitlRepository?: HitlRequestRepository) {
    super();
  }

  rehydrate(records: ReadonlyArray<{ id: string; payload: unknown }>): void {
    for (const record of records) {
      this.persisted.set(record.id, record.payload as QuestionRequest);
    }
  }

  override async awaitReply(
    ...args: Parameters<InMemoryQuestionStore['awaitReply']>
  ): Promise<Awaited<ReturnType<InMemoryQuestionStore['awaitReply']>>> {
    const [request] = args;
    const key = this.decisionKey(request);
    const cached = this.decisions.get(key);
    if (cached) {
      this.decisions.delete(key);
      this.persisted.delete(request.requestId);
      this.settled.add(request.requestId);
      this.record(request);
      this.settle(request.requestId, this.statusFor(cached), cached);
      return cached;
    }
    try {
      this.record(request);
      this.persisted.delete(request.requestId);
      return await super.awaitReply(...args);
    } finally {
      this.settled.add(request.requestId);
      this.expireIfPending(request.requestId);
    }
  }

  override resolveRequest(
    ...args: Parameters<InMemoryQuestionStore['resolveRequest']>
  ): void {
    const [id, reply] = args;
    const orphan = this.persisted.get(id);
    const status = this.statusFor(reply);
    if (orphan) {
      this.decisions.set(this.decisionKey(orphan), reply);
      this.persisted.delete(id);
      this.settled.add(id);
      this.settle(id, status, reply);
      return;
    }
    super.resolveRequest(...args);
    this.settled.add(id);
    this.settle(id, status, reply);
  }

  override cancelRequest(
    ...args: Parameters<InMemoryQuestionStore['cancelRequest']>
  ): void {
    const id = args[0];
    const orphan = this.persisted.get(id);
    if (orphan) {
      this.decisions.set(this.decisionKey(orphan), { action: 'cancel' });
      this.persisted.delete(id);
      this.settled.add(id);
      this.settle(id, 'cancelled');
      return;
    }
    super.cancelRequest(...args);
    this.settled.add(id);
    this.settle(id, 'cancelled');
  }

  private decisionKey(request: QuestionRequest): string {
    return `${request.runId}:${(request.questions ?? []).map((q) => q.question).join('|')}`;
  }

  private statusFor(reply: QuestionResult): 'approved' | 'rejected' | 'cancelled' {
    return reply.action === 'accept'
      ? 'approved'
      : reply.action === 'decline'
        ? 'rejected'
        : 'cancelled';
  }

  private record(request: Parameters<InMemoryQuestionStore['awaitReply']>[0]): void {
    try {
      this.hitlRepository?.create({
        id: request.requestId,
        kind: 'question',
        runId: request.runId,
        sessionId: request.sessionId,
        payload: request,
        expiresAt: request.expiresAt,
      });
    } catch {
      // Keep the live HITL path independent of persistence health.
    }
  }

  private settle(
    id: string,
    status: 'approved' | 'rejected' | 'cancelled',
    reply?: unknown,
  ): void {
    try {
      this.hitlRepository?.settle('question', id, status, reply);
    } catch {
      // Keep the in-memory decision authoritative for the live run.
    }
  }

  private expireIfPending(id: string): void {
    try {
      this.hitlRepository?.settleIfPending(
        'question',
        id,
        'expired',
        'Question timed out or the run was cancelled',
      );
    } catch {
      // Persistence is best-effort; the run already has its terminal result.
    }
  }

  override getRequest(
    ...args: Parameters<InMemoryQuestionStore['getRequest']>
  ): ReturnType<InMemoryQuestionStore['getRequest']> {
    return super.getRequest(...args) ?? this.persisted.get(args[0]);
  }

  override pendingRequests(
    ...args: Parameters<InMemoryQuestionStore['pendingRequests']>
  ): ReturnType<InMemoryQuestionStore['pendingRequests']> {
    const live = super
      .pendingRequests(...args)
      .filter((r) => !this.settled.has(r.requestId));
    const runId = args[0];
    const restored = [...this.persisted.values()].filter(
      (r) => !this.settled.has(r.requestId) && (!runId || r.runId === runId),
    );
    const seen = new Set(live.map((r) => r.requestId));
    return [...live, ...restored.filter((r) => !seen.has(r.requestId))];
  }
}

type PlanRequest = Parameters<InMemoryPlanApprovalStore['awaitReply']>[0];
type PlanResult = Awaited<ReturnType<InMemoryPlanApprovalStore['awaitReply']>>;

export class SessionPlanApprovalStore extends InMemoryPlanApprovalStore {
  private readonly settled = new Set<string>();
  private readonly persisted = new Map<string, PlanRequest>();
  private readonly decisions = new Map<string, PlanResult>();

  constructor(private readonly hitlRepository?: HitlRequestRepository) {
    super();
  }

  rehydrate(records: ReadonlyArray<{ id: string; payload: unknown }>): void {
    for (const record of records) {
      this.persisted.set(record.id, record.payload as PlanRequest);
    }
  }

  override async awaitReply(
    ...args: Parameters<InMemoryPlanApprovalStore['awaitReply']>
  ): Promise<Awaited<ReturnType<InMemoryPlanApprovalStore['awaitReply']>>> {
    const [request] = args;
    const key = this.decisionKey(request);
    const cached = this.decisions.get(key);
    if (cached) {
      this.decisions.delete(key);
      this.persisted.delete(request.requestId);
      this.settled.add(request.requestId);
      this.record(request);
      this.settle(request.requestId, this.statusFor(cached), cached);
      return cached;
    }
    try {
      this.record(request);
      this.persisted.delete(request.requestId);
      return await super.awaitReply(...args);
    } finally {
      this.settled.add(request.requestId);
      this.expireIfPending(request.requestId);
    }
  }

  override resolveRequest(
    ...args: Parameters<InMemoryPlanApprovalStore['resolveRequest']>
  ): void {
    const [id, reply] = args;
    const orphan = this.persisted.get(id);
    const status = this.statusFor(reply);
    if (orphan) {
      this.decisions.set(this.decisionKey(orphan), reply);
      this.persisted.delete(id);
      this.settled.add(id);
      this.settle(id, status, reply);
      return;
    }
    super.resolveRequest(...args);
    this.settled.add(id);
    this.settle(id, status, reply);
  }

  override cancelRequest(
    ...args: Parameters<InMemoryPlanApprovalStore['cancelRequest']>
  ): void {
    const id = args[0];
    const orphan = this.persisted.get(id);
    if (orphan) {
      this.decisions.set(this.decisionKey(orphan), { decision: 'cancel' });
      this.persisted.delete(id);
      this.settled.add(id);
      this.settle(id, 'cancelled');
      return;
    }
    super.cancelRequest(...args);
    this.settled.add(id);
    this.settle(id, 'cancelled');
  }

  private decisionKey(request: PlanRequest): string {
    return `${request.runId}:${request.title ?? ''}:${(request.steps ?? []).map((s) => s.text).join('|')}`;
  }

  private statusFor(reply: PlanResult): 'approved' | 'rejected' | 'cancelled' {
    return reply.decision === 'approve'
      ? 'approved'
      : reply.decision === 'request_changes'
        ? 'rejected'
        : 'cancelled';
  }

  private record(request: Parameters<InMemoryPlanApprovalStore['awaitReply']>[0]): void {
    try {
      this.hitlRepository?.create({
        id: request.requestId,
        kind: 'plan',
        runId: request.runId,
        sessionId: request.sessionId,
        payload: request,
        expiresAt: request.expiresAt,
      });
    } catch {
      // Keep the live HITL path independent of persistence health.
    }
  }

  private settle(
    id: string,
    status: 'approved' | 'rejected' | 'cancelled',
    reply?: unknown,
  ): void {
    try {
      this.hitlRepository?.settle('plan', id, status, reply);
    } catch {
      // Keep the in-memory decision authoritative for the live run.
    }
  }

  private expireIfPending(id: string): void {
    try {
      this.hitlRepository?.settleIfPending(
        'plan',
        id,
        'expired',
        'Plan review timed out or the run was cancelled',
      );
    } catch {
      // Persistence is best-effort; the run already has its terminal result.
    }
  }

  override getRequest(
    ...args: Parameters<InMemoryPlanApprovalStore['getRequest']>
  ): ReturnType<InMemoryPlanApprovalStore['getRequest']> {
    return super.getRequest(...args) ?? this.persisted.get(args[0]);
  }

  override pendingRequests(
    ...args: Parameters<InMemoryPlanApprovalStore['pendingRequests']>
  ): ReturnType<InMemoryPlanApprovalStore['pendingRequests']> {
    const live = super
      .pendingRequests(...args)
      .filter((r) => !this.settled.has(r.requestId));
    const runId = args[0];
    const restored = [...this.persisted.values()].filter(
      (r) => !this.settled.has(r.requestId) && (!runId || r.runId === runId),
    );
    const seen = new Set(live.map((r) => r.requestId));
    return [...live, ...restored.filter((r) => !seen.has(r.requestId))];
  }
}
