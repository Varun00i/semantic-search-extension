// ============================================================
// Worker Client — Communicates with the embedding Web Worker
// ============================================================

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  onProgress?: (data: any) => void;
};

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<string, PendingRequest>();

/**
 * Get or create the singleton embedding worker.
 */
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./embedding-worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event) => {
      const { id, type, payload } = event.data;

      // Skip the init message
      if (id === '__init__') return;

      const req = pending.get(id);
      if (!req) return;

      switch (type) {
        case 'SUCCESS':
          pending.delete(id);
          req.resolve(payload);
          break;
        case 'ERROR':
          pending.delete(id);
          req.reject(new Error(payload.message));
          break;
        case 'PROGRESS':
          req.onProgress?.(payload);
          break;
      }
    };

    worker.onerror = (event) => {
      console.error('[EmbeddingWorker] Error:', event.message);
      // Reject all pending requests
      for (const [id, req] of pending) {
        req.reject(new Error(`Worker error: ${event.message}`));
        pending.delete(id);
      }
    };
  }
  return worker;
}

/**
 * Send a request to the embedding worker and return a promise.
 */
function sendRequest(
  type: string,
  payload?: any,
  onProgress?: (data: any) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = `req_${++requestId}`;
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, type, payload });
  });
}

/**
 * Initialize the AI model in the worker.
 */
export async function workerInitModel(
  config?: any,
  onProgress?: (progress: number, message: string) => void
): Promise<void> {
  await sendRequest('INIT_MODEL', { config }, (data) => {
    onProgress?.(data.progress, data.message);
  });
}

/**
 * Generate a single embedding in the worker.
 */
export async function workerEmbedSingle(text: string): Promise<Float32Array> {
  const result = await sendRequest('EMBED_SINGLE', { text });
  return new Float32Array(result.vector);
}

/**
 * Generate batch embeddings in the worker.
 */
export async function workerEmbedBatch(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<Float32Array[]> {
  const result = await sendRequest('EMBED_BATCH', { texts }, (data) => {
    onProgress?.(data.completed, data.total);
  });
  return result.vectors.map((buf: ArrayBuffer) => new Float32Array(buf));
}

/**
 * Get model status from the worker.
 */
export async function workerGetStatus(): Promise<{ status: string; progress: number }> {
  return sendRequest('GET_STATUS');
}

/**
 * Terminate the worker and clean up.
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    pending.clear();
  }
}
