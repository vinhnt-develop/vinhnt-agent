import { Injectable, Logger, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';
import type {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelStreamEvent,
  ModelPricing,
  ModelCapabilities,
} from '@vinhnt-sdk/schema';
import {
  OpenAICompatibleProvider,
  type OpenAICompatibleProviderOptions,
} from '@vinhnt-sdk/provider-openai-compatible';
import { TokenMeter } from '@vinhnt-sdk/llm';
import { ProviderConfigService } from '@/modules/provider-config/services/provider-config.service';

export interface ProviderConfig {
  provider: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  defaultMaxTokens?: number;
  temperature?: number;
  contextLimit?: number;
  pricing?: { input?: number; output?: number };
}

interface CacheEntry {
  provider: ModelProvider;
  configHash: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

interface RawModelList {
  data?: Array<{
    id?: string;
    name?: string;
    context_window?: number;
    context_length?: number;
    max_output_tokens?: number;
    max_tokens?: number;
  }>;
}

@Injectable()
export class ProviderFactory {
  private readonly logger = new Logger(ProviderFactory.name);
  private cache = new Map<string, CacheEntry>();
  private readonly tokenMeter = new TokenMeter();

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: any,
    private readonly providerConfigService: ProviderConfigService,
  ) {}

  getTokenMeter(): TokenMeter {
    return this.tokenMeter;
  }

  estimateTokens(
    messages: Array<{ role: string; content: string }>,
    tools?: Array<{ name: string; description: string }>,
  ) {
    return this.tokenMeter.estimateRequest(messages, tools);
  }

  measurePressure(usage: { promptTokens: number }, contextLimit: number) {
    return this.tokenMeter.measurePressure(
      { promptTokens: usage.promptTokens, completionTokens: 0 },
      contextLimit,
    );
  }

  /**
   * Get provider config from local SQLite database.
   * API keys are encrypted at rest, decrypted by ProviderConfigService.
   */
  async getProviderConfigFromDB(providerName?: string): Promise<ProviderConfig | null> {
    try {
      let config: any;
      if (providerName) {
        const configs = await this.providerConfigService.findByProvider(providerName);
        config = configs[0];
      } else {
        config = await this.providerConfigService.findDefault();
        if (!config) {
          const enabled = await this.providerConfigService.findEnabled();
          config = enabled[0];
        }
      }
      if (!config) return null;
      return {
        provider: config.provider,
        baseUrl: config.baseUrl || '',
        apiKey: config.apiKey || '',
        defaultModel: (config.configs?.defaultModel as string | undefined) || undefined,
        pricing: config.pricing || undefined,
      };
    } catch (error) {
      this.logger.warn('Failed to get provider config from DB', error);
      return null;
    }
  }

  /**
   * Get a ModelProvider for the given provider name.
   * Resolution: database config > fallback error
   */
  async getModelProvider(providerName?: string): Promise<ModelProvider> {
    const config = await this.getProviderConfigFromDB(providerName);
    if (!config) {
      throw new Error(`No provider config found. Configure a provider first.`);
    }

    const cacheKey = this.buildCacheKey(config);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.provider;
    }

    let resolvedConfig = config;
    if (!resolvedConfig.defaultModel) {
      const models = await this.discoverModels(resolvedConfig);
      if (models.length > 0) {
        resolvedConfig = { ...resolvedConfig, defaultModel: models[0].id };
        this.logger.debug(`Auto-selected default model: ${models[0].id}`);
      } else {
        resolvedConfig = { ...resolvedConfig, defaultModel: resolvedConfig.provider };
        this.logger.debug(`No models discovered, using provider name as default model: ${resolvedConfig.provider}`);
      }
    }

    const provider = this.buildProvider(resolvedConfig);
    this.cache.set(cacheKey, {
      provider,
      configHash: cacheKey,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    this.logger.debug(`Created provider: ${config.provider}/${config.baseUrl}`);
    return provider;
  }

  /**
   * Build a provider from explicit config (no caching).
   */
  buildProvider(config: ProviderConfig): ModelProvider {
    const opts: OpenAICompatibleProviderOptions = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey || '',
      defaultModel: config.defaultModel || config.provider,
      providerName: config.provider,
      timeoutMs: 120_000,
      retry: { maxRetries: 3, baseBackoffMs: 1000, maxBackoffMs: 30_000 },
    };

    const pricing: ModelPricing | undefined =
      config.pricing?.input !== undefined && config.pricing?.output !== undefined
        ? { input: config.pricing.input, output: config.pricing.output }
        : undefined;

    const inner = new OpenAICompatibleProvider(opts);

    if (config.provider === 'google') {
      return new GoogleProviderAdapter(inner, pricing);
    }

    return new ProviderAdapter(inner, config.provider, pricing);
  }

  /**
   * Discover models from a provider's API.
   */
  async discoverModels(config: ProviderConfig): Promise<readonly DiscoveredModel[]> {
    try {
      const url = `${config.baseUrl}/models`;
      const headers: Record<string, string> = {};
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        this.logger.warn(`Model discovery failed: ${response.status}`);
        return [];
      }

      const data: unknown = await response.json();
      return this.parseModelList(data as RawModelList);
    } catch (error) {
      this.logger.warn(`Model discovery error: ${error}`);
      return [];
    }
  }

  private buildCacheKey(config: ProviderConfig): string {
    return `${config.provider}|${config.baseUrl}|${config.apiKey || ''}`;
  }

  private parseModelList(data: RawModelList): DiscoveredModel[] {
    const result: DiscoveredModel[] = [];
    const models = data.data;
    if (!Array.isArray(models)) return result;

    for (const raw of models) {
      if (!raw?.id) continue;
      result.push({
        id: raw.id,
        name: raw.name || raw.id,
        contextWindow: raw.context_window || raw.context_length,
        maxOutputTokens: raw.max_output_tokens || raw.max_tokens,
      });
    }

    return result;
  }
}

