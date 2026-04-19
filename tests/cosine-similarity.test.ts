import {
  cosineSimilarity,
  batchCosineSimilarity,
  normalizeVector,
  dotProduct,
} from '../src/utils/cosine-similarity';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = new Float32Array([1, 2, 3, 4]);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0, 0]);
    const b = new Float32Array([0, 1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = new Float32Array([1, 0, 0, 0]);
    const b = new Float32Array([-1, 0, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('handles arbitrary vectors correctly', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    // Manual: dot=32, magA=sqrt(14), magB=sqrt(77)
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 5);
  });

  it('returns 0 for zero vectors', () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('handles large vectors (384 dimensions)', () => {
    const a = new Float32Array(384);
    const b = new Float32Array(384);
    for (let i = 0; i < 384; i++) {
      a[i] = Math.random() - 0.5;
      b[i] = Math.random() - 0.5;
    }
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThanOrEqual(-1);
    expect(sim).toBeLessThanOrEqual(1);
  });
});

describe('batchCosineSimilarity', () => {
  it('computes similarities against multiple vectors', () => {
    const query = new Float32Array([1, 0, 0]);
    const vectors = [
      new Float32Array([1, 0, 0]),
      new Float32Array([0, 1, 0]),
      new Float32Array([-1, 0, 0]),
    ];
    const results = batchCosineSimilarity(query, vectors);
    expect(results).toHaveLength(3);
    expect(results[0]).toBeCloseTo(1, 5);
    expect(results[1]).toBeCloseTo(0, 5);
    expect(results[2]).toBeCloseTo(-1, 5);
  });
});

describe('normalizeVector', () => {
  it('normalizes a vector to unit length', () => {
    const v = new Float32Array([3, 4]);
    const norm = normalizeVector(v);
    expect(norm[0]).toBeCloseTo(0.6, 5);
    expect(norm[1]).toBeCloseTo(0.8, 5);
  });

  it('returns zero vector for zero input', () => {
    const v = new Float32Array([0, 0, 0]);
    const norm = normalizeVector(v);
    expect(norm[0]).toBe(0);
    expect(norm[1]).toBe(0);
    expect(norm[2]).toBe(0);
  });
});

describe('dotProduct', () => {
  it('computes dot product correctly', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    expect(dotProduct(a, b)).toBeCloseTo(32, 5);
  });
});
