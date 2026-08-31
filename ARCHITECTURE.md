# Architecture

## Requested stack
- `enterprise` — Angular 20 (standalone) + NestJS 11 + tRPC + Prisma 6 (PostgreSQL)

## Scaffolding status
- `enterprise` — **newly scaffolded** from `template-enterprise` (the project directory contained only a stub `README.md`, `.git`, and `.github` before this run).

## Layout
- `frontend/` — Angular 20 standalone SPA (Angular CLI project name: `frontend`). Entry: `frontend/src/main.ts`, root component `frontend/src/app/app.component.ts`.
- `backend/` — NestJS 11 API with a tRPC layer (`nestjs-trpc`) and Prisma 6 client. Entry: `backend/src/main.ts`. Prisma schema: `backend/prisma/schema.prisma`.
- `.pipeline/surface.json` — generated manifest of routes, components, and `data-testid` values. Coder agents must keep this in sync when adding routes/components/test ids.
- `.colossus-acceptance.json` — acceptance contract read by the post-deploy render gate (`ready_testid: app-ready`).
- `colossus.yaml` — build manifest consumed by deploy agents (framework: angular, backend: NestJS on port 3001).
- `docker-compose.yml` — local dev stack (app + Postgres).

## Template source
- `template-enterprise` from the scaffold-templates library (Angular 19 CLI scaffold + NestJS 11 + Prisma 6 + tRPC starter, upgraded in-plan to Angular 20 per the project plan).

## Next steps for the developer / coder agent
1. Copy `backend/.env.example` (if present) to `backend/.env` and set `DATABASE_URL` / `JWT_SECRET`, or otherwise populate `backend/.env` per the plan's Step 1 (`DATABASE_URL`, `JWT_SECRET`, `PORT=3000`).
2. Implement the Conduit feature set described in the plan on top of this scaffold: Prisma schema (`User`, `Article`, `Comment`, `Tag`, `ArticleTag`, `Favorite`, `Follow`), auth/profiles/articles/comments/tags modules, and the Angular pages/components.
3. Run `npx prisma migrate dev` in `backend/` once the schema is written, and `npx prisma generate`.
4. Run `docker-compose up` to bring up the app + Postgres locally.
5. Keep `.pipeline/surface.json` updated as routes/components/test ids are added — it is the contract used by the test-spec and Playwright agents.
6. Fill in `.colossus-acceptance.json`'s `expect_text` with real front-page content once the home page is built.
7. Replace the stub `README.md` with real run/build/deploy instructions and seeded credentials, per the plan.
