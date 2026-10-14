import {
  blocklistGuardrail,
  maxLengthGuardrail,
  secretDetectionGuardrail,
  type Guardrail,
} from '@vinhnt-sdk/guardrails';
import { defaultSecretRedactor } from '@vinhnt-sdk/guard';
import type { KernelSettings } from './agent-settings.service';

export interface KernelGuardrailsConfig {
  inputGuardrails?: Guardrail[];
  outputGuardrails?: Guardrail[];
}

export interface GuardrailBuildResult {
  config: KernelGuardrailsConfig;
  /** Regex strings from the blocklist that failed to compile (skipped). */
  invalidPatterns: string[];
}

/**
 * Build kernel guardrails from user settings (P3.2 — settings-driven).
 *
 * - `inputGuardrailMaxLength > 0` → input max-length tripwire.
 * - `guardrailBlocklist` (newline-separated regex) → blocklist on both
 *   directions (invalid regexes are skipped and reported).
 * - `secretRedaction` → output secret-detection guardrail (redacts in place).
 *
 * Defaults (0 / '' / false) yield an empty config → no guardrails wired.
 */
export function buildKernelGuardrails(
  settings: Partial<KernelSettings>,
): GuardrailBuildResult {
  const input: Guardrail[] = [];
  const output: Guardrail[] = [];
  const invalidPatterns: string[] = [];

  const maxLength = settings.inputGuardrailMaxLength ?? 0;
  if (maxLength > 0) {
    input.push(maxLengthGuardrail(maxLength, 'input'));
  }

  const patterns: RegExp[] = [];
  const blocklist = settings.guardrailBlocklist ?? '';
  for (const raw of blocklist.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      patterns.push(new RegExp(trimmed, 'i'));
    } catch {
      invalidPatterns.push(trimmed);
    }
  }
  if (patterns.length > 0) {
    const guard = blocklistGuardrail(patterns, 'user-blocklist');
    input.push(guard);
    output.push(guard);
  }

  if (settings.secretRedaction) {
    output.push(secretDetectionGuardrail(defaultSecretRedactor));
  }

  return {
    config: {
      ...(input.length > 0 ? { inputGuardrails: input } : {}),
      ...(output.length > 0 ? { outputGuardrails: output } : {}),
    },
    invalidPatterns,
  };
}
