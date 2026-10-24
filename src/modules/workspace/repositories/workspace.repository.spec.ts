import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import * as schema from '@/infrastructure/database/schema';
import { workspaces } from '../schemas/workspace.schema';
import { projects } from '@/modules/project/schemas/project.schema';
import { sessions } from '@/modules/session/schemas/session.schema';
import { WorkspaceRepository } from './workspace.repository';

describe('WorkspaceRepository.softDeleteCascade', () => {
  let sqlite: Database.Database;
  let repository: WorkspaceRepository;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    repository = new WorkspaceRepository(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('soft-deletes the workspace, its projects, and their sessions atomically', async () => {
    const db = drizzle(sqlite, { schema });
    const now = new Date().toISOString();

    db.insert(workspaces)
      .values({ id: 'w1', name: 'Workspace 1', ownerId: 'u1', createdAt: now, updatedAt: now })
      .run();
    db.insert(workspaces)
      .values({ id: 'w2', name: 'Workspace 2', ownerId: 'u1', createdAt: now, updatedAt: now })
      .run();
    db.insert(projects)
      .values({ id: 'p1', workspaceId: 'w1', name: 'Project 1', createdAt: now, updatedAt: now })
      .run();
    db.insert(projects)
      .values({ id: 'p2', workspaceId: 'w2', name: 'Project 2', createdAt: now, updatedAt: now })
      .run();
    db.insert(sessions)
      .values({ id: 's1', projectId: 'p1', title: 'Session 1', createdAt: now, updatedAt: now })
      .run();
    db.insert(sessions)
      .values({ id: 's2', projectId: 'p2', title: 'Session 2', createdAt: now, updatedAt: now })
      .run();

    await repository.softDeleteCascade('w1');

    const w1 = db.select().from(workspaces).where(eq(workspaces.id, 'w1')).get();
    const p1 = db.select().from(projects).where(eq(projects.id, 'p1')).get();
    const s1 = db.select().from(sessions).where(eq(sessions.id, 's1')).get();
    expect(w1?.deletedAt).toBeTruthy();
    expect(w1?.isActive).toBe(false);
    expect(p1?.deletedAt).toBeTruthy();
    expect(p1?.isActive).toBe(false);
    expect(s1?.deletedAt).toBeTruthy();
    expect(s1?.isActive).toBe(false);

    const w2 = db.select().from(workspaces).where(eq(workspaces.id, 'w2')).get();
    const p2 = db.select().from(projects).where(eq(projects.id, 'p2')).get();
    const s2 = db.select().from(sessions).where(eq(sessions.id, 's2')).get();
    expect(w2?.deletedAt).toBeNull();
    expect(p2?.deletedAt).toBeNull();
    expect(s2?.deletedAt).toBeNull();
  });
});
