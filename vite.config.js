import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: false, filename: 'build/bundle-stats.html' })
  ],
  esbuild: {
    loader: 'tsx', // Treat all unknown files via tsx loader so JSX in .js works
    include: /src\/.*\.[tj]sx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx', // enable jsx inside .js for dependency optimization phase
      },
    },
  },
  server: {
    port: 3000, // keep the CRA default port
    proxy: {
      '/voice-profiles': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/users': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/state': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/workspaces': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/media': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/transcribe': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'build', // keep CRA's build output dir so your Github Actions don't break again!
  },
  define: {
    'process.env.REACT_APP_DATA_PROVIDER': JSON.stringify(process.env.REACT_APP_DATA_PROVIDER || (process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'remote' : '')),
    'process.env.REACT_APP_MEDIA_PROVIDER': JSON.stringify(process.env.REACT_APP_MEDIA_PROVIDER || (process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'remote' : '')),
    'process.env.REACT_APP_API_BASE_URL': JSON.stringify(process.env.REACT_APP_API_BASE_URL || (process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'https://audiorecorder-production.up.railway.app' : '')),
  }
});
