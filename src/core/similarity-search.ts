// ============================================================
// Similarity Search Engine — Vector comparison and ranking
// ============================================================
import type { SearchResult, SearchConfig, DocumentMeta, StoredEmbedding } from '../types/index';
import { cosineSimilarity, normalizeVector } from '../utils/cosine-similarity';
import { getAllEmbeddings, getEmbeddingsByDocument, getDocument, getAllDocuments } from '../db/database';

/** Default search configuration */
const DEFAULT_CONFIG: SearchConfig = {
  maxResults: 20,
  minScore: 0.25,
  searchAllDocuments: true,
};

/**
 * Perform semantic similarity search against stored embeddings.
 *
 * Steps:
 * 1. Load candidate embeddings from IndexedDB
 * 2. Compute cosine similarity between query vector and each candidate
 * 3. Filter by minimum score threshold
 * 4. Sort by score descending
 * 5. Return top-K results with metadata
 */
export async function searchSimilar(
  queryVector: Float32Array,
  config: Partial<SearchConfig> = {}
): Promise<SearchResult[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = performance.now();

  // Normalize query vector
  const normalizedQuery = normalizeVector(queryVector);

  // Load embeddings based on search scope
  let embeddingRecords;
  if (cfg.searchAllDocuments) {
    embeddingRecords = await getAllEmbeddings();
  } else if (cfg.documentIds && cfg.documentIds.length > 0) {
    const allRecords = [];
    for (const docId of cfg.documentIds) {
      const records = await getEmbeddingsByDocument(docId);
      allRecords.push(...records);
    }
    embeddingRecords = allRecords;
  } else {
    embeddingRecords = await getAllEmbeddings();
  }

  if (embeddingRecords.length === 0) return [];

  // Compute similarities
  const scored: Array<{
    score: number;
    embedding: typeof embeddingRecords[0];
  }> = [];

  for (const record of embeddingRecords) {
    const candidateVector = new Float32Array(record.vector);
    const score = cosineSimilarity(normalizedQuery, normalizeVector(candidateVector));

    if (score >= cfg.minScore) {
      scored.push({ score, embedding: record });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top-K results
  const topResults = scored.slice(0, cfg.maxResults);

  // Fetch document metadata and build results
  const documentCache = new Map<string, DocumentMeta>();
  const results: SearchResult[] = [];

  for (const item of topResults) {
    const docId = item.embedding.documentId;

    // Cache document lookups
    if (!documentCache.has(docId)) {
      const doc = await getDocument(docId);
      if (doc) {
        documentCache.set(docId, {
          id: doc.id,
          title: doc.title,
          url: doc.url,
          sourceType: doc.sourceType as any,
          chunkCount: doc.chunkCount,
          indexedAt: doc.indexedAt,
          textLength: doc.textLength,
          contentHash: doc.contentHash,
        });
      }
    }

    const docMeta = documentCache.get(docId);
    if (!docMeta) continue;

    results.push({
      score: Math.round(item.score * 1000) / 1000,
      text: item.embedding.chunkText,
      preview: item.embedding.preview,
      document: docMeta,
      position: item.embedding.position,
      chunkId: item.embedding.id,
    });
  }

  const elapsed = performance.now() - startTime;
  console.log(`[SemanticSearch] Found ${results.length} results in ${elapsed.toFixed(1)}ms`);

  return results;
}

/**
 * Search within a specific document only.
 */
export async function searchInDocument(
  queryVector: Float32Array,
  documentId: string,
  config: Partial<SearchConfig> = {}
): Promise<SearchResult[]> {
  return searchSimilar(queryVector, {
    ...config,
    searchAllDocuments: false,
    documentIds: [documentId],
  });
}

/**
 * Get all indexed documents with their metadata.
 */
export async function getIndexedDocuments(): Promise<DocumentMeta[]> {
  const docs = await getAllDocuments();
  return docs.map(doc => ({
    id: doc.id,
    title: doc.title,
    url: doc.url,
    sourceType: doc.sourceType as any,
    chunkCount: doc.chunkCount,
    indexedAt: doc.indexedAt,
    textLength: doc.textLength,
    contentHash: doc.contentHash,
  }));
}

/**
 * Highlight matching text in search results.
 * Wraps relevant words in <mark> tags.
 */
export function highlightResult(text: string, query: string): string {
  if (!query || !text) return text;

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (queryWords.length === 0) return text;

  let highlighted = text;
  for (const word of queryWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  }

  return highlighted;
}
