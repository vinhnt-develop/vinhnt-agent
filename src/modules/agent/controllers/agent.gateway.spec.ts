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

  it('forwards elicitation.requested with data + run/session context', () => {
    const data = {
      requestId: 'e1',
      runId: 'run_1',
      sessionId: 'sess_1',
      message: 'Provide details',
      mode: 'form',
      requestedSchema: { type: 'object', properties: { name: { type: 'string' } } },
    };
    const result = transform({ type: 'elicitation.requested', data }, 'run_1', 'sess_1');
    expect(result).toEqual({
      type: 'elicitation.requested',
      data,
      runId: 'run_1',
      sessionId: 'sess_1',
    });
  });

  it('forwards elicitation.replied carrying the requestId', () => {
    const data = { requestId: 'e1', action: 'accept', content: { name: 'Ada' } };
    const result = transform({ type: 'elicitation.replied', data }, 'run_1', 'sess_1');
    expect(result).toMatchObject({
      type: 'elicitation.replied',
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
  const elicitationStore = { resolveRequest: jest.fn(), getRequest: jest.fn() };
  const planApprovalStore = { resolveRequest: jest.fn(), getRequest: jest.fn() };
  const agentService = {
    getAgentToolkit: () => ({
      getApprovalStore: () => approvalStore,
      getQuestionStore: () => questionStore,
      getElicitationStore: () => elicitationStore,
      getPlanApprovalStore: () => planApprovalStore,
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

  it('resolves an elicitation reply and acks ok', () => {
    elicitationStore.getRequest.mockReturnValue({ id: 'e1' });
    const ack = gateway.handleElicitationReply(client, {
      id: 'e1',
      action: 'accept',
      content: { name: 'Ada' },
    });
    expect(ack).toEqual({ ok: true, id: 'e1' });
    expect(elicitationStore.resolveRequest).toHaveBeenCalledWith('e1', {
      action: 'accept',
      content: { name: 'Ada' },
    });
  });

  it('rejects an invalid elicitation action without resolving', () => {
    const ack = gateway.handleElicitationReply(client, { id: 'e1', action: 'nope' as never });
    expect(ack.ok).toBe(false);
    expect(elicitationStore.resolveRequest).not.toHaveBeenCalled();
  });

  it('acks not-found without resolving an elicitation', () => {
    elicitationStore.getRequest.mockReturnValue(undefined);
    const ack = gateway.handleElicitationReply(client, { id: 'gone', action: 'cancel' });
    expect(ack).toEqual({
      ok: false,
      error: 'Elicitation request not found or already resolved',
    });
    expect(elicitationStore.resolveRequest).not.toHaveBeenCalled();
  });

  it('resolves a plan decision and acks ok', () => {
    planApprovalStore.getRequest.mockReturnValue({ id: 'pl1' });
    const ack = gateway.handlePlanDecision(client, { id: 'pl1', decision: 'approve' });
    expect(ack).toEqual({ ok: true, id: 'pl1' });
    expect(planApprovalStore.resolveRequest).toHaveBeenCalledWith('pl1', { decision: 'approve' });
  });

  it('forwards plan feedback on request_changes', () => {
    planApprovalStore.getRequest.mockReturnValue({ id: 'pl1' });
    gateway.handlePlanDecision(client, {
      id: 'pl1',
      decision: 'request_changes',
      feedback: 'split it',
    });
    expect(planApprovalStore.resolveRequest).toHaveBeenCalledWith('pl1', {
      decision: 'request_changes',
      feedback: 'split it',
    });
  });

  it('rejects an invalid plan decision without resolving', () => {
    const ack = gateway.handlePlanDecision(client, { id: 'pl1', decision: 'nope' as never });
    expect(ack.ok).toBe(false);
    expect(planApprovalStore.resolveRequest).not.toHaveBeenCalled();
  });

  it('acks not-found without resolving a plan', () => {
    planApprovalStore.getRequest.mockReturnValue(undefined);
    const ack = gateway.handlePlanDecision(client, { id: 'gone', decision: 'approve' });
    expect(ack).toEqual({
      ok: false,
      error: 'Plan request not found or already resolved',
    });
    expect(planApprovalStore.resolveRequest).not.toHaveBeenCalled();
  });
});

describe('AgentGateway run:input (queue/steer)', () => {
  const sendRunInput = jest.fn();
  const gateway = new AgentGateway(
    { sendRunInput } as never,
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

  it('acks queued when the steer lands in the live run', async () => {
    sendRunInput.mockResolvedValue({ queued: true, runId: 'r1', status: 'queued' });
    const ack = await gateway.handleRunInput(client, { sessionId: 's1', message: 'go on' });
    expect(ack).toEqual({ ok: true, queued: true, runId: 'r1', status: 'queued' });
    expect(sendRunInput).toHaveBeenCalledWith({
      sessionId: 's1',
      runId: undefined,
      message: 'go on',
    });
  });

  it('acks not-queued when there is no live run (caller starts a new run)', async () => {
    sendRunInput.mockResolvedValue({ queued: false, status: 'idle' });
    const ack = await gateway.handleRunInput(client, { sessionId: 's1', message: 'hi' });
    expect(ack.ok).toBe(false);
    expect(ack.queued).toBe(false);
    expect(ack.status).toBe('idle');
  });

  it('acks finished when the run settled before the input landed', async () => {
    sendRunInput.mockResolvedValue({ queued: false, runId: 'r1', status: 'finished' });
    const ack = await gateway.handleRunInput(client, { sessionId: 's1', runId: 'r1', message: 'late' });
    expect(ack).toEqual({ ok: false, queued: false, runId: 'r1', status: 'finished' });
  });

  it('rejects an empty message without calling the service', async () => {
    const ack = await gateway.handleRunInput(client, { sessionId: 's1', message: '' });
    expect(ack.ok).toBe(false);
    expect(ack.status).toBe('empty');
    expect(sendRunInput).not.toHaveBeenCalled();
  });
});

describe('AgentGateway ui.action (generative UI)', () => {
  const sendRunInput = jest.fn();
  const gateway = new AgentGateway(
    { sendRunInput } as never,
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

  it('steers the live run with a formatted action message', async () => {
    sendRunInput.mockResolvedValue({ queued: true, runId: 'r1', status: 'queued' });
    const ack = await gateway.handleUiAction(client, {
      sessionId: 's1',
      surfaceId: 'confirm',
      actionId: 'yes',
      label: 'Yes',
      value: 'ok',
    });
    expect(ack).toEqual({ ok: true, queued: true, runId: 'r1', status: 'queued' });
    expect(sendRunInput).toHaveBeenCalledTimes(1);
    const arg = sendRunInput.mock.calls[0][0];
    expect(arg.sessionId).toBe('s1');
    expect(arg.message).toContain('Yes');
    expect(arg.message).toContain('confirm');
    expect(arg.message).toContain('yes');
    expect(arg.message).toContain('value: ok');
  });

  it('acks not-queued when there is no live run', async () => {
    sendRunInput.mockResolvedValue({ queued: false, status: 'idle' });
    const ack = await gateway.handleUiAction(client, {
      sessionId: 's1',
      surfaceId: 'confirm',
      actionId: 'yes',
    });
    expect(ack.ok).toBe(false);
    expect(ack.status).toBe('idle');
  });

  it('rejects a missing surfaceId/actionId without calling the service', async () => {
    const ack = await gateway.handleUiAction(client, { sessionId: 's1' });
    expect(ack.ok).toBe(false);
    expect(ack.status).toBe('invalid');
    expect(sendRunInput).not.toHaveBeenCalled();
  });
});
