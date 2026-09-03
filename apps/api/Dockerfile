# Multi-stage build for the K-Meets API (NestJS). Built from the monorepo
# root (see the `context`/`-f` note in docs/DEPLOYMENT.md) so pnpm workspace
# links to packages/shared resolve the same way they do locally.
#
# Usage (from the repo root):
#   docker build -f apps/api/Dockerfile -t kmeets-api .
#   docker run -p 4000:4000 --env-file apps/api/.env kmeets-api

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /repo

# --- deps: install once, reused by both the build and prod-only stages ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/staff/package.json apps/staff/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# --- build: compile the API ---
# @kmeets/shared has no build step of its own — its package.json points
# "main" straight at src/index.ts, loaded at runtime by Node's built-in
# TypeScript support (stable since Node 22.18/23.6, no ts-node needed).
# node:22-alpine tracks current 22.x patches, so this matches local dev.
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @kmeets/api build

# --- prod-deps: a second install with dev dependencies excluded ---
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/staff/package.json apps/staff/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --prod

# --- runtime: the smallest image that can actually run the server ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo

RUN addgroup -S kmeets && adduser -S kmeets -G kmeets
COPY --from=prod-deps /repo/node_modules /repo/node_modules
COPY --from=build /repo/packages/shared /repo/packages/shared
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
COPY --from=build /repo/apps/api/src/database/migrations /repo/apps/api/src/database/migrations
COPY apps/api/package.json apps/api/package.json

WORKDIR /repo/apps/api
USER kmeets

EXPOSE 4000
# validateProductionConfig() (src/config/validate-production-config.ts) runs
# on every boot and refuses to start with unsafe production config — see
# docs/SECURITY_AUDIT.md. Run `pnpm db:migrate` as a separate release-phase
# step before starting this container; it deliberately doesn't run here so
# a rolling restart of multiple instances never races running the same
# migration concurrently.
CMD ["node", "dist/src/main.js"]
