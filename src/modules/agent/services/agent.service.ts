import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AgentKernelConfig } from '@vinhnt-sdk/core';
import {
  InMemoryAgentRegistry,
  createAgent,
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

export interface RunAgentInput {
  sessionId: string;
  prompt: string;
  model?: string;
  provider?: string;
}

export interface RunAgentResult {
  runId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  output?: string;
  totalSteps: number;
  provider?: string;
  model?: string;
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

  private async getKernel(modelId?: string, providerName?: string): Promise<any> {
    const cacheKey = this.getKernelCacheKey(providerName, modelId);
    const cached = this.kernels.get(cacheKey);
    if (cached) {
      cached.lastAccess = Date.now();
      return cached.kernel;
    }

    this.evictOldestKernel();

    try {
      const { AgentKernel } = await import('@vinhnt-sdk/core');
      const tools = this.agentToolkit.getToolsAsDefinitions() as ToolDefinitionLike[];

      // Register memory search tool
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
      const workspaceRoot = this.configService.get<string>('WORKSPACE_ROOT', '.');

      const kernelConfig: AgentKernelConfig = {
        model: provider,
        store: this.runEventStore,
        sessionStore: this.sessionStore,
        eventBus: this.eventBus,
        tools: allTools.length > 0 ? (allTools as any) : undefined,

        // Limits
        maxSteps: this.configService.get<number>('agent.maxSteps', 30),
        maxTokens: this.configService.get<number>('agent.maxTokens', 4096),
        stepTimeout: this.configService.get<number>('agent.stepTimeout', 120_000),

        // Resilience — wire from AgentToolkit
        circuitBreaker: this.agentToolkit.getCircuitBreaker() as any,
        doomLoopThreshold: this.configService.get<number>('agent.doomLoopThreshold', 3),

        // Self-correction
        selfCorrectOnFailure: true,
        maxSelfCorrectAttempts: 3,

        // Thinking
        thinkingBudget: this.configService.get<number>('agent.thinkingBudget', 1024),

        // Workspace
        workspaceRoot,

        // Permissions
        permissions: {
          approvalStore: this.agentToolkit.getApprovalStore(),
          autoApprovalEnabled: this.configService.get<boolean>('agent.autoApproval', false),
          globalPermissionRules: this.configService.get<Record<string, string | Record<string, string>>>('agent.globalPermissionRules'),
          permissionRiskDefaults: this.configService.get<Record<string, string>>('agent.permissionRiskDefaults'),
        },

        // Sub-agents
        agentRegistry: this.agentRegistry,

        // Plugins
        pluginManager: this.agentToolkit.getPluginRegistry() as any,
      };

      const kernel = new AgentKernel(kernelConfig);
      this.kernels.set(cacheKey, { kernel, lastAccess: Date.now() });
      this.logger.log(`AgentKernel initialized: provider=${providerName || 'default'} model=${modelId || 'default'} tools=${tools.length} workspace=${workspaceRoot}`);
      return kernel;
    } catch (error) {
      this.logger.error('Failed to initialize AgentKernel', error);
      throw error;
    }
  }

  private buildRequestContext(provider?: string, model?: string) {
    return {
      requestId: crypto.randomUUID() as RequestId,
      traceId: crypto.randomUUID() as TraceId,
      actorId: 'local-user',
      tenantId: 'local',
      ...(provider || model ? { overrides: { provider, model } } : {}),
    };
  }

  async runAgent(input: RunAgentInput): Promise<RunAgentResult> {
    const { sessionId, prompt, model, provider } = input;
    this.logger.log(`Running agent for session ${sessionId}, model=${model}, provider=${provider}`);

    if (!sessionId) {
      this.logger.error('runAgent called without sessionId');
      return { runId: '', status: 'failed', output: 'Session ID is required', totalSteps: 0 };
    }

    const existingMessages = await this.sessionStore.listMessages(sessionId);
    if (existingMessages.length === 0) {
      this.logger.warn(`Session ${sessionId} has no messages - session may not exist in DB`);
    }

    const runId = crypto.randomUUID();
    const runStartedAt = Date.now();
    this.agentToolkit.recordTimelineEvent(runId, 'run.started', { sessionId });

    this.trackingService.startRun({
      runId,
      sessionId,
      model,
      provider,
      triggerType: 'http',
    });

    const kernel = await this.getKernel(model, provider);
    const ctx = this.buildRequestContext(provider, model);

    try {
      this.agentToolkit.recordTimelineEvent(runId, 'step.started', { step: 0 });
      const handle = kernel.createRunHandle(prompt, ctx, sessionId);
      
      const result = await handle.completed;
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
          totalSteps: 0,
        };
      }

      const messages = await this.sessionStore.listMessages(sessionId);
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');

      this.agentToolkit.recordTimelineEvent(runId, 'run.completed', { status: 'succeeded' });

      // Record token usage in CostMeter for aggregation
      const inputTokens = result.inputTokens || lastAssistantMsg?.tokens?.input || 0;
      const outputTokens = result.outputTokens || lastAssistantMsg?.tokens?.output || 0;
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
        const allMessages = await this.sessionStore.listMessages(sessionId);
        const turnMessages = allMessages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content || '' }));
        await this.knowledgeService.processTurn(sessionId, turnMessages);
      } catch (memError) {
        this.logger.warn(`Memory processing failed for session ${sessionId}`, memError);
      }

      return {
        runId,
        status: 'succeeded',
        output: result.output || lastAssistantMsg?.content,
        totalSteps: result.totalSteps,
        provider: lastAssistantMsg?.provider,
        model: lastAssistantMsg?.model,
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
        totalSteps: 0,
      };
    } finally {
      this.agentToolkit.cleanupRun(runId);
    }
  }

  async runAgentStreaming(input: RunAgentInput): Promise<{ handle: any; runId: string }> {
    const { sessionId, prompt, model, provider } = input;
    this.logger.log(`Running agent (streaming) for session ${sessionId}`);

    const kernel = await this.getKernel(model, provider);
    const ctx = this.buildRequestContext(provider, model);
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
    );

    return { handle, runId };
  }

  async cancelRun(runId: string): Promise<void> {
    const handle = this.activeHandles.get(runId);
    if (handle && !handle.isCancelled) {
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
