import { AgentService } from './agent.service';
import type { KernelSettings } from './agent-settings.service';
import type { PermissionMode } from '@/shared/permission-mode';

/**
 * SC5/SC3: autoApproval is a 2-layer switch.
 *   L2 - AGENT_AUTO_APPROVAL=false env (ops kill switch, checked first,
 *        cannot be bypassed by settings or the API).
 *   L1 - settings.autoApproval (kernel-settings.json / Settings UI toggle).
 * Then - override (per-run composer) ?? settings.permissionMode ?? 'ask'.
 * PermissionMode vocabulary comes from @vinhnt-sdk/permission (P6.5).
 */

function makeAgentService(opts: {
  envAutoApproval?: boolean;
  liveSettings?: Partial<KernelSettings>;
}) {
  const svc = Object.create(AgentService.prototype) as AgentService;
  (svc as unknown as { configService: { get: (key: string, fallback?: unknown) => unknown } })
    .configService = {
    // resolvePermissionMode only reads agent.autoApproval from configService.
    get: (_key: string, fallback?: unknown) =>
      opts.envAutoApproval !== undefined ? opts.envAutoApproval : fallback,
  };
  (svc as unknown as { settingsService: { getSettings: () => Partial<KernelSettings> } })
    .settingsService = {
    getSettings: () => opts.liveSettings ?? {},
  };
  return svc;
}

function resolve(
  svc: AgentService,
  settings?: Partial<KernelSettings>,
  override?: PermissionMode,
): PermissionMode {
  return (
    svc as unknown as {
      resolvePermissionMode(s?: Partial<KernelSettings>, o?: PermissionMode): PermissionMode;
    }
  ).resolvePermissionMode(settings, override);
}

describe('SC3 resolvePermissionMode (2-layer autoApproval)', () => {
  it('L2 env kill: AGENT_AUTO_APPROVAL=false â†’ ask even with settings true + override full', () => {
    const svc = makeAgentService({
      envAutoApproval: false,
      liveSettings: { autoApproval: true, permissionMode: 'full' },
    });
    expect(resolve(svc, { autoApproval: true, permissionMode: 'full' }, 'full')).toBe('ask');
  });

  it('L2 env kill applies even when settings are absent', () => {
    const svc = makeAgentService({ envAutoApproval: false });
    expect(resolve(svc, undefined, 'edit')).toBe('ask');
  });

  it('L1 settings: autoApproval false â†’ ask despite override full', () => {
    const svc = makeAgentService({ envAutoApproval: true });
    expect(resolve(svc, { autoApproval: false, permissionMode: 'full' }, 'full')).toBe('ask');
  });

  it('L1 settings: autoApproval false applies when no override is sent', () => {
    const svc = makeAgentService({ envAutoApproval: true });
    expect(resolve(svc, { autoApproval: false, permissionMode: 'full' })).toBe('ask');
  });

  it('both enabled â†’ per-run override wins', () => {
    const svc = makeAgentService({
      envAutoApproval: true,
      liveSettings: { autoApproval: true, permissionMode: 'ask' },
    });
    expect(resolve(svc, { autoApproval: true, permissionMode: 'ask' }, 'full')).toBe('full');
    expect(resolve(svc, { autoApproval: true, permissionMode: 'full' }, 'edit')).toBe('edit');
  });

  it('both enabled, no override â†’ saved permissionMode', () => {
    const svc = makeAgentService({ envAutoApproval: true });
    expect(resolve(svc, { autoApproval: true, permissionMode: 'edit' })).toBe('edit');
  });

  it('both enabled, no override, no permissionMode â†’ ask', () => {
    const svc = makeAgentService({ envAutoApproval: true });
    expect(resolve(svc, { autoApproval: true })).toBe('ask');
    expect(resolve(svc, undefined)).toBe('ask');
  });

  it('falls back to live settings when the run passes no autoApproval', () => {
    const svc = makeAgentService({
      envAutoApproval: true,
      liveSettings: { autoApproval: false },
    });
    expect(resolve(svc, { permissionMode: 'full' }, 'full')).toBe('ask');
  });
});

describe('SC3 evictOldestKernel reads maxKernelCacheSize live', () => {
  function makeWithKernels(maxKernelCacheSize: number, entries: Array<[string, number]>) {
    const svc = Object.create(AgentService.prototype) as AgentService;
    (svc as unknown as { settingsService: { getSettings: () => Partial<KernelSettings> } })
      .settingsService = {
      getSettings: () => ({ maxKernelCacheSize }),
    };
    (svc as unknown as { kernels: Map<string, { kernel: unknown; lastAccess: number }> }).kernels =
      new Map(entries.map(([key, lastAccess]) => [key, { kernel: {}, lastAccess }]));
    return svc;
  }

  function evict(svc: AgentService): void {
    (svc as unknown as { evictOldestKernel: () => void }).evictOldestKernel();
  }

  it('evicts the oldest kernel when over the CURRENT limit (was ctor-cached)', () => {
    const svc = makeWithKernels(1, [
      ['old', 1],
      ['new', 2],
    ]);
    evict(svc);
    const kernels = (svc as unknown as { kernels: Map<string, unknown> }).kernels;
    expect(kernels.size).toBe(1);
    expect(kernels.has('new')).toBe(true);
    expect(kernels.has('old')).toBe(false);
  });

  it('raises the limit without a restart â€” a settings edit is enough', () => {
    const svc = makeWithKernels(5, [
      ['a', 1],
      ['b', 2],
    ]);
    evict(svc);
    expect((svc as unknown as { kernels: Map<string, unknown> }).kernels.size).toBe(2);
  });
});

