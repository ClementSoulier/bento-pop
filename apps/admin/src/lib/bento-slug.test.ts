import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { SLUGS_RESERVES, checkSlug } from './bento-slug';

describe('checkSlug', () => {
  it('accepte une adresse bien formée et la normalise', () => {
    assert.deepEqual(checkSlug('  Hebdo-38 '), { ok: true, slug: 'hebdo-38' });
  });

  it('refuse ce que la contrainte SQL refuserait', () => {
    for (const mauvais of ['', 'ab', '-tete', 'queue-', 'accentué', 'avec espace', 'a'.repeat(41)]) {
      assert.equal(checkSlug(mauvais).ok, false, mauvais);
    }
  });

  it('refuse les adresses réservées, quelle que soit la casse', () => {
    assert.equal(checkSlug('opengraph-image').ok, false);
    assert.equal(checkSlug('OpenGraph-Image').ok, false);
  });

  /**
   * Le piège qui a motivé la liste : Next sert l'aperçu d'un bento à
   * `/u/<pseudo>/opengraph-image/…` par convention de fichier, et une route de
   * convention l'emporte sur un segment dynamique. Ce test échoue si le
   * fichier de route disparaît ou change de nom, auquel cas la réservation
   * n'a plus lieu d'être et la liste doit être relue.
   */
  it('réserve bien les noms des routes de convention encore présentes', () => {
    const landing = join(__dirname, '..', '..', '..', 'landing', 'src', 'app', 'u', '[pseudo]');
    for (const fichier of ['opengraph-image.tsx', 'twitter-image.tsx']) {
      const nom = fichier.replace('.tsx', '');
      assert.doesNotThrow(
        () => readFileSync(join(landing, fichier), 'utf8'),
        `${fichier} a disparu : relire SLUGS_RESERVES`,
      );
      assert.ok(
        (SLUGS_RESERVES as readonly string[]).includes(nom),
        `${nom} est une route de la landing et doit être réservé`,
      );
    }
  });
});
