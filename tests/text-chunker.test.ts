import { chunkText, splitIntoSentences, estimateTokens } from '../src/utils/text-chunker';

describe('chunkText', () => {
  it('returns empty array for empty text', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    const text = 'This is a short test sentence.';
    const chunks = chunkText(text, { chunkSize: 500, chunkOverlap: 50, minChunkSize: 20 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].index).toBe(0);
  });

  it('chunks long text into multiple pieces', () => {
    const sentence = 'This is a test sentence. ';
    const text = sentence.repeat(50); // ~1250 chars
    const chunks = chunkText(text, { chunkSize: 300, chunkOverlap: 50, minChunkSize: 20 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('preserves start offsets correctly', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.';
    const chunks = chunkText(text, { chunkSize: 40, chunkOverlap: 10, minChunkSize: 10 });
    for (const chunk of chunks) {
      expect(chunk.startOffset).toBeGreaterThanOrEqual(0);
      expect(chunk.startOffset).toBeLessThan(text.length);
    }
  });

  it('filters out chunks below minimum size', () => {
    const text = 'OK. A. B. This is a longer sentence that should remain.';
    const chunks = chunkText(text, { chunkSize: 500, chunkOverlap: 0, minChunkSize: 20 });
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('uses default config when none provided', () => {
    const text = 'A '.repeat(200);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});

describe('splitIntoSentences', () => {
  it('splits text on sentence boundaries', () => {
    const text = 'Hello world. How are you? I am fine!';
    const sentences = splitIntoSentences(text);
    expect(sentences.length).toBe(3);
  });

  it('handles text with no sentence endings', () => {
    const text = 'Hello world with no ending';
    const sentences = splitIntoSentences(text);
    expect(sentences.length).toBe(1);
    expect(sentences[0]).toBe(text);
  });

  it('handles abbreviations and edge cases', () => {
    const text = 'Mr. Smith went home. He ate lunch.';
    const sentences = splitIntoSentences(text);
    expect(sentences.length).toBeGreaterThanOrEqual(1);
  });
});

describe('estimateTokens', () => {
  it('estimates roughly 1 token per 4 characters', () => {
    const text = 'Hello world test string';
    const tokens = estimateTokens(text);
    // ~23 chars → ~5-6 tokens
    expect(tokens).toBeGreaterThan(3);
    expect(tokens).toBeLessThan(10);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});
