# Post-Deploy Report — Conduit

**URL:** https://conduit-01-staging-7d130babca823e1d.athenconsult.com/
**Namespace:** `colossus-conduit-01-staging`
**Image:** `ubuntu:30500/conduit-01@sha256:ea0edd59…0da34`
**Run date:** 2026-08-31

## Liveness — PASS

| Endpoint | Status | Time |
|---|---|---|
| `/` | 200 | 0.18 s |
| `/api/health` | 200 `{"status":"ok"}` | 0.19 s |
| `/api/health/deep` | 200 `{"status":"ok","database":"up"}` | 0.16 s |
| `/article/how-to-train-your-dragon` | 200 | — |

**TLS:** valid. `CN=athenconsult.com`, issuer Google Trust Services (WE1), valid
Jul 11 2026 → **Oct 9 2026**. `ssl_verify_result=0` on all requests.

## Demo seeding — FIXED A LIVE DEFECT

The database was **empty** on arrival: `/api/tags` and `/api/articles` both
returned empty sets and `jake@demo` login returned **401**. All four acceptance
markers were being satisfied only by the static pre-boot markup in
`index.html` — a raw-HTML grep passed while the app had no data behind it.

**Root cause:** the runtime container starts via **supervisord** (`backend` +
`nginx`), so `docker-entrypoint.sh` — which chains
`prisma migrate deploy` → seed → start — is never executed. Migrations had
been applied out-of-band (tables existed), but the seed step never ran.

**Fix:** ran `prisma/seed/seed.js` as a K8s Job on the production image with
`DATABASE_URL` projected from the `app-secrets` secret (`workingDir:
/app/backend`). Job completed; Job deleted afterward. No fallback needed.

Post-seed verification against the live URL:
- `/api/tags` → `["dragons","training"]`
- `/api/articles` → 1 article, "How to train your dragon", both tags, author `jake`
- `/api/articles/:slug/comments` → 1 seeded comment
- `POST /api/users/login` as `jake@demo` → **200** with a valid JWT (`role: ADMIN`)

The `@IsEmail({ require_tld: false })` landmine called out in the plan is
confirmed handled — the TLD-less `jake@demo` authenticates successfully.

## Credentials → Colossus — OK

Parsed `SEED_CRED ADMIN jake@demo Demo1234!` and PATCHed to the Colossus
demo-credentials endpoint. Response `{"ok":true}` (HTTP 200).

| Role | Email | Password |
|---|---|---|
| admin | `jake@demo` | `Demo1234!` |

**CloudBeaver:** not deployed in this namespace — no `cloudbeaver` service found. Omitted.

## Phase 1 — Deferred secrets: N/A

No `.pipeline/integrations.json` and no project secrets store exist. No secret
carries `obtain_timing="post_deploy"` or `obtain_by="defer"`. Nothing pending.

## Phase 2 — Webhooks: N/A

The technical plan declares **Integrations: None**; the spec names no
third-party services. No webhooks to register.

## Manual follow-ups

1. **Seeding is not self-healing.** Because supervisord bypasses
   `docker-entrypoint.sh`, neither `migrate deploy` nor the seed runs on boot.
   Current data survives pod restarts (Postgres is a StatefulSet with a PVC),
   but **any fresh/reset database will come up empty and demo login will 401
   again.** Fix by invoking the entrypoint from the supervisord `backend`
   program, or add the seed as a deploy-time Job. This is the one item worth
   fixing before the next redeploy.
2. **Static acceptance markup masks data failures.** The pre-boot markers in
   `<app-root>` are deliberate (plan Risk 1), but they made an empty database
   look healthy to a raw-HTML grep. Prefer asserting against `/api/articles`
   for real end-to-end confidence.
3. **Stray dev server.** `conduit-01-staging-ng-serve` (Angular `ng serve`,
   port 4200) is running alongside the production pod. Harmless but unused —
   consider scaling to 0 to reclaim resources.
4. **TLS renewal** due by Oct 9 2026 (wildcard/shared `athenconsult.com` cert).
