# syntax=docker/dockerfile:1
#
# Xillow web image.
#
# Multi-stage build:
#   build   -> install workspace deps and produce the static bundle (Vite)
#   runtime -> serve the bundle with nginx, reverse-proxying /api to the API
#
# Build context is the repo root (see compose.yml).

###############################################################################
# Build the static bundle
###############################################################################
FROM node:24-alpine AS build
WORKDIR /app
ENV NODE_ENV=development

# Manifest-first install so the dependency layer caches well.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm ci

COPY packages/types packages/types
COPY apps/web apps/web
# `VITE_API_BASE` is intentionally unset: the app calls same-origin /api, which
# nginx proxies to the api service (no CORS in production).
RUN npm run build -w @xillow/web

###############################################################################
# Runtime
###############################################################################
FROM nginx:1.27-alpine AS runtime

# SPA fallback + /api reverse proxy to the api service.
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
# The base image's default CMD runs nginx in the foreground.
