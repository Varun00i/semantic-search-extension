// ============================================================
// Content Script — Extracts text from webpages and handles navigation
// ============================================================
// Injected into every page. Communicates with the service worker.
// NOTE: Content scripts CANNOT use ES module imports. All dependencies
// must be inlined here. This file is built as IIFE by Vite.

// ---- Inlined: extractVisibleText (from html-cleaner.ts) ----

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IFRAME',
  'OBJECT', 'EMBED', 'APPLET', 'NAV', 'FOOTER',
]);

function extractVisibleText(element: Element): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent?.trim() || '';
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (SKIP_TAGS.has(el.tagName)) return '';
      try {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return '';
      } catch {}
      const parts: string[] = [];
      for (const child of Array.from(el.childNodes)) {
        const childText = walk(child);
        if (childText) parts.push(childText);
      }
      const blockElements = new Set([
        'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'LI', 'TR', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'MAIN',
      ]);
      if (blockElements.has(el.tagName)) {
        return '\n' + parts.join(' ') + '\n';
      }
      return parts.join(' ');
    }
    return '';
  }
  return walk(element)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---- Message Listener ----

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch((error) => {
      sendResponse({
        type: 'ERROR',
        payload: { message: error.message },
      });
    });
    return true; // async
  }
);

async function handleMessage(message: any): Promise<any> {
  switch (message.type) {
    case 'EXTRACT_TEXT':
      return handleExtractText();

    case 'NAVIGATE_TO_CHUNK':
      return handleNavigateToChunk(message.payload);

    default:
      return { error: 'Unknown content script message' };
  }
}

// ---- Text Extraction ----

/**
 * Extract visible text from the current page.
 */
function handleExtractText(): any {
  try {
    const text = extractVisibleText(document.body);
    const title = document.title || '';
    const url = window.location.href;

    // Detect if this is a PDF viewer
    const isPdf = url.toLowerCase().endsWith('.pdf') ||
      document.contentType === 'application/pdf';

    return {
      type: 'EXTRACT_TEXT_RESULT',
      payload: {
        text,
        title,
        url,
        sourceType: isPdf ? 'pdf' : 'webpage',
      },
    };
  } catch (error) {
    return {
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : 'Text extraction failed',
      },
    };
  }
}

// ---- Navigate & Highlight ----

/** Currently active highlight elements */
let activeHighlights: HTMLElement[] = [];

/**
 * Navigate to and highlight a specific text chunk on the page.
 * Uses multiple strategies with progressively shorter snippets for reliability.
 */
function handleNavigateToChunk(payload: { text: string; chunkId: string }): any {
  // Clear previous highlights
  clearHighlights();

  const { text } = payload;
  if (!text) return { success: false, message: 'No text provided' };

  // Strategy 1: Try progressively shorter snippets from start
  const snippetLengths = [200, 120, 80, 50, 30];
  
  for (const len of snippetLengths) {
    const searchSnippet = text.substring(0, len).trim();
    if (!searchSnippet || searchSnippet.length < 10) continue;

    const match = findTextInDOM(searchSnippet);
    if (match) {
      window.getSelection()?.removeAllRanges();
      highlightRangeRobust(match);
      scrollToFirstHighlight();
      return { success: true, method: 'dom-highlight' };
    }
  }

  // Strategy 2: Try from middle of text
  if (text.length > 60) {
    const midStart = Math.floor(text.length / 4);
    const midSnippet = text.substring(midStart, midStart + 80).trim();
    if (midSnippet.length >= 15) {
      const match = findTextInDOM(midSnippet);
      if (match) {
        window.getSelection()?.removeAllRanges();
        highlightRangeRobust(match);
        scrollToFirstHighlight();
        return { success: true, method: 'dom-highlight-mid' };
      }
    }
  }

  // Strategy 3: Word-sequence fuzzy matching — find longest matching word sequence
  const words = text.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 3) {
    // Try progressively shorter word sequences from the start
    for (let wordCount = Math.min(words.length, 12); wordCount >= 3; wordCount--) {
      const wordSeq = words.slice(0, wordCount).join(' ');
      const match = findTextInDOMFuzzy(wordSeq);
      if (match) {
        window.getSelection()?.removeAllRanges();
        highlightRangeRobust(match);
        scrollToFirstHighlight();
        return { success: true, method: 'dom-highlight-fuzzy' };
      }
    }
  }

  // Strategy 4: First sentence
  const firstSentence = text.split(/[.!?]\s/)[0];
  if (firstSentence && firstSentence.length >= 20 && firstSentence.length <= 200) {
    const match = findTextInDOM(firstSentence);
    if (match) {
      window.getSelection()?.removeAllRanges();
      highlightRangeRobust(match);
      scrollToFirstHighlight();
      return { success: true, method: 'dom-highlight-sentence' };
    }
  }

  // Strategy 5: window.find() fallback
  try {
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
    
    const shortSnippet = text.substring(0, 60).trim();
    if ((window as any).find(shortSnippet, false, false, true)) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        sel.removeAllRanges();
        highlightRangeRobust(range);
        scrollToFirstHighlight();
        return { success: true, method: 'window.find' };
      }
      sel?.removeAllRanges();
    }
  } catch {
    try { window.getSelection()?.removeAllRanges(); } catch {}
  }

  return { success: false, message: 'Text not found on page' };
}

