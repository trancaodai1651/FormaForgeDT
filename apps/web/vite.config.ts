import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/FormaForgeDT/' : '/',
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['manifold-3d'] },
});
