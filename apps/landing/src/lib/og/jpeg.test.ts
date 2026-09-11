import assert from 'node:assert/strict';
import { createCipheriv } from 'node:crypto';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { OG_MAX_BYTES, QUALITY_LADDER, encodeJpeg } from './jpeg';

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Bruit aléatoire en 1200×630.
 *
 * C'est le **pire cas** pour un encodeur : aucune corrélation entre pixels
 * voisins, donc rien à factoriser. Une image réelle, même couverte de six
 * photographies, compresse forcément mieux. Vérifier le budget sur du
 * bruit garantit donc qu'aucun bento ne pourra le dépasser.
 */
async function noisePng(): Promise<Buffer> {
  const total = WIDTH * HEIGHT * 3;
  const chunks: Buffer[] = [];

  // Flux AES en mode compteur sur une entrée nulle : déterministe grâce à
  // la clé figée, mais à entropie pleine. Un générateur congruentiel
  // linéaire ne convient pas — ses bits de poids faible sont fortement
  // corrélés, et le PNG obtenu ne pesait que 35 Ko, soit un cas de test
  // plus favorable qu'une vraie photographie.
  const cipher = createCipheriv('aes-256-ctr', Buffer.alloc(32, 7), Buffer.alloc(16, 3));
  while (chunks.reduce((n, c) => n + c.length, 0) < total) {
    chunks.push(cipher.update(Buffer.alloc(65_536)));
  }

  const pixels = Buffer.concat(chunks).subarray(0, total);
  return sharp(pixels, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
    .png()
    .toBuffer();
}

describe('encodeJpeg', () => {
  it('tient sous le budget WhatsApp, même sur le pire cas', async () => {
    const png = await noisePng();
    const jpeg = await encodeJpeg(png);

    // Le PNG de contrôle : c'est ce qu'`ImageResponse` produirait seul.
    assert.ok(
      png.byteLength > OG_MAX_BYTES,
      `le cas de test n'est pas assez défavorable : PNG de ${png.byteLength} octets`,
    );
    assert.ok(
      jpeg.byteLength < OG_MAX_BYTES,
      `JPEG de ${Math.round(jpeg.byteLength / 1024)} Ko, budget ${OG_MAX_BYTES / 1024} Ko`,
    );
  });

  it('produit un JPEG valide aux bonnes dimensions', async () => {
    const jpeg = await encodeJpeg(await noisePng());

    assert.deepEqual([...jpeg.subarray(0, 3)], [0xff, 0xd8, 0xff], 'en-tête JPEG absent');
    const meta = await sharp(jpeg).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, WIDTH);
    assert.equal(meta.height, HEIGHT);
  });

  it('produit un fichier progressif', async () => {
    // Un JPEG progressif affiche une version grossière dès les premiers
    // octets reçus : utile pour les robots d'aperçu qui coupent tôt.
    const meta = await sharp(await encodeJpeg(await noisePng())).metadata();
    assert.equal(meta.isProgressive, true);
  });
});

describe('paliers de qualité', () => {
  /**
   * Une image représentative — grands aplats, un peu de texture — doit
   * passer au premier palier. Si elle descendait d'un cran, la qualité
   * visible baisserait pour tous les bentos sans nécessité.
   */
  it('reste au meilleur palier sur une image représentative', async () => {
    const flat = await sharp({
      create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#fbbf24' },
    })
      .png()
      .toBuffer();

    const best = await sharp(flat)
      .jpeg({ quality: QUALITY_LADDER[0], mozjpeg: true, progressive: true })
      .toBuffer();
    const actual = await encodeJpeg(flat);

    assert.equal(actual.byteLength, best.byteLength, 'un palier inférieur a été utilisé');
  });
});
