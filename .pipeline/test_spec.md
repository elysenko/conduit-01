# Test Specification

> **WARNING — `.pipeline/surface.json` is stale and was NOT used as the endpoint source.**
> The committed `surface.json` is the untouched scaffold stub. It lists three routes
> (`GET /health`, `GET /trpc/users.findAll`, `GET /trpc/users.findById`) and six `data-testid`
> values (`app-ready`, `home-main`, `home-title`, `users-loading`, `users-error`, `users-list`)
> that describe the generic template, not Conduit. None of the 24 Conduit REST routes appear in it.
> This spec therefore derives the API surface from the **Surface contract table in
> `.pipeline/tasks.md`** (which matches `requirements`/the approved spec), and treats
> `surface.json` as a defect to be repaired by the implementing agents.
>
> Follow-on requirements this creates:
> - **SURF-1** — `surface.json` must be rewritten to list all 24 `/api/*` routes, the Conduit
>   components, and the real test ids before the pipeline declares success. Until then any
>   coverage gate reading `surface.json` reports a false pass.
> - **SURF-2** — `.colossus-acceptance.json` has `expect_text: []` and rejects the signatures
>   `home-title">Users<`, `Loading...`, `Failed to load users.`. It must be populated with the
>   four acceptance markers, and the scaffold's "Users" home page must be gone or the render
>   gate fails on a reject signature.
> - **SURF-3** — `data-testid="app-ready"` must survive the rewrite of `app.component.ts`; it is
>   the `ready_testid` the post-deploy render gate blocks on.
>
> **Unresolved inputs that change assertions** (see Out of scope): hash vs path routing,
> Angular 19 vs 20, single- vs two-container serving. Tests below are written to be
> routing-mode agnostic; where that is impossible the case says so.

## Coverage summary
- Total cases: 170 (99 API, 59 UI/journey, 12 data integrity)
- API endpoints covered: 24 / 24 (against the `tasks.md` Surface contract; **3 / 3** of the stale `surface.json` routes are addressed explicitly — `/health` as `GET /api/health`, the two `/trpc/*` routes under Out of scope)
- User journeys covered: 15

---

## API tests

All paths carry the global `/api` prefix. Unless stated otherwise, an "authenticated" request
sends `Authorization: Token <jwt>`. Seeded fixture: user `jake` / `jake@demo` / `Demo1234!`,
article `how-to-train-your-dragon` tagged `dragons` + `training` with one comment.

### `GET /api/health`
- **Happy path**: unauthenticated `GET /api/health` → `200`, body exactly `{"status":"ok"}`.
- **Idempotency / edge cases**: with Postgres stopped, the endpoint still returns `200` — it must not
  open a DB connection (this is the liveness probe; a DB-coupled liveness probe causes restart loops).

### `GET /api/health/deep`
- **Happy path**: DB reachable → `200`, body reports ok status; the handler executes `SELECT 1`.
- **Idempotency / edge cases**: DB unreachable (stop Postgres / point `DATABASE_URL` at a dead host) →
  `503` via `ServiceUnavailableException`, not `500` and not a hang.

### `GET /api/docs`
- **Happy path**: unauthenticated `GET /api/docs` → `200`, HTML containing the Swagger UI shell.
  This is `backend_probe_path` in `colossus.stack.json`; a failure here fails deploy.
- **Idempotency / edge cases**: `/api/docs` is not swallowed by the SPA static fallback — the response is
  Swagger HTML, not `index.html`. Guards the `ServeStaticModule` `exclude: ['/api/{*path}']` rule.

### `POST /api/users`
- **Happy path**: `{user:{username:"alice",email:"alice@example.com",password:"Passw0rd!"}}` → `201` (or `200`),
  body `{user:{email,token,username,bio,image}}`; `token` is a non-empty JWT; `passwordHash` is **never** in the body.
