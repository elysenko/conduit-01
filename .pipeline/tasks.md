# Pipeline Task Decomposition

## Summary
Conduit is a RealWorld-shaped blogging platform: readers browse a public global feed of articles with tag filtering and author profiles, while authenticated users register/sign in, publish and edit their own articles, comment, favorite articles, and follow other authors. The backend is NestJS 11 + Prisma (Postgres) exposing a JWT-secured REST API under `/api`; the frontend is an Angular standalone SPA. An idempotent seed creates the demo author `jake@demo` / `Demo1234!` with the article "How to train your dragon" tagged `dragons` and `training`, so a freshly booted instance is never empty. Auth model is **full_auth** (`admin`, `user` roles) with public read access to the home page, articles, tags and profiles; an admin section with a settings page for backing-service credentials (`postgresql`, `minio`) is also generated.

Scaffolder-produced roots are authoritative for paths: the server lives in **`backend/`** (spec says `server/`) and the client in **`frontend/`** (spec says `client/`). Every task below uses the scaffolded roots. Per `.pipeline/surface.json`, no source file may exceed 400 lines (hard limit 500) — split components/services rather than growing a file.

## Surface contract

### REST routes (all under the global `/api` prefix)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | public | `{status:'ok'}`, no DB touch (liveness) |
| GET | `/api/health/deep` | public | `SELECT 1`, 503 on DB failure (readiness) |
| GET | `/api/docs` | public | Swagger UI — **must keep working, it is the backend probe path** |
| POST | `/api/users` | public | register → `{user:{email,token,username,bio,image}}`; 409 on dup username/email |
| POST | `/api/users/login` | public | 401 on bad credentials |
| GET | `/api/user` | jwt | current user |
| PUT | `/api/user` | jwt | re-hash password only when supplied |
| GET | `/api/profiles/:username` | optional jwt | `{profile:{username,bio,image,following}}` |
| POST | `/api/profiles/:username/follow` | jwt | 401 anon, 400 self-follow, idempotent |
| DELETE | `/api/profiles/:username/follow` | jwt | idempotent |
| GET | `/api/articles?tag=&author=&favorited=&limit=&offset=` | optional jwt | `{articles, articlesCount}`, `createdAt desc`, default `limit=10 offset=0` |
| GET | `/api/articles/feed?limit=&offset=` | jwt | followed authors only |
| GET | `/api/articles/:slug` | optional jwt | |
| POST | `/api/articles` | jwt | slugify title, `connectOrCreate` tags |
| PUT | `/api/articles/:slug` | jwt | **403 `ForbiddenException` if `authorId !== user.id`**, re-slug on title change |
| DELETE | `/api/articles/:slug` | jwt | same 403 rule, cascade comments/tags/favorites |
| POST | `/api/articles/:slug/favorite` | jwt | returns recomputed `favoritesCount` |
| DELETE | `/api/articles/:slug/favorite` | jwt | |
| GET | `/api/articles/:slug/comments` | optional jwt | |
| POST | `/api/articles/:slug/comments` | jwt | |
| DELETE | `/api/articles/:slug/comments/:id` | jwt | 403 if not comment author, 404 if comment belongs to another article |
| GET | `/api/tags` | public | tag names ordered by usage count desc |
| GET | `/api/admin/settings` | jwt + ADMIN | service keys with masked values + `configured` flag |
| PATCH | `/api/admin/settings` | jwt + ADMIN | upsert key/value pairs |

### Client screens
| Path | Guard | Notes |
|---|---|---|
| `/` | — | `?feed=global\|your`, `?tag=`, `?page=` all round-trip through query params |
| `/login` | — | |
| `/register` | — | `/signup` redirects here (RealWorld naming) |
| `/article/:slug` | — | `?modal=confirm-delete` |
| `/profile/:username` | — | children: `''` (My Articles), `favorites` |
| `/editor` | authGuard | |
| `/editor/:slug` | authGuard | |
| `/settings` | authGuard | |
| `/admin/settings` | authGuard + admin role | service/credential settings |
| `**` | — | redirect to `/` |

