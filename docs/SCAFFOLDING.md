# Bento Pop — Spécification de scaffolding

> Document de référence pour l'initialisation du monorepo Bento Pop et la première application `quiz-wheel`.
> Version 1.0 — à versionner à la racine du repo.

---

## 1. Contexte

**Bento Pop** est un média pop culture (YouTube + podcasts) animé par Dark Hifus, accompagné de Thodalf/Keremasan, Elda et Rob (DA). Le présent projet de développement vise à outiller progressivement le média avec des applications utilitaires : tirage de thématique sur plateau, futurs outils communautaires et événementiels (Japan Expo, Japan Tours Festival, etc.).

L'objectif technique est de **construire un socle réutilisable** : identité visuelle, composants, accès données — partagés entre toutes les applications à venir.

---

## 2. Stack technique

| Domaine | Choix |
|---|---|
| Langage | TypeScript (mode `strict`) |
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS + variables CSS |
| Animations | Framer Motion |
| Données | Supabase (Postgres + Auth + Storage) |
| Monorepo | Turborepo |
| Package manager | pnpm (workspaces) |
| Hébergement | Vercel (principal) + build local fallback |
| CI | GitHub Actions (lint + typecheck + build) |

Turborepo est volontairement préféré à Nx : pipeline et cache, sans la lourdeur structurelle. La migration vers Nx reste possible si la complexité l'exige plus tard.

---

## 3. Structure du repo

