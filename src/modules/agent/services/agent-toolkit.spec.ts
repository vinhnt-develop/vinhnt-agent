import { Test, TestingModule } from '@nestjs/testing';
import { AgentSettingsService } from './agent-settings.service';
import { AgentToolkit } from './agent-toolkit';
import { McpServerService } from '@/modules/mcp-servers/services/mcp-server.service';
import { CUSTOM_TOOLS_CONFIG } from '@/infrastructure/config/config.module';

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
  createWebFetchTool: jest.fn().mockReturnValue({ id: 'web_fetch' }),
  createWebSearchTool: jest.fn().mockReturnValue({ id: 'web_search' }),
  createTodoWriteTool: jest.fn().mockReturnValue({ id: 'todowrite' }),
  createQuestionTool: jest.fn().mockReturnValue({ id: 'question' }),
  InMemoryQuestionStore: jest.fn().mockImplementation(() => ({
    awaitReply: jest.fn(),
    resolveRequest: jest.fn(),
    getRequest: jest.fn(),
    pendingRequests: jest.fn().mockReturnValue([]),
    cancelRequest: jest.fn(),
  })),
  TavilySearchProvider: jest.fn().mockImplementation(() => ({ name: 'tavily' })),
  SerperSearchProvider: jest.fn().mockImplementation(() => ({ name: 'serper' })),
}));

jest.mock('@vinhnt-sdk/core', () => ({
  PlanStore: jest.fn().mockImplementation(() => ({ get: jest.fn(), set: jest.fn() })),
  createUpdatePlanTool: jest.fn().mockReturnValue({ id: 'update_plan' }),
  createGetPlanTool: jest.fn().mockReturnValue({ id: 'get_plan' }),
}));

jest.mock('@vinhnt-sdk/permission', () => ({
  InMemoryApprovalStore: jest.fn().mockImplementation(() => ({
    awaitReply: jest.fn(),
    resolveRequest: jest.fn(),
    checkApproval: jest.fn(),
  })),
}));

jest.mock('@vinhnt-sdk/guard', () => ({
  CircuitBreaker: jest.fn().mockImplementation((options?: unknown) => ({
    __options: options,
    getOptions: () => options ?? {},
    call: jest.fn().mockImplementation((fn: () => Promise<any>) => fn()),
    getState: jest.fn().mockReturnValue('closed'),
    reset: jest.fn(),
  })),
  LoopDetector: jest.fn().mockImplementation(() => ({
    record: jest.fn(),
    isDoomLoop: jest.fn().mockReturnValue(false),
    reset: jest.fn(),
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
  let settingsMock: { getSettings: jest.Mock };

  beforeEach(async () => {
    settingsMock = {
      getSettings: jest.fn(() => ({
        workspaceRoot: '.',
      })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentToolkit,
        {
          // SC3: workspaceRoot now comes from settings (was ConfigService).
          provide: AgentSettingsService,
          useValue: settingsMock,
        },
        {
          provide: McpServerService,
          useValue: { findEnabled: jest.fn().mockResolvedValue([]) },
        },
        { provide: CUSTOM_TOOLS_CONFIG, useValue: null },
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

    it('P4.1: registers update_plan + get_plan with a shared plan store', () => {
      toolkit.initializeTools('/test/root');
      const registry = toolkit.getToolRegistry() as unknown as { register: jest.Mock };
      const ids = registry.register.mock.calls.map((c) => (c[0] as { id: string }).id);
      expect(ids).toContain('update_plan');
      expect(ids).toContain('get_plan');
    });

    it('Phase 1: registers the question tool and exposes its store', () => {
      toolkit.initializeTools('/test/root');
      const registry = toolkit.getToolRegistry() as unknown as { register: jest.Mock };
      const ids = registry.register.mock.calls.map((c) => (c[0] as { id: string }).id);
      expect(ids).toContain('question');
      expect(toolkit.getQuestionStore()).toBeDefined();
    });
  });

  describe('Guard', () => {
    it('should expose circuit breaker for kernel wiring', () => {
      expect(toolkit.getCircuitBreaker()).toBeDefined();
    });

    it('P0.5: rebuilds the breaker from saved Resilience settings', () => {
      const before = toolkit.getCircuitBreaker();
      settingsMock.getSettings.mockReturnValue({
        workspaceRoot: '.',
        maxRetries: 5,
        backoffMs: 250,
        maxBackoffMs: 15_000,
      });

      const after = toolkit.getCircuitBreaker();

      expect(after).not.toBe(before);
      expect(
        (after as unknown as { getOptions: () => Record<string, unknown> }).getOptions(),
      ).toMatchObject({ maxRetries: 5, backoffMs: 250, maxBackoffMs: 15_000 });
      // Unchanged settings must keep the same instance (breaker state preserved).
      expect(toolkit.getCircuitBreaker()).toBe(after);
    });
  });

  describe('Plugin', () => {
    it('should get plugin registry', () => {
      const registry = toolkit.getPluginRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should reset the loop detector on cleanupRun', () => {
      expect(() => toolkit.cleanupRun('run-1')).not.toThrow();
    });
  });
});
