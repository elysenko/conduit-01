# Conduit

A RealWorld-shaped blogging platform — read, write, tag, favorite, follow and comment.

- **`backend/`** — NestJS 11 REST API (`/api`), Prisma 6 + PostgreSQL, JWT auth
- **`frontend/`** — Angular 20 standalone SPA, served by nginx which proxies `/api/` to the backend

## Demo credentials

| Role | Email | Password |
|---|---|---|
| ADMIN | `jake@demo` | `Demo1234!` |

Created by the idempotent seed on every boot, along with the article *"How to train your
dragon"* (tagged `dragons` + `training`) and one comment.

> `jake@demo` has no TLD. Every email DTO therefore uses
> `@IsEmail({ require_tld: false })` — **do not "fix" this**, it is what keeps demo
> sign-in working.

## Run locally

```bash
docker compose up          # app + Postgres
```

Or run the two workspaces separately:

```bash
# backend — needs DATABASE_URL and JWT_SECRET
cd backend
npm install
npx prisma migrate deploy
node prisma/seed/seed.js
npm run start:dev          # http://localhost:3001/api  (Swagger at /api/docs)

# frontend — ng serve proxies /api to :3001 via proxy.conf.json
cd frontend
npm install
npm start                  # http://localhost:4200
```

## Environment

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | backend | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | backend | Signing key for access tokens |
| `PORT` | backend | Defaults to `3001` (must match `colossus.yaml` → `backend.port`) |

Both are injected from the platform secret at deploy time.

## Build & test

```bash
cd backend  && npm run build && npm run typecheck && npm test && npm run test:e2e
cd frontend && npx ng build --configuration production
```

`test:e2e` runs the full API journey (register → publish → tag → comment → favorite →
follow) against a real Postgres. Its fixtures are namespaced per run and torn down
afterwards, so it is safe against the seeded database.

## Routing

The SPA is **hash-routed** (`withHashLocation()`), so canonical addresses look like
`/#/article/my-slug`. `frontend/src/main.ts` normalises path-style deep links
(`/login`, `/?tag=dragons`) into the hash form before bootstrap, so both shapes work.

## Deploy

`colossus.yaml` drives the deploy: Angular → nginx (port 80), NestJS → port 3001.
`backend/docker-entrypoint.sh` runs `prisma migrate deploy`, then the seed, then the API.
Probes: `/api/health` (liveness, no DB) and `/api/health/deep` (readiness, `SELECT 1`).

Deploy with `replicas: 1` initially — concurrent `migrate deploy` from multiple replicas
can conflict.
