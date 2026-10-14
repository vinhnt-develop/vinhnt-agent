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
}));

jest.mock('@vinhnt-sdk/permission', () => ({
  InMemoryApprovalStore: jest.fn().mockImplementation(() => ({
    awaitReply: jest.fn(),
    resolveRequest: jest.fn(),
    checkApproval: jest.fn(),
  })),
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
          // SC3: workspaceRoot now comes from settings (was ConfigService).
          provide: AgentSettingsService,
          useValue: {
            getSettings: jest.fn(() => ({
              workspaceRoot: '.',
            })),
          },
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
  });

  describe('Guard', () => {
    it('should expose circuit breaker for kernel wiring', () => {
      expect(toolkit.getCircuitBreaker()).toBeDefined();
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