- **Happy path**: the returned `token` is immediately usable on `GET /api/user` → `200`.
- **Validation failures**: missing `password` → `400`.
- **Validation failures**: `email:"not-an-email"` → `400`.
- **Validation failures**: empty `username:""` → `400`.
- **Validation failures**: unknown extra property (e.g. `role:"ADMIN"`) is stripped by
  `ValidationPipe({whitelist:true})` — request succeeds but the created user's role is **not** `ADMIN`.
  Privilege-escalation guard.
- **Idempotency / edge cases**: registering an existing `username` → `409`; registering an existing `email` → `409`.
  Both must be `409`, not `500` from a raw P2002.
- **Idempotency / edge cases**: `email:"bob@demo"` (no TLD) → succeeds, **not** `400`.
  Regression test for the `@IsEmail({require_tld:false})` landmine.

### `POST /api/users/login`
- **Happy path**: seeded `{user:{email:"jake@demo",password:"Demo1234!"}}` → `200` with a usable token.
  **Highest-value single case in this file** — it is the one that catches the `require_tld` defect
  together with the seed actually having run.
- **Happy path**: a freshly registered user can log in with the same credentials → `200`.
- **Auth failures**: correct email, wrong password → `401` (not `400`, not `404`).
- **Auth failures**: unknown email → `401`, and the message must not distinguish "no such user" from
  "wrong password" (no user enumeration).
- **Validation failures**: missing `email` → `400`.

### `GET /api/user`
- **Happy path**: valid token → `200`, `{user:{email,token,username,bio,image}}` for the token's owner;
  `bio` is `"I work at statefarm"` for jake.
- **Auth failures**: no `Authorization` header → `401`.
- **Auth failures**: malformed/garbage token, and a well-formed JWT signed with the wrong secret → `401`.
- **Idempotency / edge cases**: both `Authorization: Token <jwt>` **and** `Authorization: Bearer <jwt>`
  return `200` for the same token. Covers the dual-scheme custom extractor.

### `PUT /api/user`
- **Happy path**: `{user:{bio:"updated bio"}}` → `200`; `bio` changed, `username`/`email` untouched (partial update).
- **Happy path**: `{user:{password:"NewPassw0rd!"}}` → `200`; login with the **new** password succeeds and with
  the old password returns `401`. Confirms re-hash on supply.
- **Idempotency / edge cases**: a request omitting `password` leaves the stored hash byte-identical
  (no accidental re-hash of an empty string, which would lock the account out).
- **Auth failures**: unauthenticated → `401`.
- **Idempotency / edge cases**: changing `email` to another user's email → `409`.

### `GET /api/profiles/:username`
- **Happy path**: anonymous `GET /api/profiles/jake` → `200`,
  `{profile:{username:"jake",bio:"I work at statefarm",image,following:false}}`.
- **Happy path**: authenticated as a follower of jake → `following:true`; authenticated as a non-follower → `following:false`.
  Proves the optional-JWT guard populates the viewer.
- **Validation failures**: unknown username → `404`.

### `POST /api/profiles/:username/follow`
- **Happy path**: alice follows jake → `200`, `{profile:{...,following:true}}`.
- **Idempotency / edge cases**: calling it twice → second call also `200` with `following:true`, exactly one
  `Follow` row exists (composite-key upsert, not a P2002 `500`).
- **Validation failures**: alice follows `alice` (self) → `400`.
- **Auth failures**: unauthenticated → `401`.
- **Validation failures**: follow an unknown username → `404`.

### `DELETE /api/profiles/:username/follow`
- **Happy path**: alice (following jake) unfollows → `200`, `following:false`, `Follow` row removed.
- **Idempotency / edge cases**: unfollowing when not following → `200` with `following:false`, no `500`.
- **Auth failures**: unauthenticated → `401`.

### `GET /api/articles`
- **Happy path**: anonymous → `200`, `{articles:[...],articlesCount:N}`; on a freshly seeded DB the seeded
  article is present with `tagList` containing `dragons` and `training`, and a nested `author.username === "jake"`.
