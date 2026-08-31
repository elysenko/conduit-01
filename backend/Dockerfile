# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app
# Prisma's query engine links against OpenSSL; alpine images ship without it.
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
# Generate before the rest of the source is copied so a code-only change does
# not invalidate the (slow) engine-download layer.
RUN npx prisma generate
COPY . .
RUN npm run build \
    && test -f /app/dist/main.js \
    || (echo 'ERROR: dist/main.js missing after build — check tsconfig.build.json rootDir: src' && exit 1)

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# Must match colossus.yaml -> backend.port, which drives the Service and probes.
ENV PORT=3001
RUN apk add --no-cache openssl

COPY package*.json ./
# Dev deps are kept deliberately: the entrypoint shells out to the Prisma CLI for
# `migrate deploy`, and the CLI is a devDependency.
COPY --from=builder /app/node_modules ./node_modules
# .prisma holds the generated client + query-engine binary. `npm ci` alone would
# reinstall the bare @prisma/client package and drop both.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
