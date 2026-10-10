# CLAUDE.md

Guide pour Claude Code (et tout autre agent) qui travaille sur le monorepo **Bento Pop**.

## Contexte produit

**Bento Pop** est un média pop culture (YouTube + podcasts) animé par **Dark Hifus**, avec **Thodalf/Keremasan**, **Elda** et **Rob** (DA). Ce monorepo regroupe ses outils numériques :

| App               | Quoi                                                                                      | Où                            |
| ----------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| `apps/landing`    | Site public : émissions, podcasts, RSS, bentos publics `/u/[pseudo]`                      | bento-pop.com (Coolify)       |
| `apps/mobile`     | App « **Mon Bento Pop** » : chacun compose son bento culturel et découvre ceux des autres | App Store / Play (EAS)        |
| `apps/admin`      | Back-office : contenus du site, catalogue, bentos, éditions, utilisateurs, push           | admin.bento-pop.com (Coolify) |
| `apps/quiz-wheel` | Écran plateau : tirage de jeu sur boîte bento (régie, hors-ligne possible)                | build local / standalone      |

Toutes les apps partagent l'identité visuelle « Bento Pop » : fond jaune, mascotte **Popy** (boule de riz), contours noirs épais, ombres « stamp » plates.

**Où est la vérité produit** : [`docs/MON-BENTO-POP-UX-ROADMAP.md`](./docs/MON-BENTO-POP-UX-ROADMAP.md) donne l'état des chantiers (numérotés, un par un, avec une spec `docs/UX-xx-*.md` par chantier) et les décisions de sortie. [`docs/SCAFFOLDING.md`](./docs/SCAFFOLDING.md) est la spec d'origine du monorepo, désormais historique : quand l'implémentation diverge, c'est l'implémentation qui fait foi.

## Stack

| Domaine     | Choix                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| Langage     | TypeScript strict (`noUncheckedIndexedAccess` activé)                                 |
| Web         | Next.js 15 (App Router), React 19, Tailwind CSS + preset `@bento-pop/brand`           |
| Mobile      | Expo SDK 57 (CNG), Expo Router, React Native 0.86, NativeWind 4, React Query, Zustand |
| Animations  | Framer Motion (web), Reanimated (mobile)                                              |
| Données     | Supabase, **deux projets distincts** (voir ci-dessous)                                |
| Tests       | `node:test` via `tsx --test` (`*.test.ts` à côté du code) + `test:e2e` landing        |
| Monorepo    | Turborepo + pnpm 9 workspaces                                                         |
| Hébergement | Coolify (VPS, Dockerfiles de `landing` et `admin`), EAS Build/Submit/Update (mobile)  |
| CI          | GitHub Actions : lint → typecheck → test → test:e2e → build                           |

### Les deux projets Supabase

| Projet  | Hébergement                           | Migrations                         | Package / client                                               |
| ------- | ------------------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| Landing | Auto-hébergé (supabase.bento-pop.com) | `supabase/migrations/`             | `@bento-pop/supabase` (+ `@supabase/ssr`)                      |
| Mobile  | Supabase Cloud (plan gratuit)         | `apps/mobile/supabase/migrations/` | `@bento-pop/supabase-mobile` (types `Database`, helpers bento) |

- La landing lit le projet mobile en anon pour les pages `/u/*`.
- L'admin parle aux deux : clé service-role du projet mobile **côté serveur uniquement**.
- `.github/workflows/supabase-keepalive.yml` ping le projet mobile tous les 2 jours pour éviter sa mise en pause.
- Les migrations du projet mobile s'appliquent en production au fil de l'eau : chacune doit rester **compatible avec les versions de l'app déjà servies par les stores** (cf. roadmap).

## Structure

