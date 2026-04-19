// ============================================================
// Service Worker — Background script for the browser extension (Manifest v3)
// ============================================================
// Routes messages between popup, content scripts, and offscreen document.
// Handles all extension lifecycle events.

import type {
  ExtensionMessage,
  SearchQueryMessage,
  IndexPageMessage,
  SearchResult,
  DocumentMeta,
} from '../types/index';

// ---- State ----
let offscreenDocumentCreated = false;

/**
 * Send a message to the offscreen document with retry logic.
 * Waits for the offscreen to be ready before sending.
 */
async function sendToOffscreen(message: any, retries = 3): Promise<any> {
  await ensureOffscreenDocument();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage(message);

      // If response is undefined, the offscreen listener may not be ready yet
      if (response === undefined && attempt < retries) {
        console.warn(`[ServiceWorker] No response from offscreen (attempt ${attempt}), retrying...`);
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }

      // Check for error responses from offscreen
      if (response?.type === 'ERROR') {
        throw new Error(response.payload?.message || 'Offscreen operation failed');
      }

      return response;
    } catch (error: any) {
      if (attempt < retries && error?.message?.includes('Could not establish connection')) {
        console.warn(`[ServiceWorker] Connection failed (attempt ${attempt}), retrying...`);
        // Offscreen might have been destroyed, recreate it
        offscreenDocumentCreated = false;
        await ensureOffscreenDocument();
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to communicate with offscreen document after retries');
}

// ---- Offscreen Document Management ----

/**
 * Create the offscreen document for heavy computation (model inference).
 * Offscreen docs run in a full DOM context, unlike service workers.
 */
async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenDocumentCreated) return;

  // Check if already exists
  const existingContexts = await (chrome as any).runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  }).catch(() => []);

  if (existingContexts && existingContexts.length > 0) {
    offscreenDocumentCreated = true;
    return;
  }

  try {
    await (chrome as any).offscreen.createDocument({
      url: 'src/offscreen/offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Run AI embedding model in a Web Worker for semantic search',
    });
    offscreenDocumentCreated = true;
  } catch (error) {
    console.error('[ServiceWorker] Failed to create offscreen document:', error);
  }
}

// ---- Message Handler ----

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    // Ignore messages intended for the offscreen document
    if ((message as any)?.type?.startsWith('OFFSCREEN_')) {
      return false; // Don't handle
    }
    // Ignore internal status messages from offscreen
    if ((message as any)?.type === 'MODEL_STATUS') {
      return false;
    }

    handleMessage(message, sender).then(sendResponse).catch((error) => {
      console.error('[ServiceWorker] Message handling error:', error);
      sendResponse({ type: 'ERROR', payload: { message: error.message } });
    });
    return true; // Keep channel open for async response
  }
);

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  console.log('[ServiceWorker] Handling:', (message as any).type);

  switch (message.type) {
    case 'INDEX_PAGE': {
      // Request text extraction from the content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');

      // Inject content script if not already present
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content-script.js'],
        });
      } catch {
        // Script may already be injected, that's OK
      }

      // Small delay to ensure the content script listener is registered
      await new Promise(r => setTimeout(r, 100));

      // Send extract request to content script
      const extractResult = await chrome.tabs.sendMessage(tab.id, {
        type: 'EXTRACT_TEXT',
      });

      if (!extractResult || !extractResult.payload?.text) {
        throw new Error('Failed to extract text from page');
      }

      console.log('[ServiceWorker] Text extracted, length:', extractResult.payload.text.length);

      // Forward to offscreen document for indexing
      const indexResult = await sendToOffscreen({
        type: 'OFFSCREEN_INDEX',
        payload: {
          content: extractResult.payload.text,
          title: extractResult.payload.title || tab.title || 'Untitled',
          url: extractResult.payload.url || tab.url || '',
          sourceType: 'webpage',
        },
      });

      console.log('[ServiceWorker] Index result:', indexResult?.type);
      return indexResult;
    }

    case 'INDEX_PDF': {
      return sendToOffscreen({
        type: 'OFFSCREEN_INDEX_PDF',
        payload: message.payload,
      });
    }

    case 'INDEX_TEXT': {
      return sendToOffscreen({
        type: 'OFFSCREEN_INDEX',
        payload: message.payload,
      });
    }

    case 'SEARCH_QUERY': {
      return sendToOffscreen({
        type: 'OFFSCREEN_SEARCH',
        payload: (message as SearchQueryMessage).payload,
      });
    }

    case 'GET_DOCUMENTS': {
      return sendToOffscreen({
        type: 'OFFSCREEN_GET_DOCUMENTS',
      });
    }

    case 'DELETE_DOCUMENT': {
      return sendToOffscreen({
        type: 'OFFSCREEN_DELETE_DOCUMENT',
        payload: message.payload,
      });
    }

    case 'CLEAR_ALL': {
      return sendToOffscreen({
        type: 'OFFSCREEN_CLEAR_ALL',
      });
    }

    case 'GET_STATUS': {
      return sendToOffscreen({
        type: 'OFFSCREEN_GET_STATUS',
      });
    }

    case 'NAVIGATE_TO_CHUNK': {
      // Forward to content script for highlighting
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, message);
      }
      return { success: true };
    }

    default:
      console.warn('[ServiceWorker] Unknown message type:', message.type);
      return { error: 'Unknown message type' };
  }
}

// ---- Extension Lifecycle ----

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[SemanticSearch] Extension installed:', details.reason);

  // Set default settings on install
  if (details.reason === 'install') {
    chrome.storage.local.set({
      settings: {
        autoIndex: false,
        maxCachedDocuments: 100,
      },
    });
  }
});

// Keep service worker alive during long operations
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepalive') {
    const interval = setInterval(() => {
      port.postMessage({ type: 'ping' });
    }, 25000);
    port.onDisconnect.addListener(() => clearInterval(interval));
  }
});

// Context menu for quick indexing
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({
    id: 'semantic-search-index',
    title: 'Index this page for Semantic Search',
    contexts: ['page'],
  });

  chrome.contextMenus?.create({
    id: 'semantic-search-selection',
    title: 'Search semantically for "%s"',
    contexts: ['selection'],
  });
});

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'semantic-search-index' && tab?.id) {
    chrome.runtime.sendMessage({
      type: 'INDEX_PAGE',
      payload: { url: tab.url, title: tab.title },
    });
  } else if (info.menuItemId === 'semantic-search-selection' && info.selectionText) {
    // Open popup with the selected text as query
    await chrome.action.openPopup?.();
    // Small delay to ensure popup is loaded
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'SEARCH_QUERY',
        payload: { query: info.selectionText },
      });
    }, 500);
  }
});

console.log('[SemanticSearch] Service worker loaded');