- **Happy path**: `?tag=dragons` → only articles carrying that tag; `?tag=nonexistent` → `{articles:[],articlesCount:0}` and `200` (not `404`).
- **Happy path**: `?author=jake` → only jake's articles.
- **Happy path**: `?favorited=alice` → only articles alice has favorited; empty array before she favorites anything.
- **Idempotency / edge cases**: default paging is `limit=10, offset=0` — with 12 articles seeded, the default
  response holds 10 items while `articlesCount` reports **12** (total matching, not page size). Common off-by-design bug.
- **Idempotency / edge cases**: `?limit=2&offset=2` returns the 3rd and 4th articles; `limit` above the cap and
  a negative `offset` are rejected `400` or clamped, never a `500`.
- **Idempotency / edge cases**: ordering is `createdAt` **descending** — create three articles in sequence and
  assert the newest is index 0.
- **Happy path**: `favorited` boolean is viewer-relative — anonymous sees `favorited:false`; the favoriting user sees `true`.
- **Idempotency / edge cases**: combined `?tag=dragons&author=jake&limit=1` applies all filters conjunctively.

### `GET /api/articles/feed`
- **Happy path**: alice follows jake → `200`, feed contains jake's articles only, `createdAt desc`, with `articlesCount`.
- **Idempotency / edge cases**: alice follows nobody → `{articles:[],articlesCount:0}`, `200`.
- **Auth failures**: unauthenticated → `401` (the feed is guarded, unlike `GET /api/articles`).
- **Idempotency / edge cases**: `?limit=&offset=` paginate the feed identically to the list endpoint.

### `GET /api/articles/:slug`
- **Happy path**: anonymous `GET /api/articles/how-to-train-your-dragon` → `200`, `{article:{...}}` with
  `title`, `description`, `body`, `tagList`, `favoritesCount`, `favorited:false`, nested `author` profile.
- **Happy path**: authenticated as a user who favorited it → `favorited:true`; author's `following` flag reflects the viewer.
- **Validation failures**: unknown slug → `404`.

### `POST /api/articles`
- **Happy path**: `{article:{title:"My First Post",description:"d",body:"b",tagList:["dragons","newtag"]}}` →
  `201`, slug `my-first-post`, `author` is the caller, `favoritesCount:0`, `favorited:false`.
- **Idempotency / edge cases**: `connectOrCreate` — `dragons` reuses the existing `Tag` row (no duplicate),
  `newtag` is created; `GET /api/tags` then contains both exactly once.
- **Idempotency / edge cases**: two articles with the identical title `"Duplicate Title"` produce **distinct**
  slugs (second gets a 6-char base36 suffix). Neither request returns `500`; the P2002 is caught and retried.
- **Validation failures**: missing `title` → `400`; empty `body:""` → `400`.
- **Auth failures**: unauthenticated → `401`.
- **Idempotency / edge cases**: `tagList` omitted entirely → `201` with `tagList:[]`.

### `PUT /api/articles/:slug`
- **Happy path**: author updates `body` only → `200`, body changed, slug **unchanged**, `updatedAt` advanced.
- **Idempotency / edge cases**: author changes `title` → article is re-slugged, response carries the new slug,
  and `GET` on the new slug resolves.
- **Auth failures**: a second registered user updates jake's article → **`403`**, and the article is unmodified.
  The ownership check must run in the service before any write — a guard-only implementation yields `401` here and fails.
- **Auth failures**: unauthenticated → `401` (distinct from the `403` above; the two must not be conflated).
- **Validation failures**: unknown slug → `404`.

### `DELETE /api/articles/:slug`
- **Happy path**: author deletes own article → `200`/`204`; subsequent `GET` → `404`; `articlesCount` in the
  global list drops by one.
- **Idempotency / edge cases**: cascade — the article's `Comment`, `ArticleTag` and `Favorite` rows are all gone
  (no orphans, no FK violation raised to the client).
- **Auth failures**: a second user deletes jake's article → **`403`**, article still retrievable.
- **Auth failures**: unauthenticated → `401`. Unknown slug → `404`.

