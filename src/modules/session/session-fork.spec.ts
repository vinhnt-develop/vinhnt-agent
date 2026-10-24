import { BadRequestException } from '@nestjs/common';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import * as schema from '@/infrastructure/database/schema';
import { agentRuns } from '@/modules/agent/schemas/agent.schema';
import { messages, sessions } from './schemas/session.schema';
import { SessionRepository } from './repositories/session.repository';
import { SessionService } from './services/session.service';

describe('session fork and summary', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let repository: SessionRepository;
  let service: SessionService;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    repository = new SessionRepository(db);
    service = new SessionService(repository);
  });

  afterEach(() => {
    sqlite.close();
  });

  function seedSession(id: string, title = 'Source') {
    db.insert(sessions).values({
      id,
      title,
      metadata: { setting: 'kept' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }).run();
  }

  function seedMessage(
    id: string,
    sessionId: string,
    role: string,
    createdAt: string,
    extra: Partial<typeof messages.$inferInsert> = {},
  ) {
    db.insert(messages).values({
      id,
      sessionId,
      role,
      content: `${role} ${id}`,
      createdAt,
      ...extra,
    }).run();
  }

  it('copies a history prefix into a child without mutating the source', async () => {
    seedSession('s1');
    seedMessage('m1', 's1', 'user', '2026-01-01T00:00:01.000Z');
    seedMessage('m2', 's1', 'assistant', '2026-01-01T00:00:02.000Z', {
      contentBlocks: [{ type: 'text', text: 'hello' }],
      inputTokens: 10,
      outputTokens: 20,
      reasoningTokens: 3,
      model: 'test-model',
      provider: 'test-provider',
      cost: 0.01,
    });
    seedMessage('m3', 's1', 'tool', '2026-01-01T00:00:03.000Z', {
      toolCallId: 'call_1',
    });

    const result = await service.fork('s1', {
      title: 'Branched',
      atMessageId: 'm2',
    });

    expect(result.copiedMessageCount).toBe(2);
    expect(result.session?.id).not.toBe('s1');
    expect(result.session?.parentId).toBe('s1');
    expect(result.session?.title).toBe('Branched');
    expect(result.session?.metadata).toMatchObject({
      setting: 'kept',
      forkedFromSessionId: 's1',
      forkPointMessageId: 'm2',
      forkedMessageCount: 2,
    });

    const childMessages = db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, result.session!.id))
      .all();
    expect(childMessages).toHaveLength(2);
    expect(childMessages.map((row) => row.role)).toEqual(['user', 'assistant']);
    expect(childMessages.map((row) => row.id)).not.toContain('m1');
    expect(childMessages[1]).toMatchObject({
      contentBlocks: [{ type: 'text', text: 'hello' }],
      inputTokens: 10,
      outputTokens: 20,
      reasoningTokens: 3,
      model: 'test-model',
      provider: 'test-provider',
      cost: 0.01,
    });

    const sourceMessages = db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, 's1'))
      .all();
    const source = db.select().from(sessions).where(eq(sessions.id, 's1')).get();
    expect(sourceMessages).toHaveLength(3);
    expect(source?.title).toBe('Source');
    expect(source?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(source?.metadata).toEqual({ setting: 'kept' });

    const forks = await repository.findForksWithPagination('s1', { page: 1, limit: 20 });
    expect(forks.total).toBe(1);
    expect(forks.data[0].id).toBe(result.session?.id);
  });

  it('applies atMessageId then limit to the copied prefix', async () => {
    seedSession('s1');
    seedMessage('m1', 's1', 'user', '2026-01-01T00:00:01.000Z');
    seedMessage('m2', 's1', 'assistant', '2026-01-01T00:00:02.000Z');
    seedMessage('m3', 's1', 'user', '2026-01-01T00:00:03.000Z');

    const result = await service.fork('s1', { atMessageId: 'm3', limit: 2 });
    const childMessages = db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, result.session!.id))
      .all();

    expect(result.copiedMessageCount).toBe(2);
    expect(childMessages.map((row) => row.role)).toEqual(['assistant', 'user']);
  });

  it('rejects an atMessageId from another session', async () => {
    seedSession('s1');
    seedSession('s2');
    seedMessage('m1', 's1', 'user', '2026-01-01T00:00:01.000Z');

    await expect(
      service.fork('s1', { atMessageId: 'missing' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.fork('missing', {}),
    ).rejects.toThrow('Session not found');
  });

  it('summarizes messages and runs without replaying events', async () => {
    seedSession('s1');
    seedMessage('m1', 's1', 'user', '2026-01-01T00:00:01.000Z');
    seedMessage('m2', 's1', 'assistant', '2026-01-01T00:00:02.000Z');
    seedMessage('m3', 's1', 'tool', '2026-01-01T00:00:03.000Z');
    seedMessage('m4', 's1', 'system', '2026-01-01T00:00:04.000Z');

    db.insert(agentRuns).values([
      {
        id: 'r1',
        sessionId: 's1',
        status: 'succeeded',
        inputTokens: 10,
        outputTokens: 20,
        reasoningTokens: 2,
        totalTokens: 32,
        totalCost: 0.02,
        toolCallsCount: 3,
        startedAt: '2026-01-01T00:00:01.000Z',
        completedAt: '2026-01-01T00:00:03.000Z',
      },
      {
        id: 'r2',
        sessionId: 's1',
        status: 'failed',
        inputTokens: 5,
        outputTokens: 7,
        reasoningTokens: 1,
        totalTokens: 13,
        totalCost: 0.01,
        toolCallsCount: 1,
        startedAt: '2026-01-01T00:00:04.000Z',
      },
    ]).run();

    const summary = await service.getSummary('s1');

    expect(summary).toMatchObject({
      sessionId: 's1',
      title: 'Source',
      messageCount: 4,
      userMessageCount: 1,
      assistantMessageCount: 1,
      toolMessageCount: 1,
      systemMessageCount: 1,
      firstMessageAt: '2026-01-01T00:00:01.000Z',
      lastMessageAt: '2026-01-01T00:00:04.000Z',
      runCount: 2,
      inputTokens: 15,
      outputTokens: 27,
      reasoningTokens: 3,
      totalTokens: 45,
      cost: 0.03,
      toolCallsCount: 4,
      lastRunAt: '2026-01-01T00:00:04.000Z',
    });
    expect(summary.runStatusCounts).toEqual({
      pending: 0,
      running: 0,
      succeeded: 1,
      failed: 1,
      cancelled: 0,
      interrupted: 0,
    });
  });

  it('returns zeroed stats for an empty session', async () => {
    seedSession('s1');
    const result = await service.fork('s1', {});
    const summary = await service.getSummary('s1');

    expect(result.copiedMessageCount).toBe(0);
    expect(result.session?.title).toBe('Source (fork)');
    expect(summary.messageCount).toBe(0);
    expect(summary.runCount).toBe(0);
    expect(summary.firstMessageAt).toBeNull();
    expect(summary.lastRunAt).toBeNull();
  });
});
