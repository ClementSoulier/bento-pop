import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { type DraftItemRow, REMOTE_SLOT_COLUMNS, mapRemoteSlots, refreshDraftSlots } from './bento-slots';

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

  it('une case dont l’item est refusé devient vide, même lue par son auteur (chantier 17, D28)', () => {
    // La RLS laisse l'auteur lire sa proposition quel que soit son statut :
    // sans ce filtre, un refus s'affichait comme un item accepté, sans
    // pastille, et le bento se publiait avec. Mesuré le 23 septembre 2026.
    const slots = mapRemoteSlots([
      { category_id: 6, items: { ...ITEM, status: 'rejected' } },
      { category_id: 1, items: { ...ITEM, id: 'it-2', status: 'validated' } },
    ]);
    assert.equal(slots.place, undefined);
    assert.equal(slots.film?.itemId, 'it-2');
    assert.equal(slots.film?.pending, false);
  });
});

describe('refreshDraftSlots (chantier 17, D25)', () => {
  const ligne = (over: Partial<DraftItemRow> & { id: string }): DraftItemRow => ({
    title: 'Titre en base',
    subtitle: null,
    image_url: null,
    image_credit: null,
    status: 'pending',
    merged_into_id: null,
    ...over,
  });
  const propose = (itemId: string, title = 'Le Voyqge de Recette') => ({
    title,
    paletteKey: undefined,
    itemId,
    pending: true,
  });

  it('une proposition validée perd sa pastille, et prend le titre et l’image validés', () => {
    const { slots, changed } = refreshDraftSlots({ film: propose('p-1') }, [
      ligne({ id: 'p-1', status: 'validated', title: 'Le Voyage de Recette', image_url: 'https://x/affiche.jpg' }),
    ]);
    assert.equal(changed, true);
    assert.equal(slots.film?.pending, false);
    assert.equal(slots.film?.title, 'Le Voyage de Recette');
    assert.equal(slots.film?.imageUrl, 'https://x/affiche.jpg');
    assert.equal(slots.film?.itemId, 'p-1');
  });

  it('une proposition refusée vide sa case', () => {
    const { slots, changed } = refreshDraftSlots({ film: propose('p-1'), serie: propose('p-2') }, [
      ligne({ id: 'p-1', status: 'rejected' }),
    ]);
    assert.equal(changed, true);
    assert.equal(slots.film, undefined);
    assert.equal(slots.serie?.itemId, 'p-2');
  });

  it('une proposition fusionnée prend l’item conservé', () => {
    const { slots, changed } = refreshDraftSlots({ film: propose('p-1') }, [
      ligne({ id: 'p-1', status: 'merged', merged_into_id: 'canon' }),
      ligne({ id: 'canon', status: 'validated', title: 'Interstellar' }),
    ]);
    assert.equal(changed, true);
    assert.equal(slots.film?.itemId, 'canon');
    assert.equal(slots.film?.title, 'Interstellar');
    assert.equal(slots.film?.pending, false);
  });

  it('une fusion dont l’item conservé n’est pas lu ne touche à rien', () => {
    const avant = { film: propose('p-1') };
    const { slots, changed } = refreshDraftSlots(avant, [
      ligne({ id: 'p-1', status: 'merged', merged_into_id: 'canon' }),
    ]);
    assert.equal(changed, false);
    assert.equal(slots.film, avant.film);
  });

  it('toujours en attente, ou introuvable : rien ne change', () => {
    const avant = { film: propose('p-1'), serie: propose('p-perdu') };
    const { slots, changed } = refreshDraftSlots(avant, [ligne({ id: 'p-1', status: 'pending', title: 'Le Voyqge de Recette' })]);
    assert.equal(changed, false);
    assert.deepEqual(slots, avant);
  });

  it('une case déjà à jour n’est pas réécrite', () => {
    const { slots: une } = refreshDraftSlots({ film: propose('p-1') }, [
      ligne({ id: 'p-1', status: 'validated' }),
    ]);
    const { changed } = refreshDraftSlots(une, [ligne({ id: 'p-1', status: 'validated' })]);
    assert.equal(changed, false);
  });
});
