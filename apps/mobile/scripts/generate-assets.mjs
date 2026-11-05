/**
 * Génère les icônes et le lancement de l'app (chantier 31, D11 et D12), depuis
 * le dossier de la refonte et l'original de Popy. À relancer si l'un d'eux
 * change :
 *
 *   node apps/mobile/scripts/generate-assets.mjs
 *
 * Outputs, dans apps/mobile/assets/ :
 *   icon.png                      l'icône du dossier telle quelle, iOS et repli
 *   notification-icon.png         la petite icône du dossier telle quelle
 *   adaptive-icon.png             Android, Popy sur fond transparent
 *   adaptive-icon-background.png  Android, `yolk-500` semé de pois `yolk-300`
 *   adaptive-icon-monochrome.png  Android 13, la silhouette de Popy
 *   splash-icon.png               le lancement natif, Popy cadrée au plus près
 *   favicon.png                   la version web, l'icône réduite
 *
 * L'icône adaptative d'Android tient sur 108 dp, dont 72 se voient et dont
 * seuls les 66 du centre échappent à tous les masques. Elle reprend les
 * proportions de l'icône du dossier sur ces 72 dp : Popy y prend la même part,
 * un peu sous le centre, et reste dans le cercle de 66 dp.
 */
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../../..');
const MARQUE = path.join(REPO, 'docs/design-v2/design-system/assets/Marque');
const SOURCE_ICON = path.join(MARQUE, 'app-icon-1024.png');
const SOURCE_NOTIFICATION = path.join(MARQUE, 'notification-icon-96.png');
const SOURCE_POPY = path.join(REPO, 'packages/brand/assets/mascot/popy-content.png');
const OUT_DIR = path.resolve(__dirname, '../assets');

const YOLK_500 = '#f2a82a';
const YOLK_300 = '#ffc845';

/** Le cadre du dessin dans l'original de 1 000 px, et son carré de `popy-crops.ts`. */
const POPY = { left: 97, top: 130, width: 806, height: 740 };
const POPY_SQUARE = { left: 97, top: 97, width: 806, height: 806 };

/** Dans l'icône du dossier : le dessin, son centre, et ses pois tous les 48 px. */
const ICON = 1024;
const ICON_POPY_WIDTH = 758;
const ICON_POPY_CENTER = { x: 511, y: 530 };
const ICON_DOT_STEP = 48;
const ICON_DOT_RADIUS = 5.55;
const ICON_DOT_FIRST = 16;

/** Les 1 024 px d'un calque adaptatif sont 108 dp, dont 72 visibles. */
const LAYER = 1024;
const VISIBLE = (LAYER * 72) / 108;
const SCALE = VISIBLE / ICON;
const INSET = (LAYER - VISIBLE) / 2;

const layerPopyWidth = Math.round(ICON_POPY_WIDTH * SCALE);
const layerPopyHeight = Math.round((POPY.height * layerPopyWidth) / POPY.width);
const layerPopyPlace = {
  left: Math.round(INSET + ICON_POPY_CENTER.x * SCALE - layerPopyWidth / 2),
  top: Math.round(INSET + ICON_POPY_CENTER.y * SCALE - layerPopyHeight / 2),
};

function transparentLayer() {
  return sharp({
    create: {
      width: LAYER,
      height: LAYER,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
}

async function makeAdaptiveForeground() {
  const popy = await sharp(SOURCE_POPY)
    .extract(POPY)
    .resize(layerPopyWidth, layerPopyHeight)
    .png()
    .toBuffer();
  await transparentLayer()
    .composite([{ input: popy, ...layerPopyPlace }])
    .png()
    .toFile(path.join(OUT_DIR, 'adaptive-icon.png'));
}

async function makeAdaptiveBackground() {
  const step = ICON_DOT_STEP * SCALE;
  const radius = ICON_DOT_RADIUS * SCALE;
  const first = (INSET + ICON_DOT_FIRST * SCALE) % step;
  const dots = [];
  for (let y = first; y < LAYER; y += step) {
    for (let x = first; x < LAYER; x += step) {
      dots.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LAYER}" height="${LAYER}">
    <rect width="${LAYER}" height="${LAYER}" fill="${YOLK_500}"/>
    <g fill="${YOLK_300}">${dots.join('')}</g>
  </svg>`;
  await sharp(Buffer.from(svg))
    .flatten({ background: YOLK_500 })
    .removeAlpha()
    .png()
    .toFile(path.join(OUT_DIR, 'adaptive-icon-background.png'));
}

/**
 * La silhouette de Popy, comme la petite icône du dossier mais nette à toutes
 * les tailles : blanche partout, sauf son visage, évidé, dont les yeux et la
 * bouche restent.
 */
async function makeAdaptiveMonochrome() {
  const { data, info } = await sharp(SOURCE_POPY)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    const orange = r > 200 && g > 120 && g < 215 && b < 130;
    const pink = r > 190 && g < 200 && b > 130 && b < 225;
    out[i] = out[i + 1] = out[i + 2] = 255;
    out[i + 3] = orange || pink ? 0 : a;
  }
  const popy = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(POPY)
    .resize(layerPopyWidth, layerPopyHeight)
    .png()
    .toBuffer();
  await transparentLayer()
    .composite([{ input: popy, ...layerPopyPlace }])
    .png()
    .toFile(path.join(OUT_DIR, 'adaptive-icon-monochrome.png'));
}

async function makeSplashIcon() {
  await sharp(SOURCE_POPY).extract(POPY_SQUARE).png().toFile(path.join(OUT_DIR, 'splash-icon.png'));
}

async function makeFavicon() {
  await sharp(SOURCE_ICON).resize(48, 48).png().toFile(path.join(OUT_DIR, 'favicon.png'));
}

await copyFile(SOURCE_ICON, path.join(OUT_DIR, 'icon.png'));
await copyFile(SOURCE_NOTIFICATION, path.join(OUT_DIR, 'notification-icon.png'));
await makeAdaptiveForeground();
await makeAdaptiveBackground();
await makeAdaptiveMonochrome();
await makeSplashIcon();
await makeFavicon();
console.log('Fait, dans', OUT_DIR);
