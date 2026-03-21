# DALA WMS Server

Express + Postgres backend for replacing Supabase in DALA WMS.

## What this server currently provides

- `GET /health`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /api/users`
- `POST /api/users`
- `POST /api/users/invite`
- `PATCH /api/users/:id/status`
- `GET /api/partners`
- `POST /api/partners`
- `PATCH /api/partners/:id`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`

## Environment

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_ORIGIN`

Optional initial admin seed:

- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`
- `INITIAL_ADMIN_FULL_NAME`

## Local setup

```powershell
cd server
npm install
npm run db:bootstrap
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
```

If you seed the initial admin in production, rotate that password immediately after first login.
