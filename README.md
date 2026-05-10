# Bento Pop

Monorepo des outils numériques de **Bento Pop**, média pop culture animé par Dark Hifus.

## Stack

- **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Next.js 15** (App Router) pour les apps
- **Tailwind CSS** + tokens via `@bento-pop/brand`
- **Framer Motion** pour les animations
- **Supabase** (Postgres + Auth + Storage) — préparé, pas encore branché en V1
- **Turborepo** + **pnpm workspaces**
- Hébergement **Vercel**, fallback build local pour les régies

## Structure

```
bento-pop/
├── apps/
│   ├── landing/                    # Site public bento-pop.com
│   ├── admin/                      # Backoffice (admin.bento-pop.com)
│   └── quiz-wheel/                 # Écran plateau — tirage au sort de jeu
├── packages/
│   ├── brand/                      # Tokens, typo, assets, preset Tailwind
│   ├── ui/                         # Composants React partagés
│   ├── supabase/                   # Client typé + types générés
│   ├── tsconfig/                   # Configs TS partagées
│   └── eslint-config/              # Configs ESLint partagées
├── supabase/                       # Migrations + seed
└── docs/
    └── SCAFFOLDING.md              # Spécification détaillée
```

## Pré-requis

- Node **20** (voir `.nvmrc`)
- pnpm **9+** (`corepack enable && corepack prepare pnpm@latest --activate`)

## Démarrage

```bash
nvm use                             # ou fnm use
corepack enable
pnpm install

# Lancer une app en dev (port dédié)
pnpm dev:landing                    # http://localhost:3000
pnpm dev:admin                      # http://localhost:3100
pnpm dev:quiz                       # http://localhost:3000
pnpm dev                            # toutes les apps en parallèle (Turbo)

# Build (cache Turbo)
pnpm build
pnpm build:landing
pnpm build:admin

# Lint + typecheck partout
pnpm lint
pnpm typecheck
```

## Apps

| App           | Port | Statut | Description                                                |
| ------------- | ---- | ------ | ---------------------------------------------------------- |
| `landing`     | 3000 | V1     | Site public bento-pop.com (hero, agenda, vote, équipe…). |
| `admin`       | 3100 | V1     | Backoffice : agenda, sondages, liens, team, CTAs.         |
| `quiz-wheel`  | 3000 | V1     | Écran plateau plein écran, tirage de jeu sur boîte bento. |

## Backoffice — premier accès

L'app `admin` lit/écrit dans Supabase. Pour la première mise en service :

1. Pousser la migration `supabase/migrations/20260510000000_admin_and_content_tables.sql` dans le SQL Editor du projet Supabase (ou via `supabase db push` si la CLI est liée).
2. Renseigner `apps/admin/.env` à partir de `.env.example` — les 3 clés Supabase sont les mêmes que côté `apps/landing/.env`.
3. Sur `http://localhost:3100/login`, le tout premier compte connecté est automatiquement promu **admin** par un trigger SQL. Crée donc d'abord ton utilisateur via le dashboard Supabase (Auth › Users › Add user).
4. Une fois connecté : édite l'agenda, lance des sondages, gère les réseaux et la team. Les loaders de la landing lisent ces tables avec un fallback statique en cas d'erreur DB, donc la prod ne casse pas pendant la transition.

## Mode régie hors-ligne `quiz-wheel`

Build autonome (pas besoin de `node_modules` ni d'internet au lancement) — idéal pour enregistrer dans des lieux sans Wi-Fi fiable :

```bash
pnpm --filter quiz-wheel build:offline    # une fois, avec internet
pnpm --filter quiz-wheel start:offline    # http://localhost:3000
```

La sortie est dans **`dist/quiz-wheel/`** (à la racine, bien visible). Ce dossier est **portable** : copie-le sur USB et lance `node start.mjs` sur n'importe quelle machine avec Node 20+.

Voir [`dist/quiz-wheel/README.md`](./dist/quiz-wheel/README.md) (généré au build) ou [`apps/quiz-wheel/README.md`](./apps/quiz-wheel/README.md) pour le détail.

## Documentation

- Spécification : [`docs/SCAFFOLDING.md`](./docs/SCAFFOLDING.md)
- Instructions agent (Claude Code) : [`CLAUDE.md`](./CLAUDE.md)
