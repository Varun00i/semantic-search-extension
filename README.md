# Semantic Search — Offline AI Browser Extension

A high-speed, fully offline semantic search browser extension powered by a lightweight AI embedding model (~100 MB). Search by **meaning**, not just keywords — across webpages, PDFs, and text documents, entirely inside your browser.

## Features

- **Semantic Search**: Understands meaning — "car engine problem" matches "vehicle motor issue"
- **Fully Offline**: No cloud APIs, no data leaves your browser
- **Fast**: Response time under 1 second using pre-computed embeddings and HNSW index
- **Multi-Source**: Search across webpages, PDFs, and local text files
- **Privacy-First**: All processing and storage is 100% local
- **Intelligent Caching**: Previously indexed pages are instantly searchable

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser Extension                  │
├──────────┬──────────┬───────────┬───────────────────┤
│  Popup   │ Content  │  Service  │    Offscreen      │
│   UI     │ Script   │  Worker   │    Document       │
│ (React)  │ (DOM     │ (Message  │  (Web Worker +    │
│          │  Access) │  Router)  │   ONNX Model)     │
├──────────┴──────────┴───────────┴───────────────────┤
│              Core Engine Layer                        │
├────────┬──────────┬────────────┬────────────────────┤
│ Text   │Embedding │ Similarity │  Cache / Index     │
│Processor│ Engine  │  Search    │  (IndexedDB)       │
└────────┴──────────┴────────────┴────────────────────┘
```

## Tech Stack

| Category        | Technology                           |
|-----------------|--------------------------------------|
| Extension       | Manifest v3 (Chrome)                 |
| Language        | TypeScript                           |
| UI Framework    | React 18 + Tailwind CSS              |
| AI Model        | all-MiniLM-L6-v2 (ONNX, quantized)  |
| Model Runtime   | @huggingface/transformers (ONNX Web) |
| Storage         | IndexedDB via Dexie.js               |
| PDF Parsing     | pdf.js                               |
| Vector Search   | Cosine Similarity + HNSW             |
| Build Tool      | Vite 6                               |
| Testing         | Jest                                 |

## Project Structure

```
src/
├── background/       # Service worker (message routing)
├── content/          # Content script (page text extraction)
├── core/             # Core engine modules
│   ├── controller.ts       # Main controller / orchestrator
│   ├── embedding-engine.ts # AI model loading & inference
│   ├── text-processor.ts   # Text cleaning & chunking
│   ├── similarity-search.ts# Vector search (cosine + HNSW)
│   ├── cache-manager.ts    # Cache invalidation & management
│   └── pdf-extractor.ts    # PDF text extraction
├── db/               # Database schema (Dexie.js)
├── offscreen/        # Offscreen document for background inference
├── popup/            # Popup UI (React components)
│   └── components/
├── styles/           # Global CSS (Tailwind)
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── workers/          # Web Worker for embedding computation
```

## Getting Started

### Option 1: Install from ZIP (No coding required)
1. Download the latest `semantic-search-extension.zip` from [Releases](../../releases)
2. Extract the ZIP file to a folder
3. Open Chrome → `chrome://extensions/`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked**
6. Select the extracted folder (it should contain `manifest.json`)
7. The extension icon appears in your toolbar — you're ready!


## How It Works

### Indexing (One-Time Per Page)
1. **Extract** text from the current webpage, PDF, or file
2. **Clean** by removing HTML tags, scripts, and noise
3. **Chunk** text into 200–500 token segments preserving sentences
4. **Embed** each chunk into a 384-dimensional vector using MiniLM
5. **Store** vectors + metadata in IndexedDB for instant retrieval

### Searching
1. **Embed** the search query using the same AI model
2. **Compare** query vector against all stored vectors (cosine similarity)
3. **Rank** results by semantic relevance
4. **Display** matching text with confidence scores and navigation

## Model Details

- **Model**: `Xenova/all-MiniLM-L6-v2` (sentence-transformers)
- **Size**: ~22 MB (quantized INT8)
- **Dimensions**: 384
- **Runtime**: ONNX Runtime Web via @huggingface/transformers
- **Execution**: Web Worker (non-blocking)

## Performance Targets

| Metric              | Target        |
|---------------------|---------------|
| Search latency      | < 1 second    |
| Indexing (per page)  | < 3 seconds   |
| Model load (first)  | < 5 seconds   |
| Memory usage        | < 200 MB      |
| Storage per page    | ~50-200 KB    |

## Privacy & Security

- All data stays in browser localStorage/IndexedDB
- No network requests after model download
- No telemetry or tracking
- Minimal extension permissions
- Content Security Policy enforced

## License

MIT