### `POST /api/articles/:slug/favorite`
- **Happy path**: alice favorites the seeded article → `200`, `{article:{favorited:true,favoritesCount:1}}`
  — the count is **recomputed**, not incremented blind.
- **Idempotency / edge cases**: favoriting twice → still `favorited:true` and `favoritesCount:1`, exactly one
  `Favorite` row, no P2002 `500`.
- **Auth failures**: unauthenticated → `401`.
- **Validation failures**: unknown slug → `404`.

### `DELETE /api/articles/:slug/favorite`
- **Happy path**: alice unfavorites → `200`, `favorited:false`, `favoritesCount` back to `0`.
- **Idempotency / edge cases**: unfavoriting something never favorited → `200`, `favoritesCount:0`, no `500`,
  count never goes negative.
- **Auth failures**: unauthenticated → `401`.

### `GET /api/articles/:slug/comments`
- **Happy path**: anonymous on the seeded article → `200`, `{comments:[...]}` with the seeded comment;
  each entry carries `id`, `body`, `createdAt`, and a nested `author` profile.
- **Happy path**: authenticated viewer sees the same list with `author.following` reflecting the viewer.
- **Validation failures**: unknown slug → `404`.

### `POST /api/articles/:slug/comments`
- **Happy path**: `{comment:{body:"Nice post"}}` → `201`, `{comment:{id,body,createdAt,author}}` with the caller as author;
  it then appears in the `GET` list.
- **Validation failures**: empty `body:""` → `400`.
- **Auth failures**: unauthenticated → `401`.
- **Validation failures**: unknown slug → `404`.

### `DELETE /api/articles/:slug/comments/:id`
- **Happy path**: the comment's author deletes it → `200`/`204`; it disappears from the `GET` list.
- **Auth failures**: a different authenticated user deletes it → **`403`**, comment still present.
- **Validation failures**: a valid comment id that belongs to a **different** article → `404`
  (guards against cross-article id confusion, not just a happy-path lookup by id).
- **Auth failures**: unauthenticated → `401`.

### `GET /api/tags`
- **Happy path**: → `200`, `{tags:["dragons","training",...]}`; the seeded tags are present.
- **Idempotency / edge cases**: ordering is by usage count **descending** — attach `dragons` to three articles
  and `training` to one, then assert `dragons` precedes `training`. Tests the aggregate, not just presence.
- **Idempotency / edge cases**: envelope is `{tags:[<string>]}` — an array of plain names, not tag objects.
  The client's "Popular Tags" sidebar binds to strings.

### `GET /api/admin/settings`
> Admin surface comes from `tasks.md`, **not** from the approved spec (which states no admin role exists).
> See Out of scope — these cases are contingent on that open question being resolved in favour of building it.
- **Happy path**: admin token → `200`, a list containing the `postgresql` and `minio` keys, each with a
  `configured` boolean.
- **Auth failures**: authenticated non-admin (`role: USER`) → `403`.
- **Auth failures**: unauthenticated → `401`.
- **Idempotency / edge cases**: values are **masked** — the response never contains a stored secret in clear
  text, and a key still set to `PLACEHOLDER_CONFIGURE_IN_SETTINGS` reports `configured:false`.

### `PATCH /api/admin/settings`
- **Happy path**: admin sends `{minio_access_key:"..."}` → `200`, and a follow-up `GET` reports
  `configured:true` for that key.
- **Idempotency / edge cases**: the value is persisted to a `SystemSetting` row and survives a process restart;
  patching the same key twice upserts (one row, latest value, `updatedAt` advanced).
- **Auth failures**: non-admin → `403`; unauthenticated → `401`.
- **Validation failures**: an unknown/unlisted settings key is rejected `400` rather than silently written.

---

## UI / journey tests

Wait strategy for every journey: `getAllAngularTestabilities().every(t => t.isStable())`
(per `colossus.stack.json` — `networkidle` never fires on this app). Every journey begins by
waiting for `[data-testid="app-ready"]`.

