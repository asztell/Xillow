# syntax=docker/dockerfile:1
#
# Xillow API image.
#
# Multi-stage build:
#   deps    -> install all workspace deps (cached on the lockfile/manifests)
#   build   -> compile TypeScript to apps/api/dist
#   runtime -> production deps + compiled output only, running as non-root.
#
# The build context is the repo root (see compose.yml) because this is an npm
# workspaces monorepo: npm needs the root lockfile and every workspace manifest.

###############################################################################
# Shared base
###############################################################################
FROM node:24-alpine AS base
WORKDIR /app
# Dev deps are needed to build; overridden to production in the runtime stage.
ENV NODE_ENV=development

###############################################################################
# Dependencies
###############################################################################
FROM base AS deps
# Copy only the manifests first so this layer is cached until deps change.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm ci

###############################################################################
# Build
###############################################################################
FROM deps AS build
COPY packages/types packages/types
COPY apps/api apps/api
RUN npm run build -w @xillow/api

###############################################################################
# Runtime
###############################################################################
FROM base AS runtime
ENV NODE_ENV=production

# Reproducible, production-only install.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm ci --omit=dev && npm cache clean --force

# Compiled app and the files the seed script reads at runtime.
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/types/src packages/types/src
COPY apps/api/schema.sql apps/api/schema.sql
COPY apps/api/sample_listings.json apps/api/sample_listings.json

# Drop privileges to the unprivileged `node` user that ships with the image.
USER node

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
