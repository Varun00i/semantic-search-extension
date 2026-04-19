import React from 'react';
import type { DocumentMeta } from '../../types/index';

interface DocumentListProps {
  documents: DocumentMeta[];
  onDelete: (documentId: string) => void;
  onClearAll: () => void;
  onRefresh: () => void;
}

export default function DocumentList({
  documents,
  onDelete,
  onClearAll,
  onRefresh,
}: DocumentListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-700">
            Indexed Documents
          </h2>
          <span className="text-[10px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
            {documents.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onRefresh}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            title="Refresh"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {documents.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            <p className="text-sm">No documents indexed yet</p>
            <p className="text-xs mt-1">Click "Index This Page" to get started</p>
          </div>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {documents.map((doc) => (
            <DocumentItem key={doc.id} document={doc} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentItem({
  document: doc,
  onDelete,
}: {
  document: DocumentMeta;
  onDelete: (id: string) => void;
}) {
  const sourceIcon = getSourceIcon(doc.sourceType);
  const timeAgo = formatTimeAgo(doc.indexedAt);

  return (
    <li className="px-3 py-2.5 hover:bg-gray-50 transition-colors group">
      <div className="flex items-start gap-2">
        <span className="text-sm mt-0.5">{sourceIcon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-gray-900 truncate">
            {doc.title || 'Untitled'}
          </h3>
          <p className="text-[10px] text-gray-400 truncate mt-0.5">
            {truncateUrl(doc.url)}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-gray-400">
              {doc.chunkCount} chunks
            </span>
            <span className="text-[10px] text-gray-400">
              {formatSize(doc.textLength)}
            </span>
            <span className="text-[10px] text-gray-400">
              {timeAgo}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(doc.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all"
          title="Delete"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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
