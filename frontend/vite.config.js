import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateFrontend } from '../scripts/f00/frontend-config.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  validateFrontend(env);
  return {
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true,
      proxy: { '/api/v1': { target: 'http://127.0.0.1:3000', changeOrigin: false } } },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  };
});
