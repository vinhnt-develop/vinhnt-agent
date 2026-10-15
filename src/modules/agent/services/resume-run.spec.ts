import { AgentService } from './agent.service';

/**
 * P4.2 — resume-after-crash guards. These tests exercise the pure decision
 * logic of AgentService.resumeRun with minimal mocks (no real kernel/store):
 * the SDK resumeRun path itself is covered by vinhnt-sdk's own test suite.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
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
  svc.knowledgeFilterBySession = new Map();
  svc.agentToolkit = { cleanupRun: () => {} };
  svc.trackingService = {
    getRunRow: overrides.getRunRow ?? (() => undefined),
    getRunStatus: () => 'running',
    findActiveRunForSession: () => null,
    completeRunFromResult: () => {},
  };
  svc.buildRequestContext = () => ({});
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
});

describe('AgentService.isRunActive (P4.2 attach gate)', () => {
  it('returns true only when a live handle is registered', () => {
    const handles = new Map([['live', { cancel: () => {}, isCancelled: false }]]);
    const svc = makeService({ activeHandles: handles });
    expect(svc.isRunActive('live')).toBe(true);
    expect(svc.isRunActive('orphan-db-row')).toBe(false);
  });
});
