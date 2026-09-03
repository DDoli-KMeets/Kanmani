# Builds the staff/admin dashboard (apps/staff) as a static site and serves
# it with nginx. Built from the monorepo root:
#   docker build -f apps/staff/Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://api.kmeets.in/v1 \
#     -t kmeets-staff .
#   docker run -p 8081:8080 kmeets-staff
#
# See apps/web/Dockerfile for why VITE_API_BASE_URL is a build arg, not a
# runtime env var. docs/DEPLOYMENT.md also flags keeping this app off a
# public, guessable URL — that's a hosting-level decision, not a build one.

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
COPY apps/staff apps/staff
RUN pnpm --filter @kmeets/staff build

FROM nginx:1.27-alpine AS runtime
COPY apps/staff/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/staff/dist /usr/share/nginx/html
EXPOSE 8080
