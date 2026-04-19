// ============================================================
// IndexedDB Database Schema using Dexie.js
// ============================================================
import Dexie, { type Table } from 'dexie';

/** Raw DB record for a document */
export interface DocumentRecord {
  id: string;
  title: string;
  url: string;
  sourceType: string;
  chunkCount: number;
  indexedAt: number;
  textLength: number;
  contentHash: string;
}

/** Raw DB record for an embedding */
export interface EmbeddingRecord {
  id: string;
  documentId: string;
  vector: ArrayBuffer;
  position: number;
  preview: string;
  chunkText: string;
}

/**
 * SemanticSearchDB — the main Dexie database for the extension.
 * 
 * Tables:
 * - documents: Indexed document metadata
 * - embeddings: Vector embeddings for each text chunk
 */
export class SemanticSearchDB extends Dexie {
  documents!: Table<DocumentRecord, string>;
  embeddings!: Table<EmbeddingRecord, string>;

  constructor() {
    super('SemanticSearchDB');

    this.version(1).stores({
      documents: 'id, url, sourceType, indexedAt, contentHash',
      embeddings: 'id, documentId, position',
    });
  }
}

/** Singleton database instance */
export const db = new SemanticSearchDB();

// ============================================================
// Database Helper Functions
// ============================================================

/** Store a document record */
export async function storeDocument(doc: DocumentRecord): Promise<void> {
  await db.documents.put(doc);
}

/** Store an array of embedding records */
export async function storeEmbeddings(embeddings: EmbeddingRecord[]): Promise<void> {
  await db.embeddings.bulkPut(embeddings);
}

/** Get a document by ID */
export async function getDocument(id: string): Promise<DocumentRecord | undefined> {
  return db.documents.get(id);
}

/** Get a document by URL */
export async function getDocumentByUrl(url: string): Promise<DocumentRecord | undefined> {
  return db.documents.where('url').equals(url).first();
}

/** Get all stored documents */
export async function getAllDocuments(): Promise<DocumentRecord[]> {
  return db.documents.orderBy('indexedAt').reverse().toArray();
}

/** Get all embeddings for a specific document */
export async function getEmbeddingsByDocument(documentId: string): Promise<EmbeddingRecord[]> {
  return db.embeddings.where('documentId').equals(documentId).sortBy('position');
}

/** Get all embeddings across all documents */
export async function getAllEmbeddings(): Promise<EmbeddingRecord[]> {
  return db.embeddings.toArray();
}

/** Delete a document and its embeddings */
export async function deleteDocument(documentId: string): Promise<void> {
  await db.transaction('rw', db.documents, db.embeddings, async () => {
    await db.embeddings.where('documentId').equals(documentId).delete();
    await db.documents.delete(documentId);
  });
}

/** Clear the entire database */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.documents, db.embeddings, async () => {
    await db.documents.clear();
    await db.embeddings.clear();
  });
}

/** Check if a document exists and is up-to-date */
export async function isDocumentCurrent(url: string, contentHash: string): Promise<boolean> {
  const existing = await getDocumentByUrl(url);
  return existing !== undefined && existing.contentHash === contentHash;
}

/** Get total count of indexed documents */
export async function getDocumentCount(): Promise<number> {
  return db.documents.count();
}

/** Get total count of stored embeddings */
export async function getEmbeddingCount(): Promise<number> {
  return db.embeddings.count();
}