export interface DiscoveredModel {
  id: string;
  name?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
}

class ProviderAdapter implements ModelProvider {
  readonly provider: string;
  readonly model: string;
  readonly contextLimit: number | undefined;
  readonly pricing: ModelPricing | undefined;
  readonly capabilities: ModelCapabilities;

  constructor(
    protected readonly inner: OpenAICompatibleProvider,
    providerName: string,
    pricing?: ModelPricing,
  ) {
    this.provider = providerName;
    this.model = inner.model;
    this.contextLimit = inner.contextLimit;
    this.pricing = pricing || inner.pricing;
    this.capabilities = inner.capabilities;
  }

  async generate(
    request: ModelRequest,
    signal?: AbortSignal,
  ): Promise<ModelResponse> {
    const res = await this.inner.generate(request, signal);
    return { ...res, provider: this.provider };
  }

  async *stream(
    request: ModelRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ModelStreamEvent> {
    yield* this.inner.stream(request, signal);
  }

  countTokens?(text: string): number;
}

class GoogleProviderAdapter extends ProviderAdapter {
  private readonly tokenizer = new GoogleTokenizer();

  constructor(
    inner: OpenAICompatibleProvider,
    pricing?: ModelPricing,
  ) {
    super(inner, 'google', pricing);
  }

  override countTokens(text: string): number {
    return this.tokenizer.count(text);
  }

  override async *stream(
    request: ModelRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ModelStreamEvent> {
    let inputTokens = 0;
    let outputTokens = 0;
    let lastTextContent = '';
    let hasUsage = false;

    for await (const event of this.inner.stream(request, signal)) {
      if (event.type === 'usage') {
        if (event.inputTokens > 0 || event.outputTokens > 0) {
          inputTokens = event.inputTokens;
          outputTokens = event.outputTokens;
          hasUsage = true;
        }
      }

      if (event.type === 'text') {
        lastTextContent += event.content;
      }

      yield event;
    }

    if (!hasUsage && (inputTokens === 0 && outputTokens === 0)) {
      const allMessages = request.messages || [];
      const promptText = allMessages.map((m: any) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      ).join('\n');

      inputTokens = this.tokenizer.count(promptText);
      outputTokens = lastTextContent ? this.tokenizer.count(lastTextContent) : 0;

      yield {
        type: 'usage',
        inputTokens,
        outputTokens,
      } as ModelStreamEvent;
    }
  }
}

class GoogleTokenizer {
  private readonly CHARS_PER_TOKEN = 4;

  count(text: string): number {
    if (!text) return 0;
    const charCount = text.length;
    const tokenEstimate = Math.ceil(charCount / this.CHARS_PER_TOKEN);
    return Math.max(1, tokenEstimate);
  }
}
