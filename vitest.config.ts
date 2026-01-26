import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environmentOptions: {
      // Set default environment variables for middleware tests
    },
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      'astro:db': path.resolve(__dirname, './tests/mocks/astro-db.ts'),
      'astro:middleware': path.resolve(__dirname, './tests/mocks/astro-middleware.ts'),
    },
  },
  define: {
    'import.meta.env.ADMIN_USER': JSON.stringify(process.env.ADMIN_USER || 'admin'),
    'import.meta.env.ADMIN_PASSWORD': JSON.stringify(process.env.ADMIN_PASSWORD || 'password'),
  },
});
