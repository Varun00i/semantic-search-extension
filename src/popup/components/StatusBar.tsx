import React from 'react';
import type { IndexingStatus } from '../../types/index';

interface StatusBarProps {
  indexingStatus: IndexingStatus;
  indexingProgress: number;
  statusMessage: string;
  error: string | null;
  onDismissError: () => void;
  darkMode?: boolean;
}

export default function StatusBar({
  indexingStatus,
  indexingProgress,
  statusMessage,
  error,
  onDismissError,
  darkMode,
}: StatusBarProps) {
  if (indexingStatus === 'idle' && !statusMessage && !error) return null;

  // Error
  if (error) {
    return (
      <div className={`px-3 py-2 border-b flex items-center gap-2 animate-slide-in ${
        darkMode ? 'bg-danger/6 border-danger/10' : 'bg-red-50 border-red-100'
      }`} role="alert">
        <div className="w-4 h-4 rounded-full bg-danger/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </div>
        <p className={`text-[11px] flex-1 truncate ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
        <button
          onClick={onDismissError}
          className={`p-1 rounded-lg transition-all duration-150 active:scale-95 ${
            darkMode ? 'text-white/30 hover:text-white/60 hover:bg-white/5' : 'text-black/25 hover:text-black/50 hover:bg-black/5'
          }`}
          aria-label="Dismiss error"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  }

  // Success
  if (indexingStatus === 'complete') {
    return (
      <div className={`px-3 py-2 border-b flex items-center gap-2 animate-slide-in ${
        darkMode ? 'bg-success/6 border-success/10' : 'bg-emerald-50 border-emerald-100'
      }`} role="status">
        <div className="w-4 h-4 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className={`text-[11px] font-medium flex-1 ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{statusMessage || 'Done'}</p>
      </div>
    );
  }

  // Status message
  if (statusMessage && indexingStatus === 'idle') {
    return (
      <div className={`px-3 py-1.5 border-b animate-slide-in ${
        darkMode ? 'bg-accent/5 border-surface-border' : 'bg-blue-50/60 border-surface-light-border'
      }`} role="status">
        <p className={`text-[11px] ${darkMode ? 'text-accent' : 'text-accent-light'}`}>{statusMessage}</p>
      </div>
    );
  }

  // Progress
  if (indexingStatus !== 'idle') {
    const pct = Math.round(indexingProgress * 100);
    return (
      <div className={`px-3 py-2 border-b space-y-1.5 animate-slide-in ${
        darkMode ? 'bg-accent/4 border-surface-border' : 'bg-blue-50/50 border-surface-light-border'
      }`} role="status" aria-label={`Indexing: ${pct}%`}>
        <div className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0 ${
            darkMode ? 'border-accent/60 border-t-transparent' : 'border-accent-light/60 border-t-transparent'
          }`} />
          <p className={`text-[11px] flex-1 truncate font-medium ${darkMode ? 'text-white/80' : 'text-gray-600'}`}>
            {getStatusLabel(indexingStatus)}
            {statusMessage && ` — ${statusMessage}`}
          </p>
          <span className={`text-[10px] font-semibold tabular-nums ${darkMode ? 'text-accent' : 'text-accent-light'}`}>
            {pct}%
          </span>
        </div>
        <div className={`w-full h-[3px] rounded-full overflow-hidden ${darkMode ? 'bg-white/6' : 'bg-black/5'}`}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out progress-glow"
            style={{
              width: `${pct}%`,
              background: darkMode
                ? 'linear-gradient(90deg, #a78bfa, #c4b5fd)'
                : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
            }}
          />
        </div>
      </div>
    );
  }

  return null;
}

function getStatusLabel(status: IndexingStatus): string {
  switch (status) {
    case 'extracting': return 'Extracting text';
    case 'cleaning': return 'Cleaning text';
    case 'chunking': return 'Splitting into chunks';
    case 'embedding': return 'Generating embeddings';
    case 'storing': return 'Saving to database';
    default: return 'Processing';
  }
}
