import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/lib/tasks')) {
            return 'tasks-lib';
          }
          if (id.includes('/src/lib/analysis')) {
            return 'analysis-lib';
          }
        }
      }
    }
  },
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  }
});
