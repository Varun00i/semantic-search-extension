// ============================================================
// Cache Manager — Manages document caching and invalidation
// ============================================================
import type { DocumentMeta, AppSettings, DEFAULT_SETTINGS } from '../types/index';
import {
  getDocumentByUrl,
  getAllDocuments,
  deleteDocument,
  getDocumentCount,
  isDocumentCurrent,
} from '../db/database';

/**
 * Check if a URL has already been indexed and the content hasn't changed.
 * Returns the existing document if it's still current, null otherwise.
 */
export async function checkCache(url: string, contentHash: string): Promise<DocumentMeta | null> {
  const isCurrent = await isDocumentCurrent(url, contentHash);
  if (isCurrent) {
    const doc = await getDocumentByUrl(url);
    if (doc) {
      return {
        id: doc.id,
        title: doc.title,
        url: doc.url,
        sourceType: doc.sourceType as any,
        chunkCount: doc.chunkCount,
        indexedAt: doc.indexedAt,
        textLength: doc.textLength,
        contentHash: doc.contentHash,
      };
    }
  }
  return null;
}

/**
 * Invalidate (delete) cached data for a specific URL.
 * Used when content has changed and needs re-indexing.
 */
export async function invalidateCache(url: string): Promise<void> {
  const doc = await getDocumentByUrl(url);
  if (doc) {
    await deleteDocument(doc.id);
  }
}

/**
 * Enforce cache limits by removing oldest documents when limit is exceeded.
 * Keeps the most recently indexed documents.
 */
export async function enforceCacheLimit(maxDocuments: number): Promise<number> {
  const count = await getDocumentCount();
  if (count <= maxDocuments) return 0;

  const documents = await getAllDocuments();
  // Documents are already sorted by indexedAt descending
  const toRemove = documents.slice(maxDocuments);

  let removed = 0;
  for (const doc of toRemove) {
    await deleteDocument(doc.id);
    removed++;
  }

  console.log(`[CacheManager] Removed ${removed} old documents to enforce limit of ${maxDocuments}`);
  return removed;
}

/**
 * Get cache statistics.
 */
export async function getCacheStats(): Promise<{
  documentCount: number;
  oldestIndexedAt: number | null;
  newestIndexedAt: number | null;
  totalChunks: number;
}> {
  const documents = await getAllDocuments();
  const documentCount = documents.length;

  if (documentCount === 0) {
    return {
      documentCount: 0,
      oldestIndexedAt: null,
      newestIndexedAt: null,
      totalChunks: 0,
    };
  }

  const timestamps = documents.map(d => d.indexedAt);
  const totalChunks = documents.reduce((sum, d) => sum + d.chunkCount, 0);

  return {
    documentCount,
    oldestIndexedAt: Math.min(...timestamps),
    newestIndexedAt: Math.max(...timestamps),
    totalChunks,
  };
}
