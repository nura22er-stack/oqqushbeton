import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled by DISABLE_HMR in hosted preview environments.
      // Do not modify this: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': 'http://127.0.0.1:3050',
        '/gemini-live': {
          target: 'ws://127.0.0.1:3060',
          ws: true,
        },
      },
    },
  };
});