### Entities
`User` (id, username u, email u, passwordHash, bio?, image?, role), `UserRole` enum (`ADMIN`, `USER`), `Article` (id, slug u, title, description, body, authorId, createdAt, updatedAt), `Comment` (id, body, articleId cascade, authorId, createdAt), `Tag` (id, name u), `ArticleTag` (composite PK `[articleId, tagId]`, cascade), `Favorite` (composite PK `[userId, articleId]`, cascade), `Follow` (composite PK `[followerId, followedId]`, self-relation), `SystemSetting` (key PK, value, updatedAt).

### Acceptance markers (must be greppable in raw HTML of `/`)
`Conduit`, `Global Feed`, `How to train your dragon`, `Popular Tags`.

## db_agent tasks
- [ ] Rewrite `backend/prisma/schema.prisma` datasource/generator block: keep `provider = "postgresql"` + `env("DATABASE_URL")`, and pin `prisma` / `@prisma/client` to the same `^6.x` in `backend/package.json` (scaffold currently ships `@prisma/client ^7`) so generated client and CLI cannot drift.
- [ ] Replace the scaffold `User`/`Role` models with the Conduit `User`: `id`, `username @unique`, `email @unique`, `passwordHash`, `bio String?`, `image String?`, `role UserRole @default(USER)`, `createdAt`, `updatedAt`; add `enum UserRole { ADMIN USER }`.
- [ ] Add `Article` model — `id`, `slug @unique`, `title`, `description`, `body`, `authorId` FK → `User` (cascade on delete), `createdAt`, `updatedAt`, plus `@@index([authorId])` and `@@index([createdAt])`.
- [ ] Add `Comment` model — `id`, `body`, `createdAt`, `articleId` FK → `Article` `onDelete: Cascade`, `authorId` FK → `User`.
- [ ] Add `Tag` (`id`, `name @unique`) and `ArticleTag` join model with composite PK `@@id([articleId, tagId])` and cascade deletes on both sides.
- [ ] Add `Favorite` (`@@id([userId, articleId])`, cascade both sides) and `Follow` (`@@id([followerId, followedId])`, self-relation on `User` with named back-refs `following` / `followers`).
- [ ] Add `SystemSetting` model — `key String @id`, `value String`, `updatedAt DateTime @updatedAt` — backing admin-configurable credentials for `postgresql` and `minio`.
- [ ] Generate the initial migration under `backend/prisma/migrations/` (`prisma migrate dev --name init`) and confirm `npx prisma generate` + `npx tsc --noEmit` pass.
- [ ] Rewrite `backend/prisma/seed.ts` as an idempotent seed: `upsert` user `jake` (`jake@demo`, bcrypt(`Demo1234!`, 10), bio `"I work at statefarm"`, role `ADMIN` so the admin section is reachable), `upsert` tags `dragons` + `training`, `upsert` article `"How to train your dragon"` (slug `how-to-train-your-dragon`) linked to both tags, and `upsert` one comment on it. Must be safe to re-run on every boot.
- [ ] Align the seed entrypoint with `backend/package.json` `prisma.seed` (scaffold points at `prisma/seed/seed.js`) so `node dist/prisma/seed.js` / `prisma db seed` both work from the built image.

