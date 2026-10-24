import type {
  AwaitElicitationOptions,
  ElicitationReply,
  ElicitationRequest,
  ElicitationStore,
} from '@vinhnt-sdk/tools';
import type { HitlRequestRepository } from '../repositories/hitl-request.repository';

/** Cap the settled-id audit log so a long-lived agent does not grow unbounded. */
const MAX_SETTLED_IDS = 200;

/**
 * Elicitation store scoped to real sessions.
 *
 * Unlike the SDK's in-memory store, requests are removed as soon as they
 * settle (reply, cancel, timeout or abort) and `pendingRequests` can filter by
 * session. That keeps reconnect rehydration from resurrecting answered cards
 * and gives late replies a deterministic `already_resolved` result.
 */
export class SessionElicitationStore implements ElicitationStore {
  private readonly waiters = new Map<string, (reply: ElicitationReply) => void>();
  private readonly requests = new Map<string, ElicitationRequest>();
  private readonly persisted = new Map<string, ElicitationRequest>();
  private readonly decisions = new Map<string, ElicitationReply>();
  private readonly settled = new Set<string>();
  private readonly settledOrder: string[] = [];

  constructor(private readonly hitlRepository?: HitlRequestRepository) {}

  rehydrate(records: ReadonlyArray<{ id: string; payload: unknown }>): void {
    for (const record of records) {
      this.persisted.set(record.id, record.payload as ElicitationRequest);
    }
  }

  awaitReply(
    request: ElicitationRequest,
    opts?: AwaitElicitationOptions,
  ): Promise<ElicitationReply> {
    const now = Date.now();
    const expiresAt =
      request.expiresAt ?? (opts?.timeoutMs !== undefined ? now + opts.timeoutMs : undefined);
    const normalized: ElicitationRequest =
      expiresAt !== undefined ? { ...request, expiresAt } : request;

    this.pruneExpired();
    const key = this.decisionKey(normalized);
    const cached = this.decisions.get(key);
    if (cached) {
      this.decisions.delete(key);
      this.persisted.delete(request.requestId);
      this.markSettled(request.requestId);
      this.record(normalized);
      this.persistSettle(request.requestId, this.statusFor(cached), cached);
      return Promise.resolve(cached);
    }
    if (normalized.expiresAt !== undefined && normalized.expiresAt <= now) {
      this.markSettled(request.requestId);
      return Promise.resolve({ action: 'cancel' });
    }

    this.requests.set(request.requestId, normalized);
    this.persisted.delete(request.requestId);
    this.record(normalized);

    return new Promise<ElicitationReply>((resolve, reject) => {
      const { signal } = opts ?? {};
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.waiters.delete(request.requestId);
        this.requests.delete(request.requestId);
        this.markSettled(request.requestId);
        fn();
      };
      const onAbort = () =>
        settle(() => reject(new DOMException('Aborted', 'AbortError')));

      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) {
        onAbort();
        return;
      }
      if (normalized.expiresAt !== undefined) {
        timer = setTimeout(
          () => settle(() => resolve({ action: 'cancel' })),
          Math.max(0, normalized.expiresAt - now),
        );
      }

      this.waiters.set(request.requestId, (reply) => settle(() => resolve(reply)));
    });
  }

  resolveRequest(requestId: string, reply: ElicitationReply): void {
    const resolve = this.waiters.get(requestId);
    if (resolve) {
      this.persistSettle(requestId, this.statusFor(reply), reply);
      resolve(reply);
      return;
    }
    const orphan = this.persisted.get(requestId);
    if (orphan) {
      this.decisions.set(this.decisionKey(orphan), reply);
      this.persisted.delete(requestId);
      this.markSettled(requestId);
      this.persistSettle(requestId, this.statusFor(reply), reply);
    }
  }

  getRequest(requestId: string): ElicitationRequest | undefined {
    this.pruneExpired();
    return this.requests.get(requestId) ?? this.persisted.get(requestId);
  }

  pendingRequests(runId?: string, sessionId?: string): readonly ElicitationRequest[] {
    this.pruneExpired();
    const live = [...this.requests.values()].filter(
      (request) =>
        (runId === undefined || request.runId === runId) &&
        (sessionId === undefined || request.sessionId === sessionId),
    );
    const restored = [...this.persisted.values()].filter(
      (request) =>
        (runId === undefined || request.runId === runId) &&
        (sessionId === undefined || request.sessionId === sessionId),
    );
    const seen = new Set(live.map((r) => r.requestId));
    return [...live, ...restored.filter((r) => !seen.has(r.requestId))];
  }

  cancelRequest(requestId: string): void {
    const resolve = this.waiters.get(requestId);
    if (resolve) {
      this.persistSettle(requestId, 'cancelled');
      resolve({ action: 'cancel' });
      return;
    }
    const orphan = this.persisted.get(requestId);
    if (orphan) {
      this.decisions.set(this.decisionKey(orphan), { action: 'cancel' });
      this.persisted.delete(requestId);
    }
    this.requests.delete(requestId);
    this.markSettled(requestId);
    this.persistSettle(requestId, 'cancelled');
  }

  private decisionKey(request: ElicitationRequest): string {
    return `${request.runId}:${request.message}`;
  }

  private statusFor(reply: ElicitationReply): 'approved' | 'rejected' | 'cancelled' {
    return reply.action === 'accept'
      ? 'approved'
      : reply.action === 'decline'
        ? 'rejected'
        : 'cancelled';
  }

  private record(request: ElicitationRequest): void {
    try {
      this.hitlRepository?.create({
        id: request.requestId,
        kind: 'elicitation',
        runId: request.runId,
        sessionId: request.sessionId,
        payload: request,
        expiresAt: request.expiresAt,
      });
    } catch {
      // Keep the live HITL path independent of persistence health.
    }
  }

  private persistSettle(
    requestId: string,
    status: 'approved' | 'rejected' | 'cancelled',
    reply?: unknown,
  ): void {
    try {
      this.hitlRepository?.settle('elicitation', requestId, status, reply);
    } catch {
      // Keep the in-memory decision authoritative for the live run.
    }
  }

  /** True when this id was answered, cancelled or timed out. */
  wasSettled(requestId: string): boolean {
    return this.settled.has(requestId);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [requestId, request] of this.requests) {
      if (request.expiresAt === undefined || request.expiresAt > now) continue;
      const resolve = this.waiters.get(requestId);
      if (resolve) resolve({ action: 'cancel' });
      else this.cancelRequest(requestId);
    }
    for (const [requestId, request] of this.persisted) {
      if (request.expiresAt === undefined || request.expiresAt > now) continue;
      this.persisted.delete(requestId);
      this.markSettled(requestId);
      this.persistSettle(requestId, 'cancelled');
    }
  }

  private markSettled(requestId: string): void {
    if (this.settled.has(requestId)) return;
    this.settled.add(requestId);
    this.settledOrder.push(requestId);
    while (this.settledOrder.length > MAX_SETTLED_IDS) {
      const oldest = this.settledOrder.shift();
      if (oldest !== undefined) this.settled.delete(oldest);
    }
  }
}
