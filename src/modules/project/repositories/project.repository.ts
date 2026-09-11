import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import { projects } from '../schemas/project.schema';
import { eq, sql, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ProjectRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: any) {}

  async findById(id: string) {
    return this.db.select().from(projects).where(eq(projects.id, id)).get();
  }

  async findByWorkspaceId(workspaceId: string) {
    return this.db
      .select()
      .from(projects)
      .where(sql`${projects.workspaceId} = ${workspaceId} AND ${projects.deletedAt} IS NULL`)
      .orderBy(desc(projects.createdAt))
      .all();
  }

  async findByName(name: string, workspaceId: string) {
    return this.db
      .select()
      .from(projects)
      .where(sql`${projects.name} = ${name} AND ${projects.workspaceId} = ${workspaceId}`)
      .get();
  }

  async create(data: { name: string; description?: string; path?: string; workspaceId: string }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(projects).values({
      id,
      name: data.name,
      description: data.description,
      path: data.path,
      workspaceId: data.workspaceId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    return this.findById(id);
  }

  async update(id: string, data: { name?: string; description?: string; path?: string }) {
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.path !== undefined) updateData.path = data.path;

    this.db.update(projects).set(updateData).where(eq(projects.id, id)).run();
    return this.findById(id);
  }

  async softDelete(id: string) {
    this.db.update(projects).set({ deletedAt: new Date().toISOString() }).where(eq(projects.id, id)).run();
  }
}
