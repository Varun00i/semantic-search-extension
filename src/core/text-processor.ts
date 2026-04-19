// ============================================================
// Text Processor — Orchestrates text extraction, cleaning, and chunking
// ============================================================
import type { TextChunk, ChunkingConfig, SourceType } from '../types/index';
import { cleanHtmlText } from '../utils/html-cleaner';
import { chunkText, deduplicateChunks } from '../utils/text-chunker';

/**
 * Process raw content into clean text chunks ready for embedding.
 *
 * Pipeline:
 * 1. Clean the text (remove HTML, normalize whitespace)
 * 2. Split into chunks (sentence-aware chunking with overlap)
 * 3. Deduplicate chunks
 * 4. Return array of TextChunk objects
 */
export function processText(
  rawContent: string,
  documentId: string,
  sourceType: SourceType,
  config: Partial<ChunkingConfig> = {}
): TextChunk[] {
  // Step 1: Clean text based on source type
  let cleanedText: string;

  switch (sourceType) {
    case 'webpage':
      cleanedText = cleanHtmlText(rawContent);
      break;
    case 'pdf':
      cleanedText = cleanPdfText(rawContent);
      break;
    case 'text-file':
    case 'local-file':
      cleanedText = cleanPlainText(rawContent);
      break;
    default:
      cleanedText = cleanPlainText(rawContent);
  }

  // Step 2: Validate cleaned text
  if (!cleanedText || cleanedText.trim().length < 10) {
    return [];
  }

  // Step 3: Chunk the text
  const chunks = chunkText(cleanedText, documentId, config);

  // Step 4: Deduplicate
  const uniqueChunks = deduplicateChunks(chunks);

  return uniqueChunks;
}

/**
 * Clean PDF-extracted text.
 * PDF text often has broken lines, hyphenation, and extra whitespace.
 */
function cleanPdfText(text: string): string {
  let cleaned = text;

  // Remove page headers/footers (common patterns)
  cleaned = cleaned.replace(/^Page \d+ of \d+$/gm, '');
  cleaned = cleaned.replace(/^\d+$/gm, ''); // standalone page numbers

  // Fix hyphenation at line breaks
  cleaned = cleaned.replace(/(\w)-\n(\w)/g, '$1$2');

  // Join lines that don't end with sentence-ending punctuation
  cleaned = cleaned.replace(/([^.!?\n])\n([a-z])/g, '$1 $2');

  // Normalize whitespace
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Clean plain text content.
 */
function cleanPlainText(text: string): string {
  let cleaned = text;

  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\r/g, '\n');

  // Normalize whitespace
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Get statistics about the processed text.
 */
export function getTextStats(text: string): {
  charCount: number;
  wordCount: number;
  sentenceCount: number;
  estimatedTokens: number;
} {
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const sentenceCount = (text.match(/[.!?]+/g) || []).length || 1;
  const estimatedTokens = Math.ceil(charCount / 4);

  return { charCount, wordCount, sentenceCount, estimatedTokens };
}
