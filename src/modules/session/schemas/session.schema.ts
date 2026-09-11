import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projects } from '@/modules/project/schemas/project.schema';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  title: text('title'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  model: text('model'),
  provider: text('provider'),
  cost: real('cost').default(0),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  metadata: text('metadata', { mode: 'json' }).default({}),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
  deletedAt: text('deleted_at'),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  role: text('role').notNull(),
  content: text('content').default(''),
  toolCallId: text('tool_call_id'),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  reasoningTokens: integer('reasoning_tokens').default(0),
  model: text('model'),
  provider: text('provider'),
  cost: real('cost').default(0),
  metadata: text('metadata', { mode: 'json' }).default({}),
  createdAt: text('created_at').default(sql`datetime('now')`),
});
