import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const pluginConfigs = sqliteTable('plugin_configs', {
  id: text('id').primaryKey(),
  pluginId: text('plugin_id').notNull(),
  source: text('source').notNull().default('custom'), // 'builtin' | 'community' | 'custom'
  version: text('version'),
  latestVersion: text('latest_version'),
  author: text('author'),
  repository: text('repository'),
  description: text('description'),
  dependencies: text('dependencies', { mode: 'json' }).default([]),
  localPath: text('local_path'),
  config: text('config', { mode: 'json' }).default({}),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  installedAt: text('installed_at').default(sql`datetime('now')`),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
  deletedAt: text('deleted_at'),
}, (table) => [
  uniqueIndex('idx_plugin_configs_plugin_source').on(table.pluginId, table.source),
  index('idx_plugin_configs_source').on(table.source),
]);
