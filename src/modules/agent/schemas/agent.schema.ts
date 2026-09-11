import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { sessions } from '@/modules/session/schemas/session.schema';

export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),
  tier: text('tier').default('working'),
  key: text('key').notNull(),
  value: text('value').notNull(),
  tags: text('tags', { mode: 'json' }).default([]),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
});

export const runEvents = sqliteTable('run_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: text('run_id').notNull(),
  type: text('type').notNull(),
  sequence: integer('sequence').notNull().default(0),
  data: text('data', { mode: 'json' }).default({}),
  traceId: text('trace_id'),
  occurredAt: text('occurred_at').default(sql`datetime('now')`),
});

export const toolExecutions = sqliteTable('tool_executions', {
  id: text('id').primaryKey(),
  runId: text('run_id'),
  sessionId: text('session_id').references(() => sessions.id),
  messageId: text('message_id'),
  toolName: text('tool_name').notNull(),
  toolInput: text('tool_input', { mode: 'json' }).default({}),
  toolOutput: text('tool_output', { mode: 'json' }).default({}),
  status: text('status').default('pending'),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms').default(0),
  startedAt: text('started_at').default(sql`datetime('now')`),
  completedAt: text('completed_at'),
});

export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(),
  sessionId: text('session_id'),
  status: text('status').default('pending'),
  triggerType: text('trigger_type'),
  model: text('model'),
  provider: text('provider'),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  reasoningTokens: integer('reasoning_tokens').default(0),
  totalCost: real('total_cost').default(0),
  durationMs: integer('duration_ms'),
  toolCallsCount: integer('tool_calls_count').default(0),
  errorMessage: text('error_message'),
  metadata: text('metadata', { mode: 'json' }).default({}),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').default(sql`datetime('now')`),
});

export const providerConfigs = sqliteTable('provider_configs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  name: text('name'),
  apiKey: text('api_key'),
  baseUrl: text('base_url'),
  defaultModel: text('default_model'),
  configs: text('configs', { mode: 'json' }).default({}),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
  deletedAt: text('deleted_at'),
});

export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  transport: text('transport').notNull(), // 'stdio' | 'sse' | 'streamable-http'
  command: text('command'),
  args: text('args', { mode: 'json' }),
  url: text('url'),
  env: text('env', { mode: 'json' }).default({}),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  toolCount: integer('tool_count').default(0),
  lastConnectedAt: text('last_connected_at'),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('idx_mcp_servers_name').on(table.name),
]);

export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  label: text('label'),
  type: text('type').notNull(),
  valueEncrypted: text('value_encrypted').notNull(),
  metadata: text('metadata', { mode: 'json' }).default({}),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('idx_credentials_name').on(table.name),
]);
