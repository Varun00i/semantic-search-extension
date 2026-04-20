import React, { useState, useRef, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onIndexPage: () => void;
  isSearching: boolean;
  isIndexing: boolean;
  onFileUpload: (file: File) => void;
  darkMode?: boolean;
}

export default function SearchBar({
  onSearch,
  onIndexPage,
  isSearching,
  isIndexing,
  onFileUpload,
  darkMode,
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (value.trim().length >= 2) {
          onSearch(value.trim());
        }
      }, 250);
    },
    [onSearch]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputValue.trim()) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onSearch(inputValue.trim());
      }
    },
    [inputValue, onSearch]
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    onSearch('');
    inputRef.current?.focus();
  }, [onSearch]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileUpload(file);
        e.target.value = '';
      }
    },
    [onFileUpload]
  );

  return (
    <div className={`p-3 space-y-2.5 border-b transition-colors duration-200 ${
      darkMode ? 'border-surface-border' : 'border-surface-light-border'
    }`}>
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative group">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Search by meaning..."
            aria-label="Semantic search query"
            className={`w-full pl-9 pr-16 py-2.5 text-[13px] rounded-apple border transition-all duration-200 ${
              darkMode
                ? 'bg-white/[0.07] border-surface-border text-white placeholder:text-white/35 focus:bg-white/[0.1] focus:border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/25'
                : 'bg-white border-surface-light-border text-gray-800 placeholder:text-gray-400 focus:border-accent-light/30 focus:outline-none focus:ring-2 focus:ring-accent-light/20 shadow-sm'
            }`}
            autoFocus
          />
          <svg
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
              darkMode ? 'text-white/30 group-focus-within:text-accent' : 'text-black/30 group-focus-within:text-accent-light'
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isSearching && (
              <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${
                darkMode ? 'border-accent/60' : 'border-accent-light/60'
              }`} />
            )}
            {inputValue && !isSearching && (
              <button
                type="button"
                onClick={handleClear}
                className={`w-5 h-5 flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 ${
                  darkMode ? 'text-white/30 hover:text-white/60 bg-white/8 hover:bg-white/12' : 'text-black/30 hover:text-black/50 bg-black/6 hover:bg-black/10'
                }`}
                aria-label="Clear search"
              >
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onIndexPage}
          disabled={isIndexing}
          aria-label={isIndexing ? 'Indexing in progress' : 'Index current page'}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-apple disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.97] ${
            darkMode
              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-400 hover:to-purple-400 shadow-glow-sm'
              : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-400 hover:to-purple-400 shadow-apple-sm'
          }`}
        >
          {isIndexing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Indexing...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Index Page
            </>
          )}
        </button>

        <div className="tooltip-trigger">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isIndexing}
            aria-label="Upload a text or PDF file"
            className={`flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-apple disabled:opacity-40 transition-all duration-150 active:scale-[0.97] border ${
              darkMode
                ? 'text-white/80 bg-white/[0.06] border-surface-border hover:bg-white/10 hover:border-accent/20'
                : 'text-gray-600 bg-white border-surface-light-border hover:bg-accent-light/5 hover:border-accent-light/20 shadow-sm'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Upload
          </button>
          <span className="tooltip-content">.txt .md .pdf .html .csv .json</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.html,.htm,.csv,.json"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
