import { Injectable, Logger } from '@nestjs/common';
import { ProviderConfigService } from '@/modules/provider-config/services/provider-config.service';

/** Resolved endpoint for one embeddings provider. */
interface EmbeddingEndpoint {
  baseUrl: string;
  apiKey: string;
}

/**
 * P3.5: OpenAI-compatible embeddings client for the knowledge base. Reuses
 * the existing provider configs (baseUrl + resolved apiKey, incl. `env:VAR`
 * refs). Best-effort by design: every failure path returns null so callers
 * degrade to keyword search instead of breaking CRUD.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(private readonly providerConfigService: ProviderConfigService) {}

  private get model(): string {
    // gemini-embedding-001: text-embedding-004 was removed from the Google
    // OpenAI-compat endpoint (HTTP 404 as of 2026-10).
    return (process.env.KNOWLEDGE_EMBEDDING_MODEL || 'gemini-embedding-001').trim();
  }

  /**
   * Endpoint resolution: KNOWLEDGE_EMBEDDING_PROVIDER (if set) → that single
   * provider config; otherwise the default active provider; otherwise the
   * first active provider that has a resolved key (many installs never set
   * an explicit default).
   */
  private async resolveEndpoint(): Promise<EmbeddingEndpoint | null> {
    const wanted = (process.env.KNOWLEDGE_EMBEDDING_PROVIDER || '').trim();
    if (wanted) {
      const config = await this.providerConfigService.findSingleByProvider(wanted);
      return this.toEndpoint(config);
    }
    const defaultConfig = await this.providerConfigService.findDefault();
    const fromDefault = this.toEndpoint(defaultConfig);
    if (fromDefault) return fromDefault;
    const enabled = await this.providerConfigService.findEnabled();
    for (const config of enabled) {
      const endpoint = this.toEndpoint(config);
      if (endpoint) return endpoint;
    }
    return null;
  }

  private toEndpoint(
    config: {
      baseUrl?: string | null;
      hasApiKey?: boolean;
      apiKey?: string | null;
    } | null | undefined,
  ): EmbeddingEndpoint | null {
    if (!config || !config.hasApiKey || !config.apiKey) return null;
    const baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
    if (!baseUrl) return null;
    return { baseUrl, apiKey: config.apiKey };
  }

  /** Embed a batch of texts; null on any failure (network, auth, shape). */
  async embed(texts: string[]): Promise<number[][] | null> {
    if (texts.length === 0) return [];
    const endpoint = await this.resolveEndpoint();
    if (!endpoint) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${endpoint.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${endpoint.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Embeddings request failed: HTTP ${res.status}`);
        return null;
      }
      const json = (await res.json()) as {
        data?: Array<{ index: number; embedding: number[] }>;
      };
      const data = json.data;
      if (!Array.isArray(data) || data.length !== texts.length) {
        this.logger.warn('Embeddings response shape mismatch');
        return null;
      }
      return [...data]
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (error) {
      this.logger.warn(
        `Embeddings request error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Embed a single text; null on failure. */
  async embedOne(text: string): Promise<number[] | null> {
    const [vec] = (await this.embed([text])) ?? [];
    return vec ?? null;
  }
}
