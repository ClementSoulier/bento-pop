import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bungeeTextWidth } from '@bento-pop/supabase-mobile/bento';
import { SHARE_RIBBON, shareRibbonFontSize, shareRibbonText } from './share-layout';

const PLACE = SHARE_RIBBON.maxWidth - 2 * (SHARE_RIBBON.paddingH + SHARE_RIBBON.border);

describe('le ruban de l’image de partage', () => {
  it('garde sa phrase et sa taille pour le bento principal', () => {
    assert.equal(shareRibbonText(null), 'Mon bento pop culture');
    assert.equal(shareRibbonText('  '), 'Mon bento pop culture');
    assert.equal(shareRibbonFontSize('Mon bento pop culture'), 32);
  });

  it('porte le titre de l’édition', () => {
    assert.equal(shareRibbonText('Le duel du samedi'), 'Le duel du samedi');
  });

  it('tient sur une ligne pour un titre de 30 caractères, même large', () => {
    for (const titre of ['La semaine du film qui pique', 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMM', 'Les œuvres qui ont marqué 2026']) {
      const taille = shareRibbonFontSize(titre);
      const largeur = bungeeTextWidth(titre.toUpperCase(), taille, SHARE_RIBBON.letterSpacing);
      assert.ok(largeur <= PLACE, `${titre} : ${largeur} pour ${PLACE} à ${taille}`);
      assert.ok(taille <= 32, titre);
    }
  });
});
