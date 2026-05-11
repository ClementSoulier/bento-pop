# Mon Bento Pop · App mobile

App companion Bento Pop : compose ton bento culturel (film, série, artiste, chanson, créateur, lieu) et découvre ceux des autres.

## Stack

- **Expo SDK 52** (managed) + **Expo Router v4** (file-based routing)
- **React Native 0.76** + **react-native-web** (build web aussi)
- **NativeWind v4** consommant `@bento-pop/brand` (tokens partagés avec la landing)
- **Supabase** (projet dédié `supabase-mobile/`) avec **anonymous sign-in**
- **React Query** (data fetching) + **Zustand** (état UI)
- **EAS Build** (iOS / Android binaries)

## Setup local (1ère fois)

```bash
# Depuis la racine du monorepo
pnpm install

# Crée le projet Supabase distant + lie-le
cd supabase-mobile
supabase link --project-ref <PROJECT_REF>
supabase db push    # applique la migration initiale

# Configure les env vars de l'app
cd ../apps/mobile
cp .env.example .env
# Édite .env avec EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY
```

## Dev

```bash
pnpm dev:mobile             # depuis la racine — Expo Dev Tools
pnpm dev:mobile:web         # version web (réact-native-web)
```

Scan le QR code avec Expo Go (iOS / Android) ou lance un simulateur (`i` / `a`).

## Architecture des routes (Expo Router)

```
app/
├── _layout.tsx              # Root : fonts, session anon, providers
├── index.tsx                # Redirect : onboarding ou tabs selon profile
├── onboarding/
│   ├── _layout.tsx
│   ├── splash.tsx           # P2 — écran 01 du design
│   ├── pseudo.tsx           # P2 — écran 02
│   └── mechanics.tsx        # P2 — écran 03
├── (tabs)/                  # Bottom tab bar (Compose · À la une · Trouver · Profil)
│   ├── _layout.tsx
│   ├── compose.tsx
│   ├── featured.tsx
│   ├── search.tsx
│   └── profile.tsx
└── u/
    └── [pseudo].tsx         # Bento public partageable
```

## Modèle de données (Supabase)

Cf. `supabase-mobile/migrations/20260511000000_initial_schema.sql`.

- `bento_categories` (table de référence évolutive : 6 catégories MVP)
- `users` (1:1 avec `auth.users`, anonymous sign-in)
- `items` (catalogue mutualisé issu des APIs externes)
- `bentos` (1 bento par user au MVP — `user_id` UNIQUE)
- `bento_items` (1 slot par catégorie : PK composite `(bento_id, category_id)`)

RLS : lecture publique des bentos publiés, écriture restreinte à `auth.uid()`.

## Build EAS

```bash
eas login
eas build:configure         # 1ère fois
eas build --profile development --platform ios
eas build --profile preview --platform all
```
