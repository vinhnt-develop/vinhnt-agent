import type { ToolContext, ToolDefinition } from '@vinhnt-sdk/tools';
import {
  DEFAULT_ELICIT_TIMEOUT_MS,
  resolveElicitTimeoutMs,
  withElicitationDeadline,
} from './elicit-deadline';

function toolWithAsk(
  ask: (input: Record<string, unknown>) => Promise<unknown>,
): { tool: ToolDefinition; ctx: ToolContext } {
  const ctx = {
    sessionId: 'session-1',
    runId: 'run-1',
    askElicitation: ask,
  } as unknown as ToolContext;
  const tool = {
    id: 'elicit',
    description: 'elicit',
    risk: 'external',
    execute: jest.fn(async (_raw: unknown, callCtx: ToolContext) => {
      await callCtx.askElicitation?.({
        message: 'Name?',
        mode: 'form' as const,
        requestedSchema: { type: 'object', properties: {} },
      });
      return { action: 'accept' };
    }),
  } as unknown as ToolDefinition;
  return { tool, ctx };
}

describe('withElicitationDeadline', () => {
  it('injects expiresAt and timeoutMs into the elicitation request', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const ask = jest.fn().mockResolvedValue({ action: 'accept' });
    const { tool, ctx } = toolWithAsk(ask);

    await withElicitationDeadline(tool, 30_000).execute({}, ctx);

    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: Date.now() + 30_000,
        timeoutMs: 30_000,
      }),
    );
    jest.useRealTimers();
  });

  it('resolves a live timeout callback at execute time', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const ask = jest.fn().mockResolvedValue({ action: 'accept' });
    const { tool, ctx } = toolWithAsk(ask);
    let timeout = 10_000;

    const wrapped = withElicitationDeadline(tool, () => timeout);
    timeout = 45_000;
    await wrapped.execute({}, ctx);

    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: Date.now() + 45_000,
        timeoutMs: 45_000,
      }),
    );
    jest.useRealTimers();
  });

  it('passes the context through unchanged when no host store is wired', async () => {
    const tool = {
      id: 'elicit',
      description: 'elicit',
      risk: 'external',
      execute: jest.fn().mockResolvedValue({ action: 'accept' }),
    } as unknown as ToolDefinition;
    const ctx = {} as ToolContext;

    await withElicitationDeadline(tool).execute({}, ctx);

    expect(tool.execute).toHaveBeenCalledWith({}, ctx);
  });

  it('resolves a validated timeout from the environment', () => {
    expect(resolveElicitTimeoutMs(undefined)).toBe(DEFAULT_ELICIT_TIMEOUT_MS);
    expect(resolveElicitTimeoutMs('not-a-number')).toBe(DEFAULT_ELICIT_TIMEOUT_MS);
    expect(resolveElicitTimeoutMs('500')).toBe(DEFAULT_ELICIT_TIMEOUT_MS);
    expect(resolveElicitTimeoutMs('45000')).toBe(45_000);
  });
});
