import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { KnowledgeRepository } from '../repositories/knowledge.repository';
import { EmbeddingService } from './embedding.service';
import { cosineSimilarity, parseEmbedding } from '../utils/vector';

/** P3.5: cap for semantic matches — knowledge bases are small by design. */
const SEARCH_TOP_K = 20;

type KnowledgeRow = Awaited<ReturnType<KnowledgeRepository['findAll']>>[number];

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  /** Ids currently queued for embedding — dedup concurrent searches. */
  private readonly embeddingInFlight = new Set<string>();

  constructor(
    private readonly knowledgeRepository: KnowledgeRepository,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async findAll() {
    return this.knowledgeRepository.findAll();
  }

  async findBySource(source: string) {
    return this.knowledgeRepository.findBySource(source);
  }

  async findById(id: string) {
    const entry = await this.knowledgeRepository.findById(id);
    if (!entry) {
      throw new NotFoundException('Knowledge entry not found');
    }
    return entry;
  }

  /**
   * P3.5: semantic (cosine over embeddings) with keyword fallback. Entries
   * without an embedding are matched by LIKE and queued for background
   * backfill so the corpus self-heals. Embedding failures never break
   * search — the endpoint degrades to pure keyword matching.
   */
  async search(query: string) {
    const q = query.trim();
    if (!q) return [];

    const queryVec = await this.embeddingService.embedOne(q);
    if (!queryVec) {
      return this.knowledgeRepository.search(q);
    }

    const entries = await this.knowledgeRepository.findAll();
    const missing: KnowledgeRow[] = [];
    const scored: Array<{ row: KnowledgeRow; score: number }> = [];
    for (const row of entries) {
      const vec = parseEmbedding(row.embedding);
      if (!vec) {
        missing.push(row);
        continue;
      }
      scored.push({ row, score: cosineSimilarity(queryVec, vec) });
    }
    scored.sort((a, b) => b.score - a.score);
    const semantic = scored.slice(0, SEARCH_TOP_K).map((s) => s.row);

    // Unembedded entries can't be scored — include keyword hits so nothing
    // disappears while backfill is pending.
    const semanticIds = new Set(semantic.map((r) => r.id));
    const needle = q.toLowerCase();
    const keywordOnly = missing
      .filter(
        (row) =>
          row.key.toLowerCase().includes(needle) ||
          row.value.toLowerCase().includes(needle),
      )
      .filter((row) => !semanticIds.has(row.id));

    for (const row of missing) this.scheduleBackfill(row);

    return [...semantic, ...keywordOnly];
  }

  async create(data: {
    key: string;
    value: string;
    source: string;
    sourceRef?: string;
    tier?: string;
    tags?: string[];
    isEditable?: boolean;
  }) {
    const existing = await this.knowledgeRepository.findByKeyAndSource(data.key, data.source);
    if (existing) {
      throw new ConflictException('Knowledge entry with this key and source already exists');
    }
    const entry = await this.knowledgeRepository.create(data);
    if (entry) this.embedAndStore(entry.id, entry.key, entry.value);
    return entry;
  }

  async update(id: string, data: {
    key?: string;
    value?: string;
    source?: string;
    sourceRef?: string;
    tier?: string;
    tags?: string[];
    isEditable?: boolean;
  }) {
    if (data.key && data.source) {
      const existing = await this.knowledgeRepository.findByKeyAndSource(data.key, data.source);
      if (existing && existing.id !== id) {
        throw new ConflictException('Knowledge entry with this key and source already exists');
      }
    }
    const entry = await this.knowledgeRepository.update(id, data);
    if (entry && (data.key !== undefined || data.value !== undefined)) {
      // Content changed — drop the stale vector, re-embed in the background.
      await this.knowledgeRepository.updateEmbedding(id, null, null);
      this.embedAndStore(id, entry.key, entry.value);
    }
    return entry;
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.knowledgeRepository.softDelete(id);
  }

  /** Text that gets embedded (and hashed) for an entry. */
  private embedText(key: string, value: string): string {
    return `${key}\n${value}`;
  }

  private contentHash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  /** Fire-and-forget: embed one entry and persist the vector + content hash. */
  private embedAndStore(id: string, key: string, value: string): void {
    const text = this.embedText(key, value);
    const hash = this.contentHash(text);
    void this.embeddingService
      .embedOne(text)
      .then(async (vec) => {
        if (!vec) return;
        await this.knowledgeRepository.updateEmbedding(id, JSON.stringify(vec), hash);
      })
      .catch((err) => {
        this.logger.warn(`Embed store failed for knowledge ${id}: ${err}`);
      });
  }

  /** Queue a background embed for an entry that has no vector yet. */
  private scheduleBackfill(row: KnowledgeRow): void {
    if (this.embeddingInFlight.has(row.id)) return;
    this.embeddingInFlight.add(row.id);
    setTimeout(() => {
      this.embeddingInFlight.delete(row.id);
      this.embedAndStore(row.id, row.key, row.value);
    }, 0);
  }
}
