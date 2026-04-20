import React, { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../../types/index';
import { DEFAULT_SETTINGS } from '../../types/index';

export default function SettingsPanel({ darkMode, onDarkModeChange }: { darkMode?: boolean; onDarkModeChange?: (v: boolean) => void }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
      }
    });
  }, []);

  const handleSave = useCallback(async () => {
    const toSave = { ...settings, darkMode: !!darkMode };
    await chrome.storage.local.set({ settings: toSave });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings, darkMode]);

  const updateChunking = (key: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      chunking: { ...prev.chunking, [key]: value },
    }));
  };

  const updateSearch = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      search: { ...prev.search, [key]: value },
    }));
  };

  return (
    <div className="p-3 space-y-2.5">
      {/* Appearance Toggle — grouped card */}
      <div className={`rounded-apple-lg overflow-hidden border ${
        darkMode ? 'bg-surface-1 border-surface-border' : 'bg-white border-surface-light-border shadow-sm'
      }`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-apple flex items-center justify-center ${
              darkMode ? 'bg-gradient-to-b from-violet-500 to-violet-600' : 'bg-gradient-to-b from-violet-400 to-violet-500'
            }`}>
              <span className="text-sm">{darkMode ? '🌙' : '☀️'}</span>
            </div>
            <div>
              <p className={`text-[12px] font-semibold tracking-[-0.01em] ${darkMode ? 'text-white/95' : 'text-gray-800'}`}>Appearance</p>
              <p className={`text-[10px] ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>{darkMode ? 'Dark' : 'Light'}</p>
            </div>
          </div>
          <AppleToggle
            checked={!!darkMode}
            onChange={(v) => {
              if (onDarkModeChange) onDarkModeChange(v);
              setSettings(prev => ({ ...prev, darkMode: v }));
              chrome.storage.local.get('settings', (result) => {
                const s = { ...DEFAULT_SETTINGS, ...(result.settings || {}), darkMode: v };
                chrome.storage.local.set({ settings: s });
              });
            }}
          />
        </div>
      </div>

      {/* Model Info */}
      <GroupedSection title="AI Model" darkMode={darkMode}>
        <InfoRow label="Model" value={settings.embedding.modelId} darkMode={darkMode} />
        <InfoRow label="Dimensions" value={String(settings.embedding.embeddingDimension)} darkMode={darkMode} />
        <InfoRow label="Quantized" value={settings.embedding.quantized ? 'Yes (INT8)' : 'No'} darkMode={darkMode} />
        <InfoRow label="Max Tokens" value={String(settings.embedding.maxSeqLength)} darkMode={darkMode} last />
      </GroupedSection>

      {/* Chunking Settings */}
      <GroupedSection title="Text Chunking" darkMode={darkMode}>
        <SliderSetting
          label="Chunk Size"
          value={settings.chunking.chunkSize}
          min={100} max={800} step={50}
          unit="chars"
          onChange={(v) => updateChunking('chunkSize', v)}
          darkMode={darkMode}
        />
        <SliderSetting
          label="Overlap"
          value={settings.chunking.chunkOverlap}
          min={0} max={150} step={10}
          unit="chars"
          onChange={(v) => updateChunking('chunkOverlap', v)}
          darkMode={darkMode}
        />
        <SliderSetting
          label="Min Size"
          value={settings.chunking.minChunkSize}
          min={20} max={150} step={10}
          unit="chars"
          onChange={(v) => updateChunking('minChunkSize', v)}
          darkMode={darkMode}
          last
        />
      </GroupedSection>

      {/* Search Settings */}
      <GroupedSection title="Search" darkMode={darkMode}>
        <SliderSetting
          label="Max Results"
          value={settings.search.maxResults}
          min={5} max={30} step={5}
          onChange={(v) => updateSearch('maxResults', v)}
          darkMode={darkMode}
        />
        <SliderSetting
          label="Min Score"
          value={Math.round(settings.search.minScore * 100)}
          min={10} max={80} step={5}
          unit="%"
          onChange={(v) => updateSearch('minScore', v / 100)}
          darkMode={darkMode}
          last
        />
      </GroupedSection>

      {/* Cache Settings */}
      <GroupedSection title="Storage" darkMode={darkMode}>
        <SliderSetting
          label="Max Documents"
          value={settings.maxCachedDocuments}
          min={10} max={500} step={10}
          onChange={(v) => setSettings(prev => ({ ...prev, maxCachedDocuments: v }))}
          darkMode={darkMode}
        />
        <ToggleRow
          label="Auto-index pages"
          checked={settings.autoIndex}
          onChange={(v) => {
            setSettings(prev => ({ ...prev, autoIndex: v }));
            // Persist immediately so service worker picks it up
            chrome.storage.local.get('settings', (result) => {
              const s = { ...DEFAULT_SETTINGS, ...(result.settings || {}), autoIndex: v };
              chrome.storage.local.set({ settings: s });
            });
          }}
          darkMode={darkMode}
          last
        />
      </GroupedSection>

      {/* Save / Reset */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          aria-label={saved ? 'Settings saved' : 'Save settings'}
          className={`flex-1 py-2.5 text-[12px] font-semibold rounded-apple transition-all duration-200 active:scale-[0.97] ${
            saved
              ? 'bg-success text-white'
              : darkMode
                ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-400 hover:to-purple-400 shadow-glow-sm'
                : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-400 hover:to-purple-400 shadow-apple-sm'
          }`}
        >
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
        <button
          onClick={() => {
            setSettings(DEFAULT_SETTINGS);
            chrome.storage.local.remove('settings');
            setSaved(false);
            if (onDarkModeChange) onDarkModeChange(true);
          }}
          aria-label="Reset settings to defaults"
          className={`px-4 py-2.5 text-[12px] font-semibold rounded-apple transition-all duration-200 active:scale-[0.97] border ${
            darkMode
              ? 'text-white/70 bg-white/[0.05] border-surface-border hover:bg-white/10'
              : 'text-gray-500 bg-white border-surface-light-border hover:bg-gray-50 shadow-sm'
          }`}
        >
          Reset
        </button>
      </div>

      {/* Footer */}
      <div className={`text-center pt-3 border-t ${darkMode ? 'border-surface-border' : 'border-surface-light-border'}`}>
        <p className={`text-[10px] font-medium ${darkMode ? 'text-white/40' : 'text-gray-400'}`}>
          Semantic Search v1.0.0
        </p>
        <p className={`text-[9px] mt-0.5 ${darkMode ? 'text-white/25' : 'text-gray-400'}`}>
          All processing happens locally in your browser
        </p>
      </div>
    </div>
  );
}

/* ---- Apple-style Grouped Section ---- */
function GroupedSection({ title, children, darkMode }: { title: string; children: React.ReactNode; darkMode?: boolean }) {
  return (
    <div>
      <h3 className={`text-[11px] font-semibold uppercase tracking-wide px-1 mb-1.5 ${
        darkMode ? 'text-white/45' : 'text-gray-400'
      }`}>{title}</h3>
      <div className={`rounded-apple-lg overflow-hidden border ${
        darkMode ? 'bg-surface-1 border-surface-border' : 'bg-white border-surface-light-border shadow-sm'
      }`}>
        {children}
      </div>
    </div>
  );
}

/* ---- Info row ---- */
function InfoRow({ label, value, darkMode, last }: { label: string; value: string; darkMode?: boolean; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${
      !last ? (darkMode ? 'border-b border-surface-border' : 'border-b border-surface-light-border') : ''
    }`}>
      <span className={`text-[12px] ${darkMode ? 'text-white/70' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-[12px] font-medium truncate max-w-[55%] ${darkMode ? 'text-white/95' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

/* ---- Slider row ---- */
function SliderSetting({
  label, value, min, max, step, unit, onChange, darkMode, last,
}: {
  label: string; value: number; min: number; max: number; step: number;
  unit?: string; onChange: (value: number) => void; darkMode?: boolean; last?: boolean;
}) {
  return (
    <div className={`px-4 py-2.5 ${
      !last ? (darkMode ? 'border-b border-surface-border' : 'border-b border-surface-light-border') : ''
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[12px] ${darkMode ? 'text-white/70' : 'text-gray-600'}`}>{label}</span>
        <span className={`text-[12px] font-semibold tabular-nums ${darkMode ? 'text-white/95' : 'text-gray-800'}`}>
          {value}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          background: darkMode
            ? `linear-gradient(to right, #b794f6 ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.06) ${((value - min) / (max - min)) * 100}%)`
            : `linear-gradient(to right, #8b5cf6 ${((value - min) / (max - min)) * 100}%, rgba(0,0,0,0.06) ${((value - min) / (max - min)) * 100}%)`,
        }}
        aria-label={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
      />
    </div>
  );
}

/* ---- Toggle row ---- */
function ToggleRow({ label, checked, onChange, darkMode, last }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; darkMode?: boolean; last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${
      !last ? (darkMode ? 'border-b border-surface-border' : 'border-b border-surface-light-border') : ''
    }`}>
      <span className={`text-[12px] ${darkMode ? 'text-white/70' : 'text-gray-600'}`}>{label}</span>
      <AppleToggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* ---- Compact toggle switch ---- */
function AppleToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={`relative w-[40px] h-[24px] rounded-full transition-all duration-300 ease-in-out flex-shrink-0 ${
        checked ? 'bg-accent shadow-[inset_0_0_0_1px_rgba(167,139,250,0.3)]' : 'bg-surface-3 shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.1)]'
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] bg-white rounded-full transition-all duration-300 ease-in-out ${
          checked ? 'translate-x-[16px] shadow-[0_2px_5px_rgba(0,0,0,0.25)]' : 'translate-x-0 shadow-[0_1px_3px_rgba(0,0,0,0.2)]'
        }`}
      />
    </button>
  );
}
