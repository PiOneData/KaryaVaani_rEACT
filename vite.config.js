import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The legacy roster card fetches /api/om-mapping; proxy it to the backend
// (run: cd backend && npm install && npm run seed && npm start).
export default defineConfig({
  plugins: [react()],
  // Build-time id used to cache-bust the unversioned legacy script URL
  // (public/legacy/app.js) so a new deploy is never served stale from cache.
  define: {
    __KV_BUILD_ID__: JSON.stringify(String(Date.now())),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
