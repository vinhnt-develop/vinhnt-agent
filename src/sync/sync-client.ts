import type { AgentConfig } from '../config/index.js';
import { logger } from '../common/logger.js';

export interface SyncPushPayload {
  messages?: any[];
  memories?: any[];
  usage?: any[];
}

export interface SyncPullResponse {
  configs?: any[];
  knowledge?: any[];
  lastSyncAt?: string;
}

export class SyncClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(private config: AgentConfig) {
    this.baseUrl = config.sync.apiUrl;
    this.apiKey = config.sync.apiKey;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      h['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  async push(payload: SyncPushPayload): Promise<boolean> {
    if (!this.config.sync.enabled) return false;

    try {
      const res = await fetch(`${this.baseUrl}/sync/push`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        logger.warn(`Sync push failed: ${res.status} ${res.statusText}`);
        return false;
      }

      logger.debug('Sync push completed');
      return true;
    } catch (error) {
      logger.warn('Sync push failed:', error);
      return false;
    }
  }

  async pull(lastSyncAt?: string): Promise<SyncPullResponse | null> {
    if (!this.config.sync.enabled) return null;

    try {
      const url = new URL(`${this.baseUrl}/sync/pull`);
      if (lastSyncAt) {
        url.searchParams.set('lastSyncAt', lastSyncAt);
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        logger.warn(`Sync pull failed: ${res.status} ${res.statusText}`);
        return null;
      }

      return await res.json();
    } catch (error) {
      logger.warn('Sync pull failed:', error);
      return null;
    }
  }

  async getChanges(since: string): Promise<any[] | null> {
    if (!this.config.sync.enabled) return null;

    try {
      const url = new URL(`${this.baseUrl}/sync/changes`);
      url.searchParams.set('since', since);

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      logger.warn('Sync getChanges failed:', error);
      return null;
    }
  }

  async reportUsage(usage: {
    sessionId: string;
    inputTokens: number;
    outputTokens: number;
    model?: string;
    provider?: string;
    cost?: number;
  }): Promise<boolean> {
    if (!this.config.sync.enabled) return false;

    try {
      const res = await fetch(`${this.baseUrl}/agent/usage`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(usage),
        signal: AbortSignal.timeout(10_000),
      });

      return res.ok;
    } catch {
      return false;
    }
  }
}
