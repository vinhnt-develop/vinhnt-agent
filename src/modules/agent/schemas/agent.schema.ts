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
}, (table) => [
  index('idx_run_events_run_id').on(table.runId),
]);

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
}, (table) => [
  index('idx_tool_executions_run_id').on(table.runId),
  index('idx_tool_executions_session_id').on(table.sessionId),
]);

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
  cacheReadTokens: integer('cache_read_tokens').default(0),
  cacheWriteTokens: integer('cache_write_tokens').default(0),
  totalTokens: integer('total_tokens').default(0),
  totalCost: real('total_cost').default(0),
  durationMs: integer('duration_ms'),
  toolCallsCount: integer('tool_calls_count').default(0),
  errorMessage: text('error_message'),
  stopReason: text('stop_reason'),
  metadata: text('metadata', { mode: 'json' }).default({}),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').default(sql`datetime('now')`),
}, (table) => [
  index('idx_agent_runs_session_id').on(table.sessionId),
]);
