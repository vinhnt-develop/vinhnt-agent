import type { InMemoryApprovalStore } from '@vinhnt-sdk/permission';
import type {
  InMemoryPlanApprovalStore,
  InMemoryQuestionStore,
} from '@vinhnt-sdk/tools';
import {
  SessionApprovalStore,
  SessionPlanApprovalStore,
  SessionQuestionStore,
} from './session-hitl-stores';
import type { HitlRequestRepository } from '../repositories/hitl-request.repository';

type ApprovalRequest = Parameters<
  InMemoryApprovalStore['awaitReplyWithReason']
>[0];
type QuestionRequest = Parameters<InMemoryQuestionStore['awaitReply']>[0];
type PlanRequest = Parameters<InMemoryPlanApprovalStore['awaitReply']>[0];

describe('session HITL stores', () => {
  it('drops approval requests once resolved or cancelled', async () => {
    const store = new SessionApprovalStore();
    const first = store.awaitReplyWithReason({
      id: 'p1',
      runId: 'r1',
    } as ApprovalRequest);
    expect(store.pendingRequests('r1').map((r) => r.id)).toEqual(['p1']);

    store.resolveRequest('p1', 'once');
    await expect(first).resolves.toEqual({ reply: 'once' });
    expect(store.pendingRequests('r1')).toEqual([]);

    const second = store.awaitReplyWithReason({
      id: 'p2',
      runId: 'r2',
    } as ApprovalRequest);
    store.cancelRequest('p2');
    await expect(second).resolves.toEqual({ reply: 'reject' });
    expect(store.pendingRequests('r2')).toEqual([]);
  });

  it('drops question requests once answered', async () => {
    const store = new SessionQuestionStore();
    const pending = store.awaitReply({
      requestId: 'q1',
      runId: 'r1',
      sessionId: 's1',
      questions: [],
    } as QuestionRequest);
    expect(store.pendingRequests('r1').map((r) => r.requestId)).toEqual(['q1']);

    store.resolveRequest('q1', { action: 'cancel' });
    await expect(pending).resolves.toEqual({ action: 'cancel' });
    expect(store.pendingRequests()).toEqual([]);
  });

  it('writes approval requests and decisions through to durable storage', async () => {
    const repository = { create: jest.fn(), settle: jest.fn() };
    const store = new SessionApprovalStore(
      repository as unknown as HitlRequestRepository,
    );
    const pending = store.awaitReplyWithReason({
      id: 'p1',
      runId: 'r1',
    } as unknown as ApprovalRequest);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p1',
        kind: 'approval',
        runId: 'r1',
      }),
    );

    store.resolveRequest('p1', 'reject', 'no thanks');
    await expect(pending).resolves.toEqual({
      reply: 'reject',
      reason: 'no thanks',
    });
    expect(repository.settle).toHaveBeenCalledWith(
      'approval',
      'p1',
      'rejected',
      { reply: 'reject', reason: 'no thanks' },
    );
  });

  it('maps question actions to durable statuses', async () => {
    const repository = { create: jest.fn(), settle: jest.fn() };
    const store = new SessionQuestionStore(
      repository as unknown as HitlRequestRepository,
    );
    const pending = store.awaitReply({
      requestId: 'q1',
      runId: 'r1',
      sessionId: 's1',
      questions: [],
    } as QuestionRequest);

    store.resolveRequest('q1', { action: 'decline' });
    await pending;

    expect(repository.settle).toHaveBeenCalledWith(
      'question',
      'q1',
      'rejected',
      { action: 'decline' },
    );
  });

  it('rehydrates an orphaned approval and replays its decision on resume', async () => {
    const repository = { create: jest.fn(), settle: jest.fn() };
    const store = new SessionApprovalStore(
      repository as unknown as HitlRequestRepository,
    );
    store.rehydrate([
      {
        id: 'p1',
        payload: { id: 'p1', runId: 'r1', toolName: 'shell' },
      },
    ]);

    expect(store.pendingRequests('r1').map((r) => r.id)).toEqual(['p1']);
    store.resolveRequest('p1', 'once');
    expect(store.pendingRequests('r1')).toEqual([]);
    expect(repository.settle).toHaveBeenCalledWith('approval', 'p1', 'approved', {
      reply: 'once',
    });

    const replayed = await store.awaitReplyWithReason({
      id: 'p2',
      runId: 'r1',
      toolName: 'shell',
    } as ApprovalRequest);
    expect(replayed).toEqual({ reply: 'once' });
    expect(store.pendingRequests('r1')).toEqual([]);
  });

  it('rehydrates an orphaned question and replays its answer on resume', async () => {
    const store = new SessionQuestionStore();
    store.rehydrate([
      {
        id: 'q1',
        payload: {
          requestId: 'q1',
          runId: 'r1',
          sessionId: 's1',
          questions: [{ header: 'Pick', question: 'Which one?' }],
        },
      },
    ]);

    expect(store.pendingRequests('r1').map((r) => r.requestId)).toEqual(['q1']);
    store.resolveRequest('q1', { action: 'accept', answers: [] });

    const replayed = await store.awaitReply({
      requestId: 'q2',
      runId: 'r1',
      sessionId: 's1',
      questions: [{ header: 'Pick', question: 'Which one?' }],
    } as QuestionRequest);
    expect(replayed).toEqual({ action: 'accept', answers: [] });
  });

  it('drops plan requests once decided', async () => {
    const store = new SessionPlanApprovalStore();
    const pending = store.awaitReply({
      requestId: 'pl1',
      runId: 'r1',
    } as PlanRequest);
    expect(store.pendingRequests('r1').map((r) => r.requestId)).toEqual([
      'pl1',
    ]);

    store.resolveRequest('pl1', { decision: 'approve' });
    await expect(pending).resolves.toEqual({ decision: 'approve' });
    expect(store.pendingRequests()).toEqual([]);
  });
});
