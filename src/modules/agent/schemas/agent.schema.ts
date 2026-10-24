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
  scope: text('scope').default('session').notNull(),
  userId: text('user_id'),
  appId: text('app_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_memories_scope_user').on(table.scope, table.userId),
  index('idx_memories_scope_app').on(table.scope, table.appId),
]);

/**
 * Durable HITL requests. The SDK stores gate a run with in-memory promises;
 * this table is the write-through audit/restart record so a crash does not
 * silently lose an approval/question/plan/elicitation.
 */
export const hitlRequests = sqliteTable('hitl_requests', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  runId: text('run_id').notNull(),
  sessionId: text('session_id'),
  status: text('status').notNull().default('pending'),
  payload: text('payload', { mode: 'json' }).notNull(),
  reply: text('reply', { mode: 'json' }),
  errorMessage: text('error_message'),
  expiresAt: integer('expires_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  resolvedAt: text('resolved_at'),
}, (table) => [
  index('idx_hitl_requests_run_id').on(table.runId),
  index('idx_hitl_requests_session_id').on(table.sessionId),
  index('idx_hitl_requests_status').on(table.status),
]);

export const runEvents = sqliteTable('run_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: text('run_id').notNull(),
  type: text('type').notNull(),
  sequence: integer('sequence').notNull().default(0),
  data: text('data', { mode: 'json' }).default({}),
  traceId: text('trace_id'),
  occurredAt: text('occurred_at').default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_run_events_run_id_sequence').on(table.runId, table.sequence),
]);

export const toolExecutions = sqliteTable('tool_executions', {
  id: text('id').primaryKey(),
  runId: text('run_id'),
  sessionId: text('session_id').references(() => sessions.id),
  messageId: text('message_id'),
  /** Model's tool_call id (messages.toolCallId) — joins tool rows to executions. */
  toolCallId: text('tool_call_id'),
  toolName: text('tool_name').notNull(),
  toolInput: text('tool_input', { mode: 'json' }).default({}),
  toolOutput: text('tool_output', { mode: 'json' }).default({}),
  status: text('status').default('pending'),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms').default(0),
  startedAt: text('started_at').default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
}, (table) => [
  index('idx_tool_executions_run_id').on(table.runId),
  index('idx_tool_executions_session_id').on(table.sessionId),
  index('idx_tool_executions_tool_call_id').on(table.toolCallId),
]);

export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(),
  sessionId: text('session_id'),
  parentRunId: text('parent_run_id'),
  agentId: text('agent_id'),
  traceId: text('trace_id'),
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
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_agent_runs_session_id').on(table.sessionId),
  index('idx_agent_runs_parent_run_id').on(table.parentRunId),
  index('idx_agent_runs_trace_id').on(table.traceId),
  index('idx_agent_runs_status').on(table.status),
]);