```
bento-pop/
├── apps/
│   └── quiz-wheel/                 # App #1 — écran plateau de tirage au sort
├── packages/
│   ├── ui/                         # Composants React partagés
│   ├── brand/                      # Tokens DA, typo, assets, preset Tailwind
│   ├── supabase/                   # Client typé + types générés
│   ├── tsconfig/                   # tsconfig.base / next / react
│   └── eslint-config/              # Configs ESLint partagées
├── supabase/
│   ├── migrations/                 # Migrations SQL versionnées
│   └── seed.sql                    # Données de seed
├── .github/workflows/
│   └── ci.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .nvmrc
├── .gitignore
├── README.md
└── SCAFFOLDING.md                  # Ce fichier
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### Convention de nommage des packages

Tous les packages internes utilisent le scope `@bento-pop/*` :
`@bento-pop/ui`, `@bento-pop/brand`, `@bento-pop/supabase`, etc. Aucun n'est publié sur npm — résolution via `workspace:*`.

---

## 4. Conventions

- **TypeScript strict** partout, `noUncheckedIndexedAccess` activé.
- **ESLint + Prettier** avec config partagée depuis `@bento-pop/eslint-config`.
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, …) pour préparer un changelog automatisable.
- **Branches** : `main` protégée, branches de feature `feat/<sujet>`, `fix/<sujet>`, `chore/<sujet>`.
- **Node** : version épinglée via `.nvmrc` (proposition : Node 20 LTS).
- **Imports** : alias `@/` configuré dans chaque app via `tsconfig.json`.

---

## 5. Package `@bento-pop/brand` — l'ADN visuel

Package central qui porte l'identité Bento Pop. Toutes les apps en dépendent.

**Contenu :**

- **Tokens design** exposés en doublon : variables CSS (`--bento-rice`, `--bento-nori`, `--bento-radius-lg`, …) + constantes TypeScript (pour usage hors CSS).
- **Typographie** : import des polices via `next/font` ou fichiers locaux dans `assets/fonts/`.
- **Assets** fournis par Rob, organisés ainsi :
  ```
  packages/brand/assets/
  ├── mascot/                       # Boule de riz, expressions multiples
  ├── logo/                         # Logo Bento Pop, déclinaisons
  ├── icons/                        # Icônes thématiques (cinéma, jeu vidéo, …)
  ├── illustrations/                # Visuels décoratifs
  ├── fonts/                        # Si polices custom
  └── audio/                        # Sons (voir §6.4)
  ```
- **Preset Tailwind** exporté via `@bento-pop/brand/tailwind`, étendu par chaque app dans son `tailwind.config.ts`.

**Exports prévus :**

```ts
// packages/brand/src/index.ts
export * from "./tokens";        // colors, spacing, radii, shadows
export * from "./assets";        // chemins typés vers tous les assets
export * from "./typography";
```

---

## 6. Application `quiz-wheel`

### 6.1 Objectif

Écran plateau plein écran, branché en HDMI à un téléviseur ou écran régie. Permet à l'animateur (Dark Hifus) ou un joueur de **tirer au sort une thématique de quiz** parmi 7, avec une animation de "highlight tournant" qui ralentit jusqu'à s'arrêter.

### 6.2 Spécifications produit

- **Résolution cible fixe** : 1920×1080 (16:9). Pas de responsive — design pixel-parfait pour cette résolution unique.
- **Compartiments** : 7 cases dans une boîte bento stylisée, layout asymétrique inspiré des bento grids modernes (à finaliser avec Rob — voir §6.5 propositions).
- **Thématiques (V1, en dur)** — liste indicative à valider :
  1. Cinéma & Séries
  2. Jeux Vidéo
  3. Sport & Esport
  4. Société
  5. Animation & Manga
  6. Musique & Pop
  7. Joker / Question surprise
- **Mascotte boule de riz** présente à l'écran (idéalement au centre ou en élément flottant), avec micro-animations idle.

### 6.3 Interactions clavier

| Touche | Action |
|---|---|
| `Espace` | Lancer le tirage (uniquement depuis l'état `idle`) |
| `R` | Reset vers l'état `idle` (depuis `revealed`) |
| `F` | Toggle plein écran |
| `Échap` | Sortir du plein écran |
| `M` | Mute / unmute |

L'écoute clavier est globale (`window.addEventListener('keydown', …)` dans un `useEffect`).

### 6.4 Sound design (V1)

Le son est intégré dès la V1.

- **Tick** : son court joué à chaque changement de compartiment pendant le spin. Le pitch peut légèrement varier ou descendre en fin de spin pour renforcer l'effet de ralentissement.
- **Reveal** : son ascendant + impact joué au moment où le highlight s'arrête.
- **Idle ambient** (optionnel) : nappe discrète en boucle pendant l'attente.
- **Préchargement** : tous les sons sont chargés au montage de la page (pas de retard au premier appui sur `Espace`).
- **Implémentation** : Web Audio API directement, ou `howler.js` pour la simplicité. Recommandation : Web Audio natif pour garder la dépendance minimale.
- **Fichiers** stockés dans `@bento-pop/brand/assets/audio/` (formats `.webm` Opus + `.mp3` fallback).

### 6.5 Layout (proposition technique)

Pour 7 compartiments en 1920×1080, plusieurs layouts asymétriques sont possibles. À titre d'exemple, une grille CSS 4×3 avec compartiments de tailles variées :

```
┌────────┬────────┬─────────────────┐
│  C1    │  C2    │       C3        │
│        │        │   (large)       │
├────────┼────────┴────┬────────────┤
│  C4    │             │            │
│        │  MASCOTTE   │     C5     │
├────────┤   centre    │            │
│  C6    │             ├────────────┤
│        │             │     C7     │
└────────┴─────────────┴────────────┘
```

Le layout définitif est à valider avec Rob. La logique de tirage est **agnostique du layout** : un tableau ordonné `compartments[7]` avec une fonction `getNextIndex()` qui parcourt cet ordre. La grille visuelle peut donc évoluer sans toucher à la mécanique.

### 6.6 Machine à états

```
        ┌─────────┐  Espace  ┌──────────┐  fin spin  ┌──────────┐
        │  idle   │ ───────► │ spinning │ ─────────► │ revealed │
        └─────────┘          └──────────┘            └──────────┘
             ▲                                             │
             └────────────────  R  ────────────────────────┘
```

Géré avec `useReducer` :

```ts
type State =
  | { status: "idle" }
  | { status: "spinning"; targetIndex: number; currentIndex: number; tickMs: number }
  | { status: "revealed"; index: number };

type Action =
  | { type: "START"; targetIndex: number }
  | { type: "TICK"; nextIndex: number; nextTickMs: number }
  | { type: "STOP" }
  | { type: "RESET" };
```

### 6.7 Mécanique d'animation

Le tirage se fait en deux temps :

1. Au lancement, on tire **immédiatement** un `targetIndex` aléatoire et un nombre de tours minimum (`fullLoops = 3` à 5 par exemple). Cela garantit que l'animation s'arrête sur la bonne case et permet de précalculer la durée totale.
2. Une boucle pilotée par `setTimeout` récursif fait avancer `currentIndex` d'une case à chaque tick. L'intervalle entre deux ticks (`tickMs`) suit une fonction d'easing :

```
tickMs(t) = startMs + (endMs - startMs) * easeOutCubic(t)
// startMs ≈ 50ms, endMs ≈ 600ms, t ∈ [0, 1] = progression vers la cible finale
```

Quand `currentIndex === targetIndex` ET que tous les tours minimaux ont été effectués ET `tickMs` a atteint son seuil max, on émet `STOP`.

Durée totale visée : **5 à 7 secondes**. À tuner.

`requestAnimationFrame` n'est pas nécessaire ici (le rythme est discret, pas continu). Framer Motion est utilisé en surcouche pour les transitions visuelles entre les états (highlight glow, reveal zoom, particules au reveal).

### 6.8 Mode présentation

- Curseur masqué (`cursor: none` sur le `body` après quelques secondes d'inactivité).
- **Wake Lock API** activé automatiquement au load pour empêcher la mise en veille de l'écran.
- Pas d'UI de navigation, pas de scrollbars, `overflow: hidden` sur le `html`.
- Logo + mention discrète en bas de l'écran (« bentopop.fr » ou équivalent — à définir).

### 6.9 Données

V1 : thématiques **en dur** dans `apps/quiz-wheel/src/data/categories.ts`.

```ts
export type Category = {
  id: string;
  label: string;
  shortLabel?: string;
  iconKey: string;        // référence vers @bento-pop/brand/assets/icons
  color: string;          // variable CSS du brand
};

export const CATEGORIES: readonly Category[] = [/* … 7 entrées … */] as const;
```

Migration future vers Supabase prévue (table `quiz_categories`) — non implémentée en V1.

---

## 7. Supabase — préparation

Même si `quiz-wheel` n'utilise pas Supabase en V1, le scaffolding est mis en place dès maintenant pour éviter une refonte au moment de la deuxième app :

- Projet Supabase créé (environnements `dev` et `prod` à terme).
- Supabase CLI installée localement (`supabase init` à la racine).
- Dossier `supabase/migrations/` versionné — vide en V1, prêt à recevoir la première migration.
- Package `@bento-pop/supabase` exposant :
  ```ts
  import { createClient } from "@bento-pop/supabase";
  const supabase = createClient();   // typé via Database généré
  ```
- Génération des types via :
  ```
  pnpm supabase gen types typescript --linked > packages/supabase/src/database.types.ts
  ```

---

## 8. Variables d'environnement

Chaque app a son `.env.local` (gitignoré) et un `.env.example` versionné.

`apps/quiz-wheel/.env.example` :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

En V1, ces variables ne sont pas utilisées par `quiz-wheel`, mais sont pré-câblées pour faciliter l'ajout futur.

---

## 9. CI / CD

### CI — GitHub Actions

Workflow `.github/workflows/ci.yml` déclenché sur PR et push `main` :

1. Checkout
2. Setup pnpm + Node (`.nvmrc`)
3. `pnpm install --frozen-lockfile`
4. `pnpm turbo lint typecheck build` (cache Turborepo activé via Remote Cache Vercel)

### Déploiement

- **Principal** : Vercel, un projet par app. Root directory = `apps/quiz-wheel`. Build command auto-détectée par l'intégration Turborepo.
- **Fallback local** : pour les enregistrements en lieux à connexion réseau aléatoire, un script documenté permet le mode hors-ligne :
  ```
  pnpm --filter quiz-wheel build
  pnpm --filter quiz-wheel start
  # → http://localhost:3000 sur le laptop régie
  ```

---

## 10. Étapes de scaffolding (ordre d'exécution)

1. **Init repo** : `pnpm init`, création de `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.nvmrc`, `README.md`.
2. **Packages partagés** (squelettes) :
   - `@bento-pop/tsconfig` (configs `base`, `next`, `react`)
   - `@bento-pop/eslint-config`
   - `@bento-pop/brand` (structure dossiers + tokens placeholders)
   - `@bento-pop/ui` (vide pour l'instant)
   - `@bento-pop/supabase` (squelette)
3. **Init Supabase** : `supabase init`, création projet distant, lien CLI, génération types vide.
4. **App `quiz-wheel`** : `pnpm create next-app apps/quiz-wheel --typescript --tailwind --app --src-dir --import-alias "@/*"`.
5. **Branchement Tailwind** sur preset `@bento-pop/brand`.
6. **Intégration des assets** fournis par Rob dans `@bento-pop/brand/assets/`.
7. **Composants UI** :
   - `<BentoGrid>` (layout 7 compartiments) dans l'app (puis remontée dans `@bento-pop/ui` si réutilisable).
   - `<Compartment>` avec états `idle | active | winner`.
   - `<Mascot>` au centre.
8. **Hook `useWheelSpinner`** : machine à états + boucle de tick + easing.
9. **Sound manager** : préchargement, jeu des ticks et du reveal, mute global.
10. **Mode présentation** : Wake Lock, curseur masqué, plein écran.
11. **CI GitHub Actions** : lint + typecheck + build.
12. **Premier déploiement Vercel** + test du fallback local.

---

## 11. Hors scope V1 (backlog)

- Back-office d'édition des thématiques.
- Persistance des tirages (historique par émission).
- Mode multijoueur / tableau des scores.
- App mobile compagnon (télécommande Bluetooth depuis le smartphone de l'animateur).
- Intégration Supabase Auth pour la communauté.
- Internationalisation.

---

## 12. Décisions actées

| # | Sujet | Décision |
|---|---|---|
| 1 | Nombre de compartiments | **7** |
| 2 | Résolution | **1920×1080 fixe** |
| 3 | Données thématiques V1 | **En dur** |
| 4 | Assets graphiques | **Fournis par Rob dans le repo** |
| 5 | Sound design | **Intégré en V1** |
| 6 | Autres apps prévues | **Aucune confirmée** — packages partagés gardent une API minimale |
