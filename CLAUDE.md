# CLAUDE.md

Guide pour Claude Code (et tout autre agent) qui travaille sur le monorepo **Bento Pop**.

## Contexte produit

**Bento Pop** est un média pop culture (YouTube + podcasts) animé par **Dark Hifus**, avec **Thodalf/Keremasan**, **Elda** et **Rob** (DA). Ce monorepo outille le média avec des applications de plateau et utilitaires (premier exemple : tirage de jeu sur boîte bento). Toutes les apps partagent l'identité visuelle « Bento Pop » : fond jaune, mascotte **Popy** (boule de riz), contours noirs épais, ombres « stamp » plates.

La spécification de référence vit dans **[`docs/SCAFFOLDING.md`](./docs/SCAFFOLDING.md)** — y revenir pour comprendre les décisions structurelles. Quand l'implémentation diverge du spec (ex : la V1 utilise les Popys comme « plats » plutôt que des thématiques génériques), c'est l'implémentation qui fait foi.

## Stack

| Domaine          | Choix                                                |
| ---------------- | ---------------------------------------------------- |
| Langage          | TypeScript strict (`noUncheckedIndexedAccess` activé) |
| Framework        | Next.js 15 (App Router) — React 19                   |
| Styling          | Tailwind CSS + tokens via `@bento-pop/brand`         |
| Animations       | Framer Motion                                        |
| Audio            | Web Audio API native (zéro dépendance audio externe) |
| Données          | Supabase (Postgres + Auth + Storage) — préparé       |
| Monorepo         | Turborepo + pnpm workspaces                          |
| Hébergement      | Vercel (principal) + build local (régie hors-ligne)  |
| CI               | GitHub Actions                                       |

## Structure

```
bento-pop/
├── apps/
│   └── quiz-wheel/                 # App #1 — écran plateau de tirage
├── packages/
│   ├── brand/                      # Tokens, typo, assets, preset Tailwind
│   ├── ui/                         # Composants React partagés (squelette)
│   ├── supabase/                   # Client typé (squelette V1)
│   ├── tsconfig/                   # Configs TS partagées
│   └── eslint-config/              # Configs ESLint partagées
├── supabase/
│   └── migrations/                 # SQL versionné (vide en V1)
├── docs/
│   └── SCAFFOLDING.md              # Spécification de référence
├── .github/workflows/ci.yml        # Lint + typecheck + build
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Commandes courantes

```bash
# Setup
corepack enable && corepack prepare pnpm@latest --activate
nvm use                                 # Node 20 (voir .nvmrc)
pnpm install

# Dev
pnpm --filter quiz-wheel dev            # Next.js sur :3000
pnpm dev                                # toutes les apps en parallèle

# Qualité
pnpm lint
pnpm typecheck
pnpm format                             # Prettier write
pnpm format:check

# Build
pnpm build                              # turbo build (cache)
pnpm --filter quiz-wheel build:offline  # mode régie hors-ligne (standalone, USB-portable)
pnpm --filter quiz-wheel start:offline  # lance le serveur standalone (Node, sans node_modules requis)
```

## Conventions

- **TypeScript strict** partout. `noUncheckedIndexedAccess` activé : tout accès indexé renvoie `T | undefined`. Toujours penser au cas vide.
- **Imports** : alias `@/` configuré dans `apps/*/tsconfig.json`. Pour les packages partagés, importer depuis `@bento-pop/<package>`.
- **Assets** : source unique dans `packages/brand/assets/`. Côté app Next.js, importer via `@bento-pop/brand/assets/...` (le subpath export est défini, et `next.config.ts` transpile le package).
- **Tokens** : ne jamais hardcoder de couleurs Bento Pop. Utiliser le preset Tailwind (classes `bg-bento-yellow`, `border-bento-ink`, `shadow-stamp`, …) ou les variables CSS `--bento-*` exposées par `@bento-pop/brand/tokens.css`.
- **Polices** : chargées via `next/font` côté app, en pointant vers `packages/brand/assets/fonts/` pour la police custom **Extenda 100 Yotta**. Les Google Fonts (Fredoka, Bungee) sont chargées par `next/font/google`.
- **Conventional Commits** : `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, etc.
- **Branches** : `main` protégée, branches feature `feat/<sujet>`, `fix/<sujet>`, `chore/<sujet>`.
- **Composants client** : marquer `'use client'` en tête de fichier dès qu'il y a un hook React, des handlers d'événements ou de l'animation. Garder un maximum de composants serveur quand possible (mais l'app `quiz-wheel` est essentiellement client à cause du tirage).

## Identité visuelle (rappel)

Palette principale (vars CSS dans `@bento-pop/brand/tokens.css`) :

| Token              | Hex       | Usage                          |
| ------------------ | --------- | ------------------------------ |
| `--bento-yellow`   | `#fbbf24` | Fond principal                 |
| `--bento-cream`    | `#fbf3de` | Boîte bento, modales           |
| `--bento-ink`      | `#0a0a0a` | Contours, ombres « stamp »     |
| `--bento-red`      | `#e63946` | CTA principal (`Lancer`)       |
| `--bento-tint-lit` | `#ffd857` | Compartiment en surbrillance   |
| `--bento-orange`   | `#f59331` | Corps des Popys                |

**Signature visuelle** : contours noirs épais (5–6px), ombre plate `0 4–10px 0 var(--bento-ink)` (« stamp »), border-radius généreux (22 → 36px), micro-rotations (`-1.5deg` … `8deg`) pour le côté « collé à la main ».

## App quiz-wheel — points-clés

- **Résolution cible** : 1920×1080 fixe (plateau régie). Pas de responsive complexe — design pixel-perfect.
- **Machine à états** du tirage dans `src/hooks/useWheelSpinner.ts` (`idle | spinning | revealed`). Le tick est piloté par `setTimeout` récursif avec easing (`buildTickPlan` dans `lib/easing.ts`).
- **Audio** : `lib/audio.ts` synthétise tick + ding via Web Audio. Le contexte est lazy-init au premier `launch` (Chrome bloque sinon).
- **Mode présentation** : `useWakeLock` + `useAutoHideCursor` actifs en permanence sur la page racine.
- **Layouts** : 3 dispositions exposées dans `src/data/layouts.ts` (Shokado 7 / Kyukaku 9 / Stratifié 6). Layout par défaut : `A`. Pour ajouter un selector UI plus tard, étendre `QuizWheel.tsx`.
- **Données** : Popys et jeux placeholders dans `src/data/popys.ts`. Migration future vers Supabase prévue (table `quiz_popy_games` ou similaire).

## Hors-scope V1 (ne pas implémenter sans demande explicite)

- Back-office d'édition des jeux.
- Persistance des tirages (historique par émission).
- Mode multijoueur / scores.
- App mobile compagnon.
- Internationalisation.
- Auth Supabase.

## Ressources externes

- Spec produit : [`docs/SCAFFOLDING.md`](./docs/SCAFFOLDING.md)
- Design source (Claude Design) : « Bento Quiz » — direction artistique Bento Pop avec Popys comme plats.
- Police custom : `packages/brand/assets/fonts/extenda-100-yotta.otf` (logo + CTA).
