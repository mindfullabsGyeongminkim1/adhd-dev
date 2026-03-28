import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist/cli',
    sourcemap: true,
    clean: true,
  },
  {
    entry: ['src/daemon/index.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist/daemon',
    sourcemap: true,
  },
  {
    entry: ['src/notch/main.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist/notch',
    sourcemap: true,
    external: ['electron'],
  },
  {
    // Preload MUST be CommonJS — Electron sandbox requires it
    entry: ['src/notch/preload.ts'],
    format: ['cjs'],
    target: 'node20',
    outDir: 'dist/notch',
    sourcemap: true,
    external: ['electron'],
  },
]);
