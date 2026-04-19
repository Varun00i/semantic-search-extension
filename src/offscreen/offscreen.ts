// ============================================================
// Offscreen Document — Handles heavy computation (model inference)
// ============================================================
// Offscreen documents have full DOM/Web Worker support, unlike service workers.
// This is where the AI model runs and indexing/search operations are performed.

import {
  initialize,
  indexDocument,
  search,
  getDocuments,
  removeDocument,
  clearAll,
  getStatus,
} from '../core/controller';
import { extractPdfText } from '../core/pdf-extractor';

// ---- Message Listener ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // CRITICAL: Only handle messages intended for the offscreen document.
  // Other messages (INDEX_PAGE, SEARCH_QUERY, etc.) are meant for the
  // service worker. If we respond to them, we steal the response channel.
  if (!message?.type || !message.type.startsWith('OFFSCREEN_')) {
    return false; // Don't handle — let other listeners process it
  }

  console.log('[Offscreen] Handling:', message.type);

  handleOffscreenMessage(message)
    .then((result) => {
      console.log('[Offscreen] Success:', message.type);
      sendResponse(result);
    })
    .catch((error) => {
      console.error('[Offscreen] Error:', message.type, error);
      sendResponse({
        type: 'ERROR',
        payload: { message: error.message || 'Offscreen processing failed' },
      });
    });
  return true; // async response
});

async function handleOffscreenMessage(message: any): Promise<any> {
  switch (message.type) {
    case 'OFFSCREEN_INDEX': {
      const { content, title, url, sourceType } = message.payload;
      const meta = await indexDocument(content, title, url, sourceType);
      return {
        type: 'INDEXING_COMPLETE',
        payload: { document: meta },
      };
    }

    case 'OFFSCREEN_INDEX_PDF': {
      const { data, title, url } = message.payload;

      // Decode base64 to ArrayBuffer
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Extract text from PDF
      const pdfResult = await extractPdfText(bytes.buffer);
      const pdfTitle = pdfResult.metadata.title || title;

      // Index the extracted text
      const meta = await indexDocument(
        pdfResult.text,
        pdfTitle,
        url,
        'pdf'
      );

      return {
        type: 'INDEXING_COMPLETE',
        payload: {
          document: meta,
          pageCount: pdfResult.pageCount,
        },
      };
    }

    case 'OFFSCREEN_SEARCH': {
      const { query, config } = message.payload;
      const result = await search(query, config);
      return {
        type: 'SEARCH_RESULTS',
        payload: {
          results: result.results,
          query,
          searchTimeMs: result.searchTimeMs,
        },
      };
    }

    case 'OFFSCREEN_GET_DOCUMENTS': {
      const documents = await getDocuments();
      return {
        type: 'DOCUMENTS_LIST',
        payload: { documents },
      };
    }

    case 'OFFSCREEN_DELETE_DOCUMENT': {
      const { documentId } = message.payload;
      await removeDocument(documentId);
      return { type: 'DOCUMENT_DELETED', payload: { documentId } };
    }

    case 'OFFSCREEN_CLEAR_ALL': {
      await clearAll();
      return { type: 'ALL_CLEARED' };
    }

    case 'OFFSCREEN_GET_STATUS': {
      return {
        type: 'STATUS',
        payload: getStatus(),
      };
    }

    case 'OFFSCREEN_INIT_MODEL': {
      await initialize((progress, msg) => {
        // Optionally send progress updates back
        chrome.runtime.sendMessage({
          type: 'MODEL_STATUS',
          payload: { status: 'loading', progress, message: msg },
        }).catch(() => {});
      });
      return {
        type: 'MODEL_STATUS',
        payload: { status: 'ready' },
      };
    }

    default:
      return null; // Not for us
  }
}

// ---- Auto-initialize model on load ----
(async () => {
  try {
    console.log('[Offscreen] Initializing AI model...');
    await initialize((progress, message) => {
      console.log(`[Offscreen] Model load: ${Math.round(progress * 100)}% — ${message}`);
    });
    console.log('[Offscreen] AI model ready');
  } catch (error) {
    console.error('[Offscreen] Model initialization failed:', error);
  }
})();
