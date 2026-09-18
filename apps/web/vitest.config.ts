import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // globals: false — иначе понадобится compilerOptions.types в tsconfig,
    // а это выключает автоподхват остальных @types/*
    globals: false,
    // @expense-tracker/shared собран в CommonJS и слинкован как workspace-пакет,
    // Vite иначе пытается инлайнить его как ESM и падает
    server: {
      deps: {
        external: ['@expense-tracker/shared'],
      },
    },
  },
});
