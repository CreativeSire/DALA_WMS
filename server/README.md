# DALA WMS Server

Express + Postgres backend for replacing Supabase in DALA WMS.

## What this server currently provides

- `GET /health`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/complete-invite`
- `POST /auth/change-password`
- `GET /api/admin/audit-logs`
- `GET /api/users`
- `POST /api/users`
- `POST /api/users/invite`
- `PATCH /api/users/:id/status`
- `POST /api/users/:id/reset-password`
- `GET /api/partners`
- `POST /api/partners`
- `PATCH /api/partners/:id`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- inventory, GRN, dispatch, casualties, counts, and report routes under `/api`

## Environment

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_ORIGIN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

Optional initial admin seed:

- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`
- `INITIAL_ADMIN_FULL_NAME`

## Local setup

```powershell
cd server
npm install
npm run db:bootstrap
npm run db:seed-demo
npm run dev
```

## Railway deployment

Deploy this folder as a separate Railway service.

Required variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_ORIGIN`

Recommended first run:

```powershell
cd server
npm install
npm run db:bootstrap
npm run db:seed-demo
```

If you seed the initial admin in production, rotate that password immediately after first login.

## What the new controls add

- Invite links can be emailed directly when SMTP is configured.
- Password reset emails can be sent directly to the affected user.
- Admin audit logs record invite, create, reset, activate, deactivate, and password-change events.
- The app manual now contains a plain-language backup and restore runbook.
