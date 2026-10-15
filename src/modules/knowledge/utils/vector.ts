/** Cosine similarity of two vectors; 0 for zero-length or mismatched dims. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Parse a stored embedding (JSON float array) → vector or null. */
export function parseEmbedding(stored: string | null | undefined): number[] | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (!parsed.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    return parsed as number[];
  } catch {
    return null;
  }
}
