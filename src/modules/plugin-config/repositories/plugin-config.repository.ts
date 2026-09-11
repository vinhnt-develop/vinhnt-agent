import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { pluginConfigs } from '../schemas/plugin-config.schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

@Injectable()
export class PluginConfigRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: any) {}

  async findById(id: string) {
    return this.db.select().from(pluginConfigs).where(eq(pluginConfigs.id, id)).get();
  }

  async findAll() {
    return this.db
      .select()
      .from(pluginConfigs)
      .where(sql`${pluginConfigs.deletedAt} IS NULL`)
      .orderBy(desc(pluginConfigs.createdAt))
      .all();
  }

  async findBySource(source: string) {
    return this.db
      .select()
      .from(pluginConfigs)
      .where(and(eq(pluginConfigs.source, source), sql`${pluginConfigs.deletedAt} IS NULL`))
      .orderBy(desc(pluginConfigs.createdAt))
      .all();
  }

  async findByPluginId(pluginId: string) {
    return this.db
      .select()
      .from(pluginConfigs)
      .where(eq(pluginConfigs.pluginId, pluginId))
      .get();
  }

  async findByPluginIdAndSource(pluginId: string, source: string) {
    return this.db
      .select()
      .from(pluginConfigs)
      .where(and(eq(pluginConfigs.pluginId, pluginId), eq(pluginConfigs.source, source)))
      .get();
  }

  async findEnabled() {
    return this.db
      .select()
      .from(pluginConfigs)
      .where(and(eq(pluginConfigs.isEnabled, true), sql`${pluginConfigs.deletedAt} IS NULL`))
      .orderBy(desc(pluginConfigs.createdAt))
      .all();
  }

  async create(data: {
    pluginId: string;
    source: string;
    version?: string;
    config?: Record<string, any>;
    isEnabled?: boolean;
    author?: string;
    repository?: string;
    description?: string;
    dependencies?: string[];
    localPath?: string;
  }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(pluginConfigs).values({
      id,
      pluginId: data.pluginId,
      source: data.source,
      version: data.version,
      config: data.config ?? {},
      isEnabled: data.isEnabled ?? true,
      author: data.author,
      repository: data.repository,
      description: data.description,
      dependencies: data.dependencies ?? [],
      localPath: data.localPath,
      installedAt: now,
      createdAt: now,
      updatedAt: now,
    }).run();

    return this.findById(id);
  }

  async update(id: string, data: {
    version?: string;
    config?: Record<string, any>;
    isEnabled?: boolean;
    latestVersion?: string;
  }) {
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.version !== undefined) updateData.version = data.version;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.latestVersion !== undefined) updateData.latestVersion = data.latestVersion;

    this.db.update(pluginConfigs).set(updateData).where(eq(pluginConfigs.id, id)).run();
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.db.update(pluginConfigs).set({ deletedAt: new Date().toISOString() }).where(eq(pluginConfigs.id, id)).run();
  }
}
