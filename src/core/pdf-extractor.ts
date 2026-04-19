// ============================================================
// PDF Extractor — Extracts text from PDF documents using pdf.js
// ============================================================

/**
 * Extract all text content from a PDF file.
 * Uses pdf.js (pdfjs-dist) to parse the PDF and extract text from each page.
 *
 * @param source - ArrayBuffer of the PDF file, or a URL string
 * @returns Extracted text with page separators
 */
export async function extractPdfText(source: ArrayBuffer | string): Promise<{
  text: string;
  pageCount: number;
  metadata: { title?: string; author?: string };
}> {
  // Dynamic import of pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source — use locally bundled worker file
  // Empty string causes "No GlobalWorkerOptions.workerSrc specified" warning
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument(
    typeof source === 'string' ? { url: source } : { data: source }
  );
  const pdf = await loadingTask.promise;

  // Extract metadata
  const metadataResult = await pdf.getMetadata().catch(() => null);
  const metadata: { title?: string; author?: string } = {};
  if (metadataResult?.info) {
    const info = metadataResult.info as Record<string, any>;
    metadata.title = info['Title'] || undefined;
    metadata.author = info['Author'] || undefined;
  }

  // Extract text from each page
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Reconstruct text from text items
    let pageText = '';
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if (!('str' in item)) continue;

      const textItem = item as { str: string; transform: number[] };
      const currentY = textItem.transform[5];

      // Detect line breaks based on Y position changes
      if (lastY !== null && Math.abs(currentY - lastY) > 2) {
        pageText += '\n';
      } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
        pageText += ' ';
      }

      pageText += textItem.str;
      lastY = currentY;
    }

    if (pageText.trim()) {
      pageTexts.push(pageText.trim());
    }
  }

  return {
    text: pageTexts.join('\n\n'),
    pageCount: pdf.numPages,
    metadata,
  };
}

/**
 * Extract text from a PDF blob (e.g., from a file input).
 */
export async function extractPdfFromBlob(blob: Blob): Promise<{
  text: string;
  pageCount: number;
  metadata: { title?: string; author?: string };
}> {
  const arrayBuffer = await blob.arrayBuffer();
  return extractPdfText(arrayBuffer);
}

/**
 * Check if a URL points to a PDF file.
 */
export function isPdfUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.pdf');
  } catch {
    return url.toLowerCase().endsWith('.pdf');
  }
}
