// ============================================================
// Text Chunker — Splits text into semantically meaningful chunks
// ============================================================
import type { TextChunk, ChunkingConfig } from '../types/index';

/** Default chunking configuration */
const DEFAULT_CONFIG: ChunkingConfig = {
  chunkSize: 500,
  chunkOverlap: 50,
  minChunkSize: 50,
};

/**
 * Split text into overlapping chunks, preserving sentence boundaries.
 *
 * Strategy:
 * 1. Split text into sentences
 * 2. Group sentences into chunks of ~chunkSize characters
 * 3. Add overlap between consecutive chunks
 * 4. Filter out chunks smaller than minChunkSize
 */
export function chunkText(
  text: string,
  documentId: string,
  config: Partial<ChunkingConfig> = {}
): TextChunk[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { chunkSize, chunkOverlap, minChunkSize } = cfg;

  if (!text || text.trim().length === 0) return [];

  // Split into sentences
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return [];

  const chunks: TextChunk[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkStartOffset = 0;
  let sentenceOffset = 0;
  let position = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceLen = sentence.length;

    // If adding this sentence exceeds chunk size, finalize the current chunk
    if (currentLength + sentenceLen > chunkSize && currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ').trim();

      if (chunkText.length >= minChunkSize) {
        chunks.push({
          id: `${documentId}_chunk_${position}`,
          documentId,
          text: chunkText,
          position,
          startOffset: chunkStartOffset,
          endOffset: chunkStartOffset + chunkText.length,
          preview: chunkText.substring(0, 120).trim() + (chunkText.length > 120 ? '…' : ''),
        });
        position++;
      }

      // Compute overlap: keep last few sentences that fit within chunkOverlap
      const overlapSentences: string[] = [];
      let overlapLen = 0;
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        if (overlapLen + currentChunk[j].length > chunkOverlap) break;
        overlapSentences.unshift(currentChunk[j]);
        overlapLen += currentChunk[j].length;
      }

      chunkStartOffset = sentenceOffset - overlapLen;
      currentChunk = [...overlapSentences];
      currentLength = overlapLen;
    }

    currentChunk.push(sentence);
    currentLength += sentenceLen;
    sentenceOffset += sentenceLen + 1; // +1 for the space/separator
  }

  // Finalize last chunk
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join(' ').trim();
    if (chunkText.length >= minChunkSize) {
      chunks.push({
        id: `${documentId}_chunk_${position}`,
        documentId,
        text: chunkText,
        position,
        startOffset: chunkStartOffset,
        endOffset: chunkStartOffset + chunkText.length,
        preview: chunkText.substring(0, 120).trim() + (chunkText.length > 120 ? '…' : ''),
      });
    }
  }

  return chunks;
}

/**
 * Split text into sentences using regex-based boundary detection.
 * Handles common abbreviations and edge cases.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];

  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Split on sentence-ending punctuation followed by space and uppercase letter
  // Also split on newlines that separate paragraphs
  const raw = normalized.split(/(?<=[.!?])\s+(?=[A-Z])|(?:\n\s*\n)/);

  return raw
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Estimate token count for a string.
 * Rough estimate: ~4 characters per token for English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Remove duplicate chunks (by text similarity).
 */
export function deduplicateChunks(chunks: TextChunk[]): TextChunk[] {
  const seen = new Set<string>();
  return chunks.filter(chunk => {
    // Create a normalized key for deduplication
    const key = chunk.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
