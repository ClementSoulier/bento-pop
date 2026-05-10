# syntax=docker/dockerfile:1.7
# Build context = racine du monorepo. Dans Coolify :
#   Base Directory      = /
#   Dockerfile Location = /apps/landing/Dockerfile
#   Port                = 3000

ARG NODE_VERSION=20-alpine

# ---------- 1. deps : install pnpm + node_modules pour tout le workspace ----------
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# Manifests workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.base.json ./
COPY .npmrc* ./

# Manifests des apps + packages utilisés par landing
COPY apps/landing/package.json        ./apps/landing/
COPY packages/brand/package.json      ./packages/brand/
COPY packages/ui/package.json         ./packages/ui/
COPY packages/supabase/package.json   ./packages/supabase/
COPY packages/tsconfig/package.json   ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- 2. builder : copie des sources + next build ----------
FROM node:${NODE_VERSION} AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

COPY --from=deps /repo ./
COPY . .

# NEXT_PUBLIC_* sont inlinés au build → doivent être disponibles ICI.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN pnpm --filter @bento-pop/landing build

# ---------- 3. runner : image minimale (standalone) ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /repo
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nextjs -G nodejs

# Sortie standalone : server.js à apps/landing/server.js + node_modules pruné
COPY --from=builder --chown=nextjs:nodejs /repo/apps/landing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/landing/.next/static     ./apps/landing/.next/static

# public/ optionnel : copié seulement s'il existe
# (Le test ci-dessus se fait au build du Dockerfile via une instruction shell.)
# Si tu ajoutes un dossier apps/landing/public/, décommente la ligne suivante :
# COPY --from=builder --chown=nextjs:nodejs /repo/apps/landing/public ./apps/landing/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/landing/server.js"]
