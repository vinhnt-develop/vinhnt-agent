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
  it('L2 env kill: AGENT_AUTO_APPROVAL=false → ask even with settings true + override full', () => {
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

  it('L1 settings: autoApproval false → ask despite override full', () => {
    const svc = makeAgentService({ envAutoApproval: true });
    expect(resolve(svc, { autoApproval: false, permissionMode: 'full' }, 'full')).toBe('ask');
  });

  it('L1 settings: autoApproval false applies when no override is sent', () => {
    const svc = makeAgentService({ envAutoApproval: true });
    expect(resolve(svc, { autoApproval: false, permissionMode: 'full' })).toBe('ask');
  });

  it('both enabled → per-run override wins', () => {
    const svc = makeAgentService({
      envAutoApproval: true,
      liveSettings: { autoApproval: true, permissionMode: 'ask' },
    });
    expect(resolve(svc, { autoApproval: true, permissionMode: 'ask' }, 'full')).toBe('full');
    expect(resolve(svc, { autoApproval: true, permissionMode: 'full' }, 'edit')).toBe('edit');
  });

  it('both enabled, no override → saved permissionMode', () => {
    const svc = makeAgentService({ envAutoApproval: true });
    expect(resolve(svc, { autoApproval: true, permissionMode: 'edit' })).toBe('edit');
  });

  it('both enabled, no override, no permissionMode → ask', () => {
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

  it('raises the limit without a restart — a settings edit is enough', () => {
    const svc = makeWithKernels(5, [
      ['a', 1],
      ['b', 2],
    ]);
    evict(svc);
    expect((svc as unknown as { kernels: Map<string, unknown> }).kernels.size).toBe(2);
  });
});
