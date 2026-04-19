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
 */
function handleNavigateToChunk(payload: { text: string; chunkId: string }): any {
  // Clear previous highlights
  clearHighlights();

  const { text } = payload;
  if (!text) return { success: false, message: 'No text provided' };

  // Use a shorter snippet for searching (first ~80 chars)
  const searchSnippet = text.substring(0, 80).trim();
  if (!searchSnippet) return { success: false };

  // Find the text in the DOM using TreeWalker
  const match = findTextInDOM(searchSnippet);
  if (!match) {
    // Fallback: try window.find
    try {
      (window as any).find(searchSnippet);
      return { success: true, method: 'window.find' };
    } catch {
      return { success: false, message: 'Text not found on page' };
    }
  }

  // Highlight the found text
  highlightRange(match);

  // Scroll to the highlight
  const firstHighlight = activeHighlights[0];
  if (firstHighlight) {
    firstHighlight.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  return { success: true, method: 'dom-highlight' };
}

/**
 * Find text in the DOM using TreeWalker.
 * Returns a Range if found, null otherwise.
 */
function findTextInDOM(searchText: string): Range | null {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const normalizedSearch = searchText.toLowerCase().replace(/\s+/g, ' ');
  let concatenated = '';
  const textNodes: { node: Text; start: number }[] = [];

  // Collect all text nodes and their positions
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const nodeText = node.textContent || '';
    if (!nodeText.trim()) continue;

    textNodes.push({ node, start: concatenated.length });
    concatenated += nodeText.replace(/\s+/g, ' ');
  }

  // Search in the concatenated text
  const normalizedConcat = concatenated.toLowerCase();
  const matchIndex = normalizedConcat.indexOf(normalizedSearch);
  if (matchIndex === -1) return null;

  // Find the corresponding DOM nodes for the match range
  const matchEnd = matchIndex + normalizedSearch.length;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (let i = 0; i < textNodes.length; i++) {
    const entry = textNodes[i];
    const nodeLen = (entry.node.textContent || '').replace(/\s+/g, ' ').length;
    const nodeEnd = entry.start + nodeLen;

    if (!startNode && matchIndex < nodeEnd) {
      startNode = entry.node;
      startOffset = matchIndex - entry.start;
    }

    if (matchEnd <= nodeEnd) {
      endNode = entry.node;
      endOffset = matchEnd - entry.start;
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
 * Highlight a Range by wrapping it in styled <mark> elements.
 */
function highlightRange(range: Range): void {
  try {
    const highlight = document.createElement('mark');
    highlight.className = 'semantic-search-highlight';
    highlight.style.cssText = `
      background-color: #fef08a !important;
      color: #000 !important;
      padding: 2px 0 !important;
      border-radius: 2px !important;
      box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.4) !important;
      transition: background-color 0.3s !important;
    `;

    range.surroundContents(highlight);
    activeHighlights.push(highlight);

    // Pulse animation
    setTimeout(() => {
      highlight.style.backgroundColor = '#fde047';
    }, 100);
    setTimeout(() => {
      highlight.style.backgroundColor = '#fef08a';
    }, 600);
  } catch {
    // surroundContents fails if range spans multiple elements
    // Fall back to just scrolling to the range
    const rect = range.getBoundingClientRect();
    window.scrollTo({
      top: window.scrollY + rect.top - window.innerHeight / 2,
      behavior: 'smooth',
    });
  }
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
