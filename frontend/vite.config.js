import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateFrontend } from '../scripts/f00/frontend-config.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  validateFrontend(env);
  const webPort = Number(process.env.FARMAFIND_DEV_WEB_PORT ?? '5173');
  const apiPort = Number(process.env.FARMAFIND_DEV_API_PORT ?? '3000');
  if (![webPort, apiPort].every(port => Number.isInteger(port) && port >= 1024 && port <= 65535)) {
    throw new Error('Puertos de desarrollo local inválidos');
  }
  return {
    plugins: [react()],
    server: { host: '127.0.0.1', port: webPort, strictPort: true,
      proxy: { '/api/v1': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false } } },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  };
});
