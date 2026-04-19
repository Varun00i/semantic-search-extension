// ============================================================
// Embedding Worker — Runs AI model inference off the main thread
// ============================================================
// This Web Worker handles all embedding computation to keep the UI responsive.

import { initializeModel, generateEmbedding, generateEmbeddings, getModelStatus } from '../core/embedding-engine';

/** Message types the worker can receive */
interface WorkerRequest {
  id: string;
  type: 'INIT_MODEL' | 'EMBED_SINGLE' | 'EMBED_BATCH' | 'GET_STATUS';
  payload?: any;
}

/** Message types the worker sends back */
interface WorkerResponse {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  payload?: any;
}

function postResponse(response: WorkerResponse) {
  self.postMessage(response);
}

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data;

  try {
    switch (type) {
      case 'INIT_MODEL': {
        await initializeModel(payload?.config || {}, (progress, message) => {
          postResponse({
            id,
            type: 'PROGRESS',
            payload: { progress, message },
          });
        });
        postResponse({
          id,
          type: 'SUCCESS',
          payload: { status: 'ready' },
        });
        break;
      }

      case 'EMBED_SINGLE': {
        const vector = await generateEmbedding(payload.text);
        // Transfer the underlying ArrayBuffer for zero-copy
        const buffer = vector.buffer.slice(0);
        postResponse({
          id,
          type: 'SUCCESS',
          payload: { vector: buffer },
        });
        break;
      }

      case 'EMBED_BATCH': {
        const vectors = await generateEmbeddings(
          payload.texts,
          (completed: number, total: number) => {
            postResponse({
              id,
              type: 'PROGRESS',
              payload: { completed, total },
            });
          }
        );

        // Convert Float32Arrays to transferable ArrayBuffers
        const buffers = vectors.map(v => v.buffer.slice(0));
        postResponse({
          id,
          type: 'SUCCESS',
          payload: { vectors: buffers },
        });
        break;
      }

      case 'GET_STATUS': {
        postResponse({
          id,
          type: 'SUCCESS',
          payload: getModelStatus(),
        });
        break;
      }

      default:
        postResponse({
          id,
          type: 'ERROR',
          payload: { message: `Unknown message type: ${type}` },
        });
    }
  } catch (error) {
    postResponse({
      id,
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : 'Unknown worker error',
      },
    });
  }
};

// Signal that the worker is ready
self.postMessage({ id: '__init__', type: 'SUCCESS', payload: { ready: true } });
