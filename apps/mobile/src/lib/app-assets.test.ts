import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { inflateSync } from 'node:zlib';
import { colors, palette } from '@/design/tokens';

/**
 * `app.json` et les fichiers qu'il désigne (chantier 31, D11 et D12) : ils ne
 * se voient qu'une fois compilés, et une erreur n'y lève rien jusqu'à la build
 * de sortie, ou jusqu'au refus d'un store.
 */
const APP_ROOT = join(__dirname, '..', '..');

type ExpoConfig = {
  backgroundColor: string;
  icon: string;
  android: {
    adaptiveIcon: {
      foregroundImage: string;
      backgroundImage: string;
      monochromeImage: string;
      backgroundColor: string;
    };
  };
  plugins: (string | [string, Record<string, unknown>])[];
};

const { expo } = JSON.parse(readFileSync(join(APP_ROOT, 'app.json'), 'utf8')) as {
  expo: ExpoConfig;
};

function pluginOptions(name: string): Record<string, unknown> {
  const plugin = expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === name);
  assert.ok(Array.isArray(plugin), `${name} sans options`);
  return plugin[1];
}

const splash = pluginOptions('expo-splash-screen');
const notifications = pluginOptions('expo-notifications');

/** L'en-tête d'un PNG : sa taille, et s'il a un canal alpha (types 4 et 6). */
function pngHeader(path: string) {
  const file = readFileSync(join(APP_ROOT, path));
  assert.equal(file.toString('latin1', 1, 4), 'PNG', path);
  const colorType = file[25] as number;
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
    bitDepth: file[24],
    colorType,
    alpha: colorType === 4 || colorType === 6,
  };
}

/** Le canal alpha d'un PNG RVBA de 8 bits, non entrelacé. */
function alphaOf(path: string): {
  width: number;
  height: number;
  at: (x: number, y: number) => number;
} {
  const file = readFileSync(join(APP_ROOT, path));
  const { width, height, bitDepth, colorType } = pngHeader(path);
  assert.equal(bitDepth, 8, path);
  assert.equal(colorType, 6, path);
  assert.equal(file[28], 0, `${path} : entrelacé`);
  const chunks: Buffer[] = [];
  for (let at = 8; at < file.length; ) {
    const length = file.readUInt32BE(at);
    if (file.toString('latin1', at + 4, at + 8) === 'IDAT') {
      chunks.push(file.subarray(at + 8, at + 8 + length));
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] as number;
    for (let i = 0; i < stride; i += 1) {
      const value = raw[y * (stride + 1) + 1 + i] as number;
      const left = i >= 4 ? (out[y * stride + i - 4] as number) : 0;
      const up = y > 0 ? (out[(y - 1) * stride + i] as number) : 0;
      const upLeft = y > 0 && i >= 4 ? (out[(y - 1) * stride + i - 4] as number) : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
        predicted = a <= b && a <= c ? left : b <= c ? up : upLeft;
      }
      out[y * stride + i] = (value + predicted) & 255;
    }
  }
  return { width, height, at: (x, y) => out[y * stride + x * 4 + 3] as number };
}

/** Le plus loin que va le dessin depuis le centre, en part du côté. */
function reach(path: string): number {
  const { width, height, at } = alphaOf(path);
  let far = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (at(x, y) > 8) far = Math.max(far, Math.hypot(x - width / 2, y - height / 2));
    }
  }
  return far / width;
}

describe('les icônes et le lancement de app.json', () => {
  it('désigne des fichiers présents', () => {
    const { foregroundImage, backgroundImage, monochromeImage } = expo.android.adaptiveIcon;
    for (const path of [
      expo.icon,
      foregroundImage,
      backgroundImage,
      monochromeImage,
      splash.image as string,
      notifications.icon as string,
    ]) {
      assert.ok(existsSync(join(APP_ROOT, path)), path);
    }
  });

  it('donne à l’App Store une icône carrée sans transparence, refusée sinon', () => {
    const icon = pngHeader(expo.icon);
    assert.deepEqual([icon.width, icon.height, icon.alpha], [1024, 1024, false]);
  });

  it('donne à Android un fond opaque et deux calques transparents autour du dessin', () => {
    const { foregroundImage, backgroundImage, monochromeImage } = expo.android.adaptiveIcon;
    const background = pngHeader(backgroundImage);
    assert.deepEqual([background.width, background.height, background.alpha], [1024, 1024, false]);
    for (const path of [foregroundImage, monochromeImage]) {
      const { width, height, at } = alphaOf(path);
      assert.deepEqual([width, height], [1024, 1024], path);
      assert.equal(at(0, 0), 0, path);
      assert.equal(at(1023, 1023), 0, path);
    }
  });

  it('garde Popy dans le cercle de 66 dp sur 108 que tout masque d’Android laisse voir', () => {
    const { foregroundImage, monochromeImage } = expo.android.adaptiveIcon;
    for (const path of [foregroundImage, monochromeImage]) {
      const part = reach(path);
      assert.ok(part <= 33 / 108, `${path} : ${part.toFixed(3)}`);
    }
  });

  it('donne à Android une petite icône de 96 px, seule sa transparence comptant', () => {
    const { width, height, at } = alphaOf(notifications.icon as string);
    assert.deepEqual([width, height], [96, 96]);
    assert.equal(at(0, 0), 0);
    assert.equal(at(48, 15), 255);
  });

  it('pose le lancement natif sur le jaune de marque, Popy dans le cercle de 192 dp sur 288', () => {
    const { width, height, at } = alphaOf(splash.image as string);
    assert.equal(width, height);
    assert.equal(at(0, 0), 0);
    // Popy touche les bords de son image, posée à `imageWidth` points de large.
    const part = reach(splash.image as string) * (splash.imageWidth as number);
    assert.ok(part <= 192 / 2, `rayon de ${part.toFixed(1)} dp`);
  });

  it('prend ses couleurs dans les tokens', () => {
    assert.equal(expo.backgroundColor, colors.light['bg-brand']);
    assert.equal(splash.backgroundColor, colors.light['bg-brand']);
    assert.equal(expo.android.adaptiveIcon.backgroundColor, palette['yolk-500']);
    assert.equal(notifications.color, palette['yolk-700']);
  });
});
