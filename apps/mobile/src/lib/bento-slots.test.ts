import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { REMOTE_SLOT_COLUMNS, mapRemoteSlots } from './bento-slots';

/**
 * Les lectures qui hydratent le composer, et ce qu'elles lisent.
 *
 * Deux lectures posent les cases du composer : celle du démarrage, dans
 * `state/session.ts`, et celle du changement de bento, `loadBentoById`. Elles
 * écrivaient chacune leur liste de colonnes, et la seconde avait perdu
 * `image_credit` et `status` : revenir à son bento principal effaçait crédits
 * d'image et état « en attente ». Recette du chantier 13, 16 septembre 2026.
 */

const APP_ROOT = join(__dirname, '..', '..');

describe('REMOTE_SLOT_COLUMNS', () => {
  it('lit tout ce que `mapRemoteSlots` pose dans une case', () => {
    // Chaque champ lu par le mapping doit être demandé, sans quoi il arrive
    // `undefined` et la case perd l'information en silence.
    for (const colonne of ['category_id', 'id', 'title', 'subtitle', 'image_url', 'image_credit', 'status']) {
      assert.match(REMOTE_SLOT_COLUMNS, new RegExp(`\\b${colonne}\\b`), colonne);
    }
  });

  it('est la seule liste, dans les deux lectures qui hydratent le composer', () => {
    for (const fichier of ['src/state/session.ts', 'src/lib/bento-actions.ts']) {
      const source = readFileSync(join(APP_ROOT, fichier), 'utf8');
      assert.match(source, /bento_items \( \$\{REMOTE_SLOT_COLUMNS\} \)/, fichier);
      // Aucune liste de colonnes d'item écrite à la main à côté.
      assert.doesNotMatch(source, /items \( id,/, fichier);
    }
  });
});

describe('mapRemoteSlots', () => {
  const ITEM = {
    id: 'it-1', title: 'Japon', subtitle: null, image_url: 'https://x/y.jpg',
    image_credit: 'Photo : Connormah (CC BY-SA 3.0)', status: 'pending',
  };

  it('garde le crédit d’image et l’état en attente', () => {
    const slots = mapRemoteSlots([{ category_id: 6, items: ITEM }]);
    assert.equal(slots.place?.imageCredit, 'Photo : Connormah (CC BY-SA 3.0)');
    assert.equal(slots.place?.pending, true);
  });
});
