import { AgentSettingsService } from './agent-settings.service';
import { AgentService } from './agent.service';
import { KernelSettingsStore } from '@/shared/kernel-settings.store';
import { ValidationPipe } from '@nestjs/common';
import { UpdateKernelSettingsDto } from '../dto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * P0'-8b: WebUI may send percent (50–100); kernel expects ratio (0–1].
 */
function makeService() {
  const svc = Object.create(AgentSettingsService.prototype) as AgentSettingsService;
  (svc as unknown as { settings: Record<string, unknown> }).settings = {
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 4096,
    frequencyPenalty: 0,
    presencePenalty: 0,
    maxSteps: 30,
    thinkingBudget: 1024,
    stepTimeout: 120000,
    toolChoice: 'auto',
    parallelToolCalls: true,
    maxToolCallsPerStep: 10,
    maxConcurrentToolCalls: 5,
    selfCorrectOnFailure: true,
    maxSelfCorrectAttempts: 1,
    compactionThreshold: 0.75,
    doomLoopThreshold: 3,
    maxSubAgentDepth: 3,
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000,
    sandboxMode: 'host',
    systemPrompt: '',
  };
  (svc as unknown as { saveSettings: () => void }).saveSettings = () => {};
  (svc as unknown as { logger: { log: (...a: unknown[]) => void } }).logger = {
    log: () => {},
  };
  return svc;
}

describe('P0\'-8b normalizeThreshold', () => {
  it('converts percent 75 → 0.75', () => {
    const svc = makeService();
    const out = svc.updateSettings({ compactionThreshold: 75 });
    expect(out.compactionThreshold).toBeCloseTo(0.75, 5);
  });

  it('keeps ratio 0.5 as 0.5', () => {
    const svc = makeService();
    const out = svc.updateSettings({ compactionThreshold: 0.5 });
    expect(out.compactionThreshold).toBeCloseTo(0.5, 5);
  });

  it('clamps percent >100 to 1', () => {
    const svc = makeService();
    const out = svc.updateSettings({ compactionThreshold: 150 });
    expect(out.compactionThreshold).toBe(1);
  });

  it('rejects non-positive values → default', () => {
    const svc = makeService();
    const out = svc.updateSettings({ compactionThreshold: 0 });
    expect(out.compactionThreshold).toBe(0.75);
  });

  it('getSettings also normalizes loaded value', () => {
    const svc = makeService();
    (svc as unknown as { settings: { compactionThreshold: number } }).settings.compactionThreshold = 80;
    expect(svc.getSettings().compactionThreshold).toBeCloseTo(0.8, 5);
  });
});

describe('P3.2 guardrails runtime guards', () => {
  it('drops negative inputGuardrailMaxLength', () => {
    const svc = makeService();
    const out = svc.updateSettings({ inputGuardrailMaxLength: -5 as unknown as number });
    expect(out.inputGuardrailMaxLength).toBeUndefined();
  });

  it('drops non-string guardrailBlocklist', () => {
    const svc = makeService();
    const out = svc.updateSettings({ guardrailBlocklist: 123 as unknown as string });
    expect(out.guardrailBlocklist).toBeUndefined();
  });

  it('drops non-boolean secretRedaction', () => {
    const svc = makeService();
    const out = svc.updateSettings({ secretRedaction: 'yes' as unknown as boolean });
    expect(out.secretRedaction).toBeUndefined();
  });

  it('keeps valid guardrail values', () => {
    const svc = makeService();
    const out = svc.updateSettings({
      inputGuardrailMaxLength: 500,
      guardrailBlocklist: 'bad-term',
      secretRedaction: true,
    });
    expect(out.inputGuardrailMaxLength).toBe(500);
    expect(out.guardrailBlocklist).toBe('bad-term');
    expect(out.secretRedaction).toBe(true);
  });
});

describe('P4.1 historyLimit runtime guard', () => {
  it('keeps a valid positive limit', () => {
    const svc = makeService();
    const out = svc.updateSettings({ historyLimit: 20 });
    expect(out.historyLimit).toBe(20);
  });

  it('keeps 0 (unlimited)', () => {
    const svc = makeService();
    const out = svc.updateSettings({ historyLimit: 0 });
    expect(out.historyLimit).toBe(0);
  });

  it('drops negative values', () => {
    const svc = makeService();
    const out = svc.updateSettings({ historyLimit: -1 as unknown as number });
    expect(out.historyLimit).toBeUndefined();
  });

  it('drops non-finite values', () => {
    const svc = makeService();
    const out = svc.updateSettings({ historyLimit: Number.NaN as unknown as number });
    expect(out.historyLimit).toBeUndefined();
  });
});