```
bento-pop/
├── apps/
│   ├── landing/        # Next.js — site public (+ e2e/, Dockerfile)
│   ├── admin/          # Next.js — back-office, port 3100 (+ scripts/ catalogue, Dockerfile)
│   ├── mobile/         # Expo — app/ (routes), src/{components,lib,state,supabase}, supabase/, scripts/
│   └── quiz-wheel/     # Next.js — écran plateau
├── packages/
│   ├── brand/          # Tokens, typo, assets, preset Tailwind (source unique des assets)
│   ├── supabase/       # Client typé + types du projet landing
│   ├── supabase-mobile/# Types + helpers du projet mobile
│   ├── ui/             # Composants React partagés (encore vide)
│   ├── tsconfig/       # Configs TS partagées
│   └── eslint-config/  # Configs ESLint partagées
├── supabase/           # Projet Supabase landing : migrations, seed, config
├── docs/               # Roadmap, specs UX-xx, déploiement / recette mobile, compliance stores
└── .github/workflows/  # ci.yml, supabase-keepalive.yml
```

## Commandes courantes

```bash
# Setup
corepack enable                          # pnpm 9.15 (packageManager du package.json)
nvm use                                  # Node 20 (voir .nvmrc)
pnpm install

# Dev
pnpm dev:landing                         # http://localhost:3000
pnpm dev:admin                           # http://localhost:3100
pnpm dev:mobile                          # Expo (dev client) — dev:mobile:web pour le web
pnpm dev:quiz                            # http://localhost:3000

# Qualité
pnpm lint
pnpm typecheck
pnpm test                                # tsx --test, toutes les apps
pnpm test:e2e                            # landing : build + serveur + smoke HTTP
pnpm format / pnpm format:check

# Build
pnpm build
pnpm --filter quiz-wheel build:offline   # régie hors-ligne (standalone, USB-portable)
```

Mobile (depuis `apps/mobile`) : `release` (EAS build + soumission), `store:versions`. Voir [`apps/mobile/EAS.md`](./apps/mobile/EAS.md), [`docs/DEPLOIEMENT-MOBILE.md`](./docs/DEPLOIEMENT-MOBILE.md) et [`docs/MISES-A-JOUR-APP.md`](./docs/MISES-A-JOUR-APP.md) (OTA vs store).

### Pièges connus

- **Variables d'environnement** : chaque app a son `.env.example`. Toute variable lue pendant `next build` doit figurer dans `turbo.json` (`tasks.build.env`), sinon le cache Turbo peut resservir un build faux.
- **`next-env.d.ts`** est gitignoré : sur un clone neuf, `pnpm lint` (ou `dev`/`build`) le génère. Sans lui, `pnpm typecheck` échoue sur les imports d'assets.
- **Windows** : les scripts `test` utilisent `$(find …)`. Lancer pnpm avec Git Bash comme shell de script (`npm_config_script_shell="C:\Program Files\Git\bin\bash.exe"`), et appeler `pnpm --filter <app> run test` (Turbo ne transmet pas cette variable).
- **Tests d'intégration mobile** (`*.integration.test.ts`) : ils tournent contre un stub PostgREST local (`src/test/postgrest-stub.ts`), pas contre la prod.
- **Données de prod en lecture** : `apps/mobile/scripts/readonly-proxy.mjs` fait tourner l'app sur la prod sans rien y écrire (cf. [`docs/RECETTE-MOBILE.md`](./docs/RECETTE-MOBILE.md)).

## Conventions