**URL assertions**: written against query strings only (`?tag=dragons`), which hold under both path
and hash routing. Where the full path matters the case notes the hash-mode equivalent.

### Journey: Anonymous home page and acceptance markers
- **Steps**: `GET /` as a fresh anonymous visitor; wait for app-ready.
- **Expected outcomes**: the four markers `Conduit`, `Global Feed`, `How to train your dragon`,
  `Popular Tags` are all visible in the rendered DOM.
- **Expected outcomes**: the same four markers are present in the **raw HTML** of `curl -s /`, with JS
  never executed — the pre-boot `<app-root>` markup. This is a separate assertion from the DOM one and
  must not be collapsed into it; it is the guard against the markup being deleted as "dead".
- **Expected outcomes**: `<title>` is `Conduit`; the seeded article renders as a preview card with its
  author `jake` and its tags.
- **Negative path**: none of the `.colossus-acceptance.json` reject signatures appear anywhere in the
  response — no `home-title">Users<`, no bare `Loading...`, no `Failed to load users.`. Fails while any
  scaffold "Users" page remains.

### Journey: Tag filtering and deep-link restore
- **Steps**: from `/`, click `dragons` in the Popular Tags sidebar.
- **Expected outcomes**: URL gains `?tag=dragons`; a third tab `#dragons` appears next to Global Feed and
  is selected; the list shows only `dragons` articles.
- **Expected outcomes**: reload the page at that URL → the `#dragons` tab is still selected and the list is
  still filtered. State is reconstructed from query params, not held only in memory.
- **Negative path**: navigating directly to `?tag=nosuchtag` renders an explicit empty state
  ("No articles are here... yet.") — not a spinner that never resolves and not an error banner.

### Journey: Register a new account
- **Steps**: `/register` → fill username/email/password → submit.
- **Expected outcomes**: redirected off the register page; header switches to the signed-in state showing
  the new username plus `New Article` and `Settings`; the JWT is in `localStorage`.
- **Expected outcomes**: `/signup` redirects to `/register` (RealWorld naming alias).
- **Negative path**: submitting a username that already exists renders a server-side error list on the form
  (from the `409`); the user stays on `/register` and the form is not cleared.

### Journey: Sign in as the seeded author
- **Steps**: `/login` → `jake@demo` / `Demo1234!` → submit.
- **Expected outcomes**: header shows `jake`. **The single highest-value UI check** — it is what surfaces
  the `IsEmail` TLD defect end-to-end.
- **Expected outcomes**: reloading the page keeps jake signed in (token rehydrated via `GET /api/user` on boot).
- **Negative path**: wrong password renders an inline error and leaves the user on `/login` with no token stored.

### Journey: Publish an article
- **Steps**: signed in → `New Article` → fill title/description/body, add tags `dragons` and `angular` → Publish.
- **Expected outcomes**: redirected to `/article/<slug>` showing the new title, body and both tag pills.
- **Expected outcomes**: the article now appears at the top of Global Feed on `/` (newest first).
- **Negative path**: submitting with an empty title keeps the user in the editor and renders the server's
  validation errors; no partial article is created.

### Journey: Edit an article, and ownership boundaries
- **Steps**: as the author, open own article → `Edit Article` → change the title → save.
- **Expected outcomes**: redirected to the article at its **new** slug with the updated title.
- **Expected outcomes**: viewing an article authored by someone else shows **no** Edit/Delete controls.
- **Negative path**: navigating directly to `/editor/<someone-elses-slug>` does not allow a successful save —
  the API `403` surfaces as an error rather than a silent no-op or a crash.

### Journey: Delete an article via the confirm modal
- **Steps**: as the author, open own article → click `Delete Article`.
- **Expected outcomes**: URL gains `?modal=confirm-delete` and a confirmation dialog is visible;
  the modal is deep-linkable (loading that URL directly shows it open).
- **Expected outcomes**: confirming deletes the article, navigates away, and the article is gone from Global Feed.
- **Negative path**: dismissing the modal removes `?modal=confirm-delete` from the URL and the article still exists.

