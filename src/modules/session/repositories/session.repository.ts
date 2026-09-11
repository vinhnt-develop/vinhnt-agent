import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { sessions, messages } from '../schemas/session.schema';
import { eq, sql, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

@Injectable()
export class SessionRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: any) {}

  async findById(id: string) {
    return this.db.select().from(sessions).where(eq(sessions.id, id)).get();
  }

  async findByProjectId(projectId: string) {
    return this.db
      .select()
      .from(sessions)
      .where(sql`${sessions.projectId} = ${projectId} AND ${sessions.deletedAt} IS NULL`)
      .orderBy(desc(sessions.createdAt))
      .all();
  }

  async create(data: { title?: string; projectId?: string; model?: string; provider?: string }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(sessions).values({
      id,
      title: data.title,
      projectId: data.projectId,
      model: data.model,
      provider: data.provider,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    return this.findById(id);
  }

  async update(id: string, data: { title?: string; isActive?: boolean; model?: string; provider?: string }) {
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.provider !== undefined) updateData.provider = data.provider;

    this.db.update(sessions).set(updateData).where(eq(sessions.id, id)).run();
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.db.update(sessions).set({ deletedAt: new Date().toISOString() }).where(eq(sessions.id, id)).run();
  }

  async addMessage(data: { sessionId: string; role: string; content?: string; toolCallId?: string }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(messages).values({
      id,
      sessionId: data.sessionId,
      role: data.role,
      content: data.content ?? '',
      toolCallId: data.toolCallId,
      createdAt: now,
    }).run();

    return this.db.select().from(messages).where(eq(messages.id, id)).get();
  }

  async findMessages(sessionId: string) {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .all();
  }
}
