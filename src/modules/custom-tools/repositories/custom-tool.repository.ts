import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { customTools } from '../schemas/custom-tool.schema';
import { eq, sql, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CustomToolRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: any) {}

  async findById(id: string) {
    return this.db.select().from(customTools).where(eq(customTools.id, id)).get();
  }

  async findAll() {
    return this.db
      .select()
      .from(customTools)
      .where(sql`${customTools.deletedAt} IS NULL`)
      .orderBy(desc(customTools.createdAt))
      .all();
  }

  async findActive() {
    return this.db
      .select()
      .from(customTools)
      .where(sql`${customTools.isActive} = 1 AND ${customTools.deletedAt} IS NULL`)
      .orderBy(desc(customTools.createdAt))
      .all();
  }

  async create(data: {
    name: string;
    description?: string;
    inputSchema?: Record<string, any>;
    handlerType?: string;
    handlerConfig?: Record<string, any>;
    timeoutMs?: number;
  }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(customTools).values({
      id,
      name: data.name,
      description: data.description,
      inputSchema: data.inputSchema ?? {},
      handlerType: data.handlerType ?? 'webhook',
      handlerConfig: data.handlerConfig ?? {},
      timeoutMs: data.timeoutMs ?? 30000,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    return this.findById(id);
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    inputSchema?: Record<string, any>;
    handlerType?: string;
    handlerConfig?: Record<string, any>;
    timeoutMs?: number;
    isActive?: boolean;
  }) {
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.inputSchema !== undefined) updateData.inputSchema = data.inputSchema;
    if (data.handlerType !== undefined) updateData.handlerType = data.handlerType;
    if (data.handlerConfig !== undefined) updateData.handlerConfig = data.handlerConfig;
    if (data.timeoutMs !== undefined) updateData.timeoutMs = data.timeoutMs;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    this.db.update(customTools).set(updateData).where(eq(customTools.id, id)).run();
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.db.update(customTools).set({ deletedAt: new Date().toISOString() }).where(eq(customTools.id, id)).run();
  }
}