### Journey: Comment on an article
- **Steps**: signed in, open the seeded article → type a comment → Post.
- **Expected outcomes**: the comment appears in the list with the author's name and a timestamp, and a delete
  control is shown on it (own comment).
- **Expected outcomes**: signed out, the comment form is replaced by a "Sign in or sign up to add comments" prompt
  with working links; existing comments are still readable.
- **Negative path**: another user's comment shows **no** delete control; deleting one's own comment removes it
  from the list without a reload.

### Journey: Favorite an article
- **Steps**: signed in, click the favorite button on an article preview on `/`.
- **Expected outcomes**: the button switches to the active state and the count increments by exactly one.
- **Expected outcomes**: the state survives a reload (persisted, not just optimistic local state) — this is the
  assertion that catches an optimistic toggle that never round-trips.
- **Negative path**: clicking favorite while signed out routes to `/login` (or is disabled) rather than throwing
  an unhandled `401`.

### Journey: Follow an author and use Your Feed
- **Steps**: signed in as a second user → open `/profile/jake` → click Follow → go to `/` → select `Your Feed`.
- **Expected outcomes**: the button reads Unfollow; Your Feed lists jake's articles and `?feed=your` is in the URL.
- **Expected outcomes**: the `Your Feed` tab is **absent** for anonymous visitors and present when signed in.
- **Negative path**: after unfollowing, Your Feed renders the empty state rather than stale cached articles.

### Journey: Profile pages and the favorites child route
- **Steps**: open `/profile/jake` → then the `Favorited Articles` tab.
- **Expected outcomes**: profile shows username, bio (`I work at statefarm`) and image; the default child route
  lists jake's own articles.
- **Expected outcomes**: the favorites tab changes the URL to the `favorites` child route and lists only
  favorited articles; both child routes are directly loadable by URL.
- **Negative path**: `/profile/nosuchuser` renders a not-found state, not a blank page or an infinite spinner.

### Journey: Update settings and log out
- **Steps**: signed in → `/settings` → change bio → save.
- **Expected outcomes**: the change persists and is visible on the user's profile page after navigation.
- **Expected outcomes**: clicking logout clears the token from `localStorage` and the header reverts to
  Sign in / Sign up.
- **Negative path**: after logout, navigating to `/settings` redirects to `/login`.

### Journey: Admin settings section
> Contingent on the admin open question — see Out of scope.
- **Steps**: sign in as the seeded admin `jake` → open `/admin/settings`.
- **Expected outcomes**: one section per provisioned service (`postgresql`, `minio`), each with a
  configured/unconfigured badge and a credential form.
- **Expected outcomes**: while any service reports `configured:false`, the banner
  "The following need credentials to activate: …" is rendered; saving credentials clears that service from the banner.
- **Negative path**: a signed-in non-admin visiting `/admin/settings` is redirected to `/` and the `Admin` link
  is absent from their header.

### Journey: Auth guard and returnUrl
- **Steps**: signed out, navigate directly to `/editor`.
- **Expected outcomes**: redirected to `/login` with a `returnUrl` query param naming the original destination.
- **Negative path**: after signing in from that page the user lands on `/editor`, not on `/`.

### Journey: Unknown route fallback
- **Steps**: navigate to `/this-route-does-not-exist`.
- **Expected outcomes**: redirected to `/` with the home page fully rendered (all four markers present).
- **Negative path**: a deep unknown path does not return the server's 404 or a blank document — the SPA
  fallback serves `index.html` for non-`/api` paths.

---

## Data integrity tests

Invariants asserted against the database after the relevant mutation.

- **DATA-01** — Re-running the seed (container restart, or `prisma db seed` twice) creates **no** duplicate rows:
  user count, article count, tag count and comment count are identical before and after. The seed is `upsert`-based.
- **DATA-02** — Booting against an already-migrated database is a no-op: `prisma migrate deploy` → seed → start
  succeeds twice in a row without error.
