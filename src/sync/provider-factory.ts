import type { AgentConfig } from '../config/index.js';
import { logger } from '../common/logger.js';

export interface ProviderConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

export class ProviderFactory {
  private providers = new Map<string, any>();

  constructor(private config: AgentConfig) {}

  getModelProvider(overrides?: {
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    modelId?: string;
  }): any {
    const providerName = overrides?.provider || this.config.model.provider;
    const baseUrl = overrides?.baseUrl || this.config.model.baseUrl;
    const apiKey = overrides?.apiKey || this.config.model.apiKey;
    const modelId = overrides?.modelId || this.config.model.modelId;

    const cacheKey = `${providerName}|${baseUrl}|${modelId}`;

    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey);
    }

    const { OpenAICompatibleProvider } = require('@vinhnt-sdk/provider-openai-compatible');

    const provider = new OpenAICompatibleProvider({
      name: providerName,
      baseUrl,
      apiKey,
      model: modelId,
    });

    this.providers.set(cacheKey, provider);
    logger.info(
      `Created provider: ${providerName} (${baseUrl}) model=${modelId || 'auto'}`,
    );

    return provider;
  }
}
