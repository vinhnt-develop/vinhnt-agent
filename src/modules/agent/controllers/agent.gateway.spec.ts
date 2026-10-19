import { AgentGateway } from './agent.gateway';

describe('AgentGateway.deriveTodoUpdate', () => {
  const gateway = new AgentGateway(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );
  const derive = (
    event: unknown,
    runId: string,
    sessionId?: string,
  ): Record<string, unknown> | null =>
    (gateway as unknown as {
      deriveTodoUpdate: (
        e: unknown,
        r: string,
        s?: string,
      ) => Record<string, unknown> | null;
    }).deriveTodoUpdate(event, runId, sessionId);

  it('ignores non tool.completed events', () => {
    expect(derive({ type: 'tool.invoked' }, 'r1')).toBeNull();
    expect(derive({ type: 'run.completed' }, 'r1')).toBeNull();
  });

  it('ignores tool.completed for other tools', () => {
    expect(
      derive(
        { type: 'tool.completed', data: { toolName: 'read_file', output: {} } },
        'r1',
      ),
    ).toBeNull();
  });

  it('emits a todo.updated snapshot from todowrite output', () => {
    const todos = [
      { id: '1', content: 'A', status: 'completed' },
      { id: '2', content: 'B', status: 'in_progress' },
    ];
    const result = derive(
      { type: 'tool.completed', data: { toolName: 'todowrite', output: { todos } } },
      'run_1',
      'sess_1',
    );
    expect(result).toEqual({
      type: 'todo.updated',
      todos,
      runId: 'run_1',
      sessionId: 'sess_1',
    });
  });

  it('returns null when todowrite output has no todos array', () => {
    expect(
      derive(
        { type: 'tool.completed', data: { toolName: 'todowrite', output: { error: 'x' } } },
        'r1',
      ),
    ).toBeNull();
  });

  it('omits sessionId when unknown', () => {
    const result = derive(
      { type: 'tool.completed', data: { toolName: 'todowrite', output: { todos: [] } } },
      'run_1',
    );
    expect(result).toEqual({ type: 'todo.updated', todos: [], runId: 'run_1' });
  });
});

describe('AgentGateway.transformEvent (questions)', () => {
  const gateway = new AgentGateway(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );
  const transform = (
    event: unknown,
    runId: string,
    sessionId?: string,
  ): Record<string, unknown> | null =>
    (gateway as unknown as {
      transformEvent: (
        e: unknown,
        r: string,
        s?: string,
      ) => Record<string, unknown> | null;
    }).transformEvent(event, runId, sessionId);

  it('forwards question.requested with data + run/session context', () => {
    const data = {
      requestId: 'q1',
      runId: 'run_1',
      sessionId: 'sess_1',
      questions: [{ header: 'Pick', question: 'Which one?' }],
    };
    const result = transform({ type: 'question.requested', data }, 'run_1', 'sess_1');
    expect(result).toEqual({
      type: 'question.requested',
      data,
      runId: 'run_1',
      sessionId: 'sess_1',
    });
  });

  it('forwards question.replied carrying the requestId', () => {
    const data = { requestId: 'q1', action: 'accept' };
    const result = transform({ type: 'question.replied', data }, 'run_1', 'sess_1');
    expect(result).toMatchObject({
      type: 'question.replied',
      data,
      runId: 'run_1',
      sessionId: 'sess_1',
    });
  });

  it('drops unrelated event types', () => {
    expect(transform({ type: 'something.else', data: {} }, 'run_1')).toBeNull();
  });
});

describe('AgentGateway WS reply handlers', () => {
  const approvalStore = { resolveRequest: jest.fn(), getRequest: jest.fn() };
  const questionStore = { resolveRequest: jest.fn(), getRequest: jest.fn() };
  const agentService = {
    getAgentToolkit: () => ({
      getApprovalStore: () => approvalStore,
      getQuestionStore: () => questionStore,
    }),
  };
  const gateway = new AgentGateway(
    agentService as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );
  const client = { id: 'client_1' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a permission reply and acks ok', () => {
    approvalStore.getRequest.mockReturnValue({ id: 'p1' });
    const ack = gateway.handlePermissionReply(client, { id: 'p1', reply: 'once' });
    expect(ack).toEqual({ ok: true, id: 'p1' });
    expect(approvalStore.resolveRequest).toHaveBeenCalledWith('p1', 'once', undefined);
  });

  it('forwards the reject reason to the store', () => {
    approvalStore.getRequest.mockReturnValue({ id: 'p1' });
    gateway.handlePermissionReply(client, { id: 'p1', reply: 'reject', reason: 'no thanks' });
    expect(approvalStore.resolveRequest).toHaveBeenCalledWith('p1', 'reject', 'no thanks');
  });

  it('rejects an invalid permission reply without resolving', () => {
    const ack = gateway.handlePermissionReply(client, { id: 'p1', reply: 'nope' as never });
    expect(ack.ok).toBe(false);
    expect(approvalStore.resolveRequest).not.toHaveBeenCalled();
  });

  it('acks not-found without resolving a permission', () => {
    approvalStore.getRequest.mockReturnValue(undefined);
    const ack = gateway.handlePermissionReply(client, { id: 'gone', reply: 'once' });
    expect(ack).toEqual({
      ok: false,
      error: 'Permission request not found or already resolved',
    });
    expect(approvalStore.resolveRequest).not.toHaveBeenCalled();
  });

  it('resolves a question reply and acks ok', () => {
    questionStore.getRequest.mockReturnValue({ id: 'q1' });
    const ack = gateway.handleQuestionReply(client, { id: 'q1', action: 'decline' });
    expect(ack).toEqual({ ok: true, id: 'q1' });
    expect(questionStore.resolveRequest).toHaveBeenCalledWith('q1', { action: 'decline' });
  });

  it('requires answers when accepting a question', () => {
    const ack = gateway.handleQuestionReply(client, { id: 'q1', action: 'accept' });
    expect(ack.ok).toBe(false);
    expect(questionStore.resolveRequest).not.toHaveBeenCalled();
  });
});
