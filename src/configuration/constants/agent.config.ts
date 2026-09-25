import { registerAs } from '@nestjs/config';

function safeJsonParse<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const agentConfig = registerAs('agent', () => ({
  workspaceRoot: process.env.AGENT_WORKSPACE_ROOT || '.',
  maxSteps: parseInt(process.env.AGENT_MAX_STEPS || '30', 10),
  maxTokens: parseInt(process.env.AGENT_MAX_TOKENS || '4096', 10),
  stepTimeout: parseInt(process.env.AGENT_STEP_TIMEOUT || '120000', 10),
  doomLoopThreshold: parseInt(process.env.AGENT_DOOM_LOOP_THRESHOLD || '3', 10),
  thinkingBudget: parseInt(process.env.AGENT_THINKING_BUDGET || '1024', 10),
  // Default TRUE so write/shell don't dead-end waiting for an approval UI.
  // Set AGENT_AUTO_APPROVAL=false to require explicit approval for risk≥write.
  autoApproval: process.env.AGENT_AUTO_APPROVAL !== 'false',
  // Approval wait timeout — independent of stale-run threshold (5 min).
  // Unanswered dialog fails the tool after this window (default 2 min).
  approvalTimeoutMs: parseInt(process.env.AGENT_APPROVAL_TIMEOUT_MS || '120000', 10),
  maxKernelCacheSize: parseInt(process.env.AGENT_MAX_KERNEL_CACHE_SIZE || '50', 10),
  globalPermissionRules: safeJsonParse<Record<string, string | Record<string, string>> | undefined>(
    process.env.AGENT_PERMISSION_RULES,
    undefined,
  ),
  permissionRiskDefaults: safeJsonParse<Record<string, string> | undefined>(
    process.env.AGENT_PERMISSION_RISK_DEFAULTS,
    undefined,
  ),
}));

export const syncConfig = registerAs('sync', () => ({
  enabled: process.env.SYNC_ENABLED === 'true',
  apiUrl: process.env.SYNC_API_URL || '',
  apiKey: process.env.SYNC_API_KEY || '',
}));
