import { defineConfig, build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import copy from 'rollup-plugin-copy';

/**
 * Custom plugin that builds the content script as a separate IIFE bundle
 * after the main build completes. Chrome content scripts cannot use ES modules.
 */
function buildContentScriptPlugin() {
  return {
    name: 'build-content-script-iife',
    async closeBundle() {
      await viteBuild({
        configFile: false,
        build: {
          outDir: 'dist',
          emptyOutDir: false, // Don't clear the main build output
          sourcemap: process.env.NODE_ENV === 'development',
          minify: process.env.NODE_ENV === 'production',
          rollupOptions: {
            input: {
              'content-script': resolve(__dirname, 'src/content/content-script.ts'),
            },
            output: {
              entryFileNames: 'src/content/content-script.js',
              format: 'iife',
            },
          },
          lib: undefined,
        },
      });
      console.log('✓ Content script built as IIFE');
    },
  };
}

/**
 * Custom plugin that:
 * 1. Copies ONNX Runtime WASM files to dist/wasm/ with original names
 * 2. Copies PDF.js worker to dist/pdf/ with original name
 * 3. Rewrites CDN URLs in bundled JS to point to local /wasm/ path
 */
function localWasmPlugin() {
  return {
    name: 'local-wasm-and-pdf-worker',
    writeBundle() {
      // ---- Copy ONNX Runtime WASM files ----
      const wasmDir = resolve(__dirname, 'dist/wasm');
      if (!existsSync(wasmDir)) mkdirSync(wasmDir, { recursive: true });

      const ortDir = resolve(__dirname, 'node_modules/onnxruntime-web/dist');
      const ortFiles = [
        'ort-wasm-simd-threaded.jsep.mjs',
        'ort-wasm-simd-threaded.jsep.wasm',
        'ort-wasm-simd-threaded.mjs',
        'ort-wasm-simd-threaded.wasm',
      ];
      for (const file of ortFiles) {
        const src = resolve(ortDir, file);
        const dest = resolve(wasmDir, file);
        if (existsSync(src)) {
          copyFileSync(src, dest);
          console.log(`  ✓ Copied ${file} → dist/wasm/`);
        }
      }

      // ---- Copy PDF.js worker ----
      const pdfDir = resolve(__dirname, 'dist/pdf');
      if (!existsSync(pdfDir)) mkdirSync(pdfDir, { recursive: true });

      const pdfWorkerSrc = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
      const pdfWorkerDest = resolve(pdfDir, 'pdf.worker.min.mjs');
      if (existsSync(pdfWorkerSrc)) {
        copyFileSync(pdfWorkerSrc, pdfWorkerDest);
        console.log('  ✓ Copied pdf.worker.min.mjs → dist/pdf/');
      }
    },
  };
}

/**
 * Custom plugin that rewrites CDN URLs for ONNX Runtime in bundled output
 * so that dynamic imports load from local /wasm/ instead of jsdelivr CDN.
 * This is critical for Chrome extension CSP compliance.
 */
function rewriteOnnxCdnUrls() {
  return {
    name: 'rewrite-onnx-cdn-urls',
    generateBundle(_options: any, bundle: any) {
      for (const [_name, chunk] of Object.entries(bundle) as any) {
        if (chunk.type === 'chunk' && chunk.code) {
          // Replace any CDN URL for @huggingface/transformers ONNX files
          // with a local /wasm/ path (resolves to chrome-extension://<id>/wasm/)
          const before = chunk.code;
          chunk.code = chunk.code.replace(
            /https:\/\/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers@[^"'`\/]+\/dist\//g,
            '/wasm/'
          );
          if (chunk.code !== before) {
            console.log(`  ✓ Rewrote CDN URLs to /wasm/ in ${_name}`);
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    rewriteOnnxCdnUrls(),
    copy({
      targets: [
        { src: 'manifest.json', dest: 'dist' },
        { src: 'public/icons/*', dest: 'dist/icons' },
        { src: 'src/content/content-script.css', dest: 'dist/src/content' },
      ],
      hook: 'writeBundle',
    }),
    localWasmPlugin(),
    buildContentScriptPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@db': resolve(__dirname, 'src/db'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
        'embedding-worker': resolve(__dirname, 'src/workers/embedding-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') return 'src/background/service-worker.js';
          if (chunkInfo.name === 'embedding-worker') return 'src/workers/embedding-worker.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
});
