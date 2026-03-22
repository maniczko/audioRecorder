import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function readClientEnv(...keys) {
  for (const key of keys) {
    if (process.env[key] !== undefined) {
      return process.env[key];
    }
  }
  return '';
}

export default defineConfig(async () => {
  const plugins = [react()];

  if (process.env.ANALYZE_BUNDLE === 'true') {
    const { visualizer } = await import('rollup-plugin-visualizer');
    plugins.push(visualizer({ open: false, filename: 'build/bundle-stats.html' }));
  }

  const productionRemoteFallback = process.env.NODE_ENV === 'production' || process.env.VERCEL;
  const dataProvider = readClientEnv('VITE_DATA_PROVIDER', 'REACT_APP_DATA_PROVIDER') || (productionRemoteFallback ? 'remote' : '');
  const mediaProvider = readClientEnv('VITE_MEDIA_PROVIDER', 'REACT_APP_MEDIA_PROVIDER') || (productionRemoteFallback ? 'remote' : '');
  const apiBaseUrl =
    readClientEnv('VITE_API_BASE_URL', 'REACT_APP_API_BASE_URL') ||
    (productionRemoteFallback ? 'https://audiorecorder-production.up.railway.app' : '');
  const googleClientId =
    readClientEnv('VITE_GOOGLE_CLIENT_ID', 'REACT_APP_GOOGLE_CLIENT_ID') ||
    (productionRemoteFallback ? 'demo' : '');

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
