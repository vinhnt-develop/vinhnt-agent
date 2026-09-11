import type { AgentKernelConfig } from '@vinhnt-sdk/core';
import type { RequestId, TraceId, ToolDefinitionLike } from '@vinhnt-sdk/schema';
import { TokenMeter } from '@vinhnt-sdk/llm';
import { ProviderFactory, type ProviderConfig } from '../sync/provider-factory.js';
import { LocalSessionStore } from '../storage/local-session-store.js';
import { LocalMemoryStore } from '../storage/local-memory-store.js';
import { LocalRunEventStore } from '../storage/local-run-event-store.js';
import { LocalAgentToolkit } from './local-toolkit.js';
import { logger } from '../common/logger.js';
import type { AgentConfig } from '../config/index.js';

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

export class AgentRunner {
  private kernel: any = null;
  private kernelConfig: AgentKernelConfig | null = null;
  private readonly tokenMeter = new TokenMeter();
  private readonly providerFactory: ProviderFactory;
  private readonly sessionStore: LocalSessionStore;
  private readonly memoryStore: LocalMemoryStore;
  private readonly runEventStore: LocalRunEventStore;
  private readonly toolkit: LocalAgentToolkit;

  constructor(
    private config: AgentConfig,
    dataDir: string,
  ) {
    this.sessionStore = new LocalSessionStore(dataDir);
    this.memoryStore = new LocalMemoryStore(dataDir);
    this.runEventStore = new LocalRunEventStore(dataDir);
    this.toolkit = new LocalAgentToolkit(config.workspaceRoot);
    this.providerFactory = new ProviderFactory(config);
  }

  async initialize(): Promise<void> {
    this.toolkit.initializeTools();

    const { AgentKernel } = await import('@vinhnt-sdk/core');

    const tools = this.toolkit.getToolsAsDefinitions() as ToolDefinitionLike[];
    const provider = this.providerFactory.getModelProvider();

    this.kernelConfig = {
      model: provider,
      store: this.runEventStore,
      sessionStore: this.sessionStore,
      tools: tools.length > 0 ? (tools as any) : undefined,
      maxSteps: this.config.model.maxSteps,
      maxTokens: this.config.model.maxTokens,
      stepTimeout: this.config.model.stepTimeout,
    };

    this.kernel = new AgentKernel(this.kernelConfig!);
    logger.info(
      `AgentRunner initialized: provider=${this.config.model.provider} model=${this.config.model.modelId || 'default'} tools=${tools.length}`,
    );
  }

  async runAgent(input: RunAgentInput): Promise<RunAgentResult> {
    const { sessionId, prompt, model, provider } = input;

    if (!this.kernel) {
      throw new Error('AgentRunner not initialized. Call initialize() first.');
    }

    const runId = crypto.randomUUID();
    this.toolkit.recordTimelineEvent(runId, 'run.started', { sessionId });

    const ctx = {
      requestId: crypto.randomUUID() as RequestId,
      traceId: crypto.randomUUID() as TraceId,
      actorId: 'local-user',
      tenantId: 'local',
      ...(provider || model ? { overrides: { provider, model } } : {}),
    };

    try {
      this.toolkit.recordTimelineEvent(runId, 'step.started', { step: 0 });

      const handle = this.kernel.run(prompt, ctx, sessionId);
      await handle.completed;

      this.toolkit.recordTimelineEvent(runId, 'step.completed', { step: 0 });

      const messages = await this.sessionStore.listMessages(sessionId as any);
      const lastAssistantMsg = [...messages]
        .reverse()
        .find((m) => m.role === 'assistant');

      const estimatedTokens = this.tokenMeter.estimateRequest(
        messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      );

      this.toolkit.recordTimelineEvent(runId, 'run.completed', {
        status: 'succeeded',
        totalTokens: estimatedTokens,
      });

      return {
        runId,
        status: 'succeeded',
        output: lastAssistantMsg?.content,
        totalSteps: 0,
        provider: lastAssistantMsg?.provider,
        model: lastAssistantMsg?.model,
      };
    } catch (error) {
      logger.error(`Agent run failed for session ${sessionId}`, error);

      this.toolkit.recordTimelineEvent(runId, 'run.failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        runId,
        status: 'failed',
        output: error instanceof Error ? error.message : String(error),
        totalSteps: 0,
      };
    } finally {
      this.toolkit.cleanupRun(runId);
    }
  }

  async runAgentStreaming(input: RunAgentInput): Promise<any> {
    const { sessionId, prompt, model, provider } = input;

    if (!this.kernel) {
      throw new Error('AgentRunner not initialized. Call initialize() first.');
    }

    const ctx = {
      requestId: crypto.randomUUID() as RequestId,
      traceId: crypto.randomUUID() as TraceId,
      actorId: 'local-user',
      tenantId: 'local',
      ...(provider || model ? { overrides: { provider, model } } : {}),
    };

    return this.kernel.createRunHandle(prompt, ctx, sessionId);
  }

  async cancelRun(_runId: string): Promise<void> {
    if (this.kernel) {
      this.kernel.cancelCurrentRun();
      logger.info(`Cancelled run: ${_runId}`);
    }
  }

  getSessionStore(): LocalSessionStore {
    return this.sessionStore;
  }

  getMemoryStore(): LocalMemoryStore {
    return this.memoryStore;
  }

  getToolkit(): LocalAgentToolkit {
    return this.toolkit;
  }

  async shutdown(): Promise<void> {
    await this.toolkit.shutdown();
    logger.info('AgentRunner shut down');
  }
}
