// ============================================================
// Cosine Similarity — Fast vector comparison utilities
// ============================================================

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite).
 *
 * Optimized for Float32Array with loop unrolling for performance.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  const len = a.length;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Process 4 elements at a time for performance
  const limit = len - (len % 4);
  let i = 0;

  for (; i < limit; i += 4) {
    const a0 = a[i], a1 = a[i + 1], a2 = a[i + 2], a3 = a[i + 3];
    const b0 = b[i], b1 = b[i + 1], b2 = b[i + 2], b3 = b[i + 3];

    dotProduct += a0 * b0 + a1 * b1 + a2 * b2 + a3 * b3;
    normA += a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
    normB += b0 * b0 + b1 * b1 + b2 * b2 + b3 * b3;
  }

  // Handle remaining elements
  for (; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Compute cosine similarities between a query vector and an array of candidate vectors.
 * Returns an array of { index, score } sorted by score descending.
 */
export function batchCosineSimilarity(
  query: Float32Array,
  candidates: Float32Array[],
  topK: number = 10,
  minScore: number = 0
): Array<{ index: number; score: number }> {
  const results: Array<{ index: number; score: number }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const score = cosineSimilarity(query, candidates[i]);
    if (score >= minScore) {
      results.push({ index: i, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Return top K
  return results.slice(0, topK);
}

/**
 * Normalize a vector to unit length (L2 normalization).
 * Returns a new Float32Array.
 */
export function normalizeVector(vec: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);

  if (norm === 0) return new Float32Array(vec.length);

  const result = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    result[i] = vec[i] / norm;
  }
  return result;
}

/**
 * Compute dot product of two vectors.
 * If both vectors are normalized, this equals cosine similarity.
 */
export function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
