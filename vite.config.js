import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async () => {
  const plugins = [react()];

  if (process.env.ANALYZE_BUNDLE === 'true') {
    const { visualizer } = await import('rollup-plugin-visualizer');
    plugins.push(visualizer({ open: false, filename: 'build/bundle-stats.html' }));
  }

  return {
    plugins,
    esbuild: {
      loader: 'tsx',
      include: /src\/.*\.[tj]sx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/voice-profiles': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/users': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/state': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/workspaces': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/media': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/transcribe': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'build',
    },
    define: {
      'process.env.REACT_APP_DATA_PROVIDER': JSON.stringify(
        process.env.REACT_APP_DATA_PROVIDER ||
          (process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'remote' : '')
      ),
      'process.env.REACT_APP_MEDIA_PROVIDER': JSON.stringify(
        process.env.REACT_APP_MEDIA_PROVIDER ||
          (process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'remote' : '')
      ),
      'process.env.REACT_APP_API_BASE_URL': JSON.stringify(
        process.env.REACT_APP_API_BASE_URL ||
          (process.env.NODE_ENV === 'production' || process.env.VERCEL
            ? 'https://audiorecorder-production.up.railway.app'
            : '')
      ),
    },
  };
});
