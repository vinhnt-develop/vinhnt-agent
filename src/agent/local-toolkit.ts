import {
  ToolRegistry,
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
import { FileReadTracker } from '@vinhnt-sdk/tools';
import { CircuitBreaker, LoopDetector, withToolTimeout } from '@vinhnt-sdk/guard';
import { SpanRecorder, Timeline, CostMeter } from '@vinhnt-sdk/trace';
import {
  defaultSecretRedactor,
  sanitizeForLLM,
  detectInjectionPatterns,
  redactSecrets,
} from '@vinhnt-sdk/security';
import { RunStateMachine } from '@vinhnt-sdk/step-executor';
import { InMemoryPluginRegistry, type Plugin, type PluginRegistry } from '@vinhnt-sdk/plugin';
import { McpClient, discoverMcpTools, type McpServerConfig } from '@vinhnt-sdk/mcp';
import { logger } from '../common/logger.js';

export class LocalAgentToolkit {
  private readonly toolRegistry = new ToolRegistry();
  private readonly fileReadTracker = new FileReadTracker();
  private readonly circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeoutMs: 60_000,
  });
  private readonly loopDetector = new LoopDetector(3, 20);
  private readonly timelines = new Map<string, Timeline>();
  private readonly costMeters = new Map<string, CostMeter>();
  private readonly spanRecorders = new Map<string, SpanRecorder>();
  private readonly runStateMachine = new RunStateMachine();
  private readonly pluginRegistry: PluginRegistry = new InMemoryPluginRegistry();
  private readonly mcpClient = new McpClient();
  private readonly mcpConnections = new Map<string, any>();

  constructor(private workspaceRoot: string) {}

  initializeTools(): void {
    const root = this.workspaceRoot;

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

    logger.info(
      `Initialized ${this.toolRegistry.count()} built-in tools for root: ${root}`,
    );
  }

  getToolsAsDefinitions(): ToolDefinition[] {
    return this.toolRegistry.list() as ToolDefinition[];
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  checkDoomLoop(toolId: string, args: unknown): boolean {
    return this.loopDetector.isDoomLoop(toolId, args);
  }

  recordToolCall(toolId: string, args: unknown): void {
    this.loopDetector.record(toolId, args);
  }

  async checkCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.call(fn);
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

  getRunStateMachine() {
    return this.runStateMachine;
  }

  getPluginRegistry() {
    return this.pluginRegistry;
  }

  getMcpClient() {
    return this.mcpClient;
  }

  async connectMcpServer(config: McpServerConfig): Promise<void> {
    try {
      const connection = await this.mcpClient.connect(config);
      this.mcpConnections.set(config.name, connection);
      const tools = await discoverMcpTools(config.name, connection);
      tools.forEach((tool) => this.toolRegistry.register(tool));
      logger.info(
        `MCP server connected: ${config.name}, ${tools.length} tools registered`,
      );
    } catch (error) {
      logger.error(`Failed to connect MCP server: ${config.name}`, error);
      throw error;
    }
  }

  async disconnectMcpServer(name: string): Promise<void> {
    const connection = this.mcpConnections.get(name);
    if (connection) {
      await connection.close();
      this.mcpConnections.delete(name);
      logger.info(`MCP server disconnected: ${name}`);
    }
  }

  async registerPlugin(plugin: Plugin): Promise<void> {
    this.pluginRegistry.register(plugin);
    if (plugin.activate) {
      await plugin.activate({
        toolRegistry: this.toolRegistry,
        logger: logger as any,
      } as any);
    }
    logger.info(`Plugin registered: ${plugin.manifest.id}`);
  }

  async shutdown(): Promise<void> {
    await this.mcpClient.closeAll();
    logger.info('LocalAgentToolkit shut down');
  }
}