describe('sendRunInput ack semantics (VNT-104)', () => {
  function makeService(opts: {
    activeRuns?: Array<{ id: string; sessionId?: string }>;
    kernels?: Map<string, { sendInput: (runId: string, text: string) => boolean }>;
  }) {
    const svc = Object.create(AgentService.prototype) as AgentService;
    const internals = svc as unknown as {
      activeKernels: Map<string, unknown>;
      trackingService: { findActiveRunForSession: (sessionId: string) => { id: string } | undefined };
      logger: { log: () => void; error: () => void };
    };
    internals.activeKernels = opts.kernels ?? new Map();
    internals.trackingService = {
      findActiveRunForSession: (sessionId: string) =>
        opts.activeRuns?.find((run) => run.sessionId === sessionId),
    };
    internals.logger = { log: () => {}, error: () => {} };
    return svc;
  }

  it('rejects an empty message without touching the runtime', async () => {
    const svc = makeService({});
    await expect(svc.sendRunInput({ runId: 'r1', message: '   ' })).resolves.toEqual({
      queued: false,
      status: 'empty',
    });
  });

  it('reports idle when no live run can be resolved', async () => {
    const svc = makeService({});
    await expect(svc.sendRunInput({ message: 'hi' })).resolves.toEqual({
      queued: false,
      status: 'idle',
    });
  });

  it('reports unavailable when this process holds no kernel', async () => {
    const svc = makeService({});
    await expect(svc.sendRunInput({ runId: 'r1', message: 'hi' })).resolves.toEqual({
      queued: false,
      runId: 'r1',
      status: 'unavailable',
    });
  });

  it('reports finished when the kernel refuses a settled run', async () => {
    const kernels = new Map([['r1', { sendInput: () => false }]]);
    const svc = makeService({ kernels });
    await expect(svc.sendRunInput({ runId: 'r1', message: 'late' })).resolves.toEqual({
      queued: false,
      runId: 'r1',
      status: 'finished',
    });
  });

  it('reports queued only when the kernel accepted the input', async () => {
    const sendInput = jest.fn().mockReturnValue(true);
    const kernels = new Map([['r1', { sendInput }]]);
    const svc = makeService({ kernels });
    await expect(svc.sendRunInput({ runId: 'r1', message: 'steer' })).resolves.toEqual({
      queued: true,
      runId: 'r1',
      status: 'queued',
    });
    expect(sendInput).toHaveBeenCalledWith('r1', 'steer');
  });

  it('resolves the run from the session when no runId is passed', async () => {
    const sendInput = jest.fn().mockReturnValue(true);
    const kernels = new Map([['run-7', { sendInput }]]);
    const svc = makeService({
      activeRuns: [{ id: 'run-7', sessionId: 'sess-1' }],
      kernels,
    });
    await expect(
      svc.sendRunInput({ sessionId: 'sess-1', message: 'steer' }),
    ).resolves.toEqual({ queued: true, runId: 'run-7', status: 'queued' });
  });
});

describe('promoteStaleSteeringInputs', () => {
  function makeService(messages: Array<Record<string, unknown>>) {
    const svc = Object.create(AgentService.prototype) as AgentService;
    const updateMessage = jest.fn().mockResolvedValue(undefined);
    (svc as unknown as { sessionStore: unknown }).sessionStore = {
      listMessages: jest.fn().mockResolvedValue(messages),
      updateMessage,
    };
    (svc as unknown as { logger: { warn: jest.Mock } }).logger = { warn: jest.fn() };
    return { svc, updateMessage };
  }

  function promote(svc: AgentService): Promise<void> {
    return (
      svc as unknown as { promoteStaleSteeringInputs(sessionId: string): Promise<void> }
    ).promoteStaleSteeringInputs('s1');
  }

  it('promotes only admitted-but-unpromoted steering inputs', async () => {
    const { svc, updateMessage } = makeService([
      { id: 'm1', admittedSeq: 1, promotedSeq: 1 },
      { id: 'm2', admittedSeq: 2 },
      { id: 'm3', admittedSeq: 3, promotedSeq: 2 },
      { id: 'm4' },
    ]);

    await promote(svc);

    expect(updateMessage).toHaveBeenCalledTimes(2);
    expect(updateMessage).toHaveBeenNthCalledWith(1, 's1', 'm2', { promotedSeq: 2 });
    expect(updateMessage).toHaveBeenNthCalledWith(2, 's1', 'm3', { promotedSeq: 3 });
  });

  it('never blocks a run when the store update fails', async () => {
    const svc = Object.create(AgentService.prototype) as AgentService;
    (svc as unknown as { sessionStore: unknown }).sessionStore = {
      listMessages: jest.fn().mockRejectedValue(new Error('db down')),
      updateMessage: jest.fn(),
    };
    const warn = jest.fn();
    (svc as unknown as { logger: { warn: jest.Mock } }).logger = { warn };

    await expect(promote(svc)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});

describe('kernel settings hash', () => {
  function hash(settings: Partial<KernelSettings>): string {
    const svc = makeAgentService({});
    return (
      svc as unknown as {
        getSettingsHash(s?: Partial<KernelSettings>): string;
      }
    ).getSettingsHash(settings);
  }

  it('changes when elicitTimeoutMs changes (stepTimeout is derived from it)', () => {
    const base: Partial<KernelSettings> = { stepTimeout: 120_000, elicitTimeoutMs: 300_000 };
    expect(hash({ ...base, elicitTimeoutMs: 600_000 })).not.toBe(hash(base));
  });

  it('is stable for unrelated live-read settings such as maxKernelCacheSize', () => {
    const base: Partial<KernelSettings> = { maxSteps: 30, maxKernelCacheSize: 50 };
    expect(hash({ ...base, maxKernelCacheSize: 10 })).toBe(hash(base));
  });
});