describe('P4.3 UpdateKernelSettingsDto validation (global ValidationPipe)', () => {
  // Mirror the global pipe in core.module.ts.
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  async function validate(body: unknown) {
    return pipe.transform(body, {
      type: 'body',
      metatype: UpdateKernelSettingsDto,
    });
  }

  it('accepts a full valid body', async () => {
    const out = await validate({
      temperature: 0.7,
      topP: 1,
      maxTokens: 4096,
      frequencyPenalty: 0,
      presencePenalty: 0,
      maxSteps: 30,
      thinkingBudget: 1024,
      stepTimeout: 120000,
      toolChoice: 'auto',
      parallelToolCalls: true,
      maxToolCallsPerStep: 10,
      maxConcurrentToolCalls: 5,
      permissionMode: 'ask',
      selfCorrectOnFailure: true,
      maxSelfCorrectAttempts: 1,
      compactionThreshold: 75,
      doomLoopThreshold: 3,
      maxSubAgentDepth: 3,
      historyLimit: 0,
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 30000,
      sandboxMode: 'host',
      inputGuardrailMaxLength: 0,
      guardrailBlocklist: '',
      secretRedaction: false,
      systemPrompt: '',
    });
    expect(out).toBeInstanceOf(UpdateKernelSettingsDto);
    expect((out as UpdateKernelSettingsDto).temperature).toBe(0.7);
    expect((out as UpdateKernelSettingsDto).historyLimit).toBe(0);
  });

  it('accepts a partial body (all fields optional)', async () => {
    const out = await validate({ temperature: 0.5 });
    expect(out).toBeInstanceOf(UpdateKernelSettingsDto);
    expect((out as UpdateKernelSettingsDto).temperature).toBe(0.5);
  });

  it('strips unknown keys (whitelist: true)', async () => {
    const out = await validate({ temperature: 0.7, evilKey: 'payload' });
    expect(out).not.toHaveProperty('evilKey');
    expect((out as UpdateKernelSettingsDto).temperature).toBe(0.7);
  });

  it('implicitly converts string → number (enableImplicitConversion)', async () => {
    const out = await validate({ maxTokens: '8192' });
    expect((out as UpdateKernelSettingsDto).maxTokens).toBe(8192);
  });

  it('rejects out-of-range temperature', async () => {
    await expect(validate({ temperature: 5 })).rejects.toThrow();
  });

  it('rejects out-of-range maxTokens (below min)', async () => {
    await expect(validate({ maxTokens: 0 })).rejects.toThrow();
  });

  it('rejects invalid toolChoice enum', async () => {
    await expect(validate({ toolChoice: 'sometimes' })).rejects.toThrow();
  });

  it('rejects invalid permissionMode enum', async () => {
    await expect(validate({ permissionMode: 'root' })).rejects.toThrow();
  });

  it('rejects non-numeric temperature (string that is not a number)', async () => {
    // enableImplicitConversion tries Number("abc") → NaN → @IsNumber rejects.
    await expect(validate({ temperature: 'abc' })).rejects.toThrow();
  });

  it('rejects negative historyLimit', async () => {
    await expect(validate({ historyLimit: -1 })).rejects.toThrow();
  });

  it('rejects historyLimit above max (500)', async () => {
    await expect(validate({ historyLimit: 501 })).rejects.toThrow();
  });

  it('accepts historyLimit 0 (unlimited)', async () => {
    const out = await validate({ historyLimit: 0 });
    expect((out as UpdateKernelSettingsDto).historyLimit).toBe(0);
  });
});

describe('P4.3 maxSelfCorrectAttempts default alignment', () => {
  it('server default (makeService fixture) is 1, matching webui defaultKernelSettings', () => {
    // Server DEFAULT_SETTINGS.maxSelfCorrectAttempts = 1; webui defaultKernelSettings
    // was 3, aligned down to 1 (safer, fewer runaway retry loops). The fixture in
    // makeService mirrors DEFAULT_SETTINGS — this pins the server-side value so a
    // future drift is caught.
    const svc = makeService();
    expect(svc.getSettings().maxSelfCorrectAttempts).toBe(1);
  });
});

