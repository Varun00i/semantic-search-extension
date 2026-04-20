// ============================================================
// Similarity Search Engine — Vector comparison and ranking
// ============================================================
import type { SearchResult, SearchConfig, DocumentMeta, StoredEmbedding } from '../types/index';
import { cosineSimilarity, normalizeVector } from '../utils/cosine-similarity';
import { getAllEmbeddings, getEmbeddingsByDocument, getDocument, getAllDocuments } from '../db/database';

/** Default search configuration */
const DEFAULT_CONFIG: SearchConfig = {
  maxResults: 15,
  minScore: 0.3,
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

  // Extract query text for keyword boosting
  const queryText = cfg.queryText || '';
  const stopwords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','then','once','and','but','or','nor','not','so','very','just','about','how','what','which','who','whom','this','that','these','those','it','its','also','such','than','too','only','same','other','each','every','both','few','more','most','some','any','all','many','much','own','here','there','when','where','why','because','since','while','although','though','whether','until','unless','if']);

  // Extract meaningful query terms and bigrams
  const queryLower = queryText.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter((w: string) => w.length > 0);
  const queryTerms = queryWords.filter((w: string) => w.length > 2 && !stopwords.has(w));

  // Build bigrams from query for phrase matching
  const queryBigrams: string[] = [];
  for (let i = 0; i < queryWords.length - 1; i++) {
    queryBigrams.push(queryWords[i] + ' ' + queryWords[i + 1]);
  }

  // Compute similarities with hybrid scoring
  const scored: Array<{
    score: number;
    semanticScore: number;
    keywordScore: number;
    embedding: typeof embeddingRecords[0];
  }> = [];

  for (const record of embeddingRecords) {
    const candidateVector = new Float32Array(record.vector);
    const semanticScore = cosineSimilarity(normalizedQuery, normalizeVector(candidateVector));

    let keywordScore = 0;

    if (queryTerms.length > 0 && record.chunkText) {
      const chunkLower = record.chunkText.toLowerCase();
      const chunkLen = record.chunkText.length;

      // BM25-inspired term frequency scoring with saturation
      const k1 = 1.5;
      const avgChunkLen = 300;
      const bParam = 0.75;
      const lengthNorm = 1 - bParam + bParam * (chunkLen / avgChunkLen);

      let termScore = 0;
      let matchedTerms = 0;
      for (const term of queryTerms) {
        let tf = 0;
        let searchFrom = 0;
        while (true) {
          const idx = chunkLower.indexOf(term, searchFrom);
          if (idx === -1) break;
          tf++;
          searchFrom = idx + term.length;
        }
        if (tf > 0) {
          matchedTerms++;
          // BM25 TF saturation: diminishing returns for high-frequency terms
          termScore += (tf * (k1 + 1)) / (tf + k1 * lengthNorm) / queryTerms.length;
        }
      }

      // Term coverage boost: reward matching more distinct query terms
      const coverageBoost = matchedTerms > 1 ? (matchedTerms / queryTerms.length) * 0.1 : 0;

      // Exact phrase match bonus
      let phraseBonus = 0;
      if (queryLower.length > 5 && chunkLower.includes(queryLower)) {
        phraseBonus = 0.3; // Strong bonus for exact full query match
      } else {
        // Bigram matches (ordered word pairs from query)
        let bigramMatches = 0;
        for (const bg of queryBigrams) {
          if (chunkLower.includes(bg)) bigramMatches++;
        }
        if (queryBigrams.length > 0) {
          phraseBonus = (bigramMatches / queryBigrams.length) * 0.2;
        }
      }

      // Chunk length penalty: penalize very short chunks
      const lengthFactor = Math.min(1, chunkLen / 80);

      keywordScore = (termScore * 0.25 + phraseBonus + coverageBoost) * lengthFactor;

      // Position boost: early chunks often contain titles/introductions
      if (record.position <= 1) keywordScore = Math.min(keywordScore * 1.15, 0.4);
    }

    const combinedScore = Math.min(1, semanticScore + keywordScore);

    if (combinedScore >= cfg.minScore) {
      scored.push({
        score: combinedScore,
        semanticScore,
        keywordScore,
        embedding: record,
      });
    }
  }

  // Sort by combined score descending
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate results aggressively
  const deduped: typeof scored = [];
  for (const item of scored) {
    const isDuplicate = deduped.some(existing => {
      // Same document, adjacent or overlapping chunks (within 2 positions)
      if (existing.embedding.documentId === item.embedding.documentId &&
          Math.abs(existing.embedding.position - item.embedding.position) <= 2) {
        return true;
      }
      // Same document, similar text content (check first 80 chars)
      if (existing.embedding.documentId === item.embedding.documentId &&
          existing.embedding.chunkText && item.embedding.chunkText) {
        const a = existing.embedding.chunkText.substring(0, 80).toLowerCase();
        const b = item.embedding.chunkText.substring(0, 80).toLowerCase();
        if (a === b) return true;
        // Check word-level Jaccard similarity
        const wordsA = new Set(a.split(/\s+/));
        const wordsB = new Set(b.split(/\s+/));
        let intersection = 0;
        for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
        const union = wordsA.size + wordsB.size - intersection;
        if (union > 0 && intersection / union > 0.6) return true;
      }
      return false;
    });
    if (!isDuplicate) deduped.push(item);
  }

  // Take top-K results
  const topResults = deduped.slice(0, cfg.maxResults);

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

  // Split query into meaningful words, remove stopwords
  const stopwords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','ought','used','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','and','but','or','nor','not','so','very','just','about','how','what','which','who','whom','this','that','these','those','it','its']);
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));

  if (queryWords.length === 0) return text;

  // Build a single regex for all words (more efficient)
  const escaped = queryWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}
