import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173', // Your Vite dev server
    env: {
      apiUrl: 'https://devlink-backend-ra01.onrender.com', // Your real backend or local dev backend
    },
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
