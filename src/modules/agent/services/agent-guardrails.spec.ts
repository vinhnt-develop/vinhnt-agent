import { buildKernelGuardrails } from './agent-guardrails';

describe('P3.2 buildKernelGuardrails (settings-driven)', () => {
  it('returns empty config for defaults (0 / "" / false)', () => {
    const { config, invalidPatterns } = buildKernelGuardrails({
      inputGuardrailMaxLength: 0,
      guardrailBlocklist: '',
      secretRedaction: false,
    });
    expect(config.inputGuardrails).toBeUndefined();
    expect(config.outputGuardrails).toBeUndefined();
    expect(invalidPatterns).toEqual([]);
  });

  it('wires input max-length guardrail when > 0', () => {
    const { config } = buildKernelGuardrails({ inputGuardrailMaxLength: 500 });
    expect(config.inputGuardrails).toHaveLength(1);
    expect(config.inputGuardrails![0].name).toBe('max-length');
    expect(config.outputGuardrails).toBeUndefined();
  });

  it('wires blocklist on BOTH directions and skips invalid regexes', () => {
    const { config, invalidPatterns } = buildKernelGuardrails({
      guardrailBlocklist: 'ignore previous instructions\n[unclosed\nsecret-key-\\w+',
    });
    expect(invalidPatterns).toEqual(['[unclosed']);
    expect(config.inputGuardrails).toHaveLength(1);
    expect(config.outputGuardrails).toHaveLength(1);
    expect(config.inputGuardrails![0].name).toBe('user-blocklist');
    // Same instance shared across directions (scope "both").
    expect(config.inputGuardrails![0]).toBe(config.outputGuardrails![0]);
  });

  it('wires secret-detection into output guardrails only', () => {
    const { config } = buildKernelGuardrails({ secretRedaction: true });
    expect(config.inputGuardrails).toBeUndefined();
    expect(config.outputGuardrails).toHaveLength(1);
    expect(config.outputGuardrails![0].name).toBe('secret-detection');
  });

  it('combines all three settings', () => {
    const { config } = buildKernelGuardrails({
      inputGuardrailMaxLength: 1000,
      guardrailBlocklist: 'blocked-term',
      secretRedaction: true,
    });
    expect(config.inputGuardrails).toHaveLength(2);
    expect(config.outputGuardrails).toHaveLength(2);
  });
});
