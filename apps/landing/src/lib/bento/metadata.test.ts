import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_IDS } from '@bento-pop/supabase-mobile/bento';
import {
  bentoDescription,
  bentoImageAlt,
  bentoPath,
  bentoRobots,
  bentoTitle,
} from './metadata';
import { mapBentoItems, type RawBentoItemRow } from './map';

function rows(
  entries: readonly [keyof typeof CATEGORY_IDS, string][],
): RawBentoItemRow[] {
  return entries.map(([category, title], i) => ({
    category_id: CATEGORY_IDS[category],
    items: {
      id: `item-${i}`,
      title,
      subtitle: null,
      year: null,
      image_url: null,
      image_credit: null,
    },
  }));
}

const FULL = mapBentoItems(
  rows([
    ['film', 'Interstellar'],
    ['series', 'Severance'],
    ['artist', 'Orelsan'],
    ['track', 'La Quête'],
    ['creator', 'Squeezie'],
    ['place', 'Japan Expo'],
  ]),
);

describe('bentoPath', () => {
  it('conserve la casse stockée en base', () => {
    assert.equal(bentoPath('Keremasan'), '/u/Keremasan');
  });
});

describe('bentoTitle', () => {
  it('préfixe le pseudo', () => {
    assert.equal(bentoTitle('keremasan'), 'Le bento de @keremasan');
  });
});

describe('bentoDescription', () => {
  it('énumère les choix dans l’ordre d’affichage du bento', () => {
    const out = bentoDescription('keremasan', FULL);
    assert.ok(out.startsWith('Le bento pop culture de @keremasan : Interstellar, Severance'), out);
    assert.ok(out.includes('et Japan Expo'), out);
  });

  it('respecte la limite de 160 caractères', () => {
    const long = mapBentoItems(
      rows([
        ['film', 'Le Monde de Narnia : Le Lion, la sorcière blanche et l’armoire magique'],
        ['series', 'Kaguya-sama: Love Is War — Ultra Romantic'],
        ['artist', 'Nick Cave and the Bad Seeds'],
        ['track', 'The Sound of Silence (Disturbed cover)'],
        ['creator', 'Le Joueur du Grenier'],
        ['place', 'Le Grand Rex, Paris'],
      ]),
    );
    const out = bentoDescription('unpseudotreslong_x', long);
    assert.ok(out.length <= 160, `longueur ${out.length} : ${out}`);
    assert.ok(out.endsWith('…'), out);
  });

  it('nettoie les titres comme les tuiles', () => {
    const out = bentoDescription('x', mapBentoItems(rows([['film', 'Inception (film)']])));
    assert.ok(out.includes('Inception'), out);
    assert.ok(!out.includes('(film)'), out);
  });

  it('gère un bento partiel', () => {
    const out = bentoDescription('x', mapBentoItems(rows([['film', 'Dune'], ['artist', 'Aya']])));
    assert.equal(out, 'Le bento pop culture de @x : Dune et Aya.');
  });

  /** Tous les items rejetés après publication : la page reste partageable. */
  it('retombe sur une phrase générique quand aucune case n’est lisible', () => {
    const out = bentoDescription('keremasan', {});
    assert.equal(out, 'Découvre le bento pop culture de @keremasan sur Bento Pop.');
  });
});

describe('bentoImageAlt', () => {
  it('décrit l’image sans dépendre du contenu', () => {
    assert.ok(bentoImageAlt('keremasan').includes('@keremasan'));
  });
});

describe('bentoRobots', () => {
  /**
   * Politique de la spec §8 : seuls les bentos curés par l'équipe sont
   * indexables. `follow` reste vrai dans les deux cas pour ne pas couper
   * les liens sortants vers l'accueil et les pages légales.
   */
  it('indexe uniquement les bentos mis en avant', () => {
    assert.deepEqual(bentoRobots(true), { index: true, follow: true });
    assert.deepEqual(bentoRobots(false), { index: false, follow: true });
  });
});
