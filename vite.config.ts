import { defineConfig } from 'vite';

// Tauri expects a fixed port and no screen clearing.
export default defineConfig({
  clearScreen: false,
  // The Rust build output (gigabytes) must not be watched.
  server: { host: '127.0.0.1', port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**', '**/docs/**'] } },
  build: { target: 'chrome120' }
});