describe('P4.4 contextLimit runtime guard', () => {
  it('keeps a valid positive override', () => {
    const svc = makeService();
    const out = svc.updateSettings({ contextLimit: 200000 });
    expect(out.contextLimit).toBe(200000);
  });

  it('keeps 0 (provider/SDK default)', () => {
    const svc = makeService();
    const out = svc.updateSettings({ contextLimit: 0 });
    expect(out.contextLimit).toBe(0);
  });

  it('drops negative values', () => {
    const svc = makeService();
    const out = svc.updateSettings({ contextLimit: -1 as unknown as number });
    expect(out.contextLimit).toBeUndefined();
  });

  it('drops non-finite values', () => {
    const svc = makeService();
    const out = svc.updateSettings({ contextLimit: Number.NaN as unknown as number });
    expect(out.contextLimit).toBeUndefined();
  });
});

describe('P4.4 failoverModels runtime guard', () => {
  it('keeps a valid string array (trims entries)', () => {
    const svc = makeService();
    const out = svc.updateSettings({ failoverModels: [' gpt-4o-mini ', 'claude-haiku'] });
    expect(out.failoverModels).toEqual(['gpt-4o-mini', 'claude-haiku']);
  });

  it('keeps empty array (no failover)', () => {
    const svc = makeService();
    const out = svc.updateSettings({ failoverModels: [] });
    expect(out.failoverModels).toEqual([]);
  });

  it('drops blank entries', () => {
    const svc = makeService();
    const out = svc.updateSettings({ failoverModels: ['gpt-4o', '', '  '] });
    expect(out.failoverModels).toEqual(['gpt-4o']);
  });

  it('drops non-array values', () => {
    const svc = makeService();
    const out = svc.updateSettings({ failoverModels: 'gpt-4o' as unknown as string[] });
    expect(out.failoverModels).toBeUndefined();
  });

  it('drops arrays containing non-string entries', () => {
    const svc = makeService();
    const out = svc.updateSettings({ failoverModels: ['gpt-4o', 42 as unknown as string] });
    expect(out.failoverModels).toBeUndefined();
  });
});

describe('P4.4 DTO validation for new fields', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  async function validate(body: unknown) {
    return pipe.transform(body, { type: 'body', metatype: UpdateKernelSettingsDto });
  }

  it('accepts valid contextLimit', async () => {
    const out = await validate({ contextLimit: 200000 });
    expect((out as UpdateKernelSettingsDto).contextLimit).toBe(200000);
  });

  it('accepts contextLimit 0 (auto)', async () => {
    const out = await validate({ contextLimit: 0 });
    expect((out as UpdateKernelSettingsDto).contextLimit).toBe(0);
  });

  it('rejects negative contextLimit', async () => {
    await expect(validate({ contextLimit: -1 })).rejects.toThrow();
  });

  it('accepts valid failoverModels array', async () => {
    const out = await validate({ failoverModels: ['gpt-4o-mini', 'claude-haiku'] });
    expect((out as UpdateKernelSettingsDto).failoverModels).toEqual(['gpt-4o-mini', 'claude-haiku']);
  });

  it('rejects non-array failoverModels', async () => {
    await expect(validate({ failoverModels: 'gpt-4o' })).rejects.toThrow();
  });

  it('rejects failoverModels with non-string entries', async () => {
    await expect(validate({ failoverModels: ['gpt-4o', 42] })).rejects.toThrow();
  });
});

describe('P6.4 otlpEndpoint runtime guard', () => {
  it('accepts a valid http(s) endpoint and trims it', () => {
    const svc = makeService();
    const out = svc.updateSettings({ otlpEndpoint: ' http://localhost:4318/v1/traces ' });
    expect(out.otlpEndpoint).toBe('http://localhost:4318/v1/traces');
  });

  it('accepts empty string (export off)', () => {
    const svc = makeService();
    const out = svc.updateSettings({ otlpEndpoint: '' });
    expect(out.otlpEndpoint).toBe('');
  });

  it('drops non-http schemes', () => {
    const svc = makeService();
    const out = svc.updateSettings({ otlpEndpoint: 'ftp://collector/v1/traces' });
    expect(out.otlpEndpoint).toBeUndefined();
  });

  it('drops garbage without scheme', () => {
    const svc = makeService();
    const out = svc.updateSettings({ otlpEndpoint: 'localhost:4318' });
    expect(out.otlpEndpoint).toBeUndefined();
  });

  it('drops non-string values', () => {
    const svc = makeService();
    const out = svc.updateSettings({ otlpEndpoint: 42 as unknown as string });
    expect(out.otlpEndpoint).toBeUndefined();
  });

  it('is NOT part of the kernel-affecting settings hash', () => {
    const svc = Object.create(AgentService.prototype) as {
      getSettingsHash: (s: Record<string, unknown>) => string;
    };
    const base = { temperature: 0.7, maxSteps: 30 };
    const a = svc.getSettingsHash({ ...base, otlpEndpoint: '' } as never);
    const b = svc.getSettingsHash({ ...base, otlpEndpoint: 'http://x/y' } as never);
    expect(a).toBe(b);
  });
});

