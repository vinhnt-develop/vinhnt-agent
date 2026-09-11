import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AgentToolkit } from './agent-toolkit';

jest.mock('@vinhnt-sdk/tools', () => ({
  ToolRegistry: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    list: jest.fn().mockReturnValue([]),
    count: jest.fn().mockReturnValue(0),
  })),
  ToolSandbox: jest.fn(),
  InMemoryFileHistory: jest.fn().mockImplementation(() => ({})),
  FileReadTracker: jest.fn().mockImplementation(() => ({})),
  createReadFileTool: jest.fn().mockReturnValue({ id: 'read_file' }),
  createWriteFileTool: jest.fn().mockReturnValue({ id: 'write_file' }),
  createEditFileTool: jest.fn().mockReturnValue({ id: 'edit_file' }),
  createListDirectoryTool: jest.fn().mockReturnValue({ id: 'list_directory' }),
  createGlobFilesTool: jest.fn().mockReturnValue({ id: 'glob_files' }),
  createGrepFilesTool: jest.fn().mockReturnValue({ id: 'grep_files' }),
  createShellTool: jest.fn().mockReturnValue({ id: 'execute_command' }),
  createGitStatusTool: jest.fn().mockReturnValue({ id: 'git_status' }),
  createGitDiffTool: jest.fn().mockReturnValue({ id: 'git_diff' }),
  createGitLogTool: jest.fn().mockReturnValue({ id: 'git_log' }),
}));

jest.mock('@vinhnt-sdk/permission', () => ({
  InMemoryApprovalStore: jest.fn().mockImplementation(() => ({
    awaitReply: jest.fn(),
    resolveRequest: jest.fn(),
    checkApproval: jest.fn(),
  })),
  matchPermission: jest.fn().mockReturnValue({ effect: 'allow' }),
  buildPermissionRules: jest.fn().mockReturnValue([]),
}));

jest.mock('@vinhnt-sdk/guard', () => ({
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    call: jest.fn().mockImplementation((fn: () => Promise<any>) => fn()),
    getState: jest.fn().mockReturnValue('closed'),
    reset: jest.fn(),
  })),
  LoopDetector: jest.fn().mockImplementation(() => ({
    record: jest.fn(),
    isDoomLoop: jest.fn().mockReturnValue(false),
    reset: jest.fn(),
  })),
  withToolTimeout: jest
    .fn()
    .mockImplementation(
      (_id: string, _ms: number, fn: (signal: AbortSignal) => Promise<any>) =>
        fn(new AbortController().signal),
    ),
}));

jest.mock('@vinhnt-sdk/trace', () => ({
  SpanRecorder: jest.fn().mockImplementation(() => ({
    startSpan: jest.fn(),
    endSpan: jest.fn(),
    getSpans: jest.fn().mockReturnValue([]),
  })),
  Timeline: jest.fn().mockImplementation(() => ({
    record: jest.fn(),
    getEvents: jest.fn().mockReturnValue([]),
  })),
  CostMeter: jest.fn().mockImplementation(() => ({
    record: jest.fn().mockReturnValue({ totalTokens: 100, costUsd: 0.001 }),
    getTotal: jest.fn().mockReturnValue({ totalTokens: 0, costUsd: 0 }),
  })),
}));

jest.mock('@vinhnt-sdk/security', () => ({
  defaultSecretRedactor: {
    redact: jest.fn().mockImplementation((t: string) => t),
  },
  sanitizeForLLM: jest.fn().mockImplementation((t: string) => t),
  detectInjectionPatterns: jest.fn().mockReturnValue([]),
  redactSecrets: jest.fn().mockImplementation((t: string) => t),
  sanitizeEnv: jest.fn().mockReturnValue({}),
}));

jest.mock('@vinhnt-sdk/sandbox', () => ({
  createSandbox: jest.fn(),
  createHostSandbox: jest.fn().mockImplementation((config) => ({
    scope: 'host',
    execute: jest.fn(),
    destroy: jest.fn(),
  })),
}));

jest.mock('@vinhnt-sdk/config', () => ({
  resolveEnv: jest
    .fn()
    .mockImplementation((env: Record<string, string | undefined>) => ({
      get: (key: string) => env[key],
      has: (key: string) => key in env,
      all: () => env,
    })),
  resolveCredentialFromEnv: jest
    .fn()
    .mockReturnValue({ value: 'test-value', source: 'env' }),
}));

jest.mock('@vinhnt-sdk/step-executor', () => ({
  RunStateMachine: jest.fn().mockImplementation(() => ({
    getState: jest.fn().mockReturnValue('pending'),
    setState: jest.fn(),
    getAbort: jest.fn().mockReturnValue(new AbortController()),
    getSignal: jest.fn().mockReturnValue(new AbortController().signal),
    cleanupRun: jest.fn(),
  })),
}));

