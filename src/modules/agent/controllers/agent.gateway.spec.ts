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