## backend_agent tasks
- [ ] Update `backend/src/main.ts`: `app.setGlobalPrefix('api')`, global `ValidationPipe({ whitelist: true, transform: true })`, listen on `0.0.0.0:$PORT`; keep Swagger mounted so `/api/docs` still responds; keep CORS for the dev proxy.
- [ ] Add `ServeStaticModule.forRoot({ rootPath: join(__dirname,'..','public'), exclude: ['/api/{*path}'] })` to `backend/src/app.module.ts` — **Express 5 wildcard form is mandatory; `'/api*'` throws at boot** — and register the new Auth/Profiles/Articles/Comments/Tags/AdminSettings modules.
- [ ] Verify/extend `backend/src/prisma/prisma.service.ts` — `PrismaService extends PrismaClient` with `onModuleInit` connect and `enableShutdownHooks`; `PrismaModule` stays `@Global()`.
- [ ] Rework `backend/src/health/` into `GET /api/health` (static `{status:'ok'}`, no DB) and `GET /api/health/deep` (`$queryRaw\`SELECT 1\``, 503 via `ServiceUnavailableException` on failure). Both public.
- [ ] Create `backend/src/auth/` module scaffolding: `auth.module.ts` (registers `JwtModule` with `JWT_SECRET`), `jwt.strategy.ts` with a **custom extractor accepting both `Authorization: Bearer <jwt>` and `Token <jwt>`**, payload `{sub, username, role}`, `validate` loads the user and throws `UnauthorizedException` when absent.
- [ ] Create `backend/src/auth/jwt-auth.guard.ts`, `optional-jwt-auth.guard.ts` (`handleRequest` returns `null` instead of throwing), `roles.guard.ts` + `@Roles(UserRole.ADMIN)` admin guard, and `current-user.decorator.ts`.
- [ ] Implement `auth.service.ts` + `auth.controller.ts` for `POST /api/users` (register: uniqueness check → 409, bcrypt 10 rounds, first-registered user gets `ADMIN`, subsequent users `USER`) and `POST /api/users/login` (`bcrypt.compare`, 401 on failure). Both return the `{user:{email,token,username,bio,image}}` envelope.
- [ ] Implement guarded `GET /api/user` and `PUT /api/user` (partial update; re-hash password only when supplied; 409 on username/email collision).
- [ ] Write `dto/register.dto.ts`, `dto/login.dto.ts`, `dto/update-user.dto.ts` using class-validator, with **`@IsEmail({ require_tld: false })` on every email field** so `jake@demo` validates.
- [ ] Create `backend/src/profiles/` — `GET /api/profiles/:username` (optional auth → `following` flag), `POST`/`DELETE /api/profiles/:username/follow` (guarded, 401 anon, 400 self-follow, idempotent via the composite key), shared `toProfileDto(user, viewerId)`.
- [ ] Create `backend/src/common/slug.util.ts` — `slugify(title, {lower:true, strict:true})` plus a 6-char base36 suffix, and a retry helper that catches the P2002 unique violation instead of surfacing a 500.
- [ ] Create `backend/src/articles/` read side: `GET /api/articles` (optional auth; `tag`/`author`/`favorited`/`limit`/`offset` filters via `dto/list-articles.query.ts`, `createdAt desc`, returns `{articles, articlesCount}`), `GET /api/articles/feed` (guarded, followed authors only), `GET /api/articles/:slug` (optional auth), and the shared `toArticleDto(article, viewerId)` mapper emitting `tagList`, `favorited`, `favoritesCount`, nested `author`.
- [ ] Create `backend/src/articles/` write side: `POST /api/articles` (guarded, slugify + `connectOrCreate` tags linked through `ArticleTag`), `PUT`/`DELETE /api/articles/:slug` — **load the article first and throw `ForbiddenException` (403) when `authorId !== currentUser.id`, before any mutation** — plus `dto/create-article.dto.ts` and `dto/update-article.dto.ts`.
- [ ] Implement `POST`/`DELETE /api/articles/:slug/favorite` (guarded, idempotent toggle on the composite key, response carries the recomputed `favoritesCount`).
- [ ] Create `backend/src/comments/` — `GET /api/articles/:slug/comments` (optional auth), `POST` (guarded, `dto/create-comment.dto.ts`), `DELETE /api/articles/:slug/comments/:id` (403 unless requester authored the comment, 404 when the comment belongs to a different article); comments carry `createdAt` + author profile.
- [ ] Create `backend/src/tags/` — `GET /api/tags` returning `{tags:[names]}` ordered by `ArticleTag` usage count descending.
- [ ] Create `backend/src/lib/config.ts` with `resolveConfig(key: string): Promise<string | null>` — reads `process.env[key]` first; when the value is missing or equals `PLACEHOLDER_CONFIGURE_IN_SETTINGS`, falls back to the `SystemSetting` row; returns `null` when neither is set. Export `ServiceUnconfiguredError` mapping to HTTP 503.
- [ ] Create `backend/src/admin/settings.{module,service,controller}.ts` — `GET /api/admin/settings` listing the `postgresql` and `minio` credential keys with masked values + `configured` status, and `PATCH /api/admin/settings` upserting key/value pairs. Both require jwt + `ADMIN` role; non-admins get 403.
- [ ] Update `backend/.env.example` / `docker-compose.yml` env with `DATABASE_URL`, `JWT_SECRET`, `PORT=3000`, and the `minio` credential keys defaulted to `PLACEHOLDER_CONFIGURE_IN_SETTINGS`.
- [ ] Update `backend/Dockerfile` + add `docker-entrypoint.sh` (`prisma migrate deploy` → seed → `node dist/main.js`) so the built Angular bundle is copied into `backend/public/` and the SPA is served from the same container; keep `replicas: 1` / `Recreate` guidance in a comment to avoid concurrent-migration races.
- [ ] Add `k8s/deployment.yaml`, `k8s/service.yaml`, `k8s/postgres.yaml`, `k8s/secret.example.yaml` with liveness on `/api/health` and readiness on `/api/health/deep`, `DATABASE_URL`/`JWT_SECRET` sourced from the Secret.