jest.mock('@vinhnt-sdk/plugin', () => ({
  InMemoryPluginRegistry: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    unregister: jest.fn(),
    get: jest.fn(),
    list: jest.fn().mockReturnValue([]),
  })),
  definePlugin: jest.fn().mockImplementation((manifest, options) => ({
    manifest,
    ...options,
  })),
}));

jest.mock('@vinhnt-sdk/mcp', () => ({
  McpClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    closeAll: jest.fn(),
  })),
  discoverMcpTools: jest.fn().mockResolvedValue([]),
}));

jest.mock('@vinhnt-sdk/lsp', () => ({
  LspPool: jest.fn().mockImplementation(() => ({
    setActiveRoots: jest.fn(),
    shutdownAll: jest.fn(),
  })),
  LspServerRegistry: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
  })),
  createLspTools: jest.fn().mockReturnValue([]),
  BUILTIN_SERVERS: [],
}));

describe('AgentToolkit', () => {
  let toolkit: AgentToolkit;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentToolkit,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const config: Record<string, unknown> = {
                WORKSPACE_ROOT: '/test/workspace',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    toolkit = module.get<AgentToolkit>(AgentToolkit);
  });

  it('should be defined', () => {
    expect(toolkit).toBeDefined();
  });

  describe('Tools', () => {
    it('should initialize tools', () => {
      toolkit.initializeTools('/test/root');
      expect(toolkit.getToolRegistry()).toBeDefined();
    });

    it('should return tool definitions', () => {
      const tools = toolkit.getToolsAsDefinitions();
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('Permissions', () => {
    it('should check permission with allow effect', () => {
      const result = toolkit.checkPermission('read_file', '/test/file.txt');
      expect(result.effect).toBe('allow');
    });

    it('should build permission rules', () => {
      const rules = toolkit.buildPermissionRules({ edit: 'deny' });
      expect(Array.isArray(rules)).toBe(true);
    });
  });

  describe('Guard', () => {
    it('should check circuit breaker', async () => {
      const result = await toolkit.checkCircuitBreaker(async () => 'ok');
      expect(result).toBe('ok');
    });

    it('should check doom loop', () => {
      const result = toolkit.checkDoomLoop('tool1', { arg: 'value' });
      expect(result).toBe(false);
    });

    it('should record tool call', () => {
      toolkit.recordToolCall('tool1', { arg: 'value' });
      expect(toolkit.checkDoomLoop('tool1', { arg: 'value' })).toBe(false);
    });
  });

  describe('Trace', () => {
    it('should get timeline', () => {
      const timeline = toolkit.getTimeline('run-1');
      expect(timeline).toBeDefined();
    });

    it('should get cost meter', () => {
      const meter = toolkit.getCostMeter('run-1');
      expect(meter).toBeDefined();
    });

    it('should record token usage', () => {
      const usage = toolkit.recordTokenUsage('run-1', 100, 50, 'gpt-4o');
      expect(usage).toBeDefined();
    });

    it('should record timeline event', () => {
      const timeline = toolkit.getTimeline('run-1');
      toolkit.recordTimelineEvent('run-1', 'run.started', { sessionId: 's1' });
      expect(timeline.record).toHaveBeenCalled();
    });
  });

  describe('Security', () => {
    it('should sanitize for LLM', () => {
      const result = toolkit.sanitizeForLLM('test text');
      expect(result).toBe('test text');
    });

    it('should detect injection patterns', () => {
      const result = toolkit.detectInjectionPatterns('test text');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should redact secrets', () => {
      const result = toolkit.redactSecrets('test text');
      expect(result).toBe('test text');
    });
  });

  describe('Config', () => {
    it('should resolve credential', () => {
      const result = toolkit.resolveCredential('API_KEY' as any);
      expect(result).toBeDefined();
    });
  });

  describe('Sandbox', () => {
    it('should create sandbox', () => {
      const sandbox = toolkit.createSandbox();
      expect(sandbox).toBeDefined();
    });
  });

  describe('Step Executor', () => {
    it('should get run state machine', () => {
      const sm = toolkit.getRunStateMachine();
      expect(sm).toBeDefined();
    });
  });

  describe('Plugin', () => {
    it('should get plugin registry', () => {
      const registry = toolkit.getPluginRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup run', () => {
      toolkit.getTimeline('run-1');
      toolkit.getCostMeter('run-1');
      toolkit.cleanupRun('run-1');
      expect(toolkit.getTimeline('run-1')).toBeDefined();
    });
  });
});
