import { registerAs } from '@nestjs/config';

export const agentConfig = registerAs('agent', () => ({
  workspaceRoot: process.env.AGENT_WORKSPACE_ROOT || '.',
}));

export const syncConfig = registerAs('sync', () => ({
  enabled: process.env.SYNC_ENABLED === 'true',
  apiUrl: process.env.SYNC_API_URL || '',
  apiKey: process.env.SYNC_API_KEY || '',
}));
