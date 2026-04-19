import React from 'react';

export default function Header() {
  return (
    <header className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
      <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>
      <div>
        <h1 className="text-sm font-semibold leading-tight">Semantic Search</h1>
        <p className="text-[10px] text-primary-200 leading-tight">AI-Powered Offline Search</p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-white/20">
          Offline
        </span>
      </div>
    </header>
  );
}
