import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
  },
  build: {
    outDir: 'build', // keep CRA's build output dir so your Github Actions don't break again!
  },
  define: {
    'process.env.REACT_APP_DATA_PROVIDER': JSON.stringify(process.env.REACT_APP_DATA_PROVIDER || ''),
    'process.env.REACT_APP_MEDIA_PROVIDER': JSON.stringify(process.env.REACT_APP_MEDIA_PROVIDER || ''),
    'process.env.REACT_APP_API_BASE_URL': JSON.stringify(process.env.REACT_APP_API_BASE_URL || ''),
  }
});