describe('P6.4 DTO validation for otlpEndpoint', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  it('accepts a valid endpoint', async () => {
    const out = await pipe.transform(
      { otlpEndpoint: 'http://localhost:4318/v1/traces' },
      { type: 'body', metatype: UpdateKernelSettingsDto },
    );
    expect((out as UpdateKernelSettingsDto).otlpEndpoint).toBe('http://localhost:4318/v1/traces');
  });

  it('accepts empty string (off)', async () => {
    const out = await pipe.transform(
      { otlpEndpoint: '' },
      { type: 'body', metatype: UpdateKernelSettingsDto },
    );
    expect((out as UpdateKernelSettingsDto).otlpEndpoint).toBe('');
  });

  it('omitted field stays undefined (no forced value)', async () => {
    const out = await pipe.transform({}, { type: 'body', metatype: UpdateKernelSettingsDto });
    expect((out as UpdateKernelSettingsDto).otlpEndpoint).toBeUndefined();
  });

  it('coerces a numeric endpoint to string at HTTP; runtime guard then drops it', async () => {
    const out = await pipe.transform(
      { otlpEndpoint: 42 },
      { type: 'body', metatype: UpdateKernelSettingsDto },
    );
    // enableImplicitConversion turns 42 into "42" — which is NOT http(s)://…,
    // so AgentSettingsService.updateSettings drops it (runtime guard).
    expect((out as UpdateKernelSettingsDto).otlpEndpoint).toBe('42');
  });

  it('rejects endpoint over 2048 chars', async () => {
    await expect(
      pipe.transform(
        { otlpEndpoint: `http://x/${'a'.repeat(2048)}` },
        { type: 'body', metatype: UpdateKernelSettingsDto },
      ),
    ).rejects.toThrow();
  });
});

describe('P6.5 permissionMode vocabulary (@vinhnt-sdk/permission)', () => {
  it('keeps a known mode', () => {
    const svc = makeService();
    expect(svc.updateSettings({ permissionMode: 'edit' }).permissionMode).toBe('edit');
    expect(svc.updateSettings({ permissionMode: 'full' }).permissionMode).toBe('full');
    expect(svc.updateSettings({ permissionMode: 'ask' }).permissionMode).toBe('ask');
    // SDK 0.11.0 vocabulary — Phase 6/7 modes are now known.
    expect(svc.updateSettings({ permissionMode: 'acceptEdits' }).permissionMode).toBe('acceptEdits');
    expect(svc.updateSettings({ permissionMode: 'plan' }).permissionMode).toBe('plan');
    expect(svc.updateSettings({ permissionMode: 'bypass' }).permissionMode).toBe('bypass');
    expect(svc.updateSettings({ permissionMode: 'auto' }).permissionMode).toBe('auto');
    expect(svc.updateSettings({ permissionMode: 'default' }).permissionMode).toBe('default');
  });

  it('drops unknown modes (fail-closed - falls back to saved value)', () => {
    const svc = makeService();
    const out = svc.updateSettings({ permissionMode: 'yolo' as never });
    expect(out.permissionMode).toBeUndefined();
  });

  it('accepts only known modes at HTTP (IsIn from KNOWN_PERMISSION_MODES)', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });
    const ok = await pipe.transform(
      { permissionMode: 'edit' },
      { type: 'body', metatype: UpdateKernelSettingsDto },
    );
    expect((ok as UpdateKernelSettingsDto).permissionMode).toBe('edit');
    await expect(
      pipe.transform(
        { permissionMode: 'yolo' },
        { type: 'body', metatype: UpdateKernelSettingsDto },
      ),
    ).rejects.toThrow();
  });
});

