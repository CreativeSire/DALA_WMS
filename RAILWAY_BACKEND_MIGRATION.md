# DALA WMS: Removing Supabase and Moving Backend to Railway

This app can run without Supabase, but doing that requires replacing four things:

1. Authentication
2. Database access
3. Database-derived reporting/views
4. Server-side admin actions

This is not a config swap. It is a backend migration.

## Recommended Railway-native target stack

- Frontend: keep the current Vite React app
- API: Node.js on Railway
- Database: Railway Postgres
- ORM/query layer: Prisma or Drizzle
- Auth: JWT + httpOnly cookie sessions
- Password hashing: bcrypt
- Validation: zod

## What currently depends on Supabase

### Auth

- `src/App.jsx`
- `src/pages/LoginPage.jsx`
- `src/components/Layout.jsx`
- `src/pages/ProductsPage.jsx` user invite/create flow

Current Supabase responsibilities:
- sign in
- reset password email
- session lookup
- sign out
- profile lookup by auth user id
- role-based access

### Data reads/writes

All operational pages use direct browser calls to Supabase tables/views:

- Dashboard
- GRN
- Dispatch
- Ledger
- Expiry
- Casualties
- Reorder
- Partner performance
- Physical count
- Reports
- Products
- Brand partners
- Users

### RPC/functions

The current frontend depends on generated values and batch status logic:

- `generate_grn_number`
- `generate_dispatch_number`
- `generate_count_ref`
- `update_batch_statuses`

### Edge Function

- `supabase/functions/user-admin/index.ts`

This must become a normal API route in the Railway backend.

## Current database model to recreate

From `supabase_schema_complete.sql`, the backend needs these entities:

- `profiles`
- `brand_partners`
- `products`
- `stock_batches`
- `stock_movements`
- `grn_records`
- `grn_items`
- `dispatch_notes`
- `dispatch_items`
- `casualties`
- `count_sessions`
- `count_lines`

And these current derived views need backend equivalents:

- `current_stock`
- `expiry_alerts`
- `reorder_alerts`
- `casualty_summary`
- `brand_partner_summary`
- `count_detail`

## Railway migration plan

### Phase 1: Backend foundation

Create a new backend service, either:

- `server/` inside this repo, deployed as a second Railway service, or
- a separate backend repo

Minimum endpoints:

- `GET /health`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/reset-password-request`
- `GET /auth/me`

Minimum middleware:

- cookie/session auth
- role authorization
- request validation
- error handling

### Phase 2: Move schema to Railway Postgres

Take `supabase_schema_complete.sql` and convert it into normal Postgres migrations.

Recommended approach:

- create Railway Postgres
- create Prisma/Drizzle schema
- convert all tables first
- keep views either as SQL views or API-layer queries

Important:
- RLS policies will not exist anymore
- authorization must move into backend code

### Phase 3: Replace Supabase auth

Replace:

- `supabase.auth.signInWithPassword`
- `supabase.auth.getSession`
- `supabase.auth.onAuthStateChange`
- `supabase.auth.signOut`
- `supabase.auth.resetPasswordForEmail`

With:

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/reset-password-request`

Frontend change:
- create a small `apiClient`
- store auth state from backend responses instead of Supabase session objects

### Phase 4: Replace direct table access with API routes

Every current `supabase.from(...)` call should move behind backend routes.

Suggested API shape:

- `GET /api/dashboard`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- `GET /api/partners`
- `POST /api/partners`
- `PATCH /api/partners/:id`
- `GET /api/users`
- `POST /api/users/invite`
- `POST /api/users/create`
- `PATCH /api/users/:id/status`
- `GET /api/grns`
- `POST /api/grns`
- `GET /api/dispatches`
- `POST /api/dispatches`
- `POST /api/dispatches/:id/confirm`
- `GET /api/ledger/current-stock`
- `GET /api/ledger/movements`
- `GET /api/expiry`
- `POST /api/expiry/refresh-statuses`
- `PATCH /api/products/:id/expiry-settings`
- `GET /api/casualties`
- `POST /api/casualties`
- `POST /api/casualties/:id/approve`
- `POST /api/casualties/:id/reject`
- `GET /api/reorder`
- `GET /api/partners/performance`
- `GET /api/count-sessions`
- `POST /api/count-sessions`
- `PATCH /api/count-lines/:id`
- `POST /api/count-sessions/:id/submit`
- `POST /api/count-sessions/:id/approve`
- `GET /api/reports/:reportName`

### Phase 5: Reimplement Supabase views and RPC logic

This is the part people usually underestimate.

Current Supabase logic is split between:

- SQL views
- helper functions
- frontend assumptions

You must rebuild these in one of two ways:

1. Keep them as SQL views/functions in Railway Postgres
2. Rebuild them as service-layer queries in Node

Recommended split:

- keep generated refs/numbers in backend code
- keep reporting aggregates in SQL views where practical
- keep approval and stock mutation logic in backend services

### Phase 6: Move stock mutations out of the browser

Right now, the browser directly mutates inventory-critical tables.

That should stop after migration.

The backend should exclusively own:

- GRN creation
- FIFO dispatch allocation
- batch quantity updates
- movement ledger inserts
- casualty approvals
- physical count approvals
- reconciliation batch creation

This is the most important architectural improvement in the whole migration.

## Exact frontend refactor required

### Remove

- `@supabase/supabase-js` from `package.json`
- `createClient(...)` in `src/App.jsx`
- all direct `supabase.from(...)`
- all direct `supabase.rpc(...)`
- all direct `supabase.functions.invoke(...)`

### Add

- `src/lib/apiClient.js`
- `src/lib/auth.js` or auth context backed by `/auth/me`
- fetch/axios wrappers
- centralized error handling for API failures

### Keep

- the current page structure
- the current inventory helper tests
- the embedded operator manual
- the frontend UI flow

## Backend modules you will need

Recommended structure:

- `server/src/app.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/products.ts`
- `server/src/routes/partners.ts`
- `server/src/routes/users.ts`
- `server/src/routes/grns.ts`
- `server/src/routes/dispatches.ts`
- `server/src/routes/ledger.ts`
- `server/src/routes/expiry.ts`
- `server/src/routes/casualties.ts`
- `server/src/routes/reorder.ts`
- `server/src/routes/partnerPerformance.ts`
- `server/src/routes/counts.ts`
- `server/src/routes/reports.ts`
- `server/src/services/inventoryService.ts`
- `server/src/services/authService.ts`
- `server/src/services/reportService.ts`
- `server/src/middleware/requireAuth.ts`
- `server/src/middleware/requireRole.ts`

## Risk areas during migration

These are the places most likely to regress:

- FIFO dispatch allocation
- stock movement audit integrity
- role-based access
- physical count approval logic
- casualty approval logic
- reporting parity with current SQL views
- reset-password flow

## Practical migration order

Do this in order:

1. Stand up Railway Postgres and backend service
2. Port schema
3. Implement auth and `/auth/me`
4. Move Users, Products, Partners pages to backend API
5. Move GRN and Dispatch
6. Move Casualties and Physical Count
7. Move Dashboard and reports
8. Remove Supabase package and delete Supabase-specific code

## Recommendation

If the goal is to fully leave Supabase, do not try to swap everything in one commit.

Use a staged migration:

- Stage A: backend exists, frontend still on Supabase
- Stage B: low-risk pages move first
- Stage C: inventory mutation pages move
- Stage D: auth moves
- Stage E: remove Supabase entirely

That path is slower than a hard cutover, but much safer for a warehouse system.
