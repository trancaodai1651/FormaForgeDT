import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages needs an absolute repository base, while Tauri loads the
  // compiled frontend from a local resource URL. Absolute `/FormaForgeDT/`
  // paths make the packaged desktop window render as a blank page.
  base: mode === 'desktop' || process.env.VITE_DESKTOP === 'true'
    ? './'
    : process.env.NODE_ENV === 'production'
      ? '/FormaForgeDT/'
      : '/',
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['manifold-3d'] },
}));
