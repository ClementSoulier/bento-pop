import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAIN_CASE_SET } from './case-set';
import { publishItemsFromSlots } from './bento-actions-pure';

/**
 * Chantier 9. Ce que le brouillon envoie à `publish_first_bento`.
 *
 * La conversion est pure et vit à part du module d'actions, qui importe des
 * stores : un test n'a pas à monter React Native pour vérifier une liste de
 * six paires.
 */
describe('publishItemsFromSlots', () => {
  it('rend une paire par case remplie, dans la forme attendue par le SQL', () => {
    const items = publishItemsFromSlots(
      {
        film: { title: 'Inception', paletteKey: 'tokyo', itemId: 'it-film' },
        place: { title: 'Kyoto', paletteKey: 'seoul', itemId: 'it-lieu' },
      },
      MAIN_CASE_SET,
    );
    assert.deepEqual(items, [
      { category_id: 1, item_id: 'it-film' },
      { category_id: 6, item_id: 'it-lieu' },
    ]);
  });

  it('écarte une case sans identifiant d’item', () => {
    // Une case posée optimistement dont l'écriture a échoué : elle n'a pas
    // d'`itemId`, et l'envoyer ferait échouer toute la transaction sur une
    // clé étrangère.
    assert.deepEqual(publishItemsFromSlots({ film: { title: 'Sans id', paletteKey: 'tokyo' } }, MAIN_CASE_SET), []);
  });

  /**
   * Une case hors du jeu attendu est écartée, pour la même raison qu'une
   * case sans item : mieux vaut publier ce qui est sûr. Le cas se produit si
   * un brouillon d'édition survivait à un changement d'édition.
   */
  it('écarte une case qui n’appartient pas au jeu', () => {
    assert.deepEqual(
      publishItemsFromSlots(
        { ed38_1: { title: 'Case d’ailleurs', paletteKey: 'tokyo', itemId: 'it-x' } },
        MAIN_CASE_SET,
      ),
      [],
    );
  });

  it('rend une liste vide pour un brouillon vide', () => {
    assert.deepEqual(publishItemsFromSlots({}, MAIN_CASE_SET), []);
  });
});
