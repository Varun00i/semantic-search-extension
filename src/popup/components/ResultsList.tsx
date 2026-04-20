import React, { useState } from 'react';
import type { SearchResult } from '../../types/index';

interface ResultsListProps {
  results: SearchResult[];
  query: string;
  searchTimeMs: number;
  isSearching: boolean;
  onNavigate: (result: SearchResult) => void;
  darkMode?: boolean;
}

export default function ResultsList({
  results,
  query,
  searchTimeMs,
  isSearching,
  onNavigate,
  darkMode,
}: ResultsListProps) {
  if (isSearching) {
    return (
      <div className="flex-1 p-4 space-y-3" role="status" aria-label="Searching">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`p-3 rounded-apple animate-fade-in ${
            darkMode ? 'bg-white/4' : 'bg-black/3'
          }`} style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start gap-3">
              <div className="skeleton w-6 h-6 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-3/4" />
                <div className="skeleton h-2.5 w-full" />
                <div className="skeleton h-2 w-1/3" />
              </div>
            </div>
          </div>
        ))}
        <p className={`text-[11px] text-center pt-1 ${darkMode ? 'text-accent' : 'text-accent-light'}`}>
          Searching by meaning...
        </p>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center animate-fade-in">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-apple-lg flex items-center justify-center ${
            darkMode ? 'bg-gradient-to-br from-accent/10 to-purple-500/10 border border-accent/10' : 'bg-gradient-to-br from-accent-light/8 to-purple-400/8 border border-accent-light/10'
          }`}>
            <svg className={`w-7 h-7 ${darkMode ? 'text-accent/50' : 'text-accent-light/50'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <p className={`text-[14px] font-bold tracking-[-0.02em] ${darkMode ? 'text-white/90' : 'text-gray-700'}`}>
            Search by meaning
          </p>
          <p className={`text-[12px] mt-1.5 leading-relaxed max-w-[240px] mx-auto ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>
            Index a page first, then search using natural language
          </p>
          <div className="flex items-center justify-center gap-3 mt-5">
            <span className={`text-[11px] px-3 py-1.5 rounded-full font-medium ${
              darkMode ? 'text-accent bg-accent/10' : 'text-accent-light bg-accent-light/8'
            }`}>1. Index</span>
            <svg className={`w-4 h-4 ${darkMode ? 'text-white/15' : 'text-black/15'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={`text-[11px] px-3 py-1.5 rounded-full font-medium ${
              darkMode ? 'text-accent bg-accent/10' : 'text-accent-light bg-accent-light/8'
            }`}>2. Search</span>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center animate-fade-in">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-apple-lg flex items-center justify-center ${
            darkMode ? 'bg-gradient-to-br from-accent/10 to-purple-500/10 border border-accent/10' : 'bg-gradient-to-br from-accent-light/8 to-purple-400/8 border border-accent-light/10'
          }`}>
            <svg className={`w-7 h-7 ${darkMode ? 'text-accent/50' : 'text-accent-light/50'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" />
            </svg>
          </div>
          <p className={`text-[14px] font-bold tracking-[-0.02em] ${darkMode ? 'text-white/90' : 'text-gray-700'}`}>
            No matches found
          </p>
          <p className={`text-[12px] mt-1 ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>
            Try different wording or index more pages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Results header */}
      <div className={`px-3 py-2 border-b flex items-center justify-between ${
        darkMode ? 'border-surface-border' : 'border-surface-light-border'
      }`}>
        <p className={`text-[11px] ${darkMode ? 'text-white/55' : 'text-gray-500'}`}>
          <span className="font-semibold">{results.length}</span> results
          {searchTimeMs > 0 && (
            <span className="ml-1.5 opacity-70">in {searchTimeMs}ms</span>
          )}
        </p>
      </div>

      {/* Results */}
      <ul className="divide-y divide-transparent" role="list" aria-label="Search results">
        {results.map((result, idx) => (
          <ResultItem
            key={result.chunkId || idx}
            result={result}
            rank={idx + 1}
            onNavigate={onNavigate}
            animDelay={idx * 40}
            darkMode={darkMode}
          />
        ))}
      </ul>
    </div>
  );
}

function ResultItem({
  result,
  rank,
  onNavigate,
  animDelay,
  darkMode,
}: {
  result: SearchResult;
  rank: number;
  onNavigate: (result: SearchResult) => void;
  animDelay: number;
  darkMode?: boolean;
}) {
  const [isNavigating, setIsNavigating] = useState(false);
  const scorePercent = Math.round(result.score * 100);
  const scoreColor = scorePercent >= 70
    ? darkMode ? 'text-success bg-success/10' : 'text-green-600 bg-green-50'
    : scorePercent >= 40
    ? darkMode ? 'text-warning bg-warning/10' : 'text-amber-600 bg-amber-50'
    : darkMode ? 'text-white/40 bg-white/5' : 'text-black/40 bg-black/4';

  const handleClick = async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      await onNavigate(result);
    } finally {
      setTimeout(() => setIsNavigating(false), 500);
    }
  };

  return (
    <li
      className={`mx-2 my-1 px-3 py-2.5 rounded-apple cursor-pointer transition-all duration-200 animate-fade-in ${
        isNavigating
          ? darkMode ? 'bg-accent/10' : 'bg-accent-light/8'
          : darkMode ? 'hover:bg-white/5 active:bg-white/8' : 'hover:bg-black/3 active:bg-black/5'
      }`}
      style={{ animationDelay: `${animDelay}ms` }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      aria-label={`Result ${rank}: ${result.document?.title || 'Unknown'} — ${scorePercent}% match`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`flex-shrink-0 w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center mt-0.5 ${
          darkMode ? 'bg-accent/10 text-accent/70 border border-accent/10' : 'bg-accent-light/8 text-accent-light/70 border border-accent-light/10'
        }`}>
          {rank}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className={`text-[12px] font-semibold truncate tracking-[-0.01em] ${darkMode ? 'text-white/95' : 'text-gray-800'}`}>
              {result.document?.title || 'Unknown Document'}
            </h3>
            <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${scoreColor}`}>
              {scorePercent}%
            </span>
          </div>

          <p
            className={`text-[11px] leading-[1.5] line-clamp-2 ${darkMode ? 'text-white/55' : 'text-gray-500'}`}
            dangerouslySetInnerHTML={{
              __html: result.highlightedText || result.preview || result.text.substring(0, 150),
            }}
          />

          {result.document?.url && (
            <p className={`text-[10px] mt-1.5 truncate flex items-center gap-1 ${darkMode ? 'text-white/35' : 'text-gray-400'}`}>
              {isNavigating && (
                <span className={`inline-block w-2.5 h-2.5 border-2 border-t-transparent rounded-full animate-spin ${
                  darkMode ? 'border-accent/50' : 'border-accent-light/50'
                }`} />
              )}
              {truncateUrl(result.document.url)}
            </p>
          )}
        </div>

        <div className={`mt-1.5 flex-shrink-0 transition-all duration-200 ${
          isNavigating ? 'translate-x-0.5 opacity-100' : 'opacity-30'
        }`}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </li>
  );
}

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
