import { Injectable, Logger } from '@nestjs/common';
import { LearningEngine } from '@vinhnt-sdk/knowledge';
import type { MemoryEntry } from '@vinhnt-sdk/schema';
import { SqliteMemoryStore } from '@/infrastructure/storage/sqlite-memory-store';
import { KnowledgeService } from './knowledge.service';

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

  /**
   * Get or create a LearningEngine for a session.
   * Uses LRU eviction with max size and TTL.
   */
  private getEngine(sessionId: string): LearningEngine {
    this.lastAccess.set(sessionId, Date.now());

    if (!this.engines.has(sessionId)) {
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
      });
      this.engines.set(sessionId, engine);
    }
    return this.engines.get(sessionId)!;
  }

  /**
   * Build memory block for system prompt injection.
   * Combines SDK memory (working/session tiers) with knowledge base entries.
   */
  async buildMemoryBlock(sessionId: string): Promise<MemoryEntry[]> {
    try {
      const engine = this.getEngine(sessionId);
      const sdkMemory = engine.buildMemoryBlock();

      // Also fetch knowledge base entries
      const knowledgeEntries = await this.knowledgeService.findAll();
      const knowledgeMemory: MemoryEntry[] = knowledgeEntries
        .filter((k) => !k.deletedAt)
        .map((k) => ({
          key: k.key,
          value: k.value,
          tier: 'stable' as const,
        }));

      return [...sdkMemory, ...knowledgeMemory];
    } catch (error) {
      this.logger.warn(`Failed to build memory block for session ${sessionId}`, error);
      return [];
    }
  }

  /**
   * Process a completed turn — extract facts and store in memory.
   */
  async processTurn(
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<{ extracted: number; staged: number }> {
    try {
      const engine = this.getEngine(sessionId);
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
  async setWorkingFact(sessionId: string, key: string, value: string): Promise<void> {
    const engine = this.getEngine(sessionId);
    await engine.setWorkingFact(key, value);
  }

  /**
   * Set profile (long-term identity) for a session.
   */
  async setProfile(sessionId: string, value: string): Promise<void> {
    const engine = this.getEngine(sessionId);
    await engine.setProfile(value);
  }

  /**
   * Clear working memory for a session.
   */
  clearWorking(sessionId: string): void {
    const engine = this.getEngine(sessionId);
    engine.clearWorking();
  }

  /**
   * Clean up engine for a session (e.g., on session delete).
   */
  dispose(sessionId: string): void {
    this.engines.delete(sessionId);
    this.lastAccess.delete(sessionId);
  }
}
