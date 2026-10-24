import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION, type DatabaseConnection } from '@/infrastructure/database';
import { workspaces } from '../schemas/workspace.schema';
import { projects } from '@/modules/project/schemas/project.schema';
import { sessions } from '@/modules/session/schemas/session.schema';
import { eq, sql, desc, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class WorkspaceRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DatabaseConnection) {}

  async findById(id: string) {
    return this.db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  }

  async findByOwnerId(ownerId: string) {
    return this.db
      .select()
      .from(workspaces)
      .where(sql`${workspaces.ownerId} = ${ownerId} AND ${workspaces.deletedAt} IS NULL`)
      .orderBy(desc(workspaces.createdAt))
      .all();
  }

  async findByOwnerIdWithPagination(ownerId: string, dto: PaginationDto) {
    const offset = (dto.page! - 1) * dto.limit!;
    const where = sql`${workspaces.ownerId} = ${ownerId} AND ${workspaces.deletedAt} IS NULL`;

    const rows = this.db
      .select()
      .from(workspaces)
      .where(where)
      .orderBy(desc(workspaces.createdAt))
      .limit(dto.limit!)
      .offset(offset)
      .all();

    const [{ count: total }] = this.db
      .select({ count: sql<number>`count(*)` })
      .from(workspaces)
      .where(where)
      .all();

    return { data: rows, total, page: dto.page!, limit: dto.limit! };
  }

  async findByName(name: string, ownerId: string) {
    return this.db
      .select()
      .from(workspaces)
      .where(sql`${workspaces.name} = ${name} AND ${workspaces.ownerId} = ${ownerId}`)
      .get();
  }

  async create(data: { name: string; description?: string; ownerId: string }) {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.insert(workspaces).values({
      id,
      name: data.name,
      description: data.description,
      ownerId: data.ownerId,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    }).run();

    return this.findById(id);
  }

  async update(id: string, data: { name?: string; description?: string }) {
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    this.db.update(workspaces).set(updateData).where(eq(workspaces.id, id)).run();
    return this.findById(id);
  }

  /**
   * Soft-delete a workspace and every project/session beneath it in one
   * transaction. Without the cascade, deleting a workspace left its children
   * visible through project/session APIs and the UI could still open them.
   */
  async softDeleteCascade(id: string) {
    const now = new Date().toISOString();
    this.db.transaction((tx) => {
      const projectIds = tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.workspaceId, id))
        .all()
        .map((row) => row.id);

      if (projectIds.length > 0) {
        tx.update(sessions)
          .set({ deletedAt: now, isActive: false })
          .where(inArray(sessions.projectId, projectIds))
          .run();
      }

      tx.update(projects)
        .set({ deletedAt: now, isActive: false })
        .where(eq(projects.workspaceId, id))
        .run();

      tx.update(workspaces)
        .set({ deletedAt: now, isActive: false, updatedAt: now })
        .where(eq(workspaces.id, id))
        .run();
    });
  }

  async setActive(id: string, ownerId: string) {
    this.db.update(workspaces).set({ isActive: false }).where(sql`${workspaces.ownerId} = ${ownerId}`).run();
    this.db.update(workspaces).set({ isActive: true, updatedAt: new Date().toISOString() }).where(eq(workspaces.id, id)).run();
    return this.findById(id);
  }
}
