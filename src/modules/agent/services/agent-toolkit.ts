import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ToolRegistry,
  ToolSandbox,
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
  type ToolDefinition,
} from '@vinhnt-sdk/tools';
import {
  InMemoryApprovalStore,
  matchPermission,
  buildPermissionRules,
  type ApprovalStore,
} from '@vinhnt-sdk/permission';
import {
  CircuitBreaker,
  LoopDetector,
  withToolTimeout,
} from '@vinhnt-sdk/guard';
import { SpanRecorder, Timeline, CostMeter } from '@vinhnt-sdk/trace';
import {
  defaultSecretRedactor,
  sanitizeForLLM,
  detectInjectionPatterns,
  redactSecrets,
  sanitizeEnv,
} from '@vinhnt-sdk/security';
import {
  createSandbox,
  createHostSandbox,
  type SandboxConfig,
  type ProcessSandbox,
} from '@vinhnt-sdk/sandbox';
import {
  resolveEnv,
  resolveCredentialFromEnv,
  type EnvSnapshot,
  type CredentialRef,
} from '@vinhnt-sdk/config';
import { RunStateMachine, type RunState } from '@vinhnt-sdk/step-executor';
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
import { ToolConfigService } from '@/modules/tool-config/services/tool-config.service';
import { McpServerService } from '@/modules/mcp-servers/services/mcp-server.service';

export interface AgentToolkitConfig {
  workspaceRoot?: string;
  provider?: string;
  model?: string;
}