- **DATA-03** — `User.username` and `User.email` are uniquely constrained at the DB level; a direct duplicate
  insert fails. The API's `409` is not the only line of defence.
- **DATA-04** — No plaintext password is ever persisted: `passwordHash` matches a bcrypt shape (`$2a$`/`$2b$` with
  cost 10) and never equals the supplied password.
- **DATA-05** — Deleting an `Article` cascades to its `Comment`, `ArticleTag` and `Favorite` rows, leaving zero
  orphans referencing the dead article id.
- **DATA-06** — Deleting a `User` leaves no orphaned `Article`, `Follow` or `Favorite` rows pointing at them.
- **DATA-07** — `Favorite` has composite PK `[userId, articleId]`: favoriting twice yields exactly one row.
- **DATA-08** — `Follow` has composite PK `[followerId, followedId]`: following twice yields exactly one row, and
  no row ever has `followerId === followedId` (self-follow is rejected upstream).
- **DATA-09** — `ArticleTag` has composite PK `[articleId, tagId]`; a given tag links to a given article at most once,
  and `Tag.name` is unique so `connectOrCreate` never duplicates a tag.
- **DATA-10** — `Article.slug` is unique DB-side; the collision-suffix path is what resolves duplicate titles, and a
  P2002 is caught and retried rather than surfacing as a `500`.
- **DATA-11** — `favoritesCount` returned by the API always equals the actual `Favorite` row count for that article
  (recomputed, never a drifting stored counter), and is never negative.
- **DATA-12** — `Article.updatedAt` advances on update and `createdAt` does not; `Comment.createdAt` is set on insert.

---

## Out of scope

- **`/trpc/users.findAll` and `/trpc/users.findById`** (the two remaining `surface.json` routes) — `tasks.md` plans to
  remove the tRPC surface, and Conduit's contract is plain REST. **Open question: confirm `/trpc/*` need not keep
  responding.** If the deploy oracle probes them, these become required cases and this decision must be revisited.
- **Hash vs path routing** — `colossus.stack.json` describes a hash-routed SPA, so deep links read `/#/?tag=dragons`.
  Journeys assert on query strings only, which hold either way. Exact-path assertions are deliberately omitted until
  the routing mode is ruled on.
- **Angular version** — spec assumption 6 mandates v20; the scaffold pins `^19.2.0`. No test depends on a
  version-specific API, so this spec passes under either. Not under test.
- **Deployment shape** — spec Step 14 says single container serving the SPA from Nest's `public/`; the scaffold has a
  separate `frontend/Dockerfile` + nginx and a two-service compose. Cases assume same-origin `/api` (true under both);
  container topology itself is not asserted.
- **Admin role, `/api/admin/settings`, and `/admin/settings`** — present in `tasks.md`, explicitly **absent** from the
  approved spec ("no admin role exists in the spec, so none is built"). Cases are written but flagged contingent; if the
  open question resolves against building it, drop 8 API cases and 1 journey (4 cases) — total falls to 158.
- **First-registered-user-becomes-ADMIN** — `tasks.md` adds this rule; the spec explicitly denies it. Only the
  privilege-escalation guard (`role` in the register payload is stripped) is asserted, since that is safe either way.
- **MinIO / object storage / image upload** — `minio` appears only as settings-page credential plumbing. `User.image`
  and article images are plain URLs; no upload flow exists to test.
- **Third-party integrations** — the spec declares none; the placeholder `None` / `NONE_API_KEY` entry is a no-op.
- **Kubernetes manifests** — `k8s/*.yaml` correctness (probe wiring, Secret refs, `replicas:1` / `Recreate`) is
  deploy-time configuration, not application behaviour. The probe **endpoints** are covered above; the manifests are not.
- **Password-strength, rate-limiting, CSRF, account lockout, email verification, password reset** — the spec is silent
  on all of them; no behaviour is defined to assert.
- **Visual/CSS fidelity to the RealWorld design** — styling is asserted only through the text markers and control
  presence, never pixel or class-name comparison.
