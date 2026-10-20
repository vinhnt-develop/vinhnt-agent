import type {
  AwaitElicitationOptions,
  ElicitationReply,
  ElicitationRequest,
  ElicitationStore,
} from '@vinhnt-sdk/tools';

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
  private readonly settled = new Set<string>();
  private readonly settledOrder: string[] = [];

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
    if (normalized.expiresAt !== undefined && normalized.expiresAt <= now) {
      this.markSettled(request.requestId);
      return Promise.resolve({ action: 'cancel' });
    }

    this.requests.set(request.requestId, normalized);

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
      resolve(reply);
    }
  }

  getRequest(requestId: string): ElicitationRequest | undefined {
    this.pruneExpired();
    return this.requests.get(requestId);
  }

  pendingRequests(runId?: string, sessionId?: string): readonly ElicitationRequest[] {
    this.pruneExpired();
    return [...this.requests.values()].filter(
      (request) =>
        (runId === undefined || request.runId === runId) &&
        (sessionId === undefined || request.sessionId === sessionId),
    );
  }

  cancelRequest(requestId: string): void {
    const resolve = this.waiters.get(requestId);
    if (resolve) {
      resolve({ action: 'cancel' });
      return;
    }
    this.requests.delete(requestId);
    this.markSettled(requestId);
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
