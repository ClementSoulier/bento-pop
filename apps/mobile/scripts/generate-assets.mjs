/**
 * Génère les assets iOS / Android / Splash de l'app mobile depuis le Popy
 * de la brand. À relancer manuellement si on change le Popy choisi ou la
 * couleur de fond.
 *
 *   node apps/mobile/scripts/generate-assets.mjs
 *
 * Outputs :
 *   apps/mobile/assets/icon.png            (1024×1024 opaque, iOS + fallback)
 *   apps/mobile/assets/adaptive-icon.png   (1024×1024 transparent, foreground Android)
 *   apps/mobile/assets/splash.png          (2732×2732, fond jaune + Popy centré)
 *   apps/mobile/assets/favicon.png         (48×48 pour la version web)
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_POPY = path.resolve(
  __dirname,
  '../../../packages/brand/assets/mascot/popy-content.png',
);
const OUT_DIR = path.resolve(__dirname, '../assets');

const YELLOW = { r: 0xfb, g: 0xbf, b: 0x24, alpha: 1 };

/** Charge le Popy + le resize à la taille demandée, marge incluse. */
async function popyAt(diameter) {
  return sharp(SOURCE_POPY)
    .resize(diameter, diameter, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
}

async function makeIcon() {
  // iOS App Store rejette les icônes avec transparence → fond jaune opaque.
  const size = 1024;
  const popyDiameter = Math.round(size * 0.7);
  const popyBuf = await popyAt(popyDiameter);
  const offset = Math.round((size - popyDiameter) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: YELLOW },
  })
    .composite([{ input: popyBuf, top: offset, left: offset }])
    .png()
    .toFile(path.join(OUT_DIR, 'icon.png'));
  console.log('✓ icon.png (1024×1024 opaque)');
}

async function makeAdaptiveIcon() {
  // Android adaptive icon foreground : 1024×1024, foreground centré dans
  // la safe-zone de 66 % (le reste peut être croppé en cercle/squircle).
  // Transparent autour — le bg color vient de app.json:android.adaptiveIcon.
  const size = 1024;
  const popyDiameter = Math.round(size * 0.55);
  const popyBuf = await popyAt(popyDiameter);
  const offset = Math.round((size - popyDiameter) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: popyBuf, top: offset, left: offset }])
    .png()
    .toFile(path.join(OUT_DIR, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png (1024×1024 transparent)');
}

async function makeSplash() {
  // 2732×2732 = recommandé Expo pour cover iPad Pro 12.9". Popy à 35 % du canvas.
  const size = 2732;
  const popyDiameter = Math.round(size * 0.35);
  const popyBuf = await popyAt(popyDiameter);
  const offset = Math.round((size - popyDiameter) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: YELLOW },
  })
    .composite([{ input: popyBuf, top: offset, left: offset }])
    .png()
    .toFile(path.join(OUT_DIR, 'splash.png'));
  console.log('✓ splash.png (2732×2732)');
}

async function makeFavicon() {
  // Multiple de 48 pour Google. 48×48 suffit pour la web tab.
  const size = 48;
  const popyDiameter = Math.round(size * 0.7);
  const popyBuf = await popyAt(popyDiameter);
  const offset = Math.round((size - popyDiameter) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: YELLOW },
  })
    .composite([{ input: popyBuf, top: offset, left: offset }])
    .png()
    .toFile(path.join(OUT_DIR, 'favicon.png'));
  console.log('✓ favicon.png (48×48)');
}

await makeIcon();
await makeAdaptiveIcon();
await makeSplash();
await makeFavicon();
console.log('\nDone. Outputs in', OUT_DIR);
