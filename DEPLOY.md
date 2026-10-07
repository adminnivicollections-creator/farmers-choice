# Deploying the API

The mobile app talks to one HTTPS endpoint. Until that exists, every
API-backed feature only works when the phone shares a network with a laptop.

## What you need

| Thing | Why | Cost |
|---|---|---|
| **Supabase** project | Postgres **with PostGIS**, which the proximity and booking queries need | Free tier is enough to start |
| **Render** (or Railway / Fly) web service | Runs the API container | Free tier sleeps when idle; paid tier does not |

PostGIS is the deciding constraint. Supabase ships it; most "serverless
Postgres" offerings do not.

## 1. Database

1. Create a Supabase project. Pick the **Mumbai (ap-south-1)** region.
2. SQL Editor → run:
   ```sql
   create extension if not exists postgis;
   create extension if not exists btree_gist;
   ```
3. Settings → Database → copy the **connection string** (URI, not the pooler,
   for migrations). This is `DATABASE_URL`.

## 2. API

Deploy `apps/api/Dockerfile` with the **repository root as build context** —
it is a monorepo and the image needs `packages/`.

Environment:

| Key | Value |
|---|---|
| `DATABASE_URL` | from Supabase |
| `JWT_SECRET` | 32+ random chars. `openssl rand -hex 32`. Boot fails if it still says `dev-only` |
| `NODE_ENV` | `production` |
| `OTP_PROVIDER` | `console` until DLT registration completes |
| `CORS_ORIGINS` | admin console origin, once one exists |

Health check path: `/healthz` — it queries the database, so a green check means
the API can actually serve.

Migrations run automatically on boot (`prisma migrate deploy`).

## 3. Seed it once

From a shell with `DATABASE_URL` set:

```bash
cd apps/api && npx tsx prisma/seed-all.ts
```

Loads PostGIS extensions, Andhra Pradesh locations, crops, fertilizer products
and demo QR tags. It does **not** load nutrient recommendations — those only
arrive through the sourced admin workflow.

## 4. Point the app at it

In the app: **Profile → Server address** → `https://your-api.onrender.com` →
Save and test. Or bake it in for release builds by setting
`EXPO_PUBLIC_API_BASE` in `apps/mobile/.env` and rebuilding.

## 5. Then turn cleartext off

Once the API is HTTPS, remove `usesCleartextTraffic` from `app.json` and
rebuild. Play Store flags apps that allow plain HTTP.
