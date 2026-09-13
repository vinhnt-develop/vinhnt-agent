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

/**
 * Extract human-readable error message from any error type.
 * Preserves the original message without wrapping.
 */
function extractActualErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  
  // If it's already an Error instance, use message directly
  if (error instanceof Error) {
    return error.message;
  }
  
  // If it's a string, try to parse as JSON to extract nested message
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      return extractActualErrorMessage(parsed);
    } catch {
      return error;
    }
  }
  
  // If it's an object, try to extract message from nested structures
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    
    // Google API format: { error: { error: { message: "..." } } }
    if (obj.error && typeof obj.error === 'object') {
      const innerError = obj.error as Record<string, unknown>;
      if (innerError.error && typeof innerError.error === 'object') {
        const deepError = innerError.error as Record<string, unknown>;
        if (typeof deepError.message === 'string') return deepError.message;
      }
      // OpenAI format: { error: { message: "..." } }
      if (typeof innerError.message === 'string') return innerError.message;
      // Plain error string: { error: "..." }
      if (typeof innerError.error === 'string') return innerError.error;
    }
    
    // Direct message: { message: "..." }
    if (typeof obj.message === 'string') return obj.message;
    
    // VntError/KernelError serialized: { name: "...", message: "...", code: "..." }
    if (typeof obj.message === 'string') return obj.message;
  }
  
  // Fallback: stringify and return
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

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
      const handle = kernel.run(prompt, ctx, sessionId);
      
      // Track error from EventBus (emitFail puts error in run.completed event)
      let trackedError: string | null = null;
      const unsubscribe = this.eventBus.subscribeAll((event) => {
        if (event.type === 'run.completed' && (event as any).data?.status === 'failed') {
          const eventRunId = (event as any).runId || (event as any).aggregateId;
          if (eventRunId === runId) {
            trackedError = (event as any).data?.error || null;
          }
        }
      });
      
      const result = await handle.completed;
      unsubscribe();
      this.agentToolkit.recordTimelineEvent(runId, 'step.completed', { step: 0 });

      const durationMs = Date.now() - runStartedAt;

      // Check if the run failed
      const hasError = !result || (result as any).error || (result as any).status === 'failed' || trackedError;
      
      if (hasError) {
        // Use tracked error from EventBus, fallback to result fields
        const rawError = trackedError || (result as any)?.error || (result as any)?.output || 'Agent run failed';
        const errorMsg = extractActualErrorMessage(rawError);
        
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
        inputTokens: lastAssistantMsg?.tokens?.input,
        outputTokens: lastAssistantMsg?.tokens?.output,
        reasoningTokens: lastAssistantMsg?.tokens?.reasoning,
        totalCost: lastAssistantMsg?.cost,
        durationMs,
        metadata: { model: lastAssistantMsg?.model, provider: lastAssistantMsg?.provider },
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

    const runId = crypto.randomUUID();

    this.trackingService.startRun({
      runId,
      sessionId,
      model,
      provider,
      triggerType: 'websocket',
    });

    const kernel = await this.getKernel(model, provider);
    const ctx = this.buildRequestContext(provider, model);
    const handle = kernel.createRunHandle(prompt, ctx, sessionId);
    return { handle, runId };
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
