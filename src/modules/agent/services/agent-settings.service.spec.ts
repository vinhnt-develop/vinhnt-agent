import { AgentSettingsService } from './agent-settings.service';

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
    maxSelfCorrectAttempts: 3,
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
