import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AgentKernelConfig } from '@vinhnt-sdk/core';
import {
  InMemoryAgentRegistry,
  createAgent,
  AgentKernel,
  createContextRegistry,
  createSystemPromptSource,
  createDateSource,
  createWorkspaceSource,
  createInstructionsSource,
  createAgentSource,
  createToolContextSource,
  createCustomSource,
} from '@vinhnt-sdk/core';
import type { AgentId } from '@vinhnt-sdk/schema';
import type {
  RequestId,
  TraceId,
  ToolDefinitionLike,
} from '@vinhnt-sdk/schema';
import { InMemoryEventBus } from '@vinhnt-sdk/event';
import { TokenMeter } from '@vinhnt-sdk/llm';
import { createMemorySearchTool } from '@vinhnt-sdk/knowledge';
import { SqliteSessionStore } from '@/infrastructure/storage/sqlite-session-store';
import { SqliteMemoryStore } from '@/infrastructure/storage/sqlite-memory-store';
import { SqliteRunEventStore } from '@/infrastructure/storage/sqlite-run-event-store';
import {
  ProviderFactory,
} from '@/infrastructure/model/provider-factory';
import { AgentToolkit } from './agent-toolkit';
import { AgentRunTrackingService } from './agent-run-tracking.service';
import { AgentKnowledgeService } from '@/modules/knowledge/services/agent-knowledge.service';
import { extractActualErrorMessage } from '@/shared/error-utils';
import { KernelSettings } from './agent-settings.service';

export interface RunAgentInput {
  sessionId: string;
  prompt: string;
  model?: string;
  provider?: string;
  settings?: Partial<KernelSettings>;
  projectPath?: string;
  selection?: {
    tools?: Array<{ id: string; name?: string; enabled?: boolean }>;
    knowledge?: Array<{ id: string; key?: string; enabled?: boolean }>;
    plugins?: string[];
  };
}

export interface RunAgentResult {
  runId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  output?: string;
  error?: string;
  totalSteps: number;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  totalCost?: number;
  durationMs?: number;
  stopReason?: string;
  usage?: {
    totalSteps?: number;
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalTokens?: number;
    cost?: number;
    durationMs?: number;
    stopReason?: string;
  };
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private kernels = new Map<
    string,
    { kernel: any; lastAccess: number }
  >();
  /** Active run handles keyed by runId for run-specific cancellation. */
  private activeHandles = new Map<string, { cancel: () => void; isCancelled: boolean }>();
  private readonly maxKernelCacheSize: number;
  private readonly eventBus = new InMemoryEventBus();
  private readonly tokenMeter = new TokenMeter();
  private readonly agentRegistry = new InMemoryAgentRegistry();

  constructor(
    private readonly sessionStore: SqliteSessionStore,
    private readonly memoryStore: SqliteMemoryStore,
    private readonly runEventStore: SqliteRunEventStore,
    private readonly providerFactory: ProviderFactory,
    private readonly configService: ConfigService,
    private readonly agentToolkit: AgentToolkit,
    private readonly trackingService: AgentRunTrackingService,
    private readonly knowledgeService: AgentKnowledgeService,
  ) {
    this.maxKernelCacheSize = this.configService.get<number>('agent.maxKernelCacheSize', 50);
  }

  getEventBus() { return this.eventBus; }
  getTokenMeter() { return this.tokenMeter; }
  getAgentToolkit() { return this.agentToolkit; }
  getApprovalStore() { return this.agentToolkit.getApprovalStore(); }

  private getKernelCacheKey(providerName?: string, modelId?: string): string {
    return `${providerName || 'default'}|${modelId || 'default'}`;
  }

