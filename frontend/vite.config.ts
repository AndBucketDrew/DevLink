// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    server: {
      deps: {
        // Broaden the inline to catch any tailwind/csstools related ESM package
        inline: [/@csstools/, /@asamuzakjp/, /tailwind-merge/, /@tailwindcss/],
      },
    },
    // This helps Vitest bypass the CJS/ESM struggle for these libs
    deps: {
      optimizer: {
        web: {
          include: ['@csstools/css-calc', '@asamuzakjp/css-color'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
