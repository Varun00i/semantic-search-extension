import React, { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../../types/index';
import { DEFAULT_SETTINGS } from '../../types/index';

export default function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  // Load settings on mount
  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
      }
    });
  }, []);

  const handleSave = useCallback(async () => {
    await chrome.storage.local.set({ settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings]);

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
    <div className="p-3 space-y-4 overflow-y-auto">
      {/* Model Info */}
      <Section title="AI Model">
        <InfoRow label="Model" value={settings.embedding.modelId} />
        <InfoRow label="Dimensions" value={String(settings.embedding.embeddingDimension)} />
        <InfoRow label="Quantized" value={settings.embedding.quantized ? 'Yes (INT8)' : 'No'} />
        <InfoRow label="Max Tokens" value={String(settings.embedding.maxSeqLength)} />
      </Section>

      {/* Chunking Settings */}
      <Section title="Text Chunking">
        <SliderSetting
          label="Chunk Size"
          value={settings.chunking.chunkSize}
          min={200}
          max={1000}
          step={50}
          unit="chars"
          onChange={(v) => updateChunking('chunkSize', v)}
        />
        <SliderSetting
          label="Chunk Overlap"
          value={settings.chunking.chunkOverlap}
          min={0}
          max={200}
          step={10}
          unit="chars"
          onChange={(v) => updateChunking('chunkOverlap', v)}
        />
        <SliderSetting
          label="Min Chunk Size"
          value={settings.chunking.minChunkSize}
          min={20}
          max={200}
          step={10}
          unit="chars"
          onChange={(v) => updateChunking('minChunkSize', v)}
        />
      </Section>

      {/* Search Settings */}
      <Section title="Search">
        <SliderSetting
          label="Max Results"
          value={settings.search.maxResults}
          min={5}
          max={50}
          step={5}
          onChange={(v) => updateSearch('maxResults', v)}
        />
        <SliderSetting
          label="Min Score"
          value={Math.round(settings.search.minScore * 100)}
          min={5}
          max={80}
          step={5}
          unit="%"
          onChange={(v) => updateSearch('minScore', v / 100)}
        />
      </Section>

      {/* Cache Settings */}
      <Section title="Cache">
        <SliderSetting
          label="Max Cached Docs"
          value={settings.maxCachedDocuments}
          min={10}
          max={500}
          step={10}
          onChange={(v) => setSettings(prev => ({ ...prev, maxCachedDocuments: v }))}
        />
        <ToggleSetting
          label="Auto-index pages"
          checked={settings.autoIndex}
          onChange={(v) => setSettings(prev => ({ ...prev, autoIndex: v }))}
        />
      </Section>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className={`w-full py-2 text-xs font-medium rounded-md transition-all ${
          saved
            ? 'bg-green-500 text-white'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
        {saved ? '✓ Saved!' : 'Save Settings'}
      </button>

      {/* About */}
      <div className="text-center pt-2 border-t border-gray-100">
        <p className="text-[10px] text-gray-400">
          Semantic Search Extension v1.0.0
        </p>
        <p className="text-[10px] text-gray-400">
          All processing happens locally in your browser
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-700 mb-2">{title}</h3>
      <div className="space-y-2 bg-gray-50 rounded-lg p-2.5">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className="text-[11px] font-medium text-gray-700 bg-white px-2 py-0.5 rounded">
        {value}
      </span>
    </div>
  );
}

function SliderSetting({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-500">{label}</span>
        <span className="text-[11px] font-medium text-gray-700">
          {value}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-gray-300 rounded-full appearance-none cursor-pointer accent-primary-600"
      />
    </div>
  );
}

function ToggleSetting({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-gray-500">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-4.5 rounded-full transition-colors ${
          checked ? 'bg-primary-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
