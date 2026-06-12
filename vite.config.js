import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function readClientEnv(env, ...keys) {
  for (const key of keys) {
    if (process.env[key] !== undefined) {
      return process.env[key];
    }
    if (env[key] !== undefined) {
      return env[key];
    }
  }
  return '';
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'REACT_APP_']);
  const plugins = [react()];

  if (process.env.ANALYZE_BUNDLE === 'true') {
    const { visualizer } = await import('rollup-plugin-visualizer');
    plugins.push(visualizer({ open: false, filename: 'build/bundle-stats.html' }));
  }

  const productionRemoteFallback = process.env.NODE_ENV === 'production' || process.env.VERCEL;
  const dataProvider =
    readClientEnv(env, 'VITE_DATA_PROVIDER', 'REACT_APP_DATA_PROVIDER') ||
    (productionRemoteFallback ? 'remote' : '');
  const mediaProvider =
    readClientEnv(env, 'VITE_MEDIA_PROVIDER', 'REACT_APP_MEDIA_PROVIDER') ||
    (productionRemoteFallback ? 'remote' : '');
  const apiBaseUrl = readClientEnv(env, 'VITE_API_BASE_URL', 'REACT_APP_API_BASE_URL') || '';
  const googleClientId =
    readClientEnv(env, 'VITE_GOOGLE_CLIENT_ID', 'REACT_APP_GOOGLE_CLIENT_ID') ||
    (productionRemoteFallback ? 'demo' : '');

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 3000,
      strictPort: true,
      hmr: {
        // Fix for WebSocket connection issues - use relative path
        protocol: undefined,
        host: undefined,
        port: undefined,
      },
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
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              const normalizedId = id.replace(/\\/g, '/');
              if (
                /node_modules\/(react|react-dom|scheduler)\//.test(normalizedId) ||
                /node_modules\/\.pnpm\/(react|react-dom|scheduler)@/.test(normalizedId)
              )
                return 'vendor-react-core';
              if (normalizedId.includes('react-virtuoso') || normalizedId.includes('react-window'))
                return 'vendor-virtualized';
              if (normalizedId.includes('@base-ui')) return 'vendor-base-ui';
              if (normalizedId.includes('@sentry')) return 'vendor-observability';
              if (id.includes('langchain')) return 'vendor-langchain';
              if (
                id.includes('lucide') ||
                id.includes('class-variance') ||
                id.includes('clsx') ||
                id.includes('tailwind-merge')
              )
                return 'vendor-ui';
              if (
                id.includes('web-vitals') ||
                id.includes('zod') ||
                id.includes('zustand') ||
                id.includes('idb-keyval') ||
                id.includes('dompurify')
              )
                return 'vendor-utils';
              if (id.includes('geist')) return 'vendor-fonts';
            }
          },
        },
      },
    },
    define: {
      'process.env.REACT_APP_DATA_PROVIDER': JSON.stringify(dataProvider),
      'process.env.REACT_APP_MEDIA_PROVIDER': JSON.stringify(mediaProvider),
      'process.env.REACT_APP_API_BASE_URL': JSON.stringify(apiBaseUrl),
      'import.meta.env.REACT_APP_DATA_PROVIDER': JSON.stringify(dataProvider),
      'import.meta.env.REACT_APP_MEDIA_PROVIDER': JSON.stringify(mediaProvider),
      'import.meta.env.REACT_APP_API_BASE_URL': JSON.stringify(apiBaseUrl),
      'import.meta.env.VITE_DATA_PROVIDER': JSON.stringify(dataProvider),
      'import.meta.env.VITE_MEDIA_PROVIDER': JSON.stringify(mediaProvider),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
      'process.env.REACT_APP_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
    },
  };
});
