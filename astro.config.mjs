import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import { fileURLToPath } from 'node:url';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  vite: {
    resolve: {
      alias: {
        '@': srcPath,
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
  security: {
    checkOrigin: true,
  },
});




