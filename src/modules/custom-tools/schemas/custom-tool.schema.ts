import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const customTools = sqliteTable('custom_tools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  inputSchema: text('input_schema', { mode: 'json' }).default({}),
  handlerType: text('handler_type').notNull().default('webhook'), // 'webhook' | 'mock'
  handlerConfig: text('handler_config', { mode: 'json' }).default({}),
  timeoutMs: integer('timeout_ms').default(30000),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('idx_custom_tools_name').on(table.name),
]);
