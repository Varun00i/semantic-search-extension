// ============================================================
// HTML Cleaner — Removes noise from HTML content
// ============================================================

/**
 * Clean raw HTML or DOM text, removing tags, scripts, styles, and noise.
 * Returns clean, readable text.
 */
export function cleanHtmlText(html: string): string {
  let text = html;

  // Remove script and style blocks entirely
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');

  // Remove SVG and other non-text elements
  text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');

  // Replace block-level elements with newlines for paragraph detection
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article|header|footer|main|aside|nav)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = decodeHtmlEntities(text);

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');             // collapse horizontal whitespace
  text = text.replace(/\n[ \t]+/g, '\n');           // trim leading spaces on lines
  text = text.replace(/[ \t]+\n/g, '\n');           // trim trailing spaces on lines
  text = text.replace(/\n{3,}/g, '\n\n');           // max 2 consecutive newlines
  text = text.trim();

  return text;
}

/**
 * Decode common HTML entities to their character equivalents.
 */
export function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&laquo;': '«',
    '&raquo;': '»',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replaceAll(entity, char);
  }

  // Handle numeric entities (decimal and hex)
  result = result.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return result;
}

/**
 * Extract visible text from a DOM element.
 * Used in content scripts where we have access to the DOM.
 */
export function extractVisibleText(element: Element): string {
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IFRAME',
    'OBJECT', 'EMBED', 'APPLET', 'NAV', 'FOOTER',
  ]);

  function walk(node: Node): string {
    // Text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent?.trim() || '';
    }

    // Element nodes
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;

      // Skip hidden elements and non-content tags
      if (SKIP_TAGS.has(el.tagName)) return '';

      // Check computed visibility
      if (typeof window !== 'undefined') {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return '';
      }

      const parts: string[] = [];
      for (const child of Array.from(el.childNodes)) {
        const childText = walk(child);
        if (childText) parts.push(childText);
      }

      // Add paragraph breaks for block elements
      const blockElements = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'MAIN']);
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

/**
 * Generate a SHA-256 hash of a string for content change detection.
 */
export async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback: simple hash for environments without crypto.subtle
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
