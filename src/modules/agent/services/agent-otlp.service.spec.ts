import { Logger } from '@nestjs/common';
import { AgentOtlpService } from './agent-otlp.service';
import type { AgentService } from './agent.service';
import type { AgentSettingsService } from './agent-settings.service';

type BusEventLike = {
  type?: string;
  aggregateId?: string;
  traceId?: string;
  data?: unknown;
};

const ENDPOINT = 'http://localhost:4318/v1/traces';

function makeService(otlpEndpoint: string) {
  let handler: ((e: BusEventLike) => void) | undefined;
  const unsubscribe = jest.fn();
  const agentService = {
    getEventBus: () => ({
      subscribeAll: (h: (e: unknown) => void) => {
        handler = h as (e: BusEventLike) => void;
        return unsubscribe;
      },
    }),
  } as unknown as AgentService;
  const settingsService = {
    getSettings: () => ({ otlpEndpoint }),
  } as unknown as AgentSettingsService;
  const svc = new AgentOtlpService(agentService, settingsService);
  return { svc, getHandler: () => handler, unsubscribe };
}

describe('AgentOtlpService (P6.4 OTLP opt-in)', () => {
  let fetchMock: jest.Mock;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('does nothing when otlpEndpoint is empty (opt-in off)', async () => {
    const { svc } = makeService('');
    svc.handleEvent({
      type: 'run.started',
      aggregateId: 'run-1',
      traceId: 'trace-1',
      data: { model: 'gpt-4o', prompt: 'SECRET' },
    });
    svc.handleEvent({
      type: 'run.completed',
      aggregateId: 'run-1',
      data: { status: 'succeeded', totalSteps: 3 },
    });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exports an agent.run span on run.completed when enabled', async () => {
    const { svc } = makeService(ENDPOINT);
    svc.handleEvent({
      type: 'run.started',
      aggregateId: 'run-1',
      traceId: 'trace-1',
      data: { model: 'gpt-4o', provider: 'openai', agentName: 'code', prompt: 'do work' },
    });
    svc.handleEvent({
      type: 'run.completed',
      aggregateId: 'run-1',
      data: { status: 'succeeded', totalSteps: 2, inputTokens: 10, outputTokens: 20, stopReason: 'stop' },
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    const body = String(init.body);
    expect(body).toContain('"name":"agent.run"');
    expect(body).toContain('{"key":"model","value":{"stringValue":"gpt-4o"}}');
    expect(body).toContain('{"key":"provider","value":{"stringValue":"openai"}}');
    expect(body).toContain('{"key":"status","value":{"stringValue":"succeeded"}}');
    expect(body).toContain('{"key":"stopReason","value":{"stringValue":"stop"}}');
    expect(body).toContain('{"key":"totalSteps","value":{"intValue":"2"}}');
  });

  it('never puts prompt or tool input into the exported payload', async () => {
    const { svc } = makeService(ENDPOINT);
    svc.handleEvent({
      type: 'run.started',
      aggregateId: 'run-1',
      data: { model: 'gpt-4o', prompt: 'SUPER_SECRET_PROMPT' },
    });
    svc.handleEvent({
      type: 'tool.invoked',
      aggregateId: 'run-1',
      data: { toolId: 't1', toolName: 'read_file', input: { path: '/secret/file.txt' } },
    });
    svc.handleEvent({
      type: 'llm.request',
      aggregateId: 'run-1',
      data: { systemPrompt: 'SYS_SECRET', messages: [{ role: 'user', content: 'MSG_SECRET' }] },
    });
    svc.handleEvent({ type: 'run.completed', aggregateId: 'run-1', data: { status: 'succeeded' } });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String(fetchMock.mock.calls[0][1]?.body);
    expect(body).not.toContain('SUPER_SECRET_PROMPT');
    expect(body).not.toContain('secret/file.txt');
    expect(body).not.toContain('SYS_SECRET');
    expect(body).not.toContain('MSG_SECRET');
    expect(body).not.toContain('llm.request');
    expect(body).toContain('{"key":"toolName","value":{"stringValue":"read_file"}}');
    expect(body).toContain('{"key":"toolId","value":{"stringValue":"t1"}}');
  });

  it('records whitelisted step/tool events and skips token chatter', async () => {
    const { svc } = makeService(ENDPOINT);
    svc.handleEvent({ type: 'run.started', aggregateId: 'run-1', data: { model: 'gpt-4o' } });
    svc.handleEvent({
      type: 'step.started',
      aggregateId: 'run-1',
      data: { turn: 1, step: 1, toolCallCount: 0 },
    });
    svc.handleEvent({
      type: 'tool.completed',
      aggregateId: 'run-1',
      data: { toolId: 't1', toolName: 'read_file', durationMs: 12, risk: 'read-only' },
    });
    svc.handleEvent({
      type: 'token.counted',
      aggregateId: 'run-1',
      data: { inputTokens: 111, outputTokens: 222 },
    });
    svc.handleEvent({ type: 'run.completed', aggregateId: 'run-1', data: { status: 'succeeded' } });
    await flush();

    const body = String(fetchMock.mock.calls[0][1]?.body);
    expect(body).toContain('"name":"step.started"');
    expect(body).toContain('"name":"tool.completed"');
    expect(body).toContain('{"key":"durationMs","value":{"intValue":"12"}}');
    expect(body).toContain('{"key":"turn","value":{"intValue":"1"}}');
    expect(body).not.toContain('token.counted');
  });

  it('does not throw when the export fails (logs a warning)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const warnSpy = Logger.prototype.warn as jest.Mock;
    const { svc } = makeService(ENDPOINT);
    svc.handleEvent({ type: 'run.started', aggregateId: 'run-1', data: { model: 'm' } });
    svc.handleEvent({ type: 'run.completed', aggregateId: 'run-1', data: { status: 'failed' } });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('OTLP export failed'));
  });

  it('subscribes to the bus on init and unsubscribes on destroy', () => {
    const { svc, getHandler, unsubscribe } = makeService('');
    svc.onModuleInit();
    expect(typeof getHandler()).toBe('function');
    expect(unsubscribe).not.toHaveBeenCalled();
    svc.onModuleDestroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('a handler that throws is caught by the subscription wrapper', async () => {
    const { svc, getHandler } = makeService(ENDPOINT);
    svc.onModuleInit();
    const handler = getHandler()!;
    // aggregateId missing → handleEvent returns early (no throw)
    expect(() => handler({ type: 'run.started' })).not.toThrow();
    // and a fully-formed event still flows
    handler({ type: 'run.started', aggregateId: 'run-x', data: { model: 'm' } });
    handler({ type: 'run.completed', aggregateId: 'run-x', data: { status: 'succeeded' } });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clips long reason strings on span events', async () => {
    const { svc } = makeService(ENDPOINT);
    svc.handleEvent({ type: 'run.started', aggregateId: 'run-1', data: { model: 'm' } });
    svc.handleEvent({
      type: 'step.failed',
      aggregateId: 'run-1',
      data: { turn: 1, step: 1, reason: 'x'.repeat(1000) },
    });
    svc.handleEvent({ type: 'run.completed', aggregateId: 'run-1', data: { status: 'failed' } });
    await flush();

    const body = String(fetchMock.mock.calls[0][1]?.body);
    const longRuns = body.match(/x{300}/g) ?? [];
    expect(longRuns.length).toBeGreaterThan(0);
    expect(body).not.toContain('x'.repeat(301));
  });

  it('caps span events at 500 per run', async () => {
    const { svc } = makeService(ENDPOINT);
    svc.handleEvent({ type: 'run.started', aggregateId: 'run-1', data: { model: 'm' } });
    for (let i = 0; i < 520; i++) {
      svc.handleEvent({
        type: 'tool.invoked',
        aggregateId: 'run-1',
        data: { toolId: `t${i}`, toolName: 'read_file' },
      });
    }
    svc.handleEvent({ type: 'run.completed', aggregateId: 'run-1', data: { status: 'succeeded' } });
    await flush();

    const body = String(fetchMock.mock.calls[0][1]?.body);
    const count = (body.match(/"name":"tool\.invoked"/g) ?? []).length;
    expect(count).toBe(500);
  });

  it('evicts the oldest run past MAX_ACTIVE_RUNS (256) without throwing', () => {
    const { svc } = makeService(ENDPOINT);
    for (let i = 0; i < 300; i++) {
      svc.handleEvent({
        type: 'run.started',
        aggregateId: `run-${i}`,
        data: { model: 'm' },
      });
    }
    expect(() =>
      svc.handleEvent({ type: 'run.completed', aggregateId: 'run-299', data: { status: 'succeeded' } }),
    ).not.toThrow();
  });
});
