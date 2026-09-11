import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const knowledgeEntries = sqliteTable('knowledge', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  source: text('source').notNull().default('user'), // 'system' | 'user' | 'imported'
  sourceRef: text('source_ref'),
  tier: text('tier').default('stable'),
  tags: text('tags', { mode: 'json' }).default([]),
  embedding: text('embedding'),
  contentHash: text('content_hash'),
  filePath: text('file_path'),
  isEditable: integer('is_editable', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('idx_knowledge_source').on(table.source),
  index('idx_knowledge_content_hash').on(table.contentHash),
  uniqueIndex('idx_knowledge_key_source').on(table.key, table.source),
]);
