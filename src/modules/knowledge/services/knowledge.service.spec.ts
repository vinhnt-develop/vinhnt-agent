import { KnowledgeService } from './knowledge.service';
import { cosineSimilarity, parseEmbedding } from '../utils/vector';

describe('vector utils', () => {
  it('cosine: identical vectors → 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it('cosine: orthogonal → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('cosine: zero vector or dim mismatch → 0', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });

  it('parseEmbedding: valid JSON array → vector', () => {
    expect(parseEmbedding('[0.5,0.25]')).toEqual([0.5, 0.25]);
  });

  it('parseEmbedding: garbage/null/empty → null', () => {
    expect(parseEmbedding(null)).toBeNull();
    expect(parseEmbedding('not-json')).toBeNull();
    expect(parseEmbedding('[]')).toBeNull();
    expect(parseEmbedding('[1,"x"]')).toBeNull();
  });
});

describe('KnowledgeService.search (P3.5)', () => {
  const row = (id: string, key: string, value: string, embedding: string | null) => ({
    id,
    key,
    value,
    source: 'user',
    tier: 'stable',
    tags: [],
    embedding,
    contentHash: null,
    filePath: null,
    isEditable: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    sourceRef: null,
  });

  function makeService(opts: {
    entries: ReturnType<typeof row>[];
    queryVec: number[] | null;
    keywordRows?: ReturnType<typeof row>[];
  }) {
    const repository = {
      findAll: jest.fn().mockResolvedValue(opts.entries),
      search: jest
        .fn()
        .mockResolvedValue(opts.keywordRows ?? []),
      create: jest.fn(),
      update: jest.fn(),
      findByKeyAndSource: jest.fn().mockResolvedValue(null),
      updateEmbedding: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      softDelete: jest.fn(),
    };
    const embedding = {
      embedOne: jest.fn().mockResolvedValue(opts.queryVec),
    };
    const service = new KnowledgeService(
      repository as never,
      embedding as never,
    );
    return { service, repository, embedding };
  }

  it('ranks entries by cosine similarity (semantic-first)', async () => {
    // query [1,0]; e1 aligned (score 1), e2 orthogonal (0)
    const { service } = makeService({
      entries: [
        row('e1', 'alpha', 'about apples', '[1,0]'),
        row('e2', 'beta', 'about boats', '[0,1]'),
      ],
      queryVec: [1, 0],
    });
    const result = await service.search('apples');
    expect(result.map((r) => r.id)).toEqual(['e1', 'e2']);
  });

  it('falls back to keyword search when the embedder is unavailable', async () => {
    const kw = [row('k1', 'deploy', 'how to deploy', null)];
    const { service, repository } = makeService({
      entries: [],
      queryVec: null,
      keywordRows: kw,
    });
    const result = await service.search('deploy');
    expect(repository.search).toHaveBeenCalledWith('deploy');
    expect(result).toEqual(kw);
  });

  it('merges keyword hits for not-yet-embedded entries after semantic hits', async () => {
    const { service } = makeService({
      entries: [
        row('e1', 'sem', 'vector entry', '[1,0]'),
        row('m1', 'needle in value', 'raw text haystack', null),
        row('m2', 'other', 'unrelated', null),
      ],
      queryVec: [1, 0],
    });
    const result = await service.search('needle');
    expect(result.map((r) => r.id)).toEqual(['e1', 'm1']);
  });

  it('queues background backfill for entries without embeddings', async () => {
    jest.useFakeTimers();
    const { service, repository } = makeService({
      entries: [row('m1', 'k', 'v', null)],
      queryVec: [1, 0],
    });
    await service.search('q');
    expect(repository.updateEmbedding).not.toHaveBeenCalled();
    jest.runAllTimers();
    // embedAndStore fires embedOne for the entry text; our mock always
    // resolves the query vector, so updateEmbedding gets the JSON vector.
    await Promise.resolve();
    await Promise.resolve();
    expect(repository.updateEmbedding).toHaveBeenCalledWith(
      'm1',
      JSON.stringify([1, 0]),
      expect.any(String),
    );
    jest.useRealTimers();
  });

  it('create embeds the new entry in the background', async () => {
    jest.useFakeTimers();
    const created = row('n1', 'new', 'fresh content', null);
    const { service, repository, embedding } = makeService({
      entries: [],
      queryVec: [1, 0],
    });
    (repository.create as jest.Mock).mockResolvedValue(created);
    await service.create({
      key: 'new',
      value: 'fresh content',
      source: 'user',
    });
    jest.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();
    expect(embedding.embedOne).toHaveBeenCalledWith('new\nfresh content');
    expect(repository.updateEmbedding).toHaveBeenCalledWith(
      'n1',
      JSON.stringify([1, 0]),
      expect.any(String),
    );
    jest.useRealTimers();
  });

  it('update clears the stale vector and re-embeds on content change', async () => {
    jest.useFakeTimers();
    const existing = row('u1', 'k', 'old', '[9,9]');
    const updated = { ...existing, value: 'new' };
    const { service, repository, embedding } = makeService({
      entries: [],
      queryVec: [1, 0],
    });
    (repository.findById as jest.Mock).mockResolvedValue(existing);
    (repository.update as jest.Mock).mockResolvedValue(updated);
    await service.update('u1', { value: 'new' });
    expect(repository.updateEmbedding).toHaveBeenCalledWith('u1', null, null);
    jest.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();
    expect(embedding.embedOne).toHaveBeenCalledWith('k\nnew');
    jest.useRealTimers();
  });
});
