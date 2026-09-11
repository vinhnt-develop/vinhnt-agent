import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { mcpServers } from '@/modules/agent/schemas/agent.schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

@Injectable()
export class McpServerRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: any) {}

  async findById(id: string) {
    return this.db.select().from(mcpServers).where(eq(mcpServers.id, id)).get();
  }

  async findAll() {
    return this.db
      .select()
      .from(mcpServers)
      .where(sql`${mcpServers.deletedAt} IS NULL`)
      .orderBy(desc(mcpServers.createdAt))
      .all();
  }

  async findEnabled() {
    return this.db
      .select()
      .from(mcpServers)
      .where(and(eq(mcpServers.isEnabled, true), sql`${mcpServers.deletedAt} IS NULL`))
      .orderBy(desc(mcpServers.createdAt))
      .all();
  }

  async findByName(name: string) {
    return this.db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.name, name))
      .get();
  }

  async create(data: {
    name: string;
    transport: string;
    command?: string;
    args?: Record<string, any>;
    url?: string;
    env?: Record<string, string>;
    isEnabled?: boolean;
  }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(mcpServers).values({
      id,
      name: data.name,
      transport: data.transport,
      command: data.command,
      args: data.args,
      url: data.url,
      env: data.env ?? {},
      isEnabled: data.isEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    }).run();

    return this.findById(id);
  }

  async update(id: string, data: {
    name?: string;
    transport?: string;
    command?: string;
    args?: Record<string, any>;
    url?: string;
    env?: Record<string, string>;
    isEnabled?: boolean;
    toolCount?: number;
    lastConnectedAt?: string;
  }) {
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.transport !== undefined) updateData.transport = data.transport;
    if (data.command !== undefined) updateData.command = data.command;
    if (data.args !== undefined) updateData.args = data.args;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.env !== undefined) updateData.env = data.env;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.toolCount !== undefined) updateData.toolCount = data.toolCount;
    if (data.lastConnectedAt !== undefined) updateData.lastConnectedAt = data.lastConnectedAt;

    this.db.update(mcpServers).set(updateData).where(eq(mcpServers.id, id)).run();
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.db.update(mcpServers).set({ deletedAt: new Date().toISOString() }).where(eq(mcpServers.id, id)).run();
  }
}