// SC5: coerce test-env values the way the real registerAs config does —
// numeric strings → number, 'true'/'false' → boolean, other strings/objects as-is.
function coerceEnvValue(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  const n = Number(v);
  return Number.isFinite(n) && v.trim() !== '' ? n : v;
}

function makeRealService(env: Record<string, unknown>) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-settings-p46-'));
  const configService = {
    get: (key: string, fallback?: unknown) => {
      if (key === 'CONFIG_DIR') return tmpDir;
      return env[key] !== undefined ? coerceEnvValue(env[key]) : fallback;
    },
  };
  const store = new KernelSettingsStore();
  const svc = new AgentSettingsService(
    configService as unknown as ConstructorParameters<typeof AgentSettingsService>[0],
    store,
  );
  return { svc, tmpDir, store };
}

describe('P4.6 env-seeded defaults', () => {

  it('seeds temperature/topP from agent.* config when no saved file exists', () => {
    const { svc, tmpDir } = makeRealService({ 'agent.temperature': '0.2', 'agent.topP': '0.9' });
    try {
      const settings = svc.getSettings();
      expect(settings.temperature).toBe(0.2);
      expect(settings.topP).toBe(0.9);
      // Non-seeded fields keep their literal defaults.
      expect(settings.maxSteps).toBe(30);
      expect(settings.thinkingBudget).toBe(1024);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('seeds maxSteps/thinkingBudget/doomLoopThreshold from agent.* config', () => {
    const { svc, tmpDir } = makeRealService({
      'agent.maxSteps': '10',
      'agent.thinkingBudget': '512',
      'agent.doomLoopThreshold': '5',
    });
    try {
      const settings = svc.getSettings();
      expect(settings.maxSteps).toBe(10);
      expect(settings.thinkingBudget).toBe(512);
      expect(settings.doomLoopThreshold).toBe(5);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('falls back to literals when env keys are absent', () => {
    const { svc, tmpDir } = makeRealService({});
    try {
      const settings = svc.getSettings();
      expect(settings.temperature).toBe(0.7);
      expect(settings.topP).toBe(1.0);
      expect(settings.maxTokens).toBe(4096);
      expect(settings.stepTimeout).toBe(120000);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('saved kernel-settings.json overrides env-seeded defaults (hierarchy: JSON > env)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-settings-p46-'));
    try {
      // Pre-write a saved file with temperature=0.5.
      fs.writeFileSync(
        path.join(tmpDir, 'kernel-settings.json'),
        JSON.stringify({ temperature: 0.5 }),
        'utf-8',
      );
      const configService = {
        get: (key: string, fallback?: unknown) => {
          if (key === 'CONFIG_DIR') return tmpDir;
          if (key === 'agent.temperature') return 0.2;
          return fallback;
        },
      };
      const svc = new AgentSettingsService(
        configService as unknown as ConstructorParameters<typeof AgentSettingsService>[0],
        new KernelSettingsStore(),
      );
      const settings = svc.getSettings();
      // Saved JSON (0.5) beats env seed (0.2); non-saved field still env-seeded.
      expect(settings.temperature).toBe(0.5);
      expect(settings.topP).toBe(1.0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('resetSettings falls back to env-seeded defaults (not literals)', () => {
    const { svc, tmpDir } = makeRealService({ 'agent.temperature': '0.2' });
    try {
      svc.updateSettings({ temperature: 0.9 });
      expect(svc.getSettings().temperature).toBe(0.9);
      const reset = svc.resetSettings();
      expect(reset.temperature).toBe(0.2); // env seed, not 0.7 literal
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('SC1 env-seeded SC knobs (JSON > env > literal)', () => {
  it('seeds the 6 SC fields from agent.* config and syncs the store', () => {
    const { svc, tmpDir, store } = makeRealService({
      'agent.autoApproval': 'false',
      'agent.workspaceRoot': 'D:/env-root',
      'agent.approvalTimeoutMs': '60000',
      'agent.maxKernelCacheSize': '10',
      'agent.globalPermissionRules': { shell: 'deny' },
      'agent.permissionRiskDefaults': { destructive: 'deny' },
    });
    try {
      const s = svc.getSettings();
      expect(s.autoApproval).toBe(false);
      expect(s.workspaceRoot).toBe('D:/env-root');
      expect(s.approvalTimeoutMs).toBe(60000);
      expect(s.maxKernelCacheSize).toBe(10);
      expect(s.globalPermissionRules).toEqual({ shell: 'deny' });
      expect(s.permissionRiskDefaults).toEqual({ destructive: 'deny' });
      expect(store.getWorkspaceRoot()).toBe('D:/env-root');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('saved kernel-settings.json overrides the SC env seeds (JSON > env)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-settings-sc-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'kernel-settings.json'),
        JSON.stringify({
          autoApproval: true,
          workspaceRoot: 'D:/json-root',
          approvalTimeoutMs: 30000,
          maxKernelCacheSize: 5,
        }),
        'utf-8',
      );
      const configService = {
        get: (key: string, fallback?: unknown) => {
          if (key === 'CONFIG_DIR') return tmpDir;
          const env: Record<string, unknown> = {
            'agent.autoApproval': false,
            'agent.workspaceRoot': 'D:/env-root',
            'agent.approvalTimeoutMs': 60000,
            'agent.maxKernelCacheSize': 10,
          };
          return env[key] !== undefined ? env[key] : fallback;
        },
      };
      const store = new KernelSettingsStore();
      const svc = new AgentSettingsService(
        configService as unknown as ConstructorParameters<typeof AgentSettingsService>[0],
        store,
      );
      const s = svc.getSettings();
      expect(s.autoApproval).toBe(true);
      expect(s.workspaceRoot).toBe('D:/json-root');
      expect(s.approvalTimeoutMs).toBe(30000);
      expect(s.maxKernelCacheSize).toBe(5);
      // Unsaved SC fields keep their env seed (rules were not in the file).
      expect(s.globalPermissionRules).toEqual({});
      expect(store.getWorkspaceRoot()).toBe('D:/json-root');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('resetSettings falls back to SC env seeds and re-syncs the store', () => {
    const { svc, tmpDir, store } = makeRealService({
      'agent.workspaceRoot': 'D:/env-root',
      'agent.maxKernelCacheSize': '10',
    });
    try {
      svc.updateSettings({ workspaceRoot: 'D:/edited', maxKernelCacheSize: 3 });
      expect(store.getWorkspaceRoot()).toBe('D:/edited');
      const reset = svc.resetSettings();
      expect(reset.workspaceRoot).toBe('D:/env-root');
      expect(reset.maxKernelCacheSize).toBe(10);
      expect(store.getWorkspaceRoot()).toBe('D:/env-root');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('sanitizes corrupt SC fields when loading a bad kernel-settings.json', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-settings-sc-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'kernel-settings.json'),
        JSON.stringify({
          autoApproval: 'yes',
          workspaceRoot: 42,
          approvalTimeoutMs: -5,
          maxKernelCacheSize: 0,
          globalPermissionRules: [1, 2],
          permissionRiskDefaults: { destructive: 7 },
          permissionMode: 'bogus',
        }),
        'utf-8',
      );
      const configService = {
        get: (key: string, fallback?: unknown) => (key === 'CONFIG_DIR' ? tmpDir : fallback),
      };
      const store = new KernelSettingsStore();
      const svc = new AgentSettingsService(
        configService as unknown as ConstructorParameters<typeof AgentSettingsService>[0],
        store,
      );
      const s = svc.getSettings();
      expect(s.autoApproval).toBe(true);
      expect(s.workspaceRoot).toBe('.');
      expect(s.approvalTimeoutMs).toBe(120000);
      expect(s.maxKernelCacheSize).toBe(50);
      expect(s.globalPermissionRules).toEqual({});
      expect(s.permissionRiskDefaults).toEqual({});
      expect(s.permissionMode).toBe('ask');
      expect(store.getWorkspaceRoot()).toBe('.');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('SC1 runtime guards (updateSettings)', () => {
  it('keeps valid globalPermissionRules (flat + nested)', () => {
    const svc = makeService();
    const out = svc.updateSettings({
      globalPermissionRules: { shell: 'ask', read: { '.env': 'deny' } },
    });
    expect(out.globalPermissionRules).toEqual({ shell: 'ask', read: { '.env': 'deny' } });
  });

  it('drops non-object globalPermissionRules', () => {
    const svc = makeService();
    const out = svc.updateSettings({
      globalPermissionRules: 'shell: ask' as unknown as Record<string, string | Record<string, string>>,
    });
    expect(out.globalPermissionRules).toBeUndefined();
  });

  it('drops globalPermissionRules containing non-string leaf values', () => {
    const svc = makeService();
    const out = svc.updateSettings({
      globalPermissionRules: { read: { '.env': 42 } } as unknown as Record<string, string | Record<string, string>>,
    });
    expect(out.globalPermissionRules).toBeUndefined();
  });

  it('keeps valid permissionRiskDefaults', () => {
    const svc = makeService();
    const out = svc.updateSettings({ permissionRiskDefaults: { destructive: 'ask' } });
    expect(out.permissionRiskDefaults).toEqual({ destructive: 'ask' });
  });

  it('drops permissionRiskDefaults with non-string values', () => {
    const svc = makeService();
    const out = svc.updateSettings({
      permissionRiskDefaults: { destructive: 1 } as unknown as Record<string, string>,
    });
    expect(out.permissionRiskDefaults).toBeUndefined();
  });

  it('drops out-of-range approvalTimeoutMs', () => {
    const svc = makeService();
    expect(svc.updateSettings({ approvalTimeoutMs: 500 }).approvalTimeoutMs).toBeUndefined();
    expect(svc.updateSettings({ approvalTimeoutMs: 700000 }).approvalTimeoutMs).toBeUndefined();
    expect(
      svc.updateSettings({ approvalTimeoutMs: Number.NaN as unknown as number }).approvalTimeoutMs,
    ).toBeUndefined();
  });

  it('keeps in-range approvalTimeoutMs', () => {
    const svc = makeService();
    expect(svc.updateSettings({ approvalTimeoutMs: 45000 }).approvalTimeoutMs).toBe(45000);
  });

  it('drops maxKernelCacheSize below 1', () => {
    const svc = makeService();
    expect(svc.updateSettings({ maxKernelCacheSize: 0 }).maxKernelCacheSize).toBeUndefined();
    expect(svc.updateSettings({ maxKernelCacheSize: -3 }).maxKernelCacheSize).toBeUndefined();
  });

  it('drops non-boolean autoApproval and blank workspaceRoot', () => {
    const svc = makeService();
    const out = svc.updateSettings({
      autoApproval: 'yes' as unknown as boolean,
      workspaceRoot: '   ',
    });
    expect(out.autoApproval).toBeUndefined();
    expect(out.workspaceRoot).toBeUndefined();
  });

  it('keeps valid autoApproval/workspaceRoot', () => {
    const svc = makeService();
    const out = svc.updateSettings({ autoApproval: false, workspaceRoot: 'D:/root' });
    expect(out.autoApproval).toBe(false);
    expect(out.workspaceRoot).toBe('D:/root');
  });
});

describe('VNT-322 agent runtime settings', () => {
  it('seeds browse roots/home/elicit timeout and syncs the store', () => {
    const { svc, tmpDir, store } = makeRealService({
      'agent.browseRoots': `/one${path.delimiter}/two,/three`,
      'agent.browseHome': ' D:/home ',
      'agent.elicitTimeoutMs': '45000',
    });
    try {
      const s = svc.getSettings();
      expect(s.browseRoots).toEqual(['/one', '/two', '/three']);
      expect(s.browseHome).toBe('D:/home');
      expect(s.elicitTimeoutMs).toBe(45000);
      expect(store.getBrowseRoots()).toEqual(['/one', '/two', '/three']);
      expect(store.getBrowseHome()).toBe('D:/home');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('trims/dedupes roots and drops malformed runtime values', () => {
    const svc = makeService();
    const out = svc.updateSettings({
      browseRoots: [' D:/a ', '', 'D:/a', 'D:/b'],
      browseHome: ' D:/home ',
      elicitTimeoutMs: 45000,
    });
    expect(out.browseRoots).toEqual(['D:/a', 'D:/b']);
    expect(out.browseHome).toBe('D:/home');
    expect(out.elicitTimeoutMs).toBe(45000);

    const bad = makeService().updateSettings({
      browseRoots: 'not-an-array' as unknown as string[],
      browseHome: 1 as unknown as string,
      elicitTimeoutMs: 3_600_001,
    });
    expect(bad.browseRoots).toBeUndefined();
    expect(bad.browseHome).toBeUndefined();
    expect(bad.elicitTimeoutMs).toBeUndefined();
  });
});

describe('VNT-323 ops status', () => {
  it('summarizes config without leaking secrets', () => {
    const { svc, tmpDir } = makeRealService({
      NODE_ENV: 'production',
      APP_HOST: '0.0.0.0',
      APP_PORT: '9090',
      APP_API_PREFIX: 'v1',
      APP_CORS_ORIGIN: 'https://example.test',
      DATABASE_URL: 'postgres://user:password@db.local:5432/agent',
      AUTH_SECRET: 'super-secret',
      SYNC_ENABLED: 'true',
      SYNC_API_URL: 'https://sync.test',
      SYNC_API_KEY: 'sync-secret',
    });
    try {
      const status = svc.getOpsStatus();
      expect(status.runtime).toEqual({ nodeEnv: 'production', configDir: tmpDir });
      expect(status.server).toEqual({
        host: '0.0.0.0',
        port: '9090',
        apiPrefix: 'v1',
        corsOrigin: 'https://example.test',
      });
      expect(status.database).toEqual({
        configured: true,
        driver: 'postgres',
        target: 'db.local:5432/agent',
      });
      expect(status.auth.secretConfigured).toBe(true);
      expect(status.sync).toEqual({
        enabled: true,
        apiUrlConfigured: true,
        apiKeyConfigured: true,
        consumers: 'none',
      });
      const serialized = JSON.stringify(status);
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('super-secret');
      expect(serialized).not.toContain('sync-secret');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports sqlite paths and missing auth without values', () => {
    const { svc, tmpDir } = makeRealService({
      DATABASE_URL: 'file:./data/agent.db',
    });
    try {
      const status = svc.getOpsStatus();
      expect(status.database).toEqual({
        configured: true,
        driver: 'sqlite',
        target: './data/agent.db',
      });
      expect(status.auth.secretConfigured).toBe(false);
      expect(status.sync.enabled).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('SC2 DTO validation for SC fields (global ValidationPipe)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  async function validate(body: unknown) {
    return pipe.transform(body, { type: 'body', metatype: UpdateKernelSettingsDto });
  }

  it('accepts a valid SC body', async () => {
    const out = await validate({
      autoApproval: true,
      workspaceRoot: 'D:/root',
      approvalTimeoutMs: 60000,
      maxKernelCacheSize: 25,
      globalPermissionRules: { shell: 'ask' },
      permissionRiskDefaults: { destructive: 'ask' },
    });
    expect(out).toBeInstanceOf(UpdateKernelSettingsDto);
    expect((out as UpdateKernelSettingsDto).autoApproval).toBe(true);
    expect((out as UpdateKernelSettingsDto).approvalTimeoutMs).toBe(60000);
    expect((out as UpdateKernelSettingsDto).globalPermissionRules).toEqual({ shell: 'ask' });
  });

  it('rejects approvalTimeoutMs below min (999)', async () => {
    await expect(validate({ approvalTimeoutMs: 999 })).rejects.toThrow();
  });

  it('rejects approvalTimeoutMs above max (600001)', async () => {
    await expect(validate({ approvalTimeoutMs: 600001 })).rejects.toThrow();
  });

  it('rejects maxKernelCacheSize below 1', async () => {
    await expect(validate({ maxKernelCacheSize: 0 })).rejects.toThrow();
  });

  it('rejects rules sent as an array', async () => {
    await expect(validate({ globalPermissionRules: [1, 2] })).rejects.toThrow();
    await expect(validate({ permissionRiskDefaults: ['ask'] })).rejects.toThrow();
  });

  it('strips unknown keys alongside SC fields', async () => {
    const out = await validate({ autoApproval: true, evilKey: 'payload' });
    expect(out).not.toHaveProperty('evilKey');
    expect((out as UpdateKernelSettingsDto).autoApproval).toBe(true);
  });

  it('validates runtime browse/elicit fields', async () => {
    const out = (await validate({
      browseRoots: ['D:/a', 'D:/b'],
      browseHome: 'D:/home',
      elicitTimeoutMs: 45000,
    })) as UpdateKernelSettingsDto;
    expect(out.browseRoots).toEqual(['D:/a', 'D:/b']);
    expect(out.browseHome).toBe('D:/home');
    expect(out.elicitTimeoutMs).toBe(45000);

    await expect(validate({ browseRoots: [1] })).rejects.toThrow();
    await expect(validate({ browseRoots: Array(33).fill('D:/x') })).rejects.toThrow();
    await expect(validate({ elicitTimeoutMs: 999 })).rejects.toThrow();
    await expect(validate({ elicitTimeoutMs: 3600001 })).rejects.toThrow();
  });
});
