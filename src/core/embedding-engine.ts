// ============================================================
// Embedding Engine — Loads and runs the AI model for vector generation
// ============================================================
import type { EmbeddingConfig, ModelStatus } from '../types/index';

// Dynamic import for @huggingface/transformers to support worker environments
let pipeline: any = null;
let extractor: any = null;

/** Current model status */
let modelStatus: ModelStatus = 'not-loaded';
let loadProgress = 0;
let currentModelId = '';

/** Default model configuration */
const DEFAULT_CONFIG: EmbeddingConfig = {
  modelId: 'Xenova/all-MiniLM-L6-v2',
  quantized: true,
  maxSeqLength: 256,
  embeddingDimension: 384,
};

/**
 * Initialize the embedding model.
 * Downloads and caches the model on first run.
 * Subsequent calls return the cached model instantly.
 */
export async function initializeModel(
  config: Partial<EmbeddingConfig> = {},
  onProgress?: (progress: number, message: string) => void
): Promise<void> {
  if (modelStatus === 'ready' && extractor) return;
  if (modelStatus === 'loading') {
    // Wait for existing load to complete
    while (modelStatus === 'loading') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };
  modelStatus = 'loading';
  loadProgress = 0;

  try {
    onProgress?.(0, 'Loading transformers library...');

    // Dynamic import to avoid issues in non-worker contexts
    const transformers = await import('@huggingface/transformers');
    pipeline = transformers.pipeline;

    // Configure ONNX Runtime to use locally bundled WASM files
    // instead of loading from CDN (blocked by Chrome extension CSP)
    const env = transformers.env;
    if (env?.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.wasmPaths = '/wasm/';
      env.backends.onnx.wasm.numThreads = 1; // Avoid threading issues in extension context
      env.backends.onnx.wasm.proxy = false;
    } else if ((env as any)?.wasm) {
      // Fallback for different API versions
      (env as any).wasm.wasmPaths = '/wasm/';
      (env as any).wasm.numThreads = 1;
      (env as any).wasm.proxy = false;
    }

    // Allow remote models (to download from HuggingFace Hub)
    env.allowRemoteModels = true;

    onProgress?.(0.1, `Loading model: ${cfg.modelId}...`);

    // Create feature extraction pipeline with explicit dtype to suppress warning
    extractor = await pipeline('feature-extraction', cfg.modelId, {
      quantized: cfg.quantized,
      dtype: 'q8',
      progress_callback: (data: any) => {
        if (data.status === 'progress' && data.progress) {
          loadProgress = 0.1 + (data.progress / 100) * 0.85;
          onProgress?.(loadProgress, `Downloading model: ${Math.round(data.progress)}%`);
        }
      },
    });

    loadProgress = 1;
    modelStatus = 'ready';
    currentModelId = cfg.modelId;
    onProgress?.(1, 'Model loaded successfully');
  } catch (error) {
    modelStatus = 'error';
    loadProgress = 0;
    const message = error instanceof Error ? error.message : 'Unknown error loading model';
    onProgress?.(0, `Error: ${message}`);
    throw new Error(`Failed to initialize embedding model: ${message}`);
  }
}

/**
 * Generate embedding vector for a single text string.
 * Returns a Float32Array of size embeddingDimension (default 384).
 */
export async function generateEmbedding(text: string, isQuery: boolean = false): Promise<Float32Array> {
  if (!extractor || modelStatus !== 'ready') {
    throw new Error('Model not initialized. Call initializeModel() first.');
  }

  // Truncate to max token limit
  let inputText = text.substring(0, 512);

  // Run inference
  const output = await extractor(inputText, {
    pooling: 'mean',
    normalize: true,
  });

  // Extract the embedding vector
  const embedding = output.data;
  return new Float32Array(embedding);
}

/**
 * Generate embeddings for multiple text strings in batch.
 * More efficient than calling generateEmbedding() in a loop.
 */
export async function generateEmbeddings(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<Float32Array[]> {
  if (!extractor || modelStatus !== 'ready') {
    throw new Error('Model not initialized. Call initializeModel() first.');
  }

  const results: Float32Array[] = [];
  const batchSize = 8; // Process in small batches to avoid memory issues

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const truncated = batch.map(t => t.substring(0, 1024));

    // Process each item in the batch
    for (const text of truncated) {
      const output = await extractor(text, {
        pooling: 'mean',
        normalize: true,
      });
      results.push(new Float32Array(output.data));
    }

    onProgress?.(Math.min(i + batchSize, texts.length), texts.length);
  }

  return results;
}

/**
 * Get current model status.
 */
export function getModelStatus(): { status: ModelStatus; progress: number } {
  return { status: modelStatus, progress: loadProgress };
}

/**
 * Unload the model and free memory.
 */
export async function unloadModel(): Promise<void> {
  extractor = null;
  modelStatus = 'not-loaded';
  loadProgress = 0;
  currentModelId = '';
}
