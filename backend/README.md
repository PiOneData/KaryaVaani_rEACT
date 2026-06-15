# Karya Vaani — backend

Tiny API + file-backed store (no DB server, no native modules). Serves the
OM Manpower manager-mapping roster, seeded from
`../OM Manpower_Attendance_Mapping Data.ods`.

## Run
```
cd backend
npm install
npm run seed     # parse the .ods -> data/om.db.json
npm start        # API on http://localhost:4000
```

Endpoints: `GET /api/om-mapping`, `GET /api/health`.

The Vite dev server proxies `/api` to this backend, so run both:
`npm run dev` (frontend, in karya-vaani-react/) and `npm start` (backend).
