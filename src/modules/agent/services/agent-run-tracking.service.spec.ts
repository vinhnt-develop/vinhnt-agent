import { AgentRunTrackingService } from './agent-run-tracking.service';

describe('AgentRunTrackingService (P6.1 payload consolidation)', () => {
  let tracking: AgentRunTrackingService;
  let agentRunRepository: {
    create: jest.Mock;
    createIfAbsent: jest.Mock;
    update: jest.Mock;
    findById: jest.Mock;
    cleanupStaleRuns: jest.Mock;
    findActiveBySessionId: jest.Mock;
    findRunning?: jest.Mock;
    interruptAllRunning?: jest.Mock;
    dismissInterruptedForSession?: jest.Mock;
  };
  let toolExecutionRepository: {
    create: jest.Mock;
    update: jest.Mock;
    cancelRunningByRunId: jest.Mock;
    failAllRunning?: jest.Mock;
  };

  beforeEach(() => {
    agentRunRepository = {
      create: jest.fn(),
      createIfAbsent: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      cleanupStaleRuns: jest.fn(),
      findActiveBySessionId: jest.fn(),
    };
    toolExecutionRepository = {
      create: jest.fn(),
      update: jest.fn(),
      cancelRunningByRunId: jest.fn(),
    };
    tracking = new AgentRunTrackingService(
      agentRunRepository as never,
      toolExecutionRepository as never,
    );
  });

  /** Last update() payload passed to the repository. */
  const lastUpdatePayload = (): Record<string, unknown> =>
    agentRunRepository.update.mock.calls[
      agentRunRepository.update.mock.calls.length - 1
    ][1] as Record<string, unknown>;

  describe('recordRunUsage', () => {
    it('sums per-call token and cost events', () => {
      tracking.recordRunUsage('r1', { inputTokens: 10, outputTokens: 5, reasoningTokens: 2 });
      tracking.recordRunUsage('r1', { inputTokens: 20, outputTokens: 7, reasoningTokens: 3 });
      tracking.recordRunUsage('r1', { totalCost: 0.001 });
      tracking.recordRunUsage('r1', { totalCost: 0.002 });

      tracking.completeRunFromResult({ runId: 'r1', status: 'succeeded' });

      const payload = lastUpdatePayload();
      expect(payload.inputTokens).toBe(30);
      expect(payload.outputTokens).toBe(12);
      expect(payload.reasoningTokens).toBe(5);
      expect(payload.totalCost).toBeCloseTo(0.003);
    });

    it('keeps model/provider/stopReason last-wins', () => {
      tracking.recordRunUsage('r1', { model: 'model-a', provider: 'p1' });
      tracking.recordRunUsage('r1', { model: 'model-b' });
      tracking.recordRunUsage('r1', { stopReason: 'tool_calls' });

      tracking.completeRunFromResult({ runId: 'r1', status: 'succeeded' });

      const payload = lastUpdatePayload();
      expect(payload.model).toBe('model-b');
      expect(payload.provider).toBe('p1');
      expect(payload.stopReason).toBe('tool_calls');
    });

    it('ignores an all-undefined record without creating an entry', () => {
      tracking.recordRunUsage('r1', {});
      tracking.completeRunFromResult({ runId: 'r1', status: 'succeeded' });

      expect(lastUpdatePayload().inputTokens).toBeUndefined();
    });
  });

  describe('completeRunFromResult — source priority', () => {
    it('prefers kernel usage over aggregates over fallback', () => {
      tracking.recordRunUsage('r1', { inputTokens: 50, reasoningTokens: 9 });
      tracking.completeRunFromResult({
        runId: 'r1',
        status: 'succeeded',
        result: { usage: { inputTokens: 100, reasoningTokens: 4 } },
        fallback: { inputTokens: 10, reasoningTokens: 1 },
      });

      const payload = lastUpdatePayload();
      expect(payload.inputTokens).toBe(100);
      expect(payload.reasoningTokens).toBe(4);
    });

    it('falls through 0 (provider did not report) to the next source', () => {
      tracking.recordRunUsage('r1', { inputTokens: 500 });
      tracking.completeRunFromResult({
        runId: 'r1',
        status: 'succeeded',
        result: { usage: { inputTokens: 0 } },
        fallback: { inputTokens: 10 },
      });

      expect(lastUpdatePayload().inputTokens).toBe(500);
    });

    it('uses the last-assistant fallback when usage and aggregates are empty (HTTP path)', () => {
      tracking.completeRunFromResult({
        runId: 'r1',
        status: 'succeeded',
        result: {},
        fallback: {
          inputTokens: 11,
          outputTokens: 22,
          reasoningTokens: 3,
          cost: 0.5,
          model: 'msg-model',
          provider: 'msg-provider',
        },
      });

      const payload = lastUpdatePayload();
      expect(payload.inputTokens).toBe(11);
      expect(payload.outputTokens).toBe(22);
      expect(payload.reasoningTokens).toBe(3);
      expect(payload.totalCost).toBe(0.5);
      expect(payload.model).toBe('msg-model');
      expect(payload.provider).toBe('msg-provider');
    });

    it('persists reasoning/cache tokens + cost from aggregates (the WS-path fix)', () => {
      tracking.recordRunUsage('r1', {
        reasoningTokens: 128,
        cacheReadTokens: 4096,
        cacheWriteTokens: 512,
        totalCost: 0.004,
        model: 'actual-model',
        provider: 'lmstudio',
      });
      tracking.completeRunFromResult({
        runId: 'r1',
        status: 'succeeded',
        result: { usage: { inputTokens: 700, outputTokens: 60 } },
      });

      const payload = lastUpdatePayload();
      expect(payload.reasoningTokens).toBe(128);
      expect(payload.cacheReadTokens).toBe(4096);
      expect(payload.cacheWriteTokens).toBe(512);
      expect(payload.totalCost).toBeCloseTo(0.004);
      expect(payload.model).toBe('actual-model');
      expect(payload.provider).toBe('lmstudio');
      expect(payload.totalTokens).toBe(700 + 60 + 128);
    });
  });

  describe('completeRunFromResult — status & fields', () => {
    it.each([
      ['succeeded', { status: 'succeeded' }, 'succeeded'],
      ['failed result', { status: 'failed' }, 'failed'],
      ['cancelled result', { status: 'cancelled' }, 'cancelled'],
      ['cancelled flag', { status: 'succeeded', cancelled: true }, 'cancelled'],
      ['missing result defaults to succeeded', undefined, 'succeeded'],
    ])('derives status: %s', (_name, result, expected) => {
      tracking.completeRunFromResult({ runId: 'r1', result });
      expect(lastUpdatePayload().status).toBe(expected);
    });

    it('explicit status wins over the result', () => {
      tracking.completeRunFromResult({
        runId: 'r1',
        status: 'failed',
        result: { status: 'succeeded' },
        errorMessage: 'boom',
      });
      expect(lastUpdatePayload().status).toBe('failed');
    });

    it('stopReason precedence: explicit > usage > aggregate > cancelled default', () => {
      tracking.recordRunUsage('r1', { stopReason: 'from_event' });
      tracking.completeRunFromResult({
        runId: 'r1',
        status: 'succeeded',
        result: { usage: { stopReason: 'from_usage' } },
      });
      expect(lastUpdatePayload().stopReason).toBe('from_usage');

      tracking.completeRunFromResult({ runId: 'r2', status: 'cancelled' });
      expect(lastUpdatePayload().stopReason).toBe('cancelled');

      tracking.completeRunFromResult({
        runId: 'r3',
        status: 'cancelled',
        result: {},
        stopReason: 'explicit',
      });
      expect(lastUpdatePayload().stopReason).toBe('explicit');
    });

    it('prefers kernel loop duration over wall-clock, falls back to wall-clock', () => {
      tracking.completeRunFromResult({
        runId: 'r1',
        status: 'succeeded',
        result: { usage: { durationMs: 1234 } },
        durationMs: 9999,
      });
      expect(lastUpdatePayload().durationMs).toBe(1234);

      tracking.completeRunFromResult({
        runId: 'r2',
        status: 'failed',
        durationMs: 9999,
        errorMessage: 'x',
      });
      expect(lastUpdatePayload().durationMs).toBe(9999);
    });

    it('clears the usage accumulator after completion', () => {
      tracking.recordRunUsage('r1', { reasoningTokens: 64 });
      tracking.completeRunFromResult({ runId: 'r1', status: 'succeeded' });
      expect(lastUpdatePayload().reasoningTokens).toBe(64);

      tracking.completeRunFromResult({ runId: 'r1', status: 'succeeded' });
      expect(lastUpdatePayload().reasoningTokens).toBeUndefined();
    });

    it('closes running tool rows for cancelled runs and returns the persisted payload', () => {
      const payload = tracking.completeRunFromResult({
        runId: 'r1',
        status: 'cancelled',
        errorMessage: 'Run cancelled by user',
        stopReason: 'cancelled',
      });

      expect(payload.status).toBe('cancelled');
      expect(payload.stopReason).toBe('cancelled');
      expect(toolExecutionRepository.cancelRunningByRunId).toHaveBeenCalledWith(
        'r1',
        'cancelled',
        'Run cancelled by user',
      );
      expect(lastUpdatePayload().status).toBe('cancelled');
    });

    it('passes toolCallsCount from usage (aggregated count is the fallback)', () => {
      tracking.completeRunFromResult({
        runId: 'r1',
        status: 'succeeded',
        result: { usage: { toolCallsCount: 7 } },
      });
      expect(lastUpdatePayload().toolCallsCount).toBe(7);
    });
  });

  describe('resume lifecycle', () => {
    it('boot reconciliation keeps orphan runs resumable', () => {
      agentRunRepository.findRunning = jest.fn(() => [{ id: 'r1' }]);
      agentRunRepository.interruptAllRunning = jest.fn();
      toolExecutionRepository.failAllRunning = jest.fn();

      tracking.onApplicationBootstrap();

      expect(agentRunRepository.interruptAllRunning).toHaveBeenCalledTimes(1);
      expect(toolExecutionRepository.failAllRunning).toHaveBeenCalledTimes(1);
    });

    it('a fresh run supersedes stale interrupted runs', () => {
      agentRunRepository.dismissInterruptedForSession = jest.fn();

      tracking.startRun({ runId: 'r2', sessionId: 's1' });

      expect(agentRunRepository.dismissInterruptedForSession).toHaveBeenCalledWith('s1');
      expect(agentRunRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r2', sessionId: 's1', status: 'running' }),
      );
    });

    it('keeps the pre-restart tool count when a resumed run completes', () => {
      tracking.seedToolCallsCount('r1', 4);
      tracking.startToolExecution({ runId: 'r1', toolName: 'read_file' });

      tracking.completeRunFromResult({
        runId: 'r1',
        status: 'succeeded',
      });

      expect(lastUpdatePayload().toolCallsCount).toBe(5);
    });
  });

  describe('child run lineage', () => {
    it('persists parent/agent/trace ids for a sub-agent run', () => {
      tracking.startChildRun({
        runId: 'child-1',
        sessionId: 's1',
        parentRunId: 'parent-1',
        agentId: 'code-reviewer',
        traceId: 'trace-1',
        model: 'gpt-4o',
        provider: 'openai',
        subAgent: {
          mode: 'tool',
          parentAgentId: 'orchestrator',
          toolName: 'delegate',
          allowlist: ['read_file'],
          budget: { maxSteps: 4, maxDepth: 3 },
          transcript: 'isolated',
        },
      });

      expect(agentRunRepository.createIfAbsent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'child-1',
          sessionId: 's1',
          parentRunId: 'parent-1',
          agentId: 'code-reviewer',
          traceId: 'trace-1',
          triggerType: 'subagent',
          status: 'running',
          metadata: {
            subAgent: expect.objectContaining({
              mode: 'tool',
              toolName: 'delegate',
              transcript: 'isolated',
            }),
          },
        }),
      );
    });

    it('does not create a child row without a session id', () => {
      tracking.startChildRun({
        runId: 'child-1',
        parentRunId: 'parent-1',
      });

      expect(agentRunRepository.createIfAbsent).not.toHaveBeenCalled();
    });

    it('completes only child runs and clears the tracked id', () => {
      tracking.startChildRun({
        runId: 'child-1',
        sessionId: 's1',
        parentRunId: 'parent-1',
      });

      expect(
        tracking.completeChildRun({
          runId: 'child-1',
          result: { status: 'succeeded', output: 'ok' },
        }),
      ).toBe(true);
      expect(lastUpdatePayload().status).toBe('succeeded');

      expect(
        tracking.completeChildRun({
          runId: 'child-1',
          result: { status: 'succeeded' },
        }),
      ).toBe(false);
    });

    it('ignores completion for a run that was not started as a child', () => {
      expect(
        tracking.completeChildRun({
          runId: 'top-level',
          result: { status: 'succeeded' },
        }),
      ).toBe(false);
      expect(agentRunRepository.update).not.toHaveBeenCalled();
    });
  });
});
