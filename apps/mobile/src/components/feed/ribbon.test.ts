import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FEATURED_RIBBON, GUEST_RIBBON, ribbonFor , editionRibbon} from './ribbon';

describe('ribbonFor', () => {
  it('ne pose rien sur un bento ordinaire', () => {
    assert.equal(ribbonFor({ isGuest: false, isFeatured: false }), null);
  });

  it('pose le coup de cœur quand il est seul', () => {
    assert.equal(ribbonFor({ isGuest: false, isFeatured: true }), FEATURED_RIBBON);
  });

  it('pose l\'étiquette invité quand elle est seule', () => {
    assert.equal(ribbonFor({ isGuest: true, isFeatured: false }), GUEST_RIBBON);
  });

  /**
   * Le cas qui compte, et le plus fréquent en pratique : un bento invité est
   * presque toujours aussi un coup de cœur, c'est même la raison de le
   * composer.
   *
   * « Coup de cœur » est un avis que le lecteur peut deviner. « Invité » est
   * la seule information qu'il ne peut déduire de rien d'autre : sans elle,
   * le fil attribue à une personne réelle une composition qu'elle n'a pas
   * faite. En cas de conflit, on affiche ce qui ne se devine pas.
   */
  it('fait gagner « invité » sur « coup de cœur »', () => {
    assert.equal(ribbonFor({ isGuest: true, isFeatured: true }), GUEST_RIBBON);
  });

  it('distingue les deux étiquettes par le libellé et la couleur', () => {
    assert.notEqual(GUEST_RIBBON.label, FEATURED_RIBBON.label);
    // Deux natures d'information différentes : un avis de l'équipe d'un côté,
    // l'origine du contenu de l'autre. Une même teinte les ferait lire comme
    // la même chose.
    assert.notEqual(GUEST_RIBBON.color, FEATURED_RIBBON.color);
  });

  it('garde des étiquettes assez courtes pour l\'angle de la boîte', () => {
    for (const r of [GUEST_RIBBON, FEATURED_RIBBON]) {
      assert.ok(r.label.length <= 14, `${r.label} risque de déborder`);
    }
  });
});

describe('l’étiquette d’une édition', () => {
  const base = { isGuest: false, isFeatured: false };

  it('porte le titre de l’édition, pas le mot « hebdomadaire »', () => {
    const r = ribbonFor({ ...base, editionTitle: 'La semaine du film qui pique' });
    assert.equal(r?.label, 'La semaine du film qui pique');
  });

  /**
   * L'ordre est une décision, pas un hasard. La boîte d'une édition n'a pas
   * les cases du bento principal : sans son titre, le lecteur ne comprend
   * pas pourquoi. C'est une information sur ce qu'il voit, quand « coup de
   * cœur » est un avis dessus.
   */
  it('passe devant le coup de cœur', () => {
    const r = ribbonFor({ ...base, isFeatured: true, editionTitle: 'Semaine 38' });
    assert.equal(r?.label, 'Semaine 38');
  });

  it('cède devant « invité », la seule chose qui ne se devine pas', () => {
    const r = ribbonFor({ isGuest: true, isFeatured: true, editionTitle: 'Semaine 38' });
    assert.deepEqual(r, GUEST_RIBBON);
  });

  it('ne s’affiche pas pour un bento libre', () => {
    assert.equal(ribbonFor({ ...base, editionTitle: null }), null);
    assert.equal(ribbonFor(base), null);
  });

  it('reste lisible : encre sur jaune de la marque', () => {
    const r = editionRibbon('Semaine 38');
    assert.equal(r.color, '#fbbf24');
    assert.equal(r.textColor, '#0a0a0a');
  });
});
