import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { SearchResult, DocumentMeta, IndexingStatus, ModelStatus } from '../types/index';
import { DEFAULT_SETTINGS } from '../types/index';
import SearchBar from './components/SearchBar';
import ResultsList from './components/ResultsList';
import StatusBar from './components/StatusBar';
import DocumentList from './components/DocumentList';
import SettingsPanel from './components/SettingsPanel';
import Header from './components/Header';

/** Tabs for the main UI */
type Tab = 'search' | 'documents' | 'settings';

/**
 * Send a message to the service worker and return the response.
 */
async function sendMessage(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

export default function App() {
  // ---- State ----
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [searchTimeMs, setSearchTimeMs] = useState(0);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('not-loaded');
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>('idle');
  const [indexingProgress, setIndexingProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);

  // ---- Pop-out detection: add class to html for fluid sizing ----
  useEffect(() => {
    const isPopOut = new URLSearchParams(window.location.search).has('popout');
    if (isPopOut) {
      document.documentElement.classList.add('popout');
    }
  }, []);

  // ---- Load dark mode from settings ----
  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      const dm = result.settings?.darkMode ?? true;
      setDarkMode(dm);
    });
  }, []);

  // ---- Auto-index current page on popup open if enabled ----
  const autoIndexAttempted = useRef(false);
  useEffect(() => {
    if (autoIndexAttempted.current) return;
    autoIndexAttempted.current = true;

    chrome.storage.local.get('settings', async (result) => {
      const autoIndex = result.settings?.autoIndex ?? false;
      if (!autoIndex) return;

      try {
        // Check if current page is already indexed
        const docsResponse = await sendMessage({ type: 'GET_DOCUMENTS' });
        const docs = docsResponse?.payload?.documents || docsResponse?.documents || docsResponse || [];
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

        const alreadyIndexed = Array.isArray(docs) && docs.some((d: any) => d.url === tab.url);
        if (alreadyIndexed) return;

        // Auto-index this page
        handleIndexPage();
      } catch (err) {
        console.warn('[Popup] Auto-index on open failed:', err);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Apply light class to <html> (dark is default) ----
  useEffect(() => {
    document.documentElement.classList.toggle('light', !darkMode);
  }, [darkMode]);

  // ---- Keyboard shortcut: Ctrl+1/2/3 for tabs ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+1/2/3 for tab switching
      if (e.ctrlKey && e.key === '1') { e.preventDefault(); switchTab('search'); }
      if (e.ctrlKey && e.key === '2') { e.preventDefault(); switchTab('documents'); }
      if (e.ctrlKey && e.key === '3') { e.preventDefault(); switchTab('settings'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ---- Search ----
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setQuery(searchQuery);
    setIsSearching(true);
    setError(null);

    try {
      const response = await sendMessage({
        type: 'SEARCH_QUERY',
        payload: { query: searchQuery },
      });

      if (response?.payload?.results) {
        setResults(response.payload.results);
        setSearchTimeMs(response.payload.searchTimeMs || 0);
      } else if (response?.results) {
        setResults(response.results);
        setSearchTimeMs(response.searchTimeMs || 0);
      } else {
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // ---- Index Current Page ----
  const handleIndexPage = useCallback(async () => {
    setIsIndexing(true);
    setIndexingStatus('extracting');
    setIndexingProgress(0);
    setError(null);

    try {
      const response = await sendMessage({
        type: 'INDEX_PAGE',
        payload: {},
      });

      if (!response) {
        throw new Error('No response from service worker — please refresh the page and try again');
      }
      if (response?.type === 'ERROR') {
        throw new Error(response.payload?.message || 'Indexing failed');
      }

      setIndexingStatus('complete');
      setIndexingProgress(1);
      setStatusMessage('Page indexed successfully!');
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to index page');
      setIndexingStatus('error');
    } finally {
      setIsIndexing(false);
      setTimeout(() => {
        setIndexingStatus('idle');
        setStatusMessage('');
      }, 3000);
    }
  }, []);

  // ---- Load Documents ----
  const loadDocuments = useCallback(async () => {
    try {
      const response = await sendMessage({ type: 'GET_DOCUMENTS' });
      const docs = response?.payload?.documents || response?.documents || response || [];
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ---- Delete Document ----
  const handleDeleteDocument = useCallback(async (documentId: string) => {
    try {
      await sendMessage({
        type: 'DELETE_DOCUMENT',
        payload: { documentId },
      });
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  }, [loadDocuments]);

  // ---- Clear All ----
  const handleClearAll = useCallback(async () => {
    try {
      await sendMessage({ type: 'CLEAR_ALL' });
      setDocuments([]);
      setResults([]);
      setStatusMessage('All data cleared');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear data');
    }
  }, []);

  // ---- Navigate to Result ----
  const handleNavigate = useCallback(async (result: SearchResult) => {
    try {
      const response = await sendMessage({
        type: 'NAVIGATE_TO_CHUNK',
        payload: {
          text: result.text,
          chunkId: result.chunkId,
        },
      });
      if (response && !response.success) {
        console.warn('Navigation result:', response.message || 'Could not highlight text');
      }
    } catch (err) {
      console.error('Navigation failed:', err);
    }
  }, []);

  // ---- File Upload ----
  const handleFileUpload = useCallback(async (file: File) => {
    setIsIndexing(true);
    setError(null);

    try {
      let content: string;
      let sourceType: 'pdf' | 'text-file' = 'text-file';

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        sourceType = 'pdf';
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        const response = await sendMessage({
          type: 'INDEX_PDF',
          payload: { data: base64, title: file.name, url: `file://${file.name}` },
        });
        if (response?.type === 'ERROR') throw new Error(response.payload?.message || 'PDF indexing failed');
        setStatusMessage(`Indexed: ${file.name}`);
        await loadDocuments();
        return;
      }

      content = await file.text();
      const response = await sendMessage({
        type: 'INDEX_TEXT',
        payload: { content, title: file.name, url: `file://${file.name}`, sourceType },
      });
      if (response?.type === 'ERROR') throw new Error(response.payload?.message || 'Indexing failed');
      setStatusMessage(`Indexed: ${file.name}`);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setIsIndexing(false);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  }, [loadDocuments]);

  // ---- Tab switch ----
  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'documents') loadDocuments();
    // Scroll main content to top on tab switch
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [loadDocuments]);

  // ---- Pop-out to separate window ----
  const handlePopOut = useCallback(() => {
    chrome.windows.create({
      url: chrome.runtime.getURL('src/popup/index.html?popout=1'),
      type: 'popup',
      width: 520,
      height: 640,
    });
    window.close();
  }, []);

  // ---- Render ----
  return (
    <div className={`w-full h-full flex flex-col overflow-hidden transition-colors duration-200 ${
      darkMode
        ? 'bg-surface-0 text-white/95'
        : 'bg-surface-light-0 text-gray-800'
    }`}>
      {/* Header */}
      <div className="flex-shrink-0">
        <Header darkMode={darkMode} onPopOut={handlePopOut} />

        {/* Segmented Control */}
        <div className={`px-3 py-2 ${
          darkMode ? 'bg-surface-0' : 'bg-surface-light-0'
        }`}>
          <nav className={`flex p-[3px] rounded-apple border ${
            darkMode ? 'bg-white/[0.04] border-surface-border' : 'bg-black/[0.03] border-surface-light-border'
          }`} role="tablist" aria-label="Main navigation">
            <TabButton label="Search" shortcut="Ctrl+1" darkMode={darkMode}
              icon={<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>}
              active={activeTab === 'search'} onClick={() => switchTab('search')} />
            <TabButton label="Docs" shortcut="Ctrl+2" darkMode={darkMode}
              icon={<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>}
              active={activeTab === 'documents'} onClick={() => switchTab('documents')}
              badge={documents.length > 0 ? documents.length : undefined} />
            <TabButton label="Settings" shortcut="Ctrl+3" darkMode={darkMode}
              icon={<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>}
              active={activeTab === 'settings'} onClick={() => switchTab('settings')} />
          </nav>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        indexingStatus={indexingStatus}
        indexingProgress={indexingProgress}
        statusMessage={statusMessage}
        error={error}
        onDismissError={() => setError(null)}
        darkMode={darkMode}
      />

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" role="tabpanel">
        {activeTab === 'search' && (
          <div className="flex flex-col h-full">
            <SearchBar
              onSearch={handleSearch}
              onIndexPage={handleIndexPage}
              isSearching={isSearching}
              isIndexing={isIndexing}
              onFileUpload={handleFileUpload}
              darkMode={darkMode}
            />
            <ResultsList
              results={results}
              query={query}
              searchTimeMs={searchTimeMs}
              isSearching={isSearching}
              onNavigate={handleNavigate}
              darkMode={darkMode}
            />
          </div>
        )}

        {activeTab === 'documents' && (
          <DocumentList
            documents={documents}
            onDelete={handleDeleteDocument}
            onClearAll={handleClearAll}
            onRefresh={loadDocuments}
            darkMode={darkMode}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel darkMode={darkMode} onDarkModeChange={setDarkMode} />
        )}
      </main>
    </div>
  );
}

/** Apple-style segmented control button */
function TabButton({
  label,
  icon,
  active,
  onClick,
  badge,
  shortcut,
  darkMode,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
  shortcut?: string;
  darkMode?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-label={`${label}${shortcut ? ` (${shortcut})` : ''}`}
      title={shortcut}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-[7px] text-[11px] font-semibold rounded-[9px] transition-all duration-200 ${
        active
          ? darkMode
            ? 'bg-surface-2 text-white shadow-apple-sm border border-accent/15'
            : 'bg-white text-gray-800 shadow-apple-sm border border-accent-light/10'
          : darkMode
            ? 'text-white/45 hover:text-white/65 border border-transparent'
            : 'text-gray-400 hover:text-gray-600 border border-transparent'
      }`}
    >
      <span className={active ? (darkMode ? 'text-accent' : 'text-accent-light') : ''}>{icon}</span>
      {label}
      {badge !== undefined && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center ${
          active
            ? darkMode ? 'bg-accent/15 text-accent' : 'bg-accent-light/10 text-accent-light'
            : darkMode ? 'bg-white/8 text-white/50' : 'bg-black/6 text-black/50'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}