  private evictOldestKernel(): void {
    if (this.kernels.size <= this.maxKernelCacheSize) return;
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.kernels) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey) this.kernels.delete(oldestKey);
  }

  private getSettingsHash(settings?: Partial<KernelSettings>): string {
    if (!settings) return '';
    // Every field that affects ModelCaller / system prompt / kernel behavior.
    // Missing a field here reuses a stale kernel and lies about the request.
    const relevant = {
      temperature: settings.temperature,
      topP: settings.topP,
      maxTokens: settings.maxTokens,
      frequencyPenalty: settings.frequencyPenalty,
      presencePenalty: settings.presencePenalty,
      maxSteps: settings.maxSteps,
      thinkingBudget: settings.thinkingBudget,
      stepTimeout: settings.stepTimeout,
      toolChoice: settings.toolChoice,
      parallelToolCalls: settings.parallelToolCalls,
      maxToolCallsPerStep: settings.maxToolCallsPerStep,
      maxConcurrentToolCalls: settings.maxConcurrentToolCalls,
      selfCorrectOnFailure: settings.selfCorrectOnFailure,
      maxSelfCorrectAttempts: settings.maxSelfCorrectAttempts,
      compactionThreshold: settings.compactionThreshold,
      doomLoopThreshold: settings.doomLoopThreshold,
      maxSubAgentDepth: settings.maxSubAgentDepth,
      maxRetries: settings.maxRetries,
      backoffMs: settings.backoffMs,
      maxBackoffMs: settings.maxBackoffMs,
      sandboxMode: settings.sandboxMode,
      systemPrompt: settings.systemPrompt,
    };
    return JSON.stringify(relevant);
  }

  private async getKernel(modelId?: string, providerName?: string, settings?: Partial<KernelSettings>): Promise<any> {
    const cacheKey = this.getKernelCacheKey(providerName, modelId);
    const settingsHash = this.getSettingsHash(settings);
    const fullCacheKey = settingsHash ? `${cacheKey}|${settingsHash}` : cacheKey;

    const cached = this.kernels.get(fullCacheKey);
    if (cached) {
      cached.lastAccess = Date.now();
      return cached.kernel;
    }

    // Evict non-default cached kernels for same provider/model when settings differ
    if (settingsHash) {
      for (const [key] of this.kernels) {
        if (key.startsWith(cacheKey + '|')) {
          this.kernels.delete(key);
        }
      }
    }

    this.evictOldestKernel();

    try {
      // Refresh custom tools from disk so CRUD changes are visible without restart
      await this.agentToolkit.loadCustomToolsFromStore().catch(() => undefined);
      const tools = this.agentToolkit.getToolsAsDefinitions() as ToolDefinitionLike[];

      // Register memory search tool — included in pool; kernel selection
      // filter (ctx.overrides.selection.tools) excludes it when user disables it.
      const memorySearchTool = createMemorySearchTool(this.sessionStore as any);
      const allTools = [...tools, memorySearchTool as any];

      // Register code-reviewer sub-agent
      const codeReviewer = createAgent({
        id: 'code-reviewer' as AgentId,
        profile: {
          name: 'Code Reviewer',
          description: 'Reviews code for security issues, bugs, and best practices',
        },
        systemPrompt: 'You are a code review specialist. Focus on security, correctness, and best practices. Provide actionable feedback.',
        capabilities: { tools: ['read_file', 'grep_files', 'glob_files'] },
        permissions: { mode: 'subagent', maxSteps: 10 },
      });
      await this.agentRegistry.register(codeReviewer);

      const provider = await this.providerFactory.getModelProvider(providerName);
      const workspaceRoot = this.configService.get<string>('agent.workspaceRoot', '.');

      const kernelConfig: AgentKernelConfig = {
        model: provider,
        store: this.runEventStore,
        sessionStore: this.sessionStore,
        eventBus: this.eventBus,
        tools: allTools.length > 0 ? (allTools as any) : undefined,

        // Model settings (nested pattern — aligned with SDK v0.7.0)
        modelSettings: {
          temperature: settings?.temperature ?? this.configService.get<number>('agent.temperature', 0.7),
          topP: settings?.topP ?? this.configService.get<number>('agent.topP', 1.0),
          ...(settings?.toolChoice !== undefined ? { toolChoice: settings.toolChoice } : {}),
          parallelToolCalls: settings?.parallelToolCalls ?? true,
          ...(settings?.frequencyPenalty !== undefined ? { frequencyPenalty: settings.frequencyPenalty } : {}),
          ...(settings?.presencePenalty !== undefined ? { presencePenalty: settings.presencePenalty } : {}),
        },

        // Limits
        maxSteps: settings?.maxSteps ?? this.configService.get<number>('agent.maxSteps', 30),
        maxTokens: settings?.maxTokens ?? this.configService.get<number>('agent.maxTokens', 4096),
        stepTimeout: settings?.stepTimeout ?? this.configService.get<number>('agent.stepTimeout', 120_000),
        maxToolCallsPerStep: settings?.maxToolCallsPerStep ?? 10,
        maxConcurrentToolCalls: settings?.maxConcurrentToolCalls ?? 5,

        // Resilience
        circuitBreaker: this.agentToolkit.getCircuitBreaker() as any,
        doomLoopThreshold: settings?.doomLoopThreshold ?? this.configService.get<number>('agent.doomLoopThreshold', 3),
        maxRetries: settings?.maxRetries ?? 3,
        retryBackoffMs: settings?.backoffMs ?? 1000,
        maxRetryBackoffMs: settings?.maxBackoffMs ?? 30000,

        // Self-correction
        selfCorrectOnFailure: settings?.selfCorrectOnFailure ?? true,
        maxSelfCorrectAttempts: settings?.maxSelfCorrectAttempts ?? 3,

        // Thinking
        thinkingBudget: settings?.thinkingBudget ?? this.configService.get<number>('agent.thinkingBudget', 1024),

        // Context management
        compactionThreshold: settings?.compactionThreshold ?? 0.75,

        // Sub-agents
        maxSubAgentDepth: settings?.maxSubAgentDepth ?? 3,

        // Workspace
        workspaceRoot,

        // Permissions
        permissions: {
          approvalStore: this.agentToolkit.getApprovalStore(),
          // Local agent: default auto-approve so write/shell don't dead-end
          // waiting for an approval UI that doesn't exist yet (P0 fix).
          autoApprovalEnabled: this.configService.get<boolean>('agent.autoApproval', true),
          globalPermissionRules: this.configService.get<Record<string, string | Record<string, string>>>('agent.globalPermissionRules'),
          permissionRiskDefaults: this.configService.get<Record<string, string>>('agent.permissionRiskDefaults'),
        },

        // Sub-agents
        agentRegistry: this.agentRegistry,

        // Sandbox
        sandbox: {
          mode: settings?.sandboxMode ?? 'host',
        },

        // Plugins
        pluginManager: {
          async register() {},
          async activate() {},
          async deactivate() {},
          list: () => [],
          get: () => undefined,
          getActivePlugins: () => [],
          async fireHook() { return { ok: true } as any; },
        } as any,

        // System context — layered composition from SDK
        systemContext: (() => {
          const registry = createContextRegistry();

          // Priority 0: System prompt — user custom OR SDK default
          const customPrompt = settings?.systemPrompt;
          if (customPrompt) {
            // User-provided system prompt overrides SDK default
            registry.register(createCustomSource({
              key: 'core.system-prompt',
              value: customPrompt,
              priority: 0,
            }));
          } else {
            // SDK's model-specific default prompt
            registry.register(createSystemPromptSource(() => modelId));
          }

          // Priority 5: Tool index — names only (descriptions/schemas ride tools[] API)
          registry.register(createToolContextSource(() =>
            allTools.map((t: any) => ({
              name: t.name ?? t.id,
              id: t.id,
              risk: t.risk,
            })),
          ));

          // Priority 10: Project instructions (reads AGENTS.md)
          registry.register(createInstructionsSource(workspaceRoot));

          // Priority 20: Agent roster
          registry.register(createAgentSource(this.agentRegistry, () => null));

          // Priority 30: Current date/time
          registry.register(createDateSource());

          // Priority 40: Workspace info (cwd, OS, arch, etc.)
          registry.register(createWorkspaceSource(workspaceRoot));

          return registry;
        })(),
      };

      const kernel = new AgentKernel(kernelConfig);
      this.kernels.set(fullCacheKey, { kernel, lastAccess: Date.now() });
      this.logger.log(`AgentKernel initialized: provider=${providerName || 'default'} model=${modelId || 'default'} tools=${allTools.length} workspace=${workspaceRoot}`);
      return kernel;
    } catch (error) {
      this.logger.error('Failed to initialize AgentKernel', error);
      throw error;
    }
  }

  private buildRequestContext(provider?: string, model?: string, workspaceRoot?: string, selection?: RunAgentInput['selection']) {
    return {
      requestId: crypto.randomUUID() as RequestId,
      traceId: crypto.randomUUID() as TraceId,
      actorId: 'local-user',
      tenantId: 'local',
      overrides: {
        ...(provider ? { provider } : {}),
        ...(model ? { model } : {}),
        ...(workspaceRoot ? { workspaceRoot } : {}),
        ...(selection ? { selection } : {}),
      },
    };
  }

  async runAgent(input: RunAgentInput): Promise<RunAgentResult> {
    const { sessionId, prompt, model, provider, settings, projectPath } = input;
    this.logger.log(`Running agent for session ${sessionId}, model=${model}, provider=${provider}`);

    if (!sessionId) {
      this.logger.error('runAgent called without sessionId');
      return { runId: '', status: 'failed', output: 'Session ID is required', totalSteps: 0 };
    }

    const existingMessages = await this.sessionStore.listMessages(sessionId);
    if (existingMessages.length === 0) {
      this.logger.warn(`Session ${sessionId} has no messages - session may not exist in DB`);
    }

    const runStartedAt = Date.now();
    const kernel = await this.getKernel(model, provider, settings);
    const ctx = this.buildRequestContext(provider, model, projectPath, input.selection);

    // runId MUST equal handle.runId so agent_runs joins run_events in trajectory.
    const handle = kernel.createRunHandle(prompt, ctx, sessionId);
    const runId = handle.runId as string;

    this.agentToolkit.recordTimelineEvent(runId, 'run.started', { sessionId });
    this.trackingService.startRun({
      runId,
      sessionId,
      model,
      provider,
      triggerType: 'http',
    });

    try {
      this.agentToolkit.recordTimelineEvent(runId, 'step.started', { step: 0 });

      // Drain handle.events() so tool.invoked/completed/failed are tracked
      // into tool_executions (same as WS gateway path).
      const drainEvents = (async () => {
        try {
          for await (const event of handle.events()) {
            if (event.type === 'tool.invoked') {
              this.trackingService.startToolExecution({
                runId,
                sessionId,
                toolName: event.data?.toolName || 'unknown',
                toolInput: event.data?.input as Record<string, unknown> | undefined,
              });
            } else if (event.type === 'tool.completed') {
              this.trackingService.completeToolExecution({
                runId,
                toolName: event.data?.toolName || 'unknown',
                toolOutput: event.data?.output,
                status: 'completed',
              });
            } else if (event.type === 'tool.failed') {
              this.trackingService.completeToolExecution({
                runId,
                toolName: event.data?.toolName || 'unknown',
                status: 'failed',
                errorMessage: event.data?.error,
              });
            }
          }
        } catch {
          /* drain errors must not fail the run */
        }
      })();

      const result = await handle.completed;
      await drainEvents;
      this.agentToolkit.recordTimelineEvent(runId, 'step.completed', { step: 0 });

      const durationMs = Date.now() - runStartedAt;

      if (result.status === 'failed') {
        const errorMsg = extractActualErrorMessage(result.error || 'Agent run failed');
        
        this.logger.error(`Agent run failed for session ${sessionId}`, errorMsg);
        this.agentToolkit.recordTimelineEvent(runId, 'run.failed', {
          error: errorMsg,
        });

        this.trackingService.completeRun({
          runId,
          status: 'failed',
          durationMs,
          errorMessage: errorMsg,
        });

      return {
        runId,
        status: 'failed',
        output: errorMsg,
        error: errorMsg,
        totalSteps: 0,
      };
    }

    const messages = await this.sessionStore.listMessages(sessionId);
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');

    this.agentToolkit.recordTimelineEvent(runId, 'run.completed', { status: 'succeeded' });

    // Record token usage in CostMeter for aggregation
    const inputTokens = result.inputTokens || lastAssistantMsg?.tokens?.input || 0;
    const outputTokens = result.outputTokens || lastAssistantMsg?.tokens?.output || 0;
    const reasoningTokens = lastAssistantMsg?.tokens?.reasoning || 0;
    const modelId = lastAssistantMsg?.model;
    if (inputTokens > 0 || outputTokens > 0) {
      this.agentToolkit.recordTokenUsage(runId, inputTokens, outputTokens, modelId);
    }

    this.logger.log(`Agent run completed for session ${sessionId}: tokens in=${inputTokens}, out=${outputTokens}, cost=${lastAssistantMsg?.cost || 0}`);

    this.trackingService.completeRun({
      runId,
      status: 'succeeded',
      inputTokens: result.inputTokens || lastAssistantMsg?.tokens?.input,
      outputTokens: result.outputTokens || lastAssistantMsg?.tokens?.output,
      reasoningTokens: lastAssistantMsg?.tokens?.reasoning,
      totalCost: lastAssistantMsg?.cost,
      durationMs: result.durationMs || durationMs,
      metadata: { model: lastAssistantMsg?.model, provider: lastAssistantMsg?.provider },
    });

    // Process turn to extract facts into memory
    try {
      const turnMessages = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content || '' }));
      await this.knowledgeService.processTurn(sessionId, turnMessages);
    } catch (memError) {
      this.logger.warn(`Memory processing failed for session ${sessionId}`, memError);
    }

    const totalSteps = result.totalSteps;
    const stopReason = (result as { stopReason?: string }).stopReason;
    const totalTokens = inputTokens + outputTokens + reasoningTokens;

    return {
      runId,
      status: 'succeeded',
      output: result.output || lastAssistantMsg?.content,
      totalSteps,
      provider: lastAssistantMsg?.provider,
      model: lastAssistantMsg?.model,
      inputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      totalCost: lastAssistantMsg?.cost,
      durationMs: result.durationMs || durationMs,
      stopReason,
      // Nested usage block matching webui RunAgentResponse.usage
      usage: {
        totalSteps,
        provider: lastAssistantMsg?.provider,
        model: lastAssistantMsg?.model,
        inputTokens,
        outputTokens,
        reasoningTokens,
        totalTokens,
        cost: lastAssistantMsg?.cost,
        durationMs: result.durationMs || durationMs,
        stopReason,
      },
    };
  } catch (error) {
    const errorMsg = extractActualErrorMessage(error);
    this.logger.error(`Agent run failed for session ${sessionId}`, errorMsg);
    const durationMs = Date.now() - runStartedAt;
    this.agentToolkit.recordTimelineEvent(runId, 'run.failed', {
      error: errorMsg,
    });

    this.trackingService.completeRun({
      runId,
      status: 'failed',
      durationMs,
      errorMessage: errorMsg,
    });

    return {
      runId,
      status: 'failed',
      output: errorMsg,
      error: errorMsg,
      totalSteps: 0,
    };
  } finally {
    this.agentToolkit.cleanupRun(runId);
  }
}

  async runAgentStreaming(input: RunAgentInput): Promise<{ handle: any; runId: string }> {
    const { sessionId, prompt, model, provider, settings, projectPath } = input;
    this.logger.log(`Running agent (streaming) for session ${sessionId}`);

    try {
      const kernel = await this.getKernel(model, provider, settings);
      const ctx = this.buildRequestContext(provider, model, projectPath, input.selection);
      const handle = kernel.createRunHandle(prompt, ctx, sessionId);

      const runId = handle.runId as string;

      this.trackingService.startRun({
        runId,
        sessionId,
        model,
        provider,
        triggerType: 'websocket',
      });

      this.activeHandles.set(runId, handle);

      handle.completed.then(
        () => this.activeHandles.delete(runId),
        () => this.activeHandles.delete(runId),
      ).catch((err) => {
        this.logger.error(`Stream handle error for run ${runId}`, err);
        this.activeHandles.delete(runId);
      });

      return { handle, runId };
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Failed to start streaming run for session ${sessionId}: ${errorMsg}`);
      throw error;
    }
  }

  async cancelRun(runId: string): Promise<void> {
    const handle = this.activeHandles.get(runId);
    if (handle && !handle.isCancelled) {
      handle.isCancelled = true;
      handle.cancel();
      this.logger.log(`Cancelled run: ${runId}`);
    } else {
      this.logger.warn(`No active handle found for run: ${runId}`);
    }
  }

  async getSessionMessages(sessionId: string) {
    return this.sessionStore.listMessages(sessionId);
  }

  async getRunStats() {
    return this.sessionStore.getSessionStats();
  }
}
