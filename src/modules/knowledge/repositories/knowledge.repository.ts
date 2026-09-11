import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { knowledgeEntries } from '../schemas/knowledge.schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

@Injectable()
export class KnowledgeRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: any) {}

  async findById(id: string) {
    return this.db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, id)).get();
  }

  async findAll() {
    return this.db
      .select()
      .from(knowledgeEntries)
      .where(sql`${knowledgeEntries.deletedAt} IS NULL`)
      .orderBy(desc(knowledgeEntries.createdAt))
      .all();
  }

  async findBySource(source: string) {
    return this.db
      .select()
      .from(knowledgeEntries)
      .where(and(eq(knowledgeEntries.source, source), sql`${knowledgeEntries.deletedAt} IS NULL`))
      .orderBy(desc(knowledgeEntries.createdAt))
      .all();
  }

  async findByKey(key: string) {
    return this.db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.key, key))
      .get();
  }

  async findByKeyAndSource(key: string, source: string) {
    return this.db
      .select()
      .from(knowledgeEntries)
      .where(and(eq(knowledgeEntries.key, key), eq(knowledgeEntries.source, source)))
      .get();
  }

  async search(query: string) {
    const pattern = `%${query}%`;
    return this.db
      .select()
      .from(knowledgeEntries)
      .where(
        sql`(${knowledgeEntries.key} LIKE ${pattern} OR ${knowledgeEntries.value} LIKE ${pattern}) AND ${knowledgeEntries.deletedAt} IS NULL`
      )
      .orderBy(desc(knowledgeEntries.createdAt))
      .all();
  }

  async create(data: {
    key: string;
    value: string;
    source: string;
    sourceRef?: string;
    tier?: string;
    tags?: string[];
    isEditable?: boolean;
  }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(knowledgeEntries).values({
      id,
      key: data.key,
      value: data.value,
      source: data.source,
      sourceRef: data.sourceRef,
      tier: data.tier ?? 'stable',
      tags: data.tags ?? [],
      isEditable: data.isEditable ?? true,
      createdAt: now,
      updatedAt: now,
    }).run();

    return this.findById(id);
  }

  async update(id: string, data: {
    key?: string;
    value?: string;
    source?: string;
    sourceRef?: string;
    tier?: string;
    tags?: string[];
    isEditable?: boolean;
  }) {
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.key !== undefined) updateData.key = data.key;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.sourceRef !== undefined) updateData.sourceRef = data.sourceRef;
    if (data.tier !== undefined) updateData.tier = data.tier;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isEditable !== undefined) updateData.isEditable = data.isEditable;

    this.db.update(knowledgeEntries).set(updateData).where(eq(knowledgeEntries.id, id)).run();
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.db.update(knowledgeEntries).set({ deletedAt: new Date().toISOString() }).where(eq(knowledgeEntries.id, id)).run();
  }
}