function scrollToFirstHighlight(): void {
  const first = activeHighlights[0];
  if (first) {
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Add active pulse effect
    first.classList.add('semantic-search-highlight--active');
    setTimeout(() => {
      first.classList.remove('semantic-search-highlight--active');
    }, 2000);
  }
}

/**
 * Find text in the DOM using TreeWalker.
 * Returns a Range if found, null otherwise.
 * Fixed: proper offset mapping between normalized and original text.
 */
function findTextInDOM(searchText: string): Range | null {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const normalizedSearch = searchText.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalizedSearch) return null;

  // Build arrays of text nodes with their normalized text and position mappings
  const textNodes: {
    node: Text;
    normalizedStart: number;
    originalText: string;
    normalizedText: string;
  }[] = [];
  let normalizedConcat = '';

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const originalText = node.textContent || '';
    if (!originalText.trim()) continue;

    const normalizedText = originalText.replace(/\s+/g, ' ');
    textNodes.push({
      node,
      normalizedStart: normalizedConcat.length,
      originalText,
      normalizedText,
    });
    normalizedConcat += normalizedText;
  }

  // Search in normalized concatenation
  const lowerConcat = normalizedConcat.toLowerCase();
  const matchIndex = lowerConcat.indexOf(normalizedSearch);
  if (matchIndex === -1) return null;

  const matchEnd = matchIndex + normalizedSearch.length;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (const entry of textNodes) {
    const entryEnd = entry.normalizedStart + entry.normalizedText.length;

    if (!startNode && matchIndex < entryEnd) {
      startNode = entry.node;
      const normalizedLocalOffset = matchIndex - entry.normalizedStart;
      startOffset = mapNormalizedToOriginal(entry.originalText, normalizedLocalOffset);
    }

    if (matchEnd <= entryEnd) {
      endNode = entry.node;
      const normalizedLocalOffset = matchEnd - entry.normalizedStart;
      endOffset = mapNormalizedToOriginal(entry.originalText, normalizedLocalOffset);
      break;
    }
  }

  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    range.setStart(startNode, Math.min(startOffset, startNode.length));
    range.setEnd(endNode, Math.min(endOffset, endNode.length));
    return range;
  } catch {
    return null;
  }
}

/**
 * Map a character offset in normalized text (whitespace collapsed) back to
 * the corresponding offset in the original text.
 */
function mapNormalizedToOriginal(original: string, normalizedOffset: number): number {

  let normPos = 0;
  let origPos = 0;

  while (normPos < normalizedOffset && origPos < original.length) {
    if (/\s/.test(original[origPos])) {
      // Consume all contiguous whitespace in original (maps to 1 char in normalized)
      while (origPos < original.length && /\s/.test(original[origPos])) {
        origPos++;
      }
      normPos++;
    } else {
      origPos++;
      normPos++;
    }
  }
  return Math.min(origPos, original.length);
}

/**
 * Fuzzy word-sequence matching in the DOM.
 * Splits the search text into words and finds where the word sequence
 * appears in the page text (tolerant of extra whitespace, punctuation diffs).
 */
