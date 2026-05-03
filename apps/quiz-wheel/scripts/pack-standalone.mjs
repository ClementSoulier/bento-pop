#!/usr/bin/env node
/**
 * Post-build pour le mode régie hors-ligne.
 *
 * Next.js avec `output: 'standalone'` génère son bundle dans `.next/standalone/`
 * (dossier caché et ennuyeux à manipuler). On le **déplace** à la racine du
 * monorepo dans `dist/quiz-wheel/` — bien visible, USB-friendly.
 *
 * Le bundle final est autonome : un coup de copie sur clé USB, puis sur la
 * machine cible (Node 20+) double-clic sur `Lancer Bento Quiz.command` (macOS)
 * ou `node start.mjs`. Aucun `pnpm install`, aucun internet.
 */
import { rm, cp, mkdir, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(APP_ROOT, '../..');
const SRC_STANDALONE = path.join(APP_ROOT, '.next', 'standalone');
const DEST = path.join(MONOREPO_ROOT, 'dist', 'quiz-wheel');
const APP_IN_DEST = path.join(DEST, 'apps', 'quiz-wheel');

const rel = (p) => path.relative(MONOREPO_ROOT, p);

async function copyDir(src, dest, label) {
  if (!existsSync(src)) {
    console.log(`  · ${label} : skip (absent)`);
    return;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
  console.log(`  · ${label}`);
}

// ---------------------------------------------------------------------------
// Fichiers générés à la racine du bundle
// (template literals → on échappe \` et \${} pour ne pas qu'ils soient
// interpolés par CE script).
// ---------------------------------------------------------------------------

const launcherSource = `#!/usr/bin/env node
/**
 * Bento Pop · Quiz — launcher hors-ligne.
 *
 * Démarre le serveur Next standalone et ouvre le navigateur par défaut
 * sur l'URL de l'app dès que le serveur répond.
 *
 * Usage :
 *   node start.mjs              # http://localhost:3000 + ouvre le navigateur
 *   node start.mjs 3001         # port custom
 *   node start.mjs --no-open    # ne pas ouvrir le navigateur (mode headless)
 *   PORT=3001 node start.mjs    # port via env
 *
 * Aucun \`pnpm install\` requis. Juste Node 20+.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(here, 'apps', 'quiz-wheel', 'server.js');

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const portArg = args.find((a) => /^\\d+$/.test(a));
const port = portArg ?? process.env.PORT ?? '3000';
const hostname = process.env.HOSTNAME ?? '0.0.0.0';
const url = \`http://localhost:\${port}\`;

console.log(\`Bento Pop · Quiz → \${url}\`);
console.log('  Ctrl+C pour arrêter.');

const child = spawn(process.execPath, [server], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port, HOSTNAME: hostname },
});
child.on('exit', (code) => process.exit(code ?? 0));

// Propage les signaux de terminaison au serveur enfant.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}

if (!noOpen) {
  waitReady(url).then((ok) => {
    if (!ok) {
      console.warn('[start] Le serveur n\\'a pas répondu à temps — ouvre le navigateur manuellement sur', url);
      return;
    }
    openBrowser(url);
  });
}

async function waitReady(target, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(500) });
      if (res.status < 500) return true;
    } catch {
      /* serveur pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function openBrowser(target) {
  const platform = process.platform;
  let cmd;
  let cmdArgs;
  let shell = false;
  if (platform === 'darwin') {
    cmd = 'open';
    cmdArgs = [target];
  } else if (platform === 'win32') {
    cmd = 'start';
    cmdArgs = ['', target];
    shell = true;
  } else {
    cmd = 'xdg-open';
    cmdArgs = [target];
  }
  try {
    spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true, shell }).unref();
  } catch (err) {
    console.warn('[start] Impossible d\\'ouvrir le navigateur automatiquement :', err.message);
  }
}
`;

const macLauncherSource = `#!/usr/bin/env bash
# Lance le serveur Bento Pop · Quiz et ouvre le navigateur.
# Double-clique sur ce fichier dans Finder pour démarrer.

set -e

# Se positionne dans le dossier du bundle, peu importe d'où le script est lancé.
cd "$(dirname "$0")"

# Vérifie Node 20+
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "Node.js requis" message "Installe Node 20+ depuis https://nodejs.org puis relance ce script."'
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  osascript -e "display alert \\"Node trop ancien\\" message \\"Node $(node -v) détecté. Il faut Node 20+ — https://nodejs.org\\""
  exit 1
fi

exec node start.mjs "$@"
`;

const readmeSource = `# Bento Pop · Quiz — build hors-ligne

Bundle autonome de l'application **quiz-wheel**. Aucun \`pnpm install\`,
aucun accès internet requis : juste **Node 20+** sur la machine cible.

## Lancer

### macOS — double-clic

Double-clique sur **\`Lancer Bento Quiz.command\`** dans Finder.
Un Terminal s'ouvre, le serveur démarre, et le navigateur s'ouvre tout seul
sur l'URL de l'app.

> Au tout premier lancement macOS peut bloquer l'exécution (« développeur
> non identifié »). Clic-droit sur le \`.command\` → **Ouvrir** → confirme.
> Cette étape n'est nécessaire qu'une fois.

### Ligne de commande (toutes plateformes)

\`\`\`bash
node start.mjs               # → http://localhost:3000 + ouvre le navigateur
node start.mjs 3001          # port custom
node start.mjs --no-open     # mode headless (pas d'ouverture du navigateur)
PORT=3001 node start.mjs     # port via env
\`\`\`

## Variables d'environnement

| Var        | Défaut    | Rôle                                            |
| ---------- | --------- | ----------------------------------------------- |
| \`PORT\`     | \`3000\`    | Port HTTP du serveur                            |
| \`HOSTNAME\` | \`0.0.0.0\` | Interface (par défaut accessible sur le LAN)    |

## Contrôles à l'écran

| Touche   | Action                                     |
| -------- | ------------------------------------------ |
| \`Espace\` | Lancer le tirage / fermer le reveal        |
| \`Entrée\` | Fermer le reveal                           |
| \`R\`      | Reset                                      |
| \`F\`      | Toggle plein écran                         |
| \`M\`      | Mute / unmute                              |
| \`Échap\`  | Sortir du plein écran ou fermer le reveal  |

## Contenu

- \`Lancer Bento Quiz.command\` — double-clic macOS (lance le serveur + ouvre le navigateur)
- \`start.mjs\` — launcher Node (entrée principale, multi-plateforme)
- \`apps/quiz-wheel/server.js\` — serveur Next standalone
- \`apps/quiz-wheel/.next/\` — chunks JS/CSS, fonts, images
- \`packages/\` — packages workspace traçés (\`@bento-pop/brand\`, \`@bento-pop/ui\`)
- \`node_modules/\` — dépendances runtime traçées
`;

// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(SRC_STANDALONE)) {
    console.error(
      `[pack-standalone] Bundle introuvable : ${SRC_STANDALONE}\n` +
        `Vérifie que \`output: 'standalone'\` est bien dans next.config.ts et relance \`next build\`.`,
    );
    process.exit(1);
  }

  console.log(`[pack-standalone] Empaquetage → ${rel(DEST)}/`);

  // Wipe + recreate destination
  await rm(DEST, { recursive: true, force: true });
  await mkdir(DEST, { recursive: true });

  // Arborescence standalone (server.js + node_modules + packages)
  await copyDir(SRC_STANDALONE, DEST, 'standalone tree');

  // Chunks JS/CSS + fonts/images bundlées
  await copyDir(
    path.join(APP_ROOT, '.next', 'static'),
    path.join(APP_IN_DEST, '.next', 'static'),
    '.next/static',
  );

  // public/ si présent
  await copyDir(path.join(APP_ROOT, 'public'), path.join(APP_IN_DEST, 'public'), 'public/');

  // Launcher Node multi-plateforme
  const launcherPath = path.join(DEST, 'start.mjs');
  await writeFile(launcherPath, launcherSource);
  await chmod(launcherPath, 0o755);
  console.log(`  · start.mjs`);

  // Launcher macOS double-clic Finder
  const macLauncherPath = path.join(DEST, 'Lancer Bento Quiz.command');
  await writeFile(macLauncherPath, macLauncherSource);
  await chmod(macLauncherPath, 0o755);
  console.log(`  · Lancer Bento Quiz.command (macOS double-clic)`);

  // README à la racine du bundle
  await writeFile(path.join(DEST, 'README.md'), readmeSource);
  console.log(`  · README.md`);

  console.log(`\n[pack-standalone] OK`);
  console.log(`  → double-clic sur "${rel(DEST)}/Lancer Bento Quiz.command"`);
  console.log(`  → ou : node ${rel(DEST)}/start.mjs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
