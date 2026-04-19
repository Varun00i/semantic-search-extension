// ============================================================
// Controller — Main orchestrator for indexing and search operations
// ============================================================
import type {
  AppSettings,
  DEFAULT_SETTINGS,
  SearchResult,
  SearchConfig,
  IndexingStatus,
  DocumentMeta,
  SourceType,
  TextChunk,
} from '../types/index';
import { processText, getTextStats } from './text-processor';
import { initializeModel, generateEmbedding, generateEmbeddings, getModelStatus, unloadModel } from './embedding-engine';
import { searchSimilar, highlightResult, getIndexedDocuments } from './similarity-search';
import { checkCache, invalidateCache, enforceCacheLimit, getCacheStats } from './cache-manager';
import { storeDocument, storeEmbeddings, deleteDocument, clearAllData } from '../db/database';
import { hashContent } from '../utils/html-cleaner';

/** Current indexing status */
let currentIndexingStatus: IndexingStatus = 'idle';
let currentProgress = 0;
let currentMessage = '';

// Status change callback
type StatusCallback = (status: IndexingStatus, progress: number, message: string) => void;
let statusCallback: StatusCallback | null = null;

/**
 * Set a callback to receive indexing status updates.
 */
export function onStatusChange(callback: StatusCallback): void {
  statusCallback = callback;
}

function updateStatus(status: IndexingStatus, progress: number, message: string) {
  currentIndexingStatus = status;
  currentProgress = progress;
  currentMessage = message;
  statusCallback?.(status, progress, message);
}

/**
 * Initialize the system — loads the AI model.
 */
export async function initialize(
  onProgress?: (progress: number, message: string) => void
): Promise<void> {
  await initializeModel({}, (progress, message) => {
    onProgress?.(progress, message);
  });
}

/**
 * Index a document (webpage, PDF, or text file).
 *
 * Full pipeline:
 * 1. Check cache — skip if already indexed and unchanged
 * 2. Clean and chunk the text
 * 3. Generate embeddings for each chunk
 * 4. Store embeddings and metadata in IndexedDB
 * 5. Enforce cache limits
 */
export async function indexDocument(
  content: string,
  title: string,
  url: string,
  sourceType: SourceType,
  settings?: Partial<AppSettings>
): Promise<DocumentMeta> {
  console.log('[Controller] indexDocument called:', { title, url, sourceType, contentLength: content.length });
  try {
    // Ensure model is loaded
    const { status } = getModelStatus();
    if (status !== 'ready') {
      updateStatus('embedding', 0, 'Loading AI model...');
      await initializeModel({}, (p, m) => updateStatus('embedding', p * 0.1, m));
    }

    // Step 1: Generate content hash and check cache
    updateStatus('extracting', 0.05, 'Checking cache...');
    const contentHash = await hashContent(content);
    const cached = await checkCache(url, contentHash);

    if (cached) {
      updateStatus('complete', 1, 'Document already indexed (from cache)');
      return cached;
    }

    // Invalidate old version if exists
    await invalidateCache(url);

    // Step 2: Process text — clean and chunk
    updateStatus('cleaning', 0.1, 'Cleaning and processing text...');
    const chunkingConfig = settings?.chunking;
    const chunks = processText(content, '', sourceType, chunkingConfig);

    if (chunks.length === 0) {
      updateStatus('error', 0, 'No meaningful text found in document');
      throw new Error('No meaningful text could be extracted from the document');
    }

    // Generate document ID from URL hash
    const documentId = await hashContent(url + title);

    // Update chunk IDs with the real document ID
    const updatedChunks: TextChunk[] = chunks.map((chunk, i) => ({
      ...chunk,
      id: `${documentId}_chunk_${i}`,
      documentId,
    }));

    updateStatus('chunking', 0.2, `Split into ${updatedChunks.length} chunks`);

    // Step 3: Generate embeddings
    updateStatus('embedding', 0.25, 'Generating embeddings...');
    const chunkTexts = updatedChunks.map(c => c.text);
    const vectors = await generateEmbeddings(chunkTexts, (completed, total) => {
      const embProgress = 0.25 + (completed / total) * 0.55;
      updateStatus('embedding', embProgress, `Embedding chunk ${completed}/${total}...`);
    });

    // Step 4: Store in IndexedDB
    updateStatus('storing', 0.85, 'Saving to local database...');
    const stats = getTextStats(content);

    const docRecord = {
      id: documentId,
      title,
      url,
      sourceType,
      chunkCount: updatedChunks.length,
      indexedAt: Date.now(),
      textLength: stats.charCount,
      contentHash,
    };
    await storeDocument(docRecord);

    const embeddingRecords = updatedChunks.map((chunk, i) => ({
      id: chunk.id,
      documentId,
      vector: vectors[i].buffer as ArrayBuffer,
      position: chunk.position,
      preview: chunk.preview,
      chunkText: chunk.text,
    }));
    await storeEmbeddings(embeddingRecords);

    // Step 5: Enforce cache limits
    const maxDocs = settings?.maxCachedDocuments ?? 100;
    await enforceCacheLimit(maxDocs);

    const meta: DocumentMeta = {
      id: documentId,
      title,
      url,
      sourceType,
      chunkCount: updatedChunks.length,
      indexedAt: docRecord.indexedAt,
      textLength: stats.charCount,
      contentHash,
    };

    updateStatus('complete', 1, `Indexed "${title}" — ${updatedChunks.length} chunks`);
    console.log('[Controller] indexDocument complete:', meta);
    return meta;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Indexing failed';
    updateStatus('error', 0, msg);
    throw error;
  }
}

/**
 * Perform a semantic search.
 *
 * 1. Embed the query
 * 2. Search stored vectors for similarity
 * 3. Highlight results
 * 4. Return ranked results
 */
export async function search(
  query: string,
  config?: Partial<SearchConfig>
): Promise<{ results: SearchResult[]; searchTimeMs: number }> {
  const startTime = performance.now();

  // Ensure model is loaded
  const { status } = getModelStatus();
  if (status !== 'ready') {
    await initializeModel();
  }

  // Generate query embedding
  const queryVector = await generateEmbedding(query);

  // Search for similar embeddings
  const results = await searchSimilar(queryVector, config);

  // Highlight results
  const highlighted = results.map(r => ({
    ...r,
    highlightedText: highlightResult(r.text, query),
  }));

  const searchTimeMs = Math.round(performance.now() - startTime);
  return { results: highlighted, searchTimeMs };
}

/**
 * Get all indexed documents.
 */
export async function getDocuments(): Promise<DocumentMeta[]> {
  const docs = await getIndexedDocuments();
  console.log('[Controller] getDocuments:', docs.length, 'documents');
  return docs;
}

/**
 * Delete a specific document and its embeddings.
 */
export async function removeDocument(documentId: string): Promise<void> {
  await deleteDocument(documentId);
}

/**
 * Clear all indexed data.
 */
export async function clearAll(): Promise<void> {
  await clearAllData();
}

/**
 * Get current system status.
 */
export function getStatus(): {
  modelStatus: ReturnType<typeof getModelStatus>;
  indexingStatus: IndexingStatus;
  indexingProgress: number;
  indexingMessage: string;
} {
  return {
    modelStatus: getModelStatus(),
    indexingStatus: currentIndexingStatus,
    indexingProgress: currentProgress,
    indexingMessage: currentMessage,
  };
}

/**
 * Get cache statistics.
 */
export async function getStats() {
  return getCacheStats();
}