- **TypeScript strict** partout. `noUncheckedIndexedAccess` activé : tout accès indexé renvoie `T | undefined`. Toujours penser au cas vide.
- **Imports** : alias `@/` dans les apps ; packages partagés via `@bento-pop/<package>`.
- **Assets** : source unique dans `packages/brand/assets/`, importés via `@bento-pop/brand/assets/...`.
- **Tokens** : ne jamais hardcoder de couleurs Bento Pop. Preset Tailwind/NativeWind (`bg-bento-yellow`, `border-bento-ink`, `shadow-stamp`, …) ou variables CSS `--bento-*` de `@bento-pop/brand/tokens.css`.
- **Polices** : **Extenda 100 Yotta** (custom, `packages/brand/assets/fonts/`) pour logo, titres et CTA ; Fredoka et Bungee (Google Fonts, `next/font/google` côté web, `@expo-google-fonts/*` côté mobile). Les titres Extenda en capitales doivent réserver la place des accents (testé).
- **Tests** : `*.test.ts` à côté du code testé. Plusieurs tests mobile lisent le code source (accessibilité, plafonds de police, requêtes bento) : ils échouent avec le fichier et la ligne fautifs, à corriger plutôt qu'à contourner.
- **Langue** : code, commentaires, commits et docs en français.
- **Conventional Commits** : `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, etc., avec scope d'app quand pertinent (`feat(landing): …`, `fix(mobile): …`).
- **Branches** : `main` protégée, branches `feat/<sujet>`, `fix/<sujet>`, `chore/<sujet>`, `docs/<sujet>`, PR obligatoire.
- **Composants client (Next.js)** : `'use client'` dès qu'il y a un hook, des handlers ou de l'animation ; garder un maximum de composants serveur.

## Identité visuelle (rappel)

Palette principale (vars CSS dans `@bento-pop/brand/tokens.css`) :

| Token              | Hex       | Usage                        |
| ------------------ | --------- | ---------------------------- |
| `--bento-yellow`   | `#fbbf24` | Fond principal               |
| `--bento-cream`    | `#fbf3de` | Boîte bento, modales         |
| `--bento-ink`      | `#0a0a0a` | Contours, ombres « stamp »   |
| `--bento-red`      | `#e63946` | CTA principal                |
| `--bento-tint-lit` | `#ffd857` | Compartiment en surbrillance |
| `--bento-orange`   | `#f59331` | Corps des Popys              |

**Signature visuelle** : contours noirs épais (5–6px), ombre plate `0 4–10px 0 var(--bento-ink)` (« stamp »), border-radius généreux (22 → 36px), micro-rotations (`-1.5deg` … `8deg`) pour le côté « collé à la main ».

## App mobile — points-clés

- **Versions** : une seule sortie store est prévue, une fois tous les chantiers de la roadmap terminés et recettés (chantier 29 = recette de sortie). D'ici là, ne pas publier de build sans décision explicite. `app.json` porte la version ; comparer à ce que servent réellement les stores (`store:versions`) avant de la toucher.
- **Mises à jour** : OTA via `expo-updates` pour le JS, build store pour le natif ; plancher de version piloté par `app_config` (cf. `docs/MISES-A-JOUR-APP.md`).
- **Auth** : connexion anonyme Supabase ; pseudo choisi à l'onboarding.
- **Push** : `expo-notifications` côté app, envoi par l'admin (`/api/push`, battement `pg_cron` sur `/api/push/tick`).
- **Conformité stores** : [`docs/STORE-COMPLIANCE.md`](./docs/STORE-COMPLIANCE.md).

## App quiz-wheel — points-clés

- **Résolution cible** : 1920×1080 fixe (plateau régie), design pixel-perfect.
- **Machine à états** du tirage dans `src/hooks/useWheelSpinner.ts` (`idle | spinning | revealed`), tick par `setTimeout` récursif avec easing (`buildTickPlan` dans `lib/easing.ts`).
- **Audio** : `lib/audio.ts` synthétise tick + ding via Web Audio, contexte lazy-init au premier `launch`.
- **Mode présentation** : `useWakeLock` + `useAutoHideCursor` actifs sur la page racine.
- **Layouts** : `src/data/layouts.ts` (Shokado 7 / Kyukaku 9 / Stratifié 6), défaut `A`. Popys et jeux placeholders dans `src/data/popys.ts`.

## Ressources

- Roadmap et décisions : [`docs/MON-BENTO-POP-UX-ROADMAP.md`](./docs/MON-BENTO-POP-UX-ROADMAP.md)
- Catalogue maison : [`docs/MON-BENTO-POP-CATALOG.md`](./docs/MON-BENTO-POP-CATALOG.md)
- Spec d'origine (historique) : [`docs/SCAFFOLDING.md`](./docs/SCAFFOLDING.md)
- Design source (Claude Design) : « Bento Quiz » — direction artistique Bento Pop avec Popys comme plats.
