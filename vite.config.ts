import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Tauri expects a fixed dev port and no screen clearing.
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: '127.0.0.1' },
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'], environment: 'node' },
});
