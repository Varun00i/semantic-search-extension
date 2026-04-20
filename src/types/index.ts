// ============================================================
// Type Definitions for Semantic Search Browser Extension
// ============================================================

/** Supported document source types */
export type SourceType = 'webpage' | 'pdf' | 'text-file' | 'local-file';

/** Status of model loading */
export type ModelStatus = 'not-loaded' | 'loading' | 'ready' | 'error';

/** Status of indexing operation */
export type IndexingStatus = 'idle' | 'extracting' | 'cleaning' | 'chunking' | 'embedding' | 'storing' | 'complete' | 'error';

/** A single text chunk extracted from a document */
export interface TextChunk {
  /** Unique chunk identifier */
  id: string;
  /** Parent document ID */
  documentId: string;
  /** The raw text content of the chunk */
  text: string;
  /** Position index within the document (0-based) */
  position: number;
  /** Start character offset in the original document */
  startOffset: number;
  /** End character offset in the original document */
  endOffset: number;
  /** Short preview of the chunk (first ~100 chars) */
  preview: string;
}

/** Metadata for an indexed document */
export interface DocumentMeta {
  /** Unique document identifier (hash of URL or file path) */
  id: string;
  /** Document title */
  title: string;
  /** Source URL or file path */
  url: string;
  /** Type of source */
  sourceType: SourceType;
  /** Total number of chunks */
  chunkCount: number;
  /** Timestamp when indexed (ms since epoch) */
  indexedAt: number;
  /** Size of the original text in characters */
  textLength: number;
  /** Hash of the content for cache invalidation */
  contentHash: string;
}

/** A stored vector embedding with metadata */
export interface StoredEmbedding {
  /** Unique ID (same as chunk ID) */
  id: string;
  /** Parent document ID */
  documentId: string;
  /** The embedding vector as Float32Array (stored as ArrayBuffer) */
  vector: Float32Array;
  /** Position of the chunk in the document */
  position: number;
  /** Short text preview */
  preview: string;
  /** The full chunk text */
  chunkText: string;
}

/** A single search result */
export interface SearchResult {
  /** Similarity score (0 to 1, higher is better) */
  score: number;
  /** The matched chunk text */
  text: string;
  /** Short preview */
  preview: string;
  /** Document metadata */
  document: DocumentMeta;
  /** Chunk position within document */
  position: number;
  /** Chunk ID */
  chunkId: string;
  /** Highlighted text (with <mark> tags) */
  highlightedText?: string;
}

/** Configuration for the search engine */
export interface SearchConfig {
  /** Maximum number of results to return */
  maxResults: number;
  /** Minimum similarity score threshold (0 to 1) */
  minScore: number;
  /** Whether to search across all indexed documents */
  searchAllDocuments: boolean;
  /** Specific document IDs to search within (if not searching all) */
  documentIds?: string[];
  /** Original query text for hybrid keyword scoring */
  queryText?: string;
}

/** Configuration for the embedding engine */
export interface EmbeddingConfig {
  /** Model identifier (e.g., 'Xenova/all-MiniLM-L6-v2') */
  modelId: string;
  /** Whether to use quantized model */
  quantized: boolean;
  /** Maximum sequence length for tokenization */
  maxSeqLength: number;
  /** Embedding dimension (e.g., 384 for MiniLM) */
  embeddingDimension: number;
}

/** Configuration for text chunking */
export interface ChunkingConfig {
  /** Target chunk size in characters */
  chunkSize: number;
  /** Overlap between consecutive chunks in characters */
  chunkOverlap: number;
  /** Minimum chunk size (discard smaller chunks) */
  minChunkSize: number;
}

/** Application-wide settings */
export interface AppSettings {
  embedding: EmbeddingConfig;
  chunking: ChunkingConfig;
  search: SearchConfig;
  /** Whether to auto-index pages on visit */
  autoIndex: boolean;
  /** Maximum number of documents to keep in cache */
  maxCachedDocuments: number;
  /** Whether dark mode is enabled */
  darkMode: boolean;
}

/** Default application settings */
export const DEFAULT_SETTINGS: AppSettings = {
  embedding: {
    modelId: 'Xenova/all-MiniLM-L6-v2',
    quantized: true,
    maxSeqLength: 256,
    embeddingDimension: 384,
  },
  chunking: {
    chunkSize: 300,
    chunkOverlap: 60,
    minChunkSize: 40,
  },
  search: {
    maxResults: 15,
    minScore: 0.3,
    searchAllDocuments: true,
  },
  autoIndex: false,
  maxCachedDocuments: 100,
  darkMode: true,
};

// ============================================================
// Message types for communication between extension components
// ============================================================

export type MessageType =
  | 'INDEX_PAGE'
  | 'INDEX_PDF'
  | 'INDEX_TEXT'
  | 'SEARCH_QUERY'
  | 'GET_STATUS'
  | 'GET_DOCUMENTS'
  | 'DELETE_DOCUMENT'
  | 'CLEAR_ALL'
  | 'EXTRACT_TEXT'
  | 'EXTRACT_TEXT_RESULT'
  | 'INDEXING_PROGRESS'
  | 'SEARCH_RESULTS'
  | 'MODEL_STATUS'
  | 'ERROR'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'NAVIGATE_TO_CHUNK';

/** Base message interface */
export interface BaseMessage {
  type: MessageType;
  payload?: unknown;
}

/** Request to index the current page */
export interface IndexPageMessage extends BaseMessage {
  type: 'INDEX_PAGE';
  payload: {
    url: string;
    title: string;
  };
}

/** Request to search */
export interface SearchQueryMessage extends BaseMessage {
  type: 'SEARCH_QUERY';
  payload: {
    query: string;
    config?: Partial<SearchConfig>;
  };
}

/** Extracted text from content script */
export interface ExtractTextResultMessage extends BaseMessage {
  type: 'EXTRACT_TEXT_RESULT';
  payload: {
    text: string;
    title: string;
    url: string;
    sourceType: SourceType;
  };
}

/** Indexing progress update */
export interface IndexingProgressMessage extends BaseMessage {
  type: 'INDEXING_PROGRESS';
  payload: {
    status: IndexingStatus;
    progress: number; // 0 to 1
    message: string;
    documentId?: string;
  };
}

/** Search results message */
export interface SearchResultsMessage extends BaseMessage {
  type: 'SEARCH_RESULTS';
  payload: {
    results: SearchResult[];
    query: string;
    searchTimeMs: number;
  };
}

/** Model status message */
export interface ModelStatusMessage extends BaseMessage {
  type: 'MODEL_STATUS';
  payload: {
    status: ModelStatus;
    progress?: number;
    message?: string;
  };
}

/** Error message */
export interface ErrorMessage extends BaseMessage {
  type: 'ERROR';
  payload: {
    message: string;
    code?: string;
  };
}

/** Navigate to a specific chunk in the page */
export interface NavigateToChunkMessage extends BaseMessage {
  type: 'NAVIGATE_TO_CHUNK';
  payload: {
    text: string;
    chunkId: string;
  };
}

/** Union of all message types */
export type ExtensionMessage =
  | IndexPageMessage
  | SearchQueryMessage
  | ExtractTextResultMessage
  | IndexingProgressMessage
  | SearchResultsMessage
  | ModelStatusMessage
  | ErrorMessage
  | NavigateToChunkMessage
  | BaseMessage;