function findTextInDOMFuzzy(searchText: string): Range | null {
  const searchWords = searchText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (searchWords.length === 0) return null;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  // Build a word map: each word with its DOM position
  const wordEntries: { word: string; node: Text; startInNode: number; endInNode: number }[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || '';
    if (!text.trim()) continue;
    // Find each word in this text node
    const wordRegex = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = wordRegex.exec(text)) !== null) {
      wordEntries.push({
        word: m[0].toLowerCase().replace(/[^\w]/g, ''),
        node,
        startInNode: m.index,
        endInNode: m.index + m[0].length,
      });
    }
  }

  // Slide a window across wordEntries looking for our search word sequence
  for (let i = 0; i <= wordEntries.length - searchWords.length; i++) {
    let matched = true;
    for (let j = 0; j < searchWords.length; j++) {
      const cleanSearch = searchWords[j].replace(/[^\w]/g, '');
      const cleanEntry = wordEntries[i + j].word;
      if (!cleanEntry.includes(cleanSearch) && !cleanSearch.includes(cleanEntry)) {
        matched = false;
        break;
      }
    }
    if (matched) {
      const first = wordEntries[i];
      const last = wordEntries[i + searchWords.length - 1];
      try {
        const range = document.createRange();
        range.setStart(first.node, first.startInNode);
        range.setEnd(last.node, Math.min(last.endInNode, last.node.length));
        return range;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Highlight a Range robustly — handles both single-node and cross-element ranges.
 */
function highlightRangeRobust(range: Range): void {
  try {
    if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
      // Simple case: range is within a single text node
      const highlight = createHighlightMark();
      range.surroundContents(highlight);
      activeHighlights.push(highlight);
    } else {
      // Complex case: range spans multiple elements
      highlightCrossElementRange(range);
    }
  } catch {
    // surroundContents can still fail in edge cases; fallback to per-node highlighting
    try {
      highlightCrossElementRange(range);
    } catch {
      // Last resort: just scroll to the position
      const rect = range.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0)) {
        window.scrollTo({
          top: window.scrollY + rect.top - window.innerHeight / 2,
          behavior: 'smooth',
        });
      }
    }
  }
}

/**
 * Highlight a range that spans multiple DOM elements by wrapping each text node individually.
 */
function highlightCrossElementRange(range: Range): void {
  // Collect all text nodes within the range
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Text | null;
  let inRange = false;
  while ((node = walker.nextNode() as Text | null)) {
    if (node === range.startContainer) inRange = true;
    if (inRange && node.textContent?.trim()) {
      textNodes.push(node);
    }
    if (node === range.endContainer) break;
  }

  // If walker didn't find the start node, just use start/end
  if (textNodes.length === 0 && range.startContainer.nodeType === Node.TEXT_NODE) {
    textNodes.push(range.startContainer as Text);
  }

  for (const textNode of textNodes) {
    try {
      const nodeRange = document.createRange();
      if (textNode === range.startContainer) {
        nodeRange.setStart(textNode, range.startOffset);
      } else {
        nodeRange.setStart(textNode, 0);
      }
      if (textNode === range.endContainer) {
        nodeRange.setEnd(textNode, range.endOffset);
      } else {
        nodeRange.setEnd(textNode, textNode.length);
      }

      const highlight = createHighlightMark();
      nodeRange.surroundContents(highlight);
      activeHighlights.push(highlight);
    } catch {
      // Skip nodes that can't be highlighted
    }
  }
}

function createHighlightMark(): HTMLElement {
  const el = document.createElement('mark');
  el.className = 'semantic-search-highlight';
  el.style.cssText = `
    background-color: #e9d5ff !important;
    color: #581c87 !important;
    padding: 1px 0 !important;
    border-radius: 2px !important;
    box-shadow: none !important;
    border-bottom: 2px solid #c084fc !important;
    display: inline !important;
    line-height: inherit !important;
    font-weight: inherit !important;
  `;
  return el;
}

/**
 * Remove all active highlights from the page.
 */
function clearHighlights(): void {
  for (const el of activeHighlights) {
    const parent = el.parentNode;
    if (parent) {
      // Replace highlight element with its text content
      const text = document.createTextNode(el.textContent || '');
      parent.replaceChild(text, el);
      parent.normalize(); // Merge adjacent text nodes
    }
  }
  activeHighlights = [];
}

// ---- Auto-cleanup on page unload ----
window.addEventListener('beforeunload', clearHighlights);

console.log('[SemanticSearch] Content script loaded');
