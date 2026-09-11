import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const toolConfigs = sqliteTable('tool_configs', {
  id: text('id').primaryKey(),
  toolId: text('tool_id').notNull(),
  source: text('source').notNull().default('custom'), // 'builtin' | 'mcp' | 'custom'
  mcpServerName: text('mcp_server_name'),
  mcpToolName: text('mcp_tool_name'),
  version: text('version'),
  config: text('config', { mode: 'json' }).default({}),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  manifest: text('manifest', { mode: 'json' }),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
  deletedAt: text('deleted_at'),
}, (table) => [
  uniqueIndex('idx_tool_configs_tool_source').on(table.toolId, table.source),
  index('idx_tool_configs_source').on(table.source),
]);
