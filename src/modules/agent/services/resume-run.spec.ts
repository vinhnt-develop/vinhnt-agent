import { AgentService } from './agent.service';

/**
 * P4.2 — resume-after-crash guards. These tests exercise the pure decision
 * logic of AgentService.resumeRun with minimal mocks (no real kernel/store):
 * the SDK resumeRun path itself is covered by vinhnt-sdk's own test suite.
 */

 
type TestAgentService = any;

function makeService(overrides: {
  getRunRow?: () => any;
  activeHandles?: Map<string, unknown>;
} = {}): TestAgentService {
  // Build a bare instance without running the NestJS constructor (same
  // pattern as agent.service.spec.ts).
  const svc: TestAgentService = Object.create(AgentService.prototype);
  svc.logger = { log: () => {}, warn: () => {}, error: () => {} };
  svc.activeHandles = overrides.activeHandles ?? new Map();
  svc.activeKernels = new Map();
  svc.knowledgeFilterBySession = new Map();
  svc.agentToolkit = { cleanupRun: () => {} };
  svc.trackingService = {
    getRunRow: overrides.getRunRow ?? (() => undefined),
    getRunStatus: () => 'running',
    findActiveRunForSession: () => null,
    findInterruptedRunForSession: () => undefined,
    markRunRunning: () => {},
    seedToolCallsCount: () => {},
    completeRunFromResult: () => {},
  };
  svc.buildRequestContext = () => ({});
  svc.runEventStore = {
    getSnapshot: async () => ({ state: { sessionId: 's1' } }),
    saveSnapshot: async () => {},
  };
  return svc;
}

describe('AgentService.resumeRun guards (P4.2)', () => {
  it('fails when run row is missing', async () => {
    const svc = makeService({ getRunRow: () => undefined });
    const result = await svc.resumeRun({ runId: 'missing' });
    expect(result.status).toBe('failed');
    expect(result.output).toContain('not found');
  });

  it('refuses to resume a terminal run', async () => {
    const svc = makeService({
      getRunRow: () => ({ id: 'r1', sessionId: 's1', status: 'succeeded' }),
    });
    const result = await svc.resumeRun({ runId: 'r1' });
    expect(result.status).toBe('succeeded');
    expect(result.output).toContain('already succeeded');
  });

  it('refuses to resume when this process already holds a live handle', async () => {
    const handles = new Map([['r1', { cancel: () => {}, isCancelled: false }]]);
    const svc = makeService({
      getRunRow: () => ({ id: 'r1', sessionId: 's1', status: 'running' }),
      activeHandles: handles,
    });
    const result = await svc.resumeRun({ runId: 'r1' });
    expect(result.status).toBe('failed');
    expect(result.output).toContain('already active');
  });

  it('refuses to resume when a different live run is active for the session', async () => {
    const svc = makeService({
      getRunRow: () => ({ id: 'r1', sessionId: 's1', status: 'running' }),
    });
    (svc as any).trackingService.findActiveRunForSession = (sid: string) =>
      sid === 's1' ? { id: 'other-run' } : null;
    const result = await svc.resumeRun({ runId: 'r1' });
    expect(result.status).toBe('failed');
    expect(result.output).toContain('different run');
  });

  it('fails when the run has no sessionId', async () => {
    const svc = makeService({
      getRunRow: () => ({ id: 'r1', sessionId: null, status: 'running' }),
    });
    const result = await svc.resumeRun({ runId: 'r1' });
    expect(result.status).toBe('failed');
    expect(result.output).toContain('no sessionId');
  });

  it('resumes an interrupted run and flips it back to running', async () => {
    let marked: string | undefined;
    let seeded: { runId: string; count?: number | null } | undefined;
    const svc = makeService({
      getRunRow: () => ({
        id: 'r1',
        sessionId: 's1',
        status: 'interrupted',
        toolCallsCount: 4,
      }),
    });
    svc.trackingService.markRunRunning = (id: string) => {
      marked = id;
    };
    svc.trackingService.seedToolCallsCount = (
      runId: string,
      count?: number | null,
    ) => {
      seeded = { runId, count };
    };
    svc.getKernel = async () => ({
      resumeRun: async () => ({
        abort: () => {},
        completed: Promise.resolve(),
      }),
    });
    const result = await svc.resumeRun({ runId: 'r1' });
    expect(marked).toBe('r1');
    expect(seeded).toEqual({ runId: 'r1', count: 4 });
    expect(result.status).toBe('succeeded');
  });
});

describe('AgentService resumable discovery', () => {
  it('returns the latest interrupted run when no run is live', () => {
    const svc = makeService();
    svc.trackingService.findInterruptedRunForSession = () => ({
      id: 'r1',
      sessionId: 's1',
      status: 'interrupted',
      startedAt: '2026-10-20T00:00:00.000Z',
      model: 'm',
      provider: 'p',
    });
    expect(svc.getResumableRun('s1')).toEqual({
      runId: 'r1',
      sessionId: 's1',
      startedAt: '2026-10-20T00:00:00.000Z',
      model: 'm',
      provider: 'p',
    });
  });

  it('hides the interrupted run while another run is active', () => {
    const svc = makeService();
    svc.trackingService.findActiveRunForSession = () => ({ id: 'other' });
    svc.trackingService.findInterruptedRunForSession = () => ({
      id: 'r1',
      sessionId: 's1',
      status: 'interrupted',
    });
    expect(svc.getResumableRun('s1')).toBeNull();
  });

  it('cancels an interrupted run so its banner can be dismissed', async () => {
    const svc = makeService();
    svc.trackingService.getRunStatus = () => 'interrupted';
    const completed: Array<Record<string, unknown>> = [];
    svc.trackingService.completeRunFromResult = (data: Record<string, unknown>) => {
      completed.push(data);
    };
    const result = await svc.cancelRun('r1');
    expect(result).toEqual({ cancelled: true, status: 'cancelled' });
    expect(completed[0]).toMatchObject({ runId: 'r1', status: 'cancelled' });
  });
});

describe('AgentService.isRunActive (P4.2 attach gate)', () => {
  it('returns true only when a live handle is registered', () => {
    const handles = new Map([['live', { cancel: () => {}, isCancelled: false }]]);
    const svc = makeService({ activeHandles: handles });
    expect(svc.isRunActive('live')).toBe(true);
    expect(svc.isRunActive('orphan-db-row')).toBe(false);
  });
});
