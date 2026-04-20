import React, { useState } from 'react';
import type { DocumentMeta } from '../../types/index';

interface DocumentListProps {
  documents: DocumentMeta[];
  onDelete: (documentId: string) => void;
  onClearAll: () => void;
  onRefresh: () => void;
  darkMode?: boolean;
}

export default function DocumentList({
  documents,
  onDelete,
  onClearAll,
  onRefresh,
  darkMode,
}: DocumentListProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-3 py-2 border-b transition-colors duration-200 ${
        darkMode ? 'border-surface-border' : 'border-surface-light-border'
      }`}>
        <div className="flex items-center gap-2">
          <h2 className={`text-[12px] font-semibold tracking-[-0.01em] ${darkMode ? 'text-white/80' : 'text-gray-700'}`}>
            Documents
          </h2>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
            darkMode ? 'text-accent bg-accent/10' : 'text-accent-light bg-accent-light/8'
          }`}>
            {documents.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 ${
              darkMode ? 'text-white/45 hover:text-white/70 hover:bg-white/6' : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'
            }`}
            aria-label="Refresh documents"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {documents.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1.5 animate-scale-in">
                <span className={`text-[10px] font-medium ${darkMode ? 'text-danger' : 'text-red-500'}`}>Clear all?</span>
                <button
                  onClick={() => { onClearAll(); setConfirmClear(false); }}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 active:scale-95 ${
                    darkMode ? 'text-white bg-danger/80 hover:bg-danger' : 'text-white bg-red-500 hover:bg-red-600'
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className={`text-[10px] font-medium px-2 py-1 rounded-lg transition-all duration-150 ${
                    darkMode ? 'text-white/50 hover:text-white/70' : 'text-black/40 hover:text-black/60'
                  }`}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className={`text-[10px] font-medium px-2 py-1 rounded-lg transition-all duration-150 active:scale-95 ${
                  darkMode ? 'text-danger/70 hover:text-danger hover:bg-danger/8' : 'text-red-400 hover:text-red-500 hover:bg-red-50'
                }`}
                aria-label="Clear all documents"
              >
                Clear All
              </button>
            )
          )}
        </div>
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center animate-fade-in">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-apple-lg flex items-center justify-center ${
              darkMode ? 'bg-gradient-to-br from-accent/10 to-purple-500/10 border border-accent/10' : 'bg-gradient-to-br from-accent-light/8 to-purple-400/8 border border-accent-light/10'
            }`}>
              <svg className={`w-7 h-7 ${darkMode ? 'text-accent/50' : 'text-accent-light/50'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            <p className={`text-[14px] font-bold tracking-[-0.02em] ${darkMode ? 'text-white/90' : 'text-gray-700'}`}>
              No documents yet
            </p>
            <p className={`text-[12px] mt-1.5 leading-relaxed max-w-[240px] mx-auto ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>
              Go to Search and click <span className={`font-semibold ${darkMode ? 'text-accent' : 'text-accent-light'}`}>Index Page</span> to get started
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto py-1" role="list" aria-label="Indexed documents">
          {documents.map((doc, idx) => (
            <DocumentItem key={doc.id} document={doc} onDelete={onDelete} animDelay={idx * 30} darkMode={darkMode} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentItem({
  document: doc,
  onDelete,
  animDelay,
  darkMode,
}: {
  document: DocumentMeta;
  onDelete: (id: string) => void;
  animDelay: number;
  darkMode?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sourceIcon = getSourceIcon(doc.sourceType);
  const timeAgo = formatTimeAgo(doc.indexedAt);

  return (
    <li className={`mx-2 px-3 py-2.5 rounded-apple transition-all duration-200 group animate-fade-in ${
      darkMode ? 'hover:bg-white/5' : 'hover:bg-black/3'
    }`} style={{ animationDelay: `${animDelay}ms` }}>
      <div className="flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-apple flex items-center justify-center text-sm flex-shrink-0 ${
          darkMode ? 'bg-accent/10 border border-accent/10' : 'bg-accent-light/8 border border-accent-light/10'
        }`}>
          {sourceIcon}
        </div>
        <div className="flex-1 min-w-0">
            <h3 className={`text-[12px] font-semibold truncate tracking-[-0.01em] ${darkMode ? 'text-white/95' : 'text-gray-800'}`}>
            {doc.title || 'Untitled'}
          </h3>
          <p className={`text-[10px] truncate mt-0.5 ${darkMode ? 'text-white/35' : 'text-gray-400'}`}>
            {truncateUrl(doc.url)}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
              darkMode ? 'text-white/55 bg-white/[0.06]' : 'text-gray-500 bg-gray-100'
            }`}>
              {doc.chunkCount} chunks
            </span>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
              darkMode ? 'text-white/55 bg-white/[0.06]' : 'text-gray-500 bg-gray-100'
            }`}>
              {formatSize(doc.textLength)}
            </span>
            <span className={`text-[9px] ${darkMode ? 'text-white/35' : 'text-gray-400'}`}>
              {timeAgo}
            </span>
          </div>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-1 animate-scale-in">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(doc.id); setConfirmDelete(false); }}
              className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 ${
                darkMode ? 'text-white bg-danger/80 hover:bg-danger' : 'text-white bg-red-500 hover:bg-red-600'
              }`}
              aria-label="Confirm delete"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
              className={`p-1.5 rounded-lg transition-all duration-150 ${
                darkMode ? 'text-white/40 hover:text-white/60' : 'text-black/30 hover:text-black/50'
              }`}
              aria-label="Cancel delete"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${
              darkMode ? 'text-white/20 hover:text-danger hover:bg-danger/8' : 'text-black/15 hover:text-red-500 hover:bg-red-50'
            }`}
            aria-label={`Delete ${doc.title || 'document'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </li>
  );
}

function getSourceIcon(sourceType: string): string {
  switch (sourceType) {
    case 'webpage': return '🌐';
    case 'pdf': return '📕';
    case 'text-file': return '📝';
    case 'local-file': return '📁';
    default: return '📄';
  }
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 40 ? u.pathname.substring(0, 40) + '…' : u.pathname;
    return u.hostname + path;
  } catch {
    return url.length > 50 ? url.substring(0, 50) + '…' : url;
  }
}

function formatSize(chars: number): string {
  if (chars < 1000) return `${chars} chars`;
  if (chars < 1000000) return `${(chars / 1000).toFixed(1)}K chars`;
  return `${(chars / 1000000).toFixed(1)}M chars`;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
