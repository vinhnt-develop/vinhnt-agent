import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { toolConfigs } from '../schemas/tool-config.schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ToolConfigRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: any) {}

  async findById(id: string) {
    return this.db.select().from(toolConfigs).where(eq(toolConfigs.id, id)).get();
  }

  async findAll() {
    return this.db
      .select()
      .from(toolConfigs)
      .where(sql`${toolConfigs.deletedAt} IS NULL`)
      .orderBy(desc(toolConfigs.createdAt))
      .all();
  }

  async findBySource(source: string) {
    return this.db
      .select()
      .from(toolConfigs)
      .where(and(eq(toolConfigs.source, source), sql`${toolConfigs.deletedAt} IS NULL`))
      .orderBy(desc(toolConfigs.createdAt))
      .all();
  }

  async findByToolId(toolId: string) {
    return this.db
      .select()
      .from(toolConfigs)
      .where(eq(toolConfigs.toolId, toolId))
      .get();
  }

  async findByToolIdAndSource(toolId: string, source: string) {
    return this.db
      .select()
      .from(toolConfigs)
      .where(and(eq(toolConfigs.toolId, toolId), eq(toolConfigs.source, source)))
      .get();
  }

  async findEnabled() {
    return this.db
      .select()
      .from(toolConfigs)
      .where(and(eq(toolConfigs.isEnabled, true), sql`${toolConfigs.deletedAt} IS NULL`))
      .orderBy(desc(toolConfigs.createdAt))
      .all();
  }

  async create(data: {
    toolId: string;
    source: string;
    config?: Record<string, any>;
    isEnabled?: boolean;
    mcpServerName?: string;
    mcpToolName?: string;
    version?: string;
    manifest?: Record<string, any>;
  }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(toolConfigs).values({
      id,
      toolId: data.toolId,
      source: data.source,
      config: data.config ?? {},
      isEnabled: data.isEnabled ?? true,
      mcpServerName: data.mcpServerName,
      mcpToolName: data.mcpToolName,
      version: data.version,
      manifest: data.manifest,
      createdAt: now,
      updatedAt: now,
    }).run();

    return this.findById(id);
  }

  async update(id: string, data: {
    config?: Record<string, any>;
    isEnabled?: boolean;
    version?: string;
    manifest?: Record<string, any>;
  }) {
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.config !== undefined) updateData.config = data.config;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.version !== undefined) updateData.version = data.version;
    if (data.manifest !== undefined) updateData.manifest = data.manifest;

    this.db.update(toolConfigs).set(updateData).where(eq(toolConfigs.id, id)).run();
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.db.update(toolConfigs).set({ deletedAt: new Date().toISOString() }).where(eq(toolConfigs.id, id)).run();
  }
}
