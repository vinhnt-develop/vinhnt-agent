import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import * as schema from '@/infrastructure/database/schema';
import { agentRuns, hitlRequests } from '../schemas/agent.schema';
import { HitlRequestRepository } from './hitl-request.repository';

describe('HitlRequestRepository', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: HitlRequestRepository;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    repository = new HitlRequestRepository(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('persists a pending request and its resolution', () => {
    repository.create({
      id: 'h1',
      kind: 'approval',
      runId: 'r1',
      sessionId: 's1',
      payload: { description: 'write file' },
    });

    expect(repository.countPending()).toBe(1);

    repository.settle('approval', 'h1', 'approved', { reply: 'once' });

    const row = db
      .select()
      .from(hitlRequests)
      .where(eq(hitlRequests.id, 'h1'))
      .get();
    expect(row?.status).toBe('approved');
    expect(row?.reply).toEqual({ reply: 'once' });
    expect(row?.resolvedAt).toBeTruthy();
    expect(repository.countPending()).toBe(0);
  });

  it('does not let a late timeout overwrite a resolved request', () => {
    repository.create({
      id: 'h1',
      kind: 'approval',
      runId: 'r1',
      payload: {},
    });
    repository.settle('approval', 'h1', 'approved', { reply: 'once' });

    repository.settleIfPending('approval', 'h1', 'expired');

    const row = db
      .select()
      .from(hitlRequests)
      .where(eq(hitlRequests.id, 'h1'))
      .get();
    expect(row?.status).toBe('approved');
  });

  it('rehydrates only pending requests whose runs can resume', () => {
    db.insert(agentRuns).values([
      { id: 'r1', status: 'interrupted' },
      { id: 'r2', status: 'succeeded' },
    ]).run();
    repository.create({ id: 'h1', kind: 'approval', runId: 'r1', payload: {} });
    repository.create({ id: 'h2', kind: 'approval', runId: 'r2', payload: {} });

    const resumable = repository.findPendingWithResumableRuns();
    expect(resumable.map((row) => row.id)).toEqual(['h1']);

    expect(repository.expirePendingNotIn(resumable.map((row) => row.id))).toBe(1);
    expect(repository.countPending()).toBe(1);
  });

  it('expires every pending request left by a previous process', () => {
    repository.create({
      id: 'h1',
      kind: 'question',
      runId: 'r1',
      payload: { questions: [] },
    });
    repository.create({
      id: 'h2',
      kind: 'plan',
      runId: 'r2',
      payload: { steps: [] },
    });

    expect(repository.expireAllPending()).toBe(2);
    expect(repository.countPending()).toBe(0);

    const rows = db.select().from(hitlRequests).all();
    expect(rows.every((row) => row.status === 'expired')).toBe(true);
    expect(rows.every((row) => row.resolvedAt)).toBe(true);
  });
});
