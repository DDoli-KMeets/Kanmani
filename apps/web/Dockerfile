# Builds the consumer web app (apps/web) as a static site and serves it
# with nginx. Built from the monorepo root:
#   docker build -f apps/web/Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://api.kmeets.in/v1 \
#     -t kmeets-web .
#   docker run -p 8080:8080 kmeets-web
#
# VITE_API_BASE_URL is a BUILD-time argument, not a runtime environment
# variable — Vite bakes it into the compiled JS when the app is built, so
# it must be supplied at `docker build`, not `docker run` (see
# docs/DEPLOYMENT.md's "Deploying the frontend apps" section).

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/staff/package.json apps/staff/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @kmeets/web build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