## ui_agent tasks
- [ ] Update `frontend/src/index.html`: `<title>Conduit</title>` and **static pre-boot markup inside `<app-root>` containing "Conduit", "Global Feed", "How to train your dragon" and "Popular Tags"** so a raw-HTML marker grep succeeds without JS. Do not delete this as dead markup.
- [ ] Update `frontend/src/app/app.config.ts` — `provideRouter(routes, withComponentInputBinding())` and `provideHttpClient(withInterceptors([authInterceptor]))`; confirm whether the app stays hash-routed (scaffold note) and keep query-param deep links working either way.
- [ ] Write `frontend/src/app/app.routes.ts` for the route table in the Surface contract, each entry carrying a `data.flow` node, `authGuard` on `/editor`, `/editor/:slug`, `/settings`, admin guard on `/admin/settings`, `/signup` → `/register` redirect, and `**` → `/`.
- [ ] Rewrite `frontend/src/app/app.component.ts` as the shell (`router-outlet` + header + footer), preserving the existing `data-testid="app-ready"` element.
- [ ] Create `frontend/src/app/layout/header.component.ts` (brand `conduit`; signed-out → Sign in / Sign up; signed-in → New Article / Settings / username; Admin link only when `role === 'ADMIN'`) and `footer.component.ts`.
- [ ] Create `frontend/src/app/pages/home/home.component.ts` — banner reading "conduit", tabs "Global Feed" (always), "Your Feed" (authenticated only) and a `#<tag>` tab when `?tag=` is set; sidebar headed "Popular Tags" from `GET /api/tags`; all tab/tag/page state read from and written to query params so reload restores the view.
- [ ] Create `frontend/src/app/shared/article-preview.component.ts` and `pagination.component.ts` (page size 10, `?page=` driven) used by home and profile lists.
- [ ] Create `frontend/src/app/shared/favorite-button.component.ts`, `follow-button.component.ts`, `confirm-modal.component.ts` (driven by `?modal=confirm-delete`).
- [ ] Create `frontend/src/app/pages/auth/login.component.ts` and `register.component.ts` — reactive forms, server-side error list rendering, redirect honouring `?returnUrl=`.
- [ ] Create `frontend/src/app/pages/article/article.component.ts` — title, body, tag list, author meta, favorite/follow buttons, Edit/Delete shown only to the author with delete routing to `?modal=confirm-delete`.
- [ ] Create `frontend/src/app/pages/article/comment-list.component.ts` — comment form for authenticated users, sign-in prompt otherwise; each comment shows author, timestamp, and a delete control only for its own author.
- [ ] Create `frontend/src/app/pages/editor/editor.component.ts` — one reactive form serving create and edit (`/editor` vs `/editor/:slug`), tag chips, redirect to the article on save, surfaces server validation errors.
- [ ] Create `frontend/src/app/pages/profile/profile.component.ts` with child routes `''` (My Articles) and `favorites` (Favorited Articles), showing username, bio, image and follow button.
- [ ] Create `frontend/src/app/pages/settings/settings.component.ts` — update image/username/bio/email/password and a logout control.
- [ ] Create `frontend/src/app/pages/admin/settings.component.ts` at `/admin/settings` — one section per provisioned service (`postgresql`, `minio`) with a configured/unconfigured badge and a credential form per service, saving via `PATCH /api/admin/settings`. Render the banner "The following need credentials to activate: …" whenever any listed service reports `configured: false`.
- [ ] Add empty / loading / error states to every list and detail view (no-articles-here, spinner, error text) and give each new component stable `data-testid` attributes consistent with `.pipeline/surface.json`.
- [ ] Add Conduit styling to `frontend/src/styles.css` (RealWorld-ish layout: banner, feed toggle, tag pills, article meta) without pulling in a CSS framework.

