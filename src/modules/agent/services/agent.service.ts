import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AgentKernelConfig } from '@vinhnt-sdk/core';
import type {
  RequestId,
  TraceId,
  ToolDefinitionLike,
} from '@vinhnt-sdk/schema';
import { InMemoryEventBus } from '@vinhnt-sdk/event';
import { TokenMeter } from '@vinhnt-sdk/llm';
import { SqliteSessionStore } from '@/infrastructure/storage/sqlite-session-store';
import { SqliteMemoryStore } from '@/infrastructure/storage/sqlite-memory-store';
import { SqliteRunEventStore } from '@/infrastructure/storage/sqlite-run-event-store';
import {
  ProviderFactory,
} from '@/infrastructure/model/provider-factory';
import { AgentToolkit } from './agent-toolkit';

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
  private readonly maxKernelCacheSize: number;
  private readonly eventBus = new InMemoryEventBus();
  private readonly tokenMeter = new TokenMeter();

  constructor(
    private readonly sessionStore: SqliteSessionStore,
    private readonly memoryStore: SqliteMemoryStore,
    private readonly runEventStore: SqliteRunEventStore,
    private readonly providerFactory: ProviderFactory,
    private readonly configService: ConfigService,
    private readonly agentToolkit: AgentToolkit,
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
      const provider = await this.providerFactory.getModelProvider(providerName);

      const kernelConfig: AgentKernelConfig = {
        model: provider,
        store: this.runEventStore,
        sessionStore: this.sessionStore,
        tools: tools.length > 0 ? (tools as any) : undefined,
        maxSteps: 30,
        maxTokens: 4096,
        stepTimeout: 120_000,
      };

      const kernel = new AgentKernel(kernelConfig);
      this.kernels.set(cacheKey, { kernel, lastAccess: Date.now() });
      this.logger.log(`AgentKernel initialized: provider=${providerName || 'default'} model=${modelId || 'default'} tools=${tools.length}`);
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
    this.logger.log(`Running agent for session ${sessionId}`);

    const runId = crypto.randomUUID();
    this.agentToolkit.recordTimelineEvent(runId, 'run.started', { sessionId });

    const kernel = await this.getKernel(model, provider);
    const ctx = this.buildRequestContext(provider, model);

    try {
      this.agentToolkit.recordTimelineEvent(runId, 'step.started', { step: 0 });
      const handle = kernel.run(prompt, ctx, sessionId);
      await handle.completed;
      this.agentToolkit.recordTimelineEvent(runId, 'step.completed', { step: 0 });

      const messages = await this.sessionStore.listMessages(sessionId);
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');

      this.agentToolkit.recordTimelineEvent(runId, 'run.completed', { status: 'succeeded' });

      return {
        runId,
        status: 'succeeded',
        output: lastAssistantMsg?.content,
        totalSteps: 0,
        provider: lastAssistantMsg?.provider,
        model: lastAssistantMsg?.model,
      };
    } catch (error) {
      this.logger.error(`Agent run failed for session ${sessionId}`, error);
      this.agentToolkit.recordTimelineEvent(runId, 'run.failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        runId,
        status: 'failed',
        output: error instanceof Error ? error.message : String(error),
        totalSteps: 0,
      };
    } finally {
      this.agentToolkit.cleanupRun(runId);
    }
  }

  async runAgentStreaming(input: RunAgentInput): Promise<any> {
    const { sessionId, prompt, model, provider } = input;
    this.logger.log(`Running agent (streaming) for session ${sessionId}`);

    const kernel = await this.getKernel(model, provider);
    const ctx = this.buildRequestContext(provider, model);
    return kernel.createRunHandle(prompt, ctx, sessionId);
  }

  async cancelRun(_runId: string): Promise<void> {
    const kernel = await this.getKernel();
    kernel.cancelCurrentRun();
    this.logger.log(`Cancelled run: ${_runId}`);
  }

  async getSessionMessages(sessionId: string) {
    return this.sessionStore.listMessages(sessionId);
  }

  async getRunStats() {
    return this.sessionStore.getSessionStats();
  }
}
