# quiz-wheel

Écran plateau plein écran (1920×1080) — tirage au sort d'un Popy/jeu sur une boîte bento. Branché en HDMI sur le téléviseur de régie.

## Lancer en dev

```bash
pnpm --filter quiz-wheel dev      # http://localhost:3000
```

## Mode régie hors-ligne (recommandé)

Build autonome qui n'a **plus besoin de `node_modules` ni d'internet** au lancement. Idéal pour les enregistrements en lieux à connexion réseau aléatoire.

### Sur la machine de build (avec internet)

```bash
pnpm --filter quiz-wheel build:offline
```

Sortie portable, **bien visible à la racine du monorepo** : [`dist/quiz-wheel/`](../../dist/quiz-wheel/).
Le dossier contient un `start.mjs`, son propre `README.md` et tout le runtime nécessaire.

### Sur la machine de régie (Node 20+ requis, internet pas requis)

Option 1 — sur la machine de build :

```bash
pnpm --filter quiz-wheel start:offline
# → http://localhost:3000
```

Option 2 — transporter sur un autre laptop (Node 20+ installé) :

1. Copier le dossier `dist/quiz-wheel/` sur USB (ou le zipper).
2. Sur la machine cible :
   - **macOS — double-clic** sur `Lancer Bento Quiz.command` dans Finder. Un Terminal s'ouvre, le serveur démarre, **et le navigateur s'ouvre tout seul** sur la bonne URL.
     > Au tout premier lancement macOS peut bloquer (« développeur non identifié »). Clic-droit sur le `.command` → **Ouvrir** → confirmer. Une seule fois.
   - **Ligne de commande (toutes plateformes)** : dans le dossier copié, `node start.mjs` (ouvre le navigateur par défaut), ou `node start.mjs --no-open` pour mode headless.
3. Plein écran via `F11` ou la touche `F` de l'app.

### Variables d'environnement utiles

```bash
PORT=3000          # port du serveur (3000 par défaut)
HOSTNAME=0.0.0.0   # interface (par défaut accessible sur le LAN)
```

### Flags de `start.mjs`

```bash
node start.mjs              # port 3000 + ouvre le navigateur (défaut)
node start.mjs 3001         # port custom (positional)
node start.mjs --no-open    # ne pas ouvrir le navigateur (CI / headless)
```

## Mode `next start` classique (avec node_modules)

```bash
pnpm --filter quiz-wheel build
pnpm --filter quiz-wheel start
```

Plus léger en disque que le build offline mais nécessite que `pnpm install` ait été exécuté sur la machine.

## Contrôles clavier

| Touche   | Action                                       |
| -------- | -------------------------------------------- |
| `Espace` | Lancer le tirage (depuis l'état idle/reveal) |
| `R`      | Reset vers `idle`                            |
| `F`      | Toggle plein écran                           |
| `Échap`  | Sortir du plein écran ou fermer le reveal    |
| `M`      | Mute / unmute                                |

## Structure

```
src/
├── app/
│   ├── layout.tsx           # Polices (Extenda Yotta locale + Fredoka + Bungee)
│   ├── page.tsx             # Page racine — monte <QuizWheel />
│   └── globals.css          # Reset + tokens
├── components/
│   ├── QuizWheel.tsx        # Composant racine ('use client') — clavier uniquement
│   ├── BentoBox.tsx         # Boîte + grid + sésames décoratifs
│   ├── Compartment.tsx      # Case (idle / lit / winner)
│   ├── RevealModal.tsx
│   ├── FloatingMascots.tsx
│   └── HeaderChips.tsx      # Manche / statut
├── data/
│   ├── popys.ts             # Catalogue des 9 Popys + jeu placeholder
│   └── layouts.ts           # 3 dispositions (Shokado 7 / Kyukaku 9 / Stratifié 6)
├── hooks/
│   ├── useWheelSpinner.ts   # Machine à états + boucle de tick + easing
│   ├── useKeyboardControls.ts
│   ├── useWakeLock.ts
│   └── useAutoHideCursor.ts
└── lib/
    ├── audio.ts             # Web Audio : tick + ding (zéro asset audio externe)
    └── easing.ts
```

## Stack

- Next.js 15 (App Router)
- Tailwind CSS via preset `@bento-pop/brand/tailwind`
- Framer Motion pour les transitions de reveal
- Web Audio API native (pas de dépendance audio)