## service_agent tasks
- [ ] Create `frontend/src/app/core/models.ts` — `User`, `Profile`, `Article`, `Comment`, `Tag`, `ArticleListResponse`, `SystemSettingView` interfaces matching the backend DTOs exactly.
- [ ] Create `frontend/src/app/core/api.service.ts` — typed wrappers over every route in the Surface contract, unwrapping the RealWorld envelopes (`{user}`, `{profile}`, `{article}`, `{articles, articlesCount}`, `{comments}`, `{tags}`); split into a second file if it approaches the 400-line budget.
- [ ] Create `frontend/src/app/core/auth.service.ts` — persists the JWT in `localStorage`, exposes a signal-based `currentUser`, hydrates via `GET /api/user` on boot, and provides `login`, `register`, `updateUser`, `logout`, plus an `isAdmin` computed signal.
- [ ] Create `frontend/src/app/core/auth.interceptor.ts` — attaches `Authorization: Token <jwt>` when present, clears the session and redirects to `/login` on any 401.
- [ ] Create `frontend/src/app/core/auth.guard.ts` (redirects to `/login?returnUrl=<url>`) and `admin.guard.ts` (redirects non-admins to `/`).
- [ ] Wire the pages to the data layer: home feed/tag/page query-param loading, article + comments loading, favorite/follow optimistic toggles, editor create/update, profile article lists, settings update, and admin settings load/save — no `HttpClient` calls outside `core/`.
- [ ] Update `frontend/proxy.conf.json` so `/api` proxies to the backend in dev, and remove or neutralise the scaffold's tRPC client wiring (`trpc-client.types.ts`, `ngx-trpc` usage) that Conduit does not use.

