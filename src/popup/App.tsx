import React, { useState, useCallback, useEffect } from 'react';
import type { SearchResult, DocumentMeta, IndexingStatus, ModelStatus } from '../types/index';
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

      console.log('[Popup] INDEX_PAGE response:', response);

      // Validate the response actually indicates success
      if (!response) {
        throw new Error('No response from service worker — please refresh the page and try again');
      }
      if (response?.type === 'ERROR') {
        throw new Error(response.payload?.message || 'Indexing failed');
      }

      setIndexingStatus('complete');
      setIndexingProgress(1);
      setStatusMessage('Page indexed successfully!');

      // Refresh document list
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
      console.log('[Popup] Loading documents...');
      const response = await sendMessage({ type: 'GET_DOCUMENTS' });
      console.log('[Popup] GET_DOCUMENTS response:', response);
      const docs = response?.payload?.documents || response?.documents || response || [];
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, []);

  // Load documents on mount
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
      await sendMessage({
        type: 'NAVIGATE_TO_CHUNK',
        payload: {
          text: result.text,
          chunkId: result.chunkId,
        },
      });
    } catch (err) {
      console.error('Navigation failed:', err);
    }
  }, []);

  // ---- File Upload (text/PDF) ----
  const handleFileUpload = useCallback(async (file: File) => {
    setIsIndexing(true);
    setError(null);

    try {
      let content: string;
      let sourceType: 'pdf' | 'text-file' = 'text-file';

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        sourceType = 'pdf';
        // Read as base64 and send to offscreen for PDF extraction
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        const response = await sendMessage({
          type: 'INDEX_PDF',
          payload: {
            data: base64,
            title: file.name,
            url: `file://${file.name}`,
          },
        });
        if (response?.type === 'ERROR') {
          throw new Error(response.payload?.message || 'PDF indexing failed');
        }
        setStatusMessage(`Indexed: ${file.name}`);
        await loadDocuments();
        return;
      }

      // Plain text file
      content = await file.text();
      const response = await sendMessage({
        type: 'INDEX_TEXT',
        payload: {
          content,
          title: file.name,
          url: `file://${file.name}`,
          sourceType,
        },
      });

      if (response?.type === 'ERROR') {
        throw new Error(response.payload?.message || 'Indexing failed');
      }

      setStatusMessage(`Indexed: ${file.name}`);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setIsIndexing(false);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  }, [loadDocuments]);

  // ---- Tab switch: load documents ----
  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'documents') {
      loadDocuments();
    }
  }, [loadDocuments]);

  // ---- Render ----
  return (
    <div className="w-popup h-popup flex flex-col bg-white text-gray-900 overflow-hidden">
      <Header />

      {/* Tab Navigation */}
      <nav className="flex border-b border-gray-200 bg-gray-50 px-2">
        <TabButton
          label="Search"
          icon="🔍"
          active={activeTab === 'search'}
          onClick={() => switchTab('search')}
        />
        <TabButton
          label="Documents"
          icon="📄"
          active={activeTab === 'documents'}
          onClick={() => switchTab('documents')}
        />
        <TabButton
          label="Settings"
          icon="⚙️"
          active={activeTab === 'settings'}
          onClick={() => switchTab('settings')}
        />
      </nav>

      {/* Status Bar */}
      <StatusBar
        indexingStatus={indexingStatus}
        indexingProgress={indexingProgress}
        statusMessage={statusMessage}
        error={error}
        onDismissError={() => setError(null)}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'search' && (
          <div className="flex flex-col h-full">
            <SearchBar
              onSearch={handleSearch}
              onIndexPage={handleIndexPage}
              isSearching={isSearching}
              isIndexing={isIndexing}
              onFileUpload={handleFileUpload}
            />
            <ResultsList
              results={results}
              query={query}
              searchTimeMs={searchTimeMs}
              isSearching={isSearching}
              onNavigate={handleNavigate}
            />
          </div>
        )}

        {activeTab === 'documents' && (
          <DocumentList
            documents={documents}
            onDelete={handleDeleteDocument}
            onClearAll={handleClearAll}
            onRefresh={loadDocuments}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel />
        )}
      </main>
    </div>
  );
}

/** Tab button component */
function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      <span className="text-sm">{icon}</span>
      {label}
    </button>
  );
}
