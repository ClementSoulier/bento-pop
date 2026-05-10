# syntax=docker/dockerfile:1.7
# Build context = racine du monorepo. Dans Coolify :
#   Base Directory      = /
#   Dockerfile Location = /apps/admin/Dockerfile
#   Port                = 3100

ARG NODE_VERSION=20-alpine

# ---------- 1. deps ----------
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.base.json ./
COPY .npmrc* ./

COPY apps/admin/package.json          ./apps/admin/
COPY packages/brand/package.json      ./packages/brand/
COPY packages/ui/package.json         ./packages/ui/
COPY packages/supabase/package.json   ./packages/supabase/
COPY packages/tsconfig/package.json   ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- 2. builder ----------
FROM node:${NODE_VERSION} AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

COPY --from=deps /repo ./
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN pnpm --filter @bento-pop/admin build

# ---------- 3. runner ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /repo
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3100 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/admin/.next/static     ./apps/admin/.next/static

# Si tu ajoutes apps/admin/public/, décommente :
# COPY --from=builder --chown=nextjs:nodejs /repo/apps/admin/public ./apps/admin/public

USER nextjs
EXPOSE 3100

CMD ["node", "apps/admin/server.js"]
