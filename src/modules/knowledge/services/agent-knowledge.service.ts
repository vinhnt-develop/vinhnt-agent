import { Injectable, Logger } from '@nestjs/common';
import { LearningEngine } from '@vinhnt-sdk/knowledge';
import type { MemoryEntry } from '@vinhnt-sdk/schema';
import { SqliteMemoryStore } from '@/infrastructure/storage/sqlite-memory-store';
import { KnowledgeService } from './knowledge.service';

/** Owner of learned memory; `userId` turns facts into cross-session memory. */
export interface MemoryOwnerScope {
  userId?: string;
  appId?: string;
}

@Injectable()
export class AgentKnowledgeService {
  private readonly logger = new Logger(AgentKnowledgeService.name);
  private readonly engines = new Map<string, LearningEngine>();
  private readonly MAX_ENGINES = 100;
  private readonly ENGINE_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly lastAccess = new Map<string, number>();

  constructor(
    private readonly memoryStore: SqliteMemoryStore,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  /** Scope-aware cache key: memory must never be shared across users. */
  private engineKey(sessionId: string, scope?: MemoryOwnerScope): string {
    return `${scope?.userId ?? ''}|${scope?.appId ?? ''}|${sessionId}`;
  }

  private hasOwner(scope?: MemoryOwnerScope): scope is MemoryOwnerScope {
    return scope?.userId !== undefined || scope?.appId !== undefined;
  }

  /**
   * Get or create a LearningEngine for a session.
   * Uses LRU eviction with max size and TTL.
   */
  private getEngine(sessionId: string, scope?: MemoryOwnerScope): LearningEngine {
    const key = this.engineKey(sessionId, scope);
    this.lastAccess.set(key, Date.now());

    if (!this.engines.has(key)) {
      // Evict oldest if at capacity
      if (this.engines.size >= this.MAX_ENGINES) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, lastTime] of this.lastAccess) {
          if (lastTime < oldestTime) {
            oldestTime = lastTime;
            oldestKey = key;
          }
        }
        if (oldestKey) {
          this.engines.delete(oldestKey);
          this.lastAccess.delete(oldestKey);
          this.logger.debug(`Evicted LearningEngine for session ${oldestKey}`);
        }
      }

      const engine = new LearningEngine({
        config: {
          enabled: true,
          backgroundReview: true,
          memoryWriteApproval: false,
          skillWriteApproval: false,
          memoryCharLimit: 2200,
          userCharLimit: 1400,
        },
        sessionId,
        store: this.memoryStore,
        ...(this.hasOwner(scope) ? { scope } : {}),
      });
      this.engines.set(key, engine);
    }
    return this.engines.get(key)!;
  }

  /**
   * Build memory block for system prompt injection.
   * Combines SDK memory (working/session tiers) with knowledge base entries.
   * P4.5: when `includeIds` is provided (composer knowledge selection), only
   * those knowledge entries are included; SDK memory is always kept.
   */
  async buildMemoryBlock(
    sessionId: string,
    includeIds?: readonly string[],
    scope?: MemoryOwnerScope,
  ): Promise<MemoryEntry[]> {
    try {
      const engine = this.getEngine(sessionId, scope);
      const sdkMemory = engine.buildMemoryBlock();

      // Also fetch knowledge base entries
      let knowledgeEntries = await this.knowledgeService.findAll();
      if (includeIds && includeIds.length > 0) {
        const idSet = new Set(includeIds);
        knowledgeEntries = knowledgeEntries.filter((k) => idSet.has(String(k.id)));
      }
      const knowledgeMemory: MemoryEntry[] = knowledgeEntries
        .filter((k) => !k.deletedAt)
        .map((k) => ({
          key: k.key,
          value: k.value,
          tier: 'stable' as const,
          charLimit: 1400,
        }));

      return [...sdkMemory, ...knowledgeMemory];
    } catch (error) {
      this.logger.warn(`Failed to build memory block for session ${sessionId}`, error);
      return [];
    }
  }

  /**
   * Process a completed turn â€” extract facts and store in memory.
   */
  async processTurn(
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
    scope?: MemoryOwnerScope,
  ): Promise<{ extracted: number; staged: number }> {
    try {
      const engine = this.getEngine(sessionId, scope);
      const result = await engine.processTurn(messages);
      this.logger.debug(`Memory extracted: ${result.extracted}, staged: ${result.staged}`);
      return result;
    } catch (error) {
      this.logger.warn(`Failed to process turn for session ${sessionId}`, error);
      return { extracted: 0, staged: 0 };
    }
  }

  /**
   * Set a working memory fact for a session.
   */
  async setWorkingFact(
    sessionId: string,
    key: string,
    value: string,
    scope?: MemoryOwnerScope,
  ): Promise<void> {
    const engine = this.getEngine(sessionId, scope);
    await engine.setWorkingFact(key, value);
  }

  /**
   * Set profile (long-term identity) for a session.
   */
  async setProfile(sessionId: string, value: string, scope?: MemoryOwnerScope): Promise<void> {
    const engine = this.getEngine(sessionId, scope);
    await engine.setProfile(value);
  }

  /**
   * Clear working memory for a session.
   */
  clearWorking(sessionId: string, scope?: MemoryOwnerScope): void {
    const engine = this.getEngine(sessionId, scope);
    engine.clearWorking();
  }

  /**
   * Clean up engines for a session (e.g., on session delete).
   */
  dispose(sessionId: string): void {
    const suffix = `|${sessionId}`;
    for (const key of [...this.engines.keys()]) {
      if (key.endsWith(suffix)) {
        this.engines.delete(key);
        this.lastAccess.delete(key);
      }
    }
  }
}
