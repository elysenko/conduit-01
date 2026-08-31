#!/bin/sh
# Applies pending migrations, seeds idempotently, then hands PID 1 to the API.
#
# `set -e` matters: if the migration fails the container must exit non-zero so
# Kubernetes never routes traffic to a pod running against a stale schema.
set -e

echo "[entrypoint] applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] seeding (idempotent, upsert-based)..."
# A seed failure must not block startup — the schema is already correct and the
# app is fully functional without demo content.
node prisma/seed/seed.js || echo "[entrypoint] WARN: seed failed, continuing"

echo "[entrypoint] starting Conduit API on port ${PORT:-3001}"
exec node dist/main.js
