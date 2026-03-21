# DALA WMS

DALA WMS is a Railway-hosted warehouse management system with a React frontend and an Express + Postgres backend under `server/`.

Live deployment:
- Frontend: [dalawms.up.railway.app](https://dalawms.up.railway.app)
- API: [dala-wms-api-production.up.railway.app](https://dala-wms-api-production.up.railway.app)
- GitHub: [CreativeSire/DALA_WMS](https://github.com/CreativeSire/DALA_WMS)

## Current architecture

- `src/`: Vite + React operator console
- `server/`: Express API, Railway Postgres access, auth, inventory, reports, and admin flows
- `public/env.js`: runtime frontend config injection for Railway

The current production path is Railway-native. Supabase variables are optional fallback inputs only and should not be treated as the primary deployment target.

## Frontend local development

```powershell
npm install
npm run dev
```

Set `.env.local` for local API access:

```env
VITE_API_BASE_URL=https://dala-wms-api-production.up.railway.app
```

## Backend local development

```powershell
cd server
npm install
npm run db:bootstrap
npm run dev
```

Required backend variables:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=long-secret-at-least-24-characters
FRONTEND_ORIGIN=http://localhost:5173
```

Optional bootstrap admin:

```env
INITIAL_ADMIN_EMAIL=admin@dala.ng
INITIAL_ADMIN_PASSWORD=ChangeMeNow123!
INITIAL_ADMIN_FULL_NAME=DALA Admin
```

## Demo data

To seed a realistic warehouse dataset into the Railway backend:

```powershell
npm run server:seed-demo
```

Or directly:

```powershell
cd server
npm run db:seed-demo
```

The demo seed is intentionally guarded. If stock movements already exist, it exits without overwriting live data.

## Tests

Frontend:

```powershell
npm test
```

Backend:

```powershell
cd server
npm test
```

## Production build

```powershell
npm run build
```

## Railway deployment

### Frontend service

Deploy the repo root with:

```env
VITE_API_BASE_URL=https://dala-wms-api-production.up.railway.app
```

The canonical frontend domain is:

- [dalawms.up.railway.app](https://dalawms.up.railway.app)

### API service

Deploy `server/` as a separate Railway service with:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=long-secret-at-least-24-characters
FRONTEND_ORIGIN=https://dalawms.up.railway.app
```

Then initialize:

```powershell
cd server
npm run db:bootstrap
npm run db:seed-demo
```

## Authentication and admin flows

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/complete-invite`
- `POST /auth/change-password`
- `POST /api/users/invite`
- `POST /api/users/:id/reset-password`
- `PATCH /api/users/:id/status`

The Users page now supports:
- invite link generation
- direct user creation
- temporary password resets
- activation and deactivation

## Operational note

The embedded operator manual in `src/pages/HowItWorksPage.jsx` and `src/content/howItWorks.js` should be updated whenever workflows, permissions, or deployment steps change.