@Injectable()
export class AgentToolkit {
  private readonly logger = new Logger(AgentToolkit.name);
  private readonly toolRegistry = new ToolRegistry();
  private readonly approvalStore: ApprovalStore = new InMemoryApprovalStore();
  private readonly fileReadTracker = new FileReadTracker();
  private readonly fileHistory = new InMemoryFileHistory();
  private readonly circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeoutMs: 60_000,
  });
  private readonly loopDetector = new LoopDetector(3, 20);
  private readonly timelines = new Map<string, Timeline>();
  private readonly costMeters = new Map<string, CostMeter>();
  private readonly spanRecorders = new Map<string, SpanRecorder>();
  private readonly envSnapshot: EnvSnapshot;
  private readonly runStateMachine = new RunStateMachine();
  private readonly pluginRegistry: PluginRegistry =
    new InMemoryPluginRegistry();
  private readonly mcpClient = new McpClient();
  private readonly lspPool = new LspPool();
  private readonly lspServerRegistry = new LspServerRegistry(BUILTIN_SERVERS);
  private readonly mcpConnections = new Map<string, any>();

  constructor(
    private readonly configService: ConfigService,
    private readonly toolConfigService: ToolConfigService,
    private readonly mcpServerService: McpServerService,
  ) {
    this.envSnapshot = resolveEnv(process.env);
  }

  initializeTools(workspaceRoot?: string): void {
    const root =
      workspaceRoot || this.configService.get<string>('WORKSPACE_ROOT', '.');

    this.toolRegistry.register(createReadFileTool(root, this.fileReadTracker));
    this.toolRegistry.register(createWriteFileTool(root, this.fileReadTracker));
    this.toolRegistry.register(createEditFileTool(root, this.fileReadTracker));
    this.toolRegistry.register(createListDirectoryTool(root));
    this.toolRegistry.register(createGlobFilesTool(root));
    this.toolRegistry.register(createGrepFilesTool(root));
    this.toolRegistry.register(
      createShellTool({ workspaceRoot: root, defaultTimeoutMs: 30_000 }),
    );
    this.toolRegistry.register(createGitStatusTool(root));
    this.toolRegistry.register(createGitDiffTool(root));
    this.toolRegistry.register(createGitLogTool(root));

    this.logger.log(
      `Initialized ${this.toolRegistry.count()} built-in tools for root: ${root}`,
    );
  }

  async loadToolsFromDb(): Promise<void> {
    try {
      const toolConfigs = await this.toolConfigService.findEnabled();
      this.logger.log(`Loading ${toolConfigs.length} tool configs from DB`);
      for (const config of toolConfigs) {
        if (config.source === 'builtin') continue;
        if (config.source === 'mcp' && config.mcpServerName) {
          continue;
        }
        if (config.source === 'custom') {
          continue;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load tools from DB', error);
    }
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
            command: server.command,
            args: Array.isArray(server.args) ? server.args : undefined,
            url: server.url,
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
        risk: 'moderate' as const,
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

  getToolsAsDefinitions(): ToolDefinition[] {
    return this.toolRegistry.list() as ToolDefinition[];
  }

  checkPermission(
    action: string,
    resource: string,
    permissionRules?: Array<{
      action: string;
      effect: string;
      target?: string;
    }>,
  ): {
    effect: string;
    matchedRule?: { action?: string; effect: string; target?: string };
  } {
    if (!permissionRules || permissionRules.length === 0) {
      return { effect: 'allow' };
    }
    return matchPermission(permissionRules, action, resource);
  }

  buildPermissionRules(
    config: Record<string, string | Record<string, string>>,
  ): Array<{ action: string; resource: string; effect: string }> {
    return buildPermissionRules(config);
  }

  async checkCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.call(fn);
  }

  checkDoomLoop(toolId: string, args: unknown): boolean {
    return this.loopDetector.isDoomLoop(toolId, args);
  }

  recordToolCall(toolId: string, args: unknown): void {
    this.loopDetector.record(toolId, args);
  }

  async withTimeout<T>(
    toolId: string,
    timeoutMs: number,
    fn: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    return withToolTimeout(toolId, timeoutMs, fn);
  }

  getTimeline(runId: string): Timeline {
    if (!this.timelines.has(runId)) {
      this.timelines.set(runId, new Timeline());
    }
    return this.timelines.get(runId)!;
  }

  getCostMeter(runId: string): CostMeter {
    if (!this.costMeters.has(runId)) {
      this.costMeters.set(runId, new CostMeter());
    }
    return this.costMeters.get(runId)!;
  }

  getSpanRecorder(runId: string): SpanRecorder {
    if (!this.spanRecorders.has(runId)) {
      this.spanRecorders.set(runId, new SpanRecorder(runId));
    }
    return this.spanRecorders.get(runId)!;
  }

  recordTimelineEvent(
    runId: string,
    type: string,
    data: Record<string, unknown>,
  ): void {
    const timeline = this.getTimeline(runId);
    timeline.record(type as any, data);
  }

  recordTokenUsage(
    runId: string,
    inputTokens: number,
    outputTokens: number,
    modelId?: string,
  ) {
    const meter = this.getCostMeter(runId);
    return meter.record(inputTokens, outputTokens, modelId);
  }

  cleanupRun(runId: string): void {
    this.timelines.delete(runId);
    this.costMeters.delete(runId);
    this.spanRecorders.delete(runId);
    this.loopDetector.reset();
  }

  sanitizeForLLM(text: string, source?: string): string {
    return sanitizeForLLM(text, source);
  }

  detectInjectionPatterns(text: string): string[] {
    return detectInjectionPatterns(text);
  }

  redactSecrets(text: string): string {
    return redactSecrets(text);
  }

  redactObjectSecrets<T>(value: T): T {
    const redactor = defaultSecretRedactor;
    return JSON.parse(redactor.redact(JSON.stringify(value))) as T;
  }

  sanitizeEnv(
    source?: Record<string, string | undefined>,
    allowedVars?: string[],
  ): Record<string, string> {
    return sanitizeEnv(source, allowedVars);
  }

  resolveCredential(ref: CredentialRef) {
    return resolveCredentialFromEnv(this.envSnapshot, ref);
  }

  createSandbox(config?: SandboxConfig): ProcessSandbox {
    return createHostSandbox(config);
  }

  validateToolOutput(output: string, toolName: string): string {
    return sanitizeForLLM(output, `tool:${toolName}`);
  }

  getRunStateMachine() {
    return this.runStateMachine;
  }

  getPluginRegistry() {
    return this.pluginRegistry;
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
    if (plugin.activate) {
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
    if (plugin?.deactivate) {
      await plugin.deactivate();
    }
    this.pluginRegistry.unregister(id);
    this.logger.log(`Plugin unregistered: ${id}`);
  }

  async initializeLspPool(workspaceRoot?: string): Promise<void> {
    const root =
      workspaceRoot || this.configService.get<string>('WORKSPACE_ROOT', '.');
    this.lspPool.setActiveRoots([root]);
    this.logger.log(`LSP pool initialized for root: ${root}`);
  }

  getLspTools(): ToolDefinition[] {
    return createLspTools(this.lspPool);
  }

  registerLspServer(definition: LspServerDefinition): void {
    this.lspServerRegistry.register(definition);
  }

  async shutdown(): Promise<void> {
    await this.mcpClient.closeAll();
    await this.lspPool.shutdownAll();
    this.logger.log('AgentToolkit shut down');
  }
}
