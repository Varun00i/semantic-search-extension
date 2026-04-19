import React from 'react';
import type { IndexingStatus } from '../../types/index';

interface StatusBarProps {
  indexingStatus: IndexingStatus;
  indexingProgress: number;
  statusMessage: string;
  error: string | null;
  onDismissError: () => void;
}

export default function StatusBar({
  indexingStatus,
  indexingProgress,
  statusMessage,
  error,
  onDismissError,
}: StatusBarProps) {
  // Don't show anything if idle and no messages
  if (indexingStatus === 'idle' && !statusMessage && !error) return null;

  // Error state
  if (error) {
    return (
      <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2 animate-slide-in">
        <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
        </svg>
        <p className="text-xs text-red-700 flex-1">{error}</p>
        <button
          onClick={onDismissError}
          className="text-red-400 hover:text-red-600 p-0.5"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  }

  // Success state
  if (indexingStatus === 'complete') {
    return (
      <div className="px-3 py-2 bg-green-50 border-b border-green-200 flex items-center gap-2 animate-slide-in">
        <svg className="w-4 h-4 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" />
          <path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-xs text-green-700 flex-1">{statusMessage || 'Indexing complete!'}</p>
      </div>
    );
  }

  // Status message only
  if (statusMessage && indexingStatus === 'idle') {
    return (
      <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-200 animate-slide-in">
        <p className="text-xs text-blue-700">{statusMessage}</p>
      </div>
    );
  }

  // Progress state (indexing in progress)
  if (indexingStatus !== 'idle') {
    return (
      <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 space-y-1.5 animate-slide-in">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-xs text-blue-700 flex-1">
            {getStatusLabel(indexingStatus)}
            {statusMessage && ` — ${statusMessage}`}
          </p>
          <span className="text-[10px] text-blue-500 font-medium">
            {Math.round(indexingProgress * 100)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.round(indexingProgress * 100)}%` }}
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
