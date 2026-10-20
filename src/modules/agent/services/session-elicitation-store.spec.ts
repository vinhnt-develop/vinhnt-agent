import type { ElicitationRequest } from '@vinhnt-sdk/tools';
import { SessionElicitationStore } from './session-elicitation-store';

function request(overrides: Partial<ElicitationRequest> = {}): ElicitationRequest {
  return {
    requestId: 'req-1',
    runId: 'run-1',
    sessionId: 'session-1',
    message: 'Name?',
    mode: 'form',
    ...overrides,
  };
}

describe('SessionElicitationStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('filters pending requests by run and session', async () => {
    const store = new SessionElicitationStore();
    const first = store.awaitReply(request());
    const second = store.awaitReply(
      request({ requestId: 'req-2', sessionId: 'session-2' }),
    );

    expect(store.pendingRequests(undefined, 'session-1')).toEqual([
      expect.objectContaining({ requestId: 'req-1' }),
    ]);
    expect(store.pendingRequests('run-1', 'session-2')).toEqual([
      expect.objectContaining({ requestId: 'req-2' }),
    ]);

    store.resolveRequest('req-1', { action: 'accept', content: { name: 'Ada' } });
    store.resolveRequest('req-2', { action: 'cancel' });
    await expect(first).resolves.toEqual({
      action: 'accept',
      content: { name: 'Ada' },
    });
    await expect(second).resolves.toEqual({ action: 'cancel' });
  });

  it('removes a request once it is answered', async () => {
    const store = new SessionElicitationStore();
    const pending = store.awaitReply(request());

    expect(store.getRequest('req-1')).toBeDefined();
    store.resolveRequest('req-1', { action: 'decline' });
    await expect(pending).resolves.toEqual({ action: 'decline' });

    expect(store.getRequest('req-1')).toBeUndefined();
    expect(store.pendingRequests()).toEqual([]);
    expect(store.wasSettled('req-1')).toBe(true);
  });

  it('treats a later reply as already settled instead of re-resolving', async () => {
    const store = new SessionElicitationStore();
    const pending = store.awaitReply(request());

    store.cancelRequest('req-1');
    await expect(pending).resolves.toEqual({ action: 'cancel' });

    expect(store.getRequest('req-1')).toBeUndefined();
    expect(store.wasSettled('req-1')).toBe(true);
    expect(store.wasSettled('unknown')).toBe(false);
  });

  it('times out at expiresAt with a cancel reply and drops the request', async () => {
    const store = new SessionElicitationStore();
    const pending = store.awaitReply(
      request({ expiresAt: Date.now() + 1000 }),
    );

    jest.advanceTimersByTime(1000);

    await expect(pending).resolves.toEqual({ action: 'cancel' });
    expect(store.pendingRequests()).toEqual([]);
    expect(store.wasSettled('req-1')).toBe(true);
  });

  it('uses timeoutMs when the request has no expiresAt', async () => {
    const store = new SessionElicitationStore();
    const pending = store.awaitReply(request(), { timeoutMs: 500 });

    expect(store.getRequest('req-1')?.expiresAt).toBeGreaterThanOrEqual(
      Date.now() + 500,
    );

    jest.advanceTimersByTime(500);

    await expect(pending).resolves.toEqual({ action: 'cancel' });
    expect(store.getRequest('req-1')).toBeUndefined();
  });

  it('rejects on abort and removes the request', async () => {
    const store = new SessionElicitationStore();
    const controller = new AbortController();
    const pending = store.awaitReply(request(), { signal: controller.signal });

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(store.getRequest('req-1')).toBeUndefined();
    expect(store.wasSettled('req-1')).toBe(true);
  });

  it('does not keep already-expired requests pending', async () => {
    const store = new SessionElicitationStore();
    const pending = store.awaitReply(
      request({ expiresAt: Date.now() - 1 }),
    );

    await expect(pending).resolves.toEqual({ action: 'cancel' });
    expect(store.pendingRequests()).toEqual([]);
    expect(store.wasSettled('req-1')).toBe(true);
  });

  it('prunes expired requests when pending requests are read', async () => {
    const store = new SessionElicitationStore();
    void store.awaitReply(request({ expiresAt: Date.now() + 1000 }));

    jest.advanceTimersByTime(1001);

    expect(store.pendingRequests(undefined, 'session-1')).toEqual([]);
  });
});
