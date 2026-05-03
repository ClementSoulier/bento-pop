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

# Lancer l'app quiz-wheel en dev
pnpm --filter quiz-wheel dev        # http://localhost:3000

# Build complet (cache Turbo)
pnpm build

# Lint + typecheck partout
pnpm lint
pnpm typecheck
```

## Apps

| App           | Port | Statut | Description                                                |
| ------------- | ---- | ------ | ---------------------------------------------------------- |
| `quiz-wheel`  | 3000 | V1     | Écran plateau plein écran, tirage de jeu sur boîte bento. |

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
