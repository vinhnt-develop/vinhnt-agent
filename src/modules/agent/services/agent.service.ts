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
import { AgentRunTrackingService } from './agent-run-tracking.service';
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

  constructor(
    private readonly sessionStore: SqliteSessionStore,
    private readonly memoryStore: SqliteMemoryStore,
    private readonly runEventStore: SqliteRunEventStore,
    private readonly providerFactory: ProviderFactory,
    private readonly configService: ConfigService,
    private readonly agentToolkit: AgentToolkit,
    private readonly trackingService: AgentRunTrackingService,
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
        eventBus: this.eventBus,
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

      this.logger.log(`Agent run completed for session ${sessionId}: tokens in=${lastAssistantMsg?.tokens?.input || 0}, out=${lastAssistantMsg?.tokens?.output || 0}, cost=${lastAssistantMsg?.cost || 0}`);

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
