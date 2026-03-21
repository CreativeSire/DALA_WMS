# DALA WMS

Warehouse Management System frontend built with Vite and React, with an in-progress Railway-native backend under `server/`.

## Local development

```powershell
npm install
npm run dev
```

Set these variables in `.env.local` before using the live app:

```env
VITE_API_BASE_URL=https://your-dala-wms-api.up.railway.app
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

`VITE_API_BASE_URL` enables the new Railway backend for login, users, products, and brand partners.
The inventory/ledger/reporting modules still use the Supabase path until the remaining migration work is completed.

## Tests

```powershell
npm test
```

## Production build

```powershell
npm run build
```

## Railway deployment

This repo includes a `Dockerfile`, so Railway can deploy it directly from GitHub.

### 1. Connect the repo

- Open Railway and create a new project from GitHub.
- Select `CreativeSire/DALA_WMS`.

### 2. Set required environment variables

Add these in Railway before or immediately after the first deploy:

```env
VITE_API_BASE_URL=https://your-dala-wms-api.up.railway.app
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

If none of these values are set, the app will still boot into a setup/manual screen so the deployment can be reviewed without crashing.

## Railway backend

The replacement backend lives in [server/README.md](/C:/Users/HomePC/Desktop/DALA%20WMS/server/README.md).

Current Railway backend coverage:

- login/logout/session lookup
- users
- products
- brand partners

Not migrated yet:

- dashboard
- GRN
- dispatch
- ledger
- expiry
- casualties
- reorder
- partner performance
- physical count
- reports

### 3. Deploy the Supabase Edge Function separately

User invite/create runs through Supabase, not Railway.

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
npm run deploy:user-admin
```

If your local Supabase project is not linked, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-user-admin.ps1 -ProjectRef your-project-ref
```

## Review artifacts

- Standalone manual review page: `manual-review.html`
- Embedded in-app manual: `src/pages/HowItWorksPage.jsx`
