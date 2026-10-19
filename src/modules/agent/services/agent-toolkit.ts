import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { AgentSettingsService } from './agent-settings.service';
import {
  CUSTOM_TOOLS_CONFIG,
  type CustomToolJsonConfig,
  type JsonConfigStore,
} from '@/infrastructure/config';
import {
  ToolRegistry,
  InMemoryFileHistory,
  FileReadTracker,
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createListDirectoryTool,
  createGlobFilesTool,
  createGrepFilesTool,
  createShellTool,
  createGitStatusTool,
  createGitDiffTool,
  createGitLogTool,
  createWebFetchTool,
  createWebSearchTool,
  createTodoWriteTool,
  createQuestionTool,
  InMemoryQuestionStore,
  createSubmitPlanTool,
  InMemoryPlanApprovalStore,
  TavilySearchProvider,
  SerperSearchProvider,
  type QuestionStore,
  type PlanApprovalStore,
  type ToolDefinition,
} from '@vinhnt-sdk/tools';
import {
  createUpdatePlanTool,
  createGetPlanTool,
  PlanStore,
} from '@vinhnt-sdk/core';
import {
  InMemoryApprovalStore,
  type ApprovalStore,
} from '@vinhnt-sdk/permission';
import {
  CircuitBreaker,
  LoopDetector,
} from '@vinhnt-sdk/guard';
import {
  InMemoryPluginRegistry,
  definePlugin,
  type Plugin,
  type PluginRegistry,
} from '@vinhnt-sdk/plugin';
import {
  McpClient,
  discoverMcpTools,
  type McpServerConfig,
} from '@vinhnt-sdk/mcp';
import {
  LspPool,
  LspServerRegistry,
  createLspTools,
  BUILTIN_SERVERS,
  type LspServerDefinition,
} from '@vinhnt-sdk/lsp';
import { McpServerService } from '@/modules/mcp-servers/services/mcp-server.service';

/** Structural PluginManager for kernel wiring (matches @vinhnt-sdk/core PluginManager). */
export interface PluginManagerLike {
  register(plugin: Plugin): Promise<void>;
  activate(id: string): Promise<void>;
  deactivate(id: string): Promise<void>;
  list(): readonly Plugin[];
  get(id: string): Plugin | undefined;
  getActivePlugins(): readonly Plugin[];
  fireHook(name: string, data: unknown): Promise<unknown>;
}

export interface AgentToolkitConfig {
  workspaceRoot?: string;
  provider?: string;
  model?: string;
}

