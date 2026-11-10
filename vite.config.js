import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2022',
    cssMinify: true,
  },
  server: {
    port: 5173,
  },
});
