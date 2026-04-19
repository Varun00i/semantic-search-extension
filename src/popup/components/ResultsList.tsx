import React from 'react';
import type { SearchResult } from '../../types/index';

interface ResultsListProps {
  results: SearchResult[];
  query: string;
  searchTimeMs: number;
  isSearching: boolean;
  onNavigate: (result: SearchResult) => void;
}

export default function ResultsList({
  results,
  query,
  searchTimeMs,
  isSearching,
  onNavigate,
}: ResultsListProps) {
  if (isSearching) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Searching by meaning...</p>
        </div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p className="text-sm font-medium">Search by meaning</p>
          <p className="text-xs mt-1">
            Index a page first, then search semantically
          </p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" />
          </svg>
          <p className="text-sm">No semantic matches found</p>
          <p className="text-xs mt-1">Try different wording or index more pages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Results count and time */}
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
        <p className="text-[11px] text-gray-500">
          <span className="font-medium text-gray-700">{results.length}</span> results
          {searchTimeMs > 0 && (
            <span> in <span className="font-medium text-gray-700">{searchTimeMs}ms</span></span>
          )}
        </p>
      </div>

      {/* Results */}
      <ul className="divide-y divide-gray-100">
        {results.map((result, idx) => (
          <ResultItem
            key={result.chunkId || idx}
            result={result}
            rank={idx + 1}
            onClick={() => onNavigate(result)}
          />
        ))}
      </ul>
    </div>
  );
}

function ResultItem({
  result,
  rank,
  onClick,
}: {
  result: SearchResult;
  rank: number;
  onClick: () => void;
}) {
  const scorePercent = Math.round(result.score * 100);
  const scoreColor =
    scorePercent >= 70
      ? 'text-green-600 bg-green-50'
      : scorePercent >= 40
      ? 'text-yellow-600 bg-yellow-50'
      : 'text-gray-500 bg-gray-50';

  return (
    <li
      className="px-3 py-2.5 hover:bg-blue-50/50 cursor-pointer transition-colors animate-fade-in"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Rank badge */}
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-medium flex items-center justify-center mt-0.5">
          {rank}
        </span>

        <div className="flex-1 min-w-0">
          {/* Document title */}
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-xs font-medium text-gray-900 truncate">
              {result.document?.title || 'Unknown Document'}
            </h3>
            <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${scoreColor}`}>
              {scorePercent}%
            </span>
          </div>

          {/* Text preview */}
          <p
            className="text-[11px] text-gray-600 leading-relaxed line-clamp-3"
            dangerouslySetInnerHTML={{
              __html: result.highlightedText || result.preview || result.text.substring(0, 200),
            }}
          />

          {/* Source URL */}
          {result.document?.url && (
            <p className="text-[10px] text-gray-400 mt-1 truncate">
              {truncateUrl(result.document.url)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/** Truncate long URLs for display */
function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30
      ? u.pathname.substring(0, 30) + '…'
      : u.pathname;
    return u.hostname + path;
  } catch {
    return url.length > 50 ? url.substring(0, 50) + '…' : url;
  }
}