@Injectable()
export class AgentToolkit implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentToolkit.name);
  private readonly toolRegistry = new ToolRegistry();
  private readonly approvalStore: ApprovalStore = new InMemoryApprovalStore();
  private readonly questionStore: QuestionStore = new InMemoryQuestionStore();
  private readonly planApprovalStore: PlanApprovalStore = new InMemoryPlanApprovalStore();
  private readonly fileReadTracker = new FileReadTracker();
  private readonly fileHistory = new InMemoryFileHistory();
  private readonly planStore = new PlanStore();
  private readonly circuitBreakerDefaults = {
    failureThreshold: 5,
    resetTimeoutMs: 60_000,
  };
  private circuitBreaker = new CircuitBreaker({ ...this.circuitBreakerDefaults });
  /** Resilience values currently baked into `circuitBreaker` (P0.5). */
  private resilienceApplied = { maxRetries: 3, backoffMs: 1000, maxBackoffMs: 30000 };
  private readonly loopDetector = new LoopDetector(3, 20);
  private readonly pluginRegistry: PluginRegistry =
    new InMemoryPluginRegistry();
  private readonly mcpClient = new McpClient();
  private readonly lspPool = new LspPool();
  private readonly lspServerRegistry = new LspServerRegistry(BUILTIN_SERVERS);
  private readonly mcpConnections = new Map<string, any>();
  private pluginManager?: PluginManagerLike;
  private lspToolsRegistered = false;

  constructor(
    private readonly settingsService: AgentSettingsService,
    private readonly mcpServerService: McpServerService,
    @Inject(CUSTOM_TOOLS_CONFIG)
    private readonly customToolsConfig?: JsonConfigStore<CustomToolJsonConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.initializeTools();
    } catch (error) {
      this.logger.error('Failed to initialize built-in tools', error);
    }
    try {
      await this.loadCustomToolsFromStore();
    } catch (error) {
      this.logger.warn('Failed to load custom tools on startup', error);
    }
    try {
      await this.connectMcpServersFromDb();
    } catch (error) {
      this.logger.warn('Failed to connect MCP servers on startup', error);
    }
    try {
      await this.initializeLspPool();
    } catch (error) {
      this.logger.warn('LSP pool unavailable (optional) — skipping', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  /** Load active custom tools from JsonConfigStore into the registry. */
  async loadCustomToolsFromStore(): Promise<void> {
    this.customToolsConfig?.reload();
    const all = this.customToolsConfig?.findAll() ?? [];
    const tools = all.filter((t) => t.isActive);
    const activeIds = new Set(tools.map((t) => `custom_${t.id}`));
    for (const t of this.toolRegistry.list()) {
      if (t.id.startsWith('custom_') && !activeIds.has(t.id)) {
        this.toolRegistry.unregister(t.id);
      }
    }
    if (tools.length === 0) return;
    this.registerCustomTools(
      tools.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? '',
        inputSchema: (t.inputSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>,
        handlerType: (t.handlerType === 'mock' ? 'mock' : 'webhook') as 'webhook' | 'mock',
        handlerConfig: (t.handlerConfig ?? {}) as Record<string, unknown>,
        timeoutMs: t.timeoutMs ?? undefined,
      })),
    );
  }

  initializeTools(workspaceRoot?: string): void {
    const root =
      workspaceRoot || this.settingsService.getSettings().workspaceRoot;

    const asSystem = (tool: ToolDefinition): ToolDefinition => ({
      ...tool,
      metadata: { ...tool.metadata, source: 'system' },
    });

    this.toolRegistry.register(asSystem(createReadFileTool(root, this.fileReadTracker)));
    this.toolRegistry.register(asSystem(createWriteFileTool(root, this.fileReadTracker)));
    this.toolRegistry.register(asSystem(createEditFileTool(root, this.fileReadTracker)));
    this.toolRegistry.register(asSystem(createListDirectoryTool(root)));
    this.toolRegistry.register(asSystem(createGlobFilesTool(root)));
    this.toolRegistry.register(asSystem(createGrepFilesTool(root)));
    this.toolRegistry.register(
      asSystem(
        createShellTool({ workspaceRoot: root, defaultTimeoutMs: 30_000 }),
      ),
    );
    this.toolRegistry.register(asSystem(createGitStatusTool(root)));
    this.toolRegistry.register(asSystem(createGitDiffTool(root)));
    this.toolRegistry.register(asSystem(createGitLogTool(root)));

    // P4.1: SDK capability tools. web_fetch/todowrite are keyless;
    // web_search needs a search-provider key (env-injected, no hardcoding).
    this.toolRegistry.register(asSystem(createWebFetchTool()));
    this.toolRegistry.register(asSystem(createTodoWriteTool()));
    // Ask-user (HITL): the tool defers to `ctx.askQuestion`, which the kernel
    // wires to the injected QuestionStore; the user replies over REST/WS.
    this.toolRegistry.register(asSystem(createQuestionTool()));
    // Plan approval (HITL): the tool defers to `ctx.askPlan`, which the kernel
    // wires to the injected PlanApprovalStore; the user decides over REST/WS.
    this.toolRegistry.register(asSystem(createSubmitPlanTool()));
    // Plan tracking: update_plan writes / get_plan reads one shared store
    // (per-toolkit instance — concurrent agents must not share a plan).
    this.toolRegistry.register(asSystem(createUpdatePlanTool(this.planStore)));
    this.toolRegistry.register(asSystem(createGetPlanTool(this.planStore)));
    const searchProvider = process.env.SERPER_API_KEY
      ? new SerperSearchProvider({ apiKey: process.env.SERPER_API_KEY })
      : process.env.TAVILY_API_KEY
        ? new TavilySearchProvider({ apiKey: process.env.TAVILY_API_KEY })
        : null;
    if (searchProvider) {
      this.toolRegistry.register(
        asSystem(createWebSearchTool({ provider: searchProvider })),
      );
    } else {
      this.logger.log(
        'web_search not registered — set TAVILY_API_KEY or SERPER_API_KEY to enable',
      );
    }

    this.logger.log(
      `Initialized ${this.toolRegistry.count()} built-in tools for root: ${root}`,
    );
  }

  async connectMcpServersFromDb(): Promise<void> {
    try {
      const servers = await this.mcpServerService.findEnabled();
      this.logger.log(`Connecting ${servers.length} MCP servers from DB`);
      for (const server of servers) {
        try {
          const config: McpServerConfig = {
            name: server.name,
            transport: server.transport as 'stdio' | 'sse' | 'streamable-http',
            command: server.command ?? undefined,
            args: Array.isArray(server.args) ? server.args : undefined,
            url: server.url ?? undefined,
            env: server.env as Record<string, string> | undefined,
          };
          await this.connectMcpServer(config);
        } catch (error) {
          this.logger.error(`Failed to connect MCP server: ${server.name}`, error);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load MCP servers from DB', error);
    }
  }

  registerCustomTools(
    customTools: Array<{
      id: string;
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      handlerType: 'webhook' | 'mock';
      handlerConfig: Record<string, unknown>;
      timeoutMs?: number;
    }>,
  ): void {
    for (const tool of customTools) {
      const handler = async (
        args: Record<string, unknown>,
      ): Promise<string> => {
        if (tool.handlerType === 'webhook') {
          const url = tool.handlerConfig.url as string;
          const method = (tool.handlerConfig.method as string) || 'POST';
          const headers =
            (tool.handlerConfig.headers as Record<string, string>) || {};

          // SSRF protection: validate URL
          try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              return `Error: Only HTTP/HTTPS URLs are allowed. Got: ${parsed.protocol}`;
            }
            // Block private/internal IPs
            const hostname = parsed.hostname;
            if (
              hostname === 'localhost' ||
              hostname === '127.0.0.1' ||
              hostname === '::1' ||
              hostname === '0.0.0.0' ||
              hostname.startsWith('10.') ||
              hostname.startsWith('172.') ||
              hostname.startsWith('192.168.') ||
              hostname.startsWith('169.254.') ||
              hostname.endsWith('.local')
            ) {
              return `Error: Private/internal URLs are not allowed for security reasons. Got: ${hostname}`;
            }
          } catch {
            return `Error: Invalid URL format: ${url}`;
          }

          try {
            const response = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify(args),
              signal: AbortSignal.timeout(tool.timeoutMs || 30_000),
            });
            return await response.text();
          } catch (error) {
            return `Error calling webhook: ${error instanceof Error ? error.message : String(error)}`;
          }
        }

        // mock handler
        const mockResponse = tool.handlerConfig.response;
        if (typeof mockResponse === 'string') return mockResponse;
        return JSON.stringify(
          mockResponse || { result: 'ok', tool: tool.name },
        );
      };

      this.toolRegistry.register({
        id: `custom_${tool.id}`,
        name: tool.name,
        description: tool.description,
        inputSchema: (tool.inputSchema || {
          type: 'object',
          properties: {},
        }) as any,
        risk: 'write' as const,
        metadata: { source: 'custom' },
        execute: handler,
      });
    }

    this.logger.log(`Registered ${customTools.length} custom tools`);
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getApprovalStore(): ApprovalStore {
    return this.approvalStore;
  }

  getQuestionStore(): QuestionStore {
    return this.questionStore;
  }

  getPlanApprovalStore(): PlanApprovalStore {
    return this.planApprovalStore;
  }

  /**
   * P0.5: Settings → Resilience (maxRetries/backoffMs/maxBackoffMs) must reach
   * the LIVE breaker. The kernel prefers an injected instance over building its
   * own from config (`circuitBreaker ?? new CircuitBreaker(...)` in kernel.ts),
   * so a hardcoded singleton silently made those three fields dead UI. The
   * kernel cache already evicts on a settings-hash change (getSettingsHash
   * includes them), so the next run rebuilds the kernel and lands here — sync
   * the breaker against the saved settings before handing it over.
   */
  getCircuitBreaker(): CircuitBreaker {
    const saved = this.settingsService.getSettings();
    const want = {
      maxRetries: saved.maxRetries ?? 3,
      backoffMs: saved.backoffMs ?? 1000,
      maxBackoffMs: saved.maxBackoffMs ?? 30000,
    };
    if (
      want.maxRetries !== this.resilienceApplied.maxRetries ||
      want.backoffMs !== this.resilienceApplied.backoffMs ||
      want.maxBackoffMs !== this.resilienceApplied.maxBackoffMs
    ) {
      this.circuitBreaker = new CircuitBreaker({
        ...this.circuitBreakerDefaults,
        ...want,
      });
      this.resilienceApplied = want;
      this.logger.log(
        `Circuit breaker rebuilt from settings: maxRetries=${want.maxRetries} backoffMs=${want.backoffMs} maxBackoffMs=${want.maxBackoffMs}`,
      );
    }
    return this.circuitBreaker;
  }

  getToolsAsDefinitions(): ToolDefinition[] {
    return this.toolRegistry.list().map((t) => {
      const tool = t as ToolDefinition;
      const metaSource = tool.metadata?.source;
      const source =
        typeof metaSource === 'string' && metaSource
          ? metaSource
          : tool.id.startsWith('custom_')
            ? 'custom'
            : tool.id.startsWith('mcp__')
              ? 'mcp'
              : 'system';
      return {
        ...tool,
        metadata: { ...tool.metadata, source },
      };
    });
  }

  cleanupRun(_runId: string): void {
    this.loopDetector.reset();
  }

  getPluginRegistry() {
    return this.pluginRegistry;
  }

  /** Real PluginManager for kernel wiring (fireHook → registered plugins). */
  setPluginManager(pm: PluginManagerLike | undefined): void {
    this.pluginManager = pm;
  }

  getPluginManager(): PluginManagerLike | undefined {
    return this.pluginManager;
  }

  getMcpClient() {
    return this.mcpClient;
  }

  getLspPool() {
    return this.lspPool;
  }

  getLspServerRegistry() {
    return this.lspServerRegistry;
  }

  async connectMcpServer(config: McpServerConfig): Promise<void> {
    try {
      const connection = await this.mcpClient.connect(config);
      this.mcpConnections.set(config.name, connection);
      const tools = await discoverMcpTools(config.name, connection);
      tools.forEach((tool) => this.toolRegistry.register(tool));
      this.logger.log(
        `MCP server connected: ${config.name}, ${tools.length} tools registered`,
      );
    } catch (error) {
      this.logger.error(`Failed to connect MCP server: ${config.name}`, error);
      throw error;
    }
  }

  async disconnectMcpServer(name: string): Promise<void> {
    const connection = this.mcpConnections.get(name);
    if (connection) {
      await connection.close();
      this.mcpConnections.delete(name);
      this.logger.log(`MCP server disconnected: ${name}`);
    }
  }

  async registerPlugin(plugin: Plugin): Promise<void> {
    this.pluginRegistry.register(plugin);
    if (this.pluginManager) {
      try {
        await this.pluginManager.register(plugin);
        await this.pluginManager.activate(plugin.manifest.id);
      } catch (error) {
        this.logger.warn(
          `PluginManager activate failed for ${plugin.manifest.id}`,
          error,
        );
      }
    } else if (plugin.activate) {
      await plugin.activate({
        toolRegistry: this.toolRegistry,
        approvalStore: this.approvalStore,
        logger: this.logger,
      } as any);
    }
    this.logger.log(`Plugin registered: ${plugin.manifest.id}`);
  }

  async unregisterPlugin(id: string): Promise<void> {
    const plugin = this.pluginRegistry.get(id);
    if (this.pluginManager?.get(id)) {
      try {
        await this.pluginManager.deactivate(id);
      } catch (error) {
        this.logger.warn(`PluginManager deactivate failed for ${id}`, error);
      }
    } else if (plugin?.deactivate) {
      await plugin.deactivate();
    }
    this.pluginRegistry.unregister(id);
    this.logger.log(`Plugin unregistered: ${id}`);
  }

  async initializeLspPool(workspaceRoot?: string): Promise<void> {
    const root =
      workspaceRoot || this.settingsService.getSettings().workspaceRoot;
    this.lspPool.setActiveRoots([root]);
    if (!this.lspToolsRegistered) {
      const lspTools = this.getLspTools();
      for (const tool of lspTools) {
        this.toolRegistry.register({
          ...tool,
          metadata: { ...tool.metadata, source: 'system' },
        });
      }
      this.lspToolsRegistered = true;
      this.logger.log(
        `LSP pool initialized for root: ${root}, ${lspTools.length} LSP tools registered`,
      );
    } else {
      this.logger.log(`LSP pool root updated: ${root}`);
    }
  }

  getLspTools(): ToolDefinition[] {
    return createLspTools(this.lspPool);
  }

  registerLspServer(definition: LspServerDefinition): void {
    this.lspServerRegistry.register(definition);
  }

  async shutdown(): Promise<void> {
    try {
      await this.mcpClient.closeAll();
    } catch (error) {
      this.logger.warn('MCP closeAll failed during shutdown', error);
    }
    try {
      await this.lspPool.shutdownAll();
    } catch (error) {
      this.logger.warn('LSP shutdownAll failed during shutdown', error);
    }
    this.logger.log('AgentToolkit shut down');
  }
}
