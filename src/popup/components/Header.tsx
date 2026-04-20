import React from 'react';

export default function Header({ darkMode, onPopOut }: { darkMode?: boolean; onPopOut?: () => void }) {
  return (
    <header
      className={`drag-handle flex items-center gap-3 px-4 py-3 select-none border-b transition-colors duration-200 ${
        darkMode
          ? 'bg-gradient-to-r from-surface-1 via-surface-1 to-[rgba(139,92,246,0.06)] border-surface-border'
          : 'bg-gradient-to-r from-surface-light-0 via-surface-light-1 to-[rgba(139,92,246,0.05)] border-surface-light-border'
      }`}
      role="banner"
    >
      {/* App icon — gradient orb */}
      <div className={`relative w-9 h-9 rounded-[12px] flex items-center justify-center ${
        darkMode
          ? 'bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-glow-sm'
          : 'bg-gradient-to-br from-violet-400 via-purple-400 to-fuchsia-400 shadow-glow-sm'
      }`}>
        <svg
          className="w-[18px] h-[18px] text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className={`text-[13px] font-bold leading-tight tracking-[-0.02em] ${
          darkMode ? 'text-white' : 'text-gray-800'
        }`}>Semantic Search</h1>
        <p className={`text-[10px] leading-tight mt-0.5 tracking-[-0.01em] ${
          darkMode ? 'text-white/50' : 'text-gray-500'
        }`}>Private &middot; Offline AI</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-mono font-semibold tracking-tight ${
          darkMode
            ? 'bg-accent/12 text-accent border border-accent/20'
            : 'bg-accent-light/8 text-accent-light border border-accent-light/15'
        }`}>
          Ctrl+Shift+F
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold tracking-wide uppercase ${
          darkMode
            ? 'bg-success/12 text-success border border-success/15'
            : 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
        }`}>
          <span className="w-[5px] h-[5px] rounded-full bg-current animate-pulse-soft" />
          Local
        </span>
        {onPopOut && (
          <button
            onClick={onPopOut}
            className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 ${
              darkMode
                ? 'text-white/50 hover:text-accent hover:bg-accent/10'
                : 'text-gray-400 hover:text-accent-light hover:bg-accent-light/8'
            }`}
            aria-label="Open in new window"
            title="Open in window"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
