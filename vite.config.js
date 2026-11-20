import { defineConfig } from 'vite';

// Relative base so the site works both at the root of a domain and under
// https://<user>.github.io/cripticoEmotes/ (GitHub Pages).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
