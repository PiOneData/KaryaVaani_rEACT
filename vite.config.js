import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The legacy roster card fetches /api/om-mapping; proxy it to the backend
// (run: cd backend && npm install && npm run seed && npm start).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