## tester tasks
- [ ] Write `backend/test/conduit.e2e-spec.ts` happy path: register → login → create article → article appears in `GET /api/articles` and under `?tag=` → post comment → favorite → follow, asserting response shapes and `articlesCount`.
- [ ] Extend the e2e spec with auth negatives: **401** for every unauthenticated write (create/update/delete article, comment, favorite, follow) and **403** when a second user edits or deletes jake's article or deletes someone else's comment.
- [ ] Add e2e coverage for the seeded login `jake@demo` / `Demo1234!` returning 200 with a token — the regression test for the `@IsEmail({require_tld:false})` landmine.
- [ ] Add e2e coverage for `GET /api/health` (200 without DB) and `GET /api/health/deep` (200 with DB), plus `GET /api/tags` ordering by usage.
- [ ] Add e2e coverage for admin settings: non-admin gets 403 on `GET`/`PATCH /api/admin/settings`, admin gets the masked `postgresql`/`minio` key list, and `PATCH` persists to `SystemSetting`.
- [ ] Add unit tests for `slugify` collision handling (duplicate titles produce distinct slugs, P2002 retried not 500) and for `resolveConfig` precedence (env → SystemSetting → null, with `PLACEHOLDER_CONFIGURE_IN_SETTINGS` treated as unset).
- [ ] Write `frontend/e2e/smoke.spec.ts` (Playwright) asserting the four acceptance markers "Conduit", "Global Feed", "How to train your dragon" and "Popular Tags" render on `/`, using the Angular testability wait strategy from `colossus.stack.json`.
- [ ] Extend the Playwright smoke: sign in as `jake@demo` / `Demo1234!` and assert the header shows `jake`; click the `dragons` tag and assert the URL becomes `?tag=dragons` and the list filters; reload and assert the state is restored.
- [ ] Add a raw-HTML check (`curl -s / | grep -c "Conduit"` equivalent) so the Step 10 pre-boot markup cannot be silently removed.
- [ ] Update `README.md` — run/build/deploy instructions, `docker compose up` flow, health endpoints, and the seeded credentials `jake@demo` / `Demo1234!`.

## Open questions
- **Spec paths vs scaffold paths.** The spec writes `server/` and `client/`; the scaffolder produced `backend/` and `frontend/`. All tasks target the scaffolded roots — confirm no downstream tooling expects `server/`/`client/`.
- **Angular version.** Spec assumption 6 mandates Angular 20 (standalone, zone-based); the scaffold pins `^19.2.0`. Recommend staying on 19 (the certified stack) since nothing in the spec needs a v20 API — needs a ruling before ui_agent starts.
- **Prisma major.** Spec pins `^6.x`; scaffold ships `@prisma/client ^7.0.0`. Tasks assume downgrading to `^6.x` per the spec's drift risk — confirm the certified stack tolerates it.
- **tRPC.** The scaffold ships a `nestjs-trpc` module and `ngx-trpc` client; Conduit's contract is plain REST. Tasks assume the tRPC surface is removed (or left inert) — confirm `/trpc/*` need not keep responding.
- **Single container vs two.** Spec Step 14 serves the SPA from Nest's `public/`; the scaffold has a separate `frontend/Dockerfile` + `nginx.conf` and a two-service compose file. Tasks follow the spec (single container) but leave the nginx assets in place — confirm which deployment shape the oracle checks.
- **Hash routing.** `colossus.stack.json` describes the frontend as a hash-routed SPA. The spec's deep-linkable `?tag=`/`?page=`/`?feed=` URLs still work under hash routing but read as `/#/?tag=dragons` — confirm the expected URL shape before writing the smoke assertions.
- **Admin role is not in the spec.** The pipeline auth model is `full_auth` with roles `admin, user`, so an `ADMIN` role, admin guard and `/admin/settings` page are generated; the spec explicitly says "no admin role exists in the spec". Tasks give the seeded `jake` the `ADMIN` role and make the first registered user an admin so the section is reachable — confirm this is acceptable.
- **`minio` deployment.** `minio` is listed in `spec_deployments` but the spec never mentions object storage or image upload. Only settings-page credential plumbing is generated; no upload feature is built. Confirm whether image upload is actually in scope (`User.image` / `Article` cover images are currently plain URLs).
- **Placeholder integration.** `spec_integrations` contains a single entry literally named `None` with env key `NONE_API_KEY`; the spec states "None — the spec declares no third-party services". No `lib/integrations/*` client is generated. Confirm this is the intended no-op.
- **Article `favorited=` filter and profile favorites.** The spec lists the query param and the profile child route but never states whether favorites are public; tasks assume the list is public and only the `favorited` boolean is viewer-dependent.
