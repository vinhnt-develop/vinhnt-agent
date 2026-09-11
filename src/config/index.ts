import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

dotenv.config();

const configSchema = z.object({
  workspaceRoot: z.string().default('.'),
  dataDir: z.string().default('.vinhnt-agent'),
  model: z.object({
    provider: z.string().default('openai'),
    apiKey: z.string().default(''),
    baseUrl: z.string().default('https://api.openai.com/v1'),
    modelId: z.string().default(''),
    maxSteps: z.coerce.number().default(30),
    maxTokens: z.coerce.number().default(4096),
    temperature: z.coerce.number().default(0.7),
    stepTimeout: z.coerce.number().default(120000),
  }),
  sync: z.object({
    enabled: z.coerce.boolean().default(false),
    apiUrl: z.string().default('http://localhost:3000/api/v1'),
    apiKey: z.string().default(''),
  }),
  server: z.object({
    port: z.coerce.number().default(3001),
    host: z.string().default('localhost'),
  }),
});

export type AgentConfig = z.infer<typeof configSchema>;

function resolveDataDir(dataDir: string): string {
  if (path.isAbsolute(dataDir)) return dataDir;
  return path.resolve(process.cwd(), dataDir);
}

export function loadConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  const raw = {
    workspaceRoot: process.env.AGENT_WORKSPACE_ROOT || '.',
    dataDir: process.env.AGENT_DATA_DIR || '.vinhnt-agent',
    model: {
      provider: process.env.AGENT_MODEL_PROVIDER || 'openai',
      apiKey: process.env.AGENT_MODEL_API_KEY || '',
      baseUrl: process.env.AGENT_MODEL_BASE_URL || 'https://api.openai.com/v1',
      modelId: process.env.AGENT_MODEL_ID || '',
      maxSteps: Number(process.env.AGENT_MAX_STEPS) || 30,
      maxTokens: Number(process.env.AGENT_MAX_TOKENS) || 4096,
      temperature: Number(process.env.AGENT_TEMPERATURE) || 0.7,
      stepTimeout: Number(process.env.AGENT_STEP_TIMEOUT) || 120000,
    },
    sync: {
      enabled: process.env.SYNC_ENABLED === 'true',
      apiUrl: process.env.SYNC_API_URL || 'http://localhost:3000/api/v1',
      apiKey: process.env.SYNC_API_KEY || '',
    },
    server: {
      port: Number(process.env.AGENT_SERVER_PORT) || 3001,
      host: process.env.AGENT_SERVER_HOST || 'localhost',
    },
    ...overrides,
  };

  const config = configSchema.parse(raw);
  config.dataDir = resolveDataDir(config.dataDir);

  // Ensure data directory exists
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }

  return config;
}

export function getConfigPath(config: AgentConfig): string {
  return path.join(config.dataDir, 'config.json');
}
