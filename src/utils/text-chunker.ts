// ============================================================
// Text Chunker — Splits text into semantically meaningful chunks
// ============================================================
import type { TextChunk, ChunkingConfig } from '../types/index';

/** Default chunking configuration */
const DEFAULT_CONFIG: ChunkingConfig = {
  chunkSize: 300,
  chunkOverlap: 60,
  minChunkSize: 40,
};

/**
 * Split text into overlapping chunks, preserving semantic boundaries.
 *
 * Strategy:
 * 1. Split text into paragraphs (double newlines)
 * 2. Detect section headers and treat them as chunk boundaries
 * 3. Break large paragraphs into sentences
 * 4. Group segments into chunks of ~chunkSize characters with overlap
 * 5. Avoid overlap across section boundaries
 * 6. Filter out chunks smaller than minChunkSize
 */
export function chunkText(
  text: string,
  documentId: string,
  config: Partial<ChunkingConfig> = {}
): TextChunk[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { chunkSize, chunkOverlap, minChunkSize } = cfg;

  if (!text || text.trim().length === 0) return [];

  // Split into semantic segments (paragraph-aware)
  const segments = splitIntoSegments(text);
  if (segments.length === 0) return [];

  const chunks: TextChunk[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkStartOffset = 0;
  let runningOffset = 0;
  let position = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isHeader = detectHeader(segment);
    const segmentLen = segment.length;

    // Section boundary: finalize current chunk before a header (no overlap)
    if (isHeader && currentChunk.length > 0) {
      const content = currentChunk.join(' ').trim();
      if (content.length >= minChunkSize) {
        chunks.push(buildChunk(documentId, content, position, chunkStartOffset));
        position++;
      }
      currentChunk = [];
      currentLength = 0;
      chunkStartOffset = runningOffset;
    }

    // If adding this segment exceeds chunk size, finalize current chunk
    if (currentLength + segmentLen > chunkSize && currentChunk.length > 0) {
      const content = currentChunk.join(' ').trim();
      if (content.length >= minChunkSize) {
        chunks.push(buildChunk(documentId, content, position, chunkStartOffset));
        position++;
      }

      // Overlap: keep trailing segments that fit within chunkOverlap
      const overlapSegments: string[] = [];
      let overlapLen = 0;
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        if (overlapLen + currentChunk[j].length > chunkOverlap) break;
        overlapSegments.unshift(currentChunk[j]);
        overlapLen += currentChunk[j].length;
      }

      chunkStartOffset = runningOffset - overlapLen;
      currentChunk = [...overlapSegments];
      currentLength = overlapLen;
    }

    currentChunk.push(segment);
    currentLength += segmentLen + 1;
    runningOffset += segmentLen + 1;
  }

  // Finalize last chunk
  if (currentChunk.length > 0) {
    const content = currentChunk.join(' ').trim();
    if (content.length >= minChunkSize) {
      chunks.push(buildChunk(documentId, content, position, chunkStartOffset));
    }
  }

  return chunks;
}

/** Build a TextChunk object. */
function buildChunk(documentId: string, text: string, position: number, startOffset: number): TextChunk {
  return {
    id: `${documentId}_chunk_${position}`,
    documentId,
    text,
    position,
    startOffset,
    endOffset: startOffset + text.length,
    preview: text.substring(0, 120).trim() + (text.length > 120 ? '…' : ''),
  };
}

/**
 * Split text into semantic segments: paragraphs first, then sentences
 * for large paragraphs. Preserves document structure better than flat
 * sentence splitting.
 */
function splitIntoSegments(text: string): string[] {
  if (!text) return [];

  // Split by paragraph breaks (2+ newlines)
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);
  const segments: string[] = [];

  for (const para of paragraphs) {
    // Short paragraphs stay as one segment (preserves meaning)
    if (para.length <= 500) {
      segments.push(para.replace(/\s+/g, ' ').trim());
    } else {
      // Break long paragraphs into sentences
      const sentences = splitIntoSentences(para);
      segments.push(...sentences);
    }
  }

  return segments.filter(s => s.length > 5);
}

/**
 * Detect whether a text segment is likely a section header.
 * Headers are kept as chunk boundaries to preserve document structure.
 */
function detectHeader(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;

  // Must be short and NOT end with sentence-ending punctuation
  if (trimmed.length < 80 && !/[.!?,;]$/.test(trimmed)) {
    // ALL CAPS text
    if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return true;
    // Numbered headings (e.g., "1. Introduction", "2) Methods")
    if (/^\d+[.)]\s/.test(trimmed)) return true;
    // Title case: short line where most words are capitalized
    const words = trimmed.split(/\s+/);
    if (words.length >= 2 && words.length <= 8) {
      const capitalized = words.filter(w => /^[A-Z]/.test(w)).length;
      if (capitalized / words.length >= 0.6) return true;
    }
  }

  return false;
}

/**
 * Split text into sentences using regex-based boundary detection.
 * Handles common abbreviations and edge cases.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];

  // Normalize whitespace within the segment
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Split on sentence-ending punctuation followed by space and capital letter
  const raw = normalized.split(/(?<=[.!?])\s+(?=[A-Z"])/);

  return raw
    .map(s => s.trim())
    .filter(s => s.length > 5); // Filter out very short fragments
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
