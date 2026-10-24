import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core';
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
  gitBranch: text('git_branch'),
  version: text('version'),
  parentId: text('parent_id'),
  metadata: text('metadata', { mode: 'json' }).default({}),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('idx_sessions_project_id').on(table.projectId),
  index('idx_sessions_parent_id').on(table.parentId),
]);

export const sessionSurfaces = sqliteTable('session_surfaces', {
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  surfaceId: text('surface_id').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  primaryKey({ columns: [table.sessionId, table.surfaceId] }),
  index('idx_session_surfaces_session_id').on(table.sessionId),
]);

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  role: text('role').notNull(),
  content: text('content').default(''),
  toolCallId: text('tool_call_id'),
  contentBlocks: text('content_blocks', { mode: 'json' }).default([]),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  reasoningTokens: integer('reasoning_tokens').default(0),
  model: text('model'),
  provider: text('provider'),
  cost: real('cost').default(0),
  metadata: text('metadata', { mode: 'json' }).default({}),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_messages_session_id').on(table.sessionId),
]);
