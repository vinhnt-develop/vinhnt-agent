import { registerAs } from '@nestjs/config';

export const agentConfig = registerAs('agent', () => ({
  workspaceRoot: process.env.AGENT_WORKSPACE_ROOT || '.',
  maxSteps: parseInt(process.env.AGENT_MAX_STEPS || '30', 10),
  maxTokens: parseInt(process.env.AGENT_MAX_TOKENS || '4096', 10),
  stepTimeout: parseInt(process.env.AGENT_STEP_TIMEOUT || '120000', 10),
  doomLoopThreshold: parseInt(process.env.AGENT_DOOM_LOOP_THRESHOLD || '3', 10),
  thinkingBudget: parseInt(process.env.AGENT_THINKING_BUDGET || '1024', 10),
  autoApproval: process.env.AGENT_AUTO_APPROVAL === 'true',
  maxKernelCacheSize: parseInt(process.env.AGENT_MAX_KERNEL_CACHE_SIZE || '50', 10),
  globalPermissionRules: process.env.AGENT_PERMISSION_RULES
    ? JSON.parse(process.env.AGENT_PERMISSION_RULES)
    : undefined,
  permissionRiskDefaults: process.env.AGENT_PERMISSION_RISK_DEFAULTS
    ? JSON.parse(process.env.AGENT_PERMISSION_RISK_DEFAULTS)
    : undefined,
}));

export const syncConfig = registerAs('sync', () => ({
  enabled: process.env.SYNC_ENABLED === 'true',
  apiUrl: process.env.SYNC_API_URL || '',
  apiKey: process.env.SYNC_API_KEY || '',
}));
