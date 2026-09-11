import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATEGORY_BY_ID,
  CATEGORY_IDS,
  CATEGORY_META,
  CATEGORY_ORDER,
  DECORATIVE_PALETTE_KEYS,
  PALETTES,
  POPY_KEYS,
  paletteKeyForItem,
  popyKeyForPseudo,
  stableHash,
} from '@bento-pop/supabase-mobile/bento';

describe('stableHash', () => {
  /**
   * Valeurs de référence djb2 calculées indépendamment de l'implémentation
   * (h₀ = 5381, hₙ = hₙ₋₁ × 33 + code). Vérifie l'algorithme lui-même, pas
   * seulement sa stabilité dans le temps.
   */
  it('correspond aux valeurs de référence djb2', () => {
    assert.equal(stableHash(''), 5381);
    assert.equal(stableHash('a'), 5381 * 33 + 97);
    assert.equal(stableHash('ab'), (5381 * 33 + 97) * 33 + 98);
  });

  it('est déterministe', () => {
    assert.equal(stableHash('keremasan'), stableHash('keremasan'));
  });

  it('renvoie toujours un entier positif, y compris sur des entrées longues', () => {
    for (const input of ['', 'a', 'x'.repeat(5000), '稲葉曇', '🍱🍱🍱']) {
      const h = stableHash(input);
      assert.ok(Number.isInteger(h), `pas un entier pour « ${input.slice(0, 12)} »`);
      assert.ok(h >= 0, `négatif pour « ${input.slice(0, 12)} »`);
      assert.ok(Number.isSafeInteger(h), `hors plage sûre pour « ${input.slice(0, 12)} »`);
    }
  });

  it('distingue des entrées proches', () => {
    assert.notEqual(stableHash('abc'), stableHash('abd'));
    assert.notEqual(stableHash('ab'), stableHash('ba'));
  });
});

describe('paletteKeyForItem', () => {
  it('est déterministe', () => {
    const id = '4ca1cd66-f74c-4f62-b739-5092cd91ca5f';
    assert.equal(paletteKeyForItem(id), paletteKeyForItem(id));
  });

  it('ne renvoie jamais la palette de repli', () => {
    // `neutral` est réservée aux cas sans palette attribuée : la voir sortir
    // de la rotation signifierait que l'exclusion a sauté.
    for (let i = 0; i < 500; i++) {
      assert.notEqual(paletteKeyForItem(`item-${i}`), 'neutral');
    }
  });

  it('renvoie toujours une clé existante', () => {
    for (let i = 0; i < 200; i++) {
      assert.ok(paletteKeyForItem(`id-${i}`) in PALETTES);
    }
  });

  it('couvre toutes les palettes décoratives sur un échantillon réaliste', () => {
    const seen = new Set(
      Array.from({ length: 1000 }, (_, i) => paletteKeyForItem(`item-${i}`)),
    );
    assert.equal(
      seen.size,
      DECORATIVE_PALETTE_KEYS.length,
      `palettes jamais atteintes : ${DECORATIVE_PALETTE_KEYS.filter((k) => !seen.has(k)).join(', ')}`,
    );
  });

  it('exclut exactement `neutral` de la rotation', () => {
    assert.equal(DECORATIVE_PALETTE_KEYS.length, Object.keys(PALETTES).length - 1);
    assert.ok(!DECORATIVE_PALETTE_KEYS.includes('neutral'));
  });
});

describe('PALETTES', () => {
  it('déclare au moins deux couleurs et des bornes normalisées', () => {
    for (const [key, palette] of Object.entries(PALETTES)) {
      assert.ok(palette.colors.length >= 2, `${key} : moins de deux couleurs`);
      for (const color of palette.colors) {
        assert.match(color, /^#[0-9a-f]{6}$/, `${key} : couleur « ${color} » mal formée`);
      }
      for (const point of [palette.start, palette.end]) {
        assert.ok(point.x >= 0 && point.x <= 1, `${key} : x hors [0,1]`);
        assert.ok(point.y >= 0 && point.y <= 1, `${key} : y hors [0,1]`);
      }
      assert.match(palette.ink, /^#[0-9a-f]{6}$/, `${key} : ink mal formée`);
    }
  });
});

describe('catégories', () => {
  it('a des identifiants et un ordre cohérents', () => {
    assert.equal(CATEGORY_ORDER.length, 6);
    assert.deepEqual([...CATEGORY_ORDER].sort(), Object.keys(CATEGORY_IDS).sort());
  });

  it('a une correspondance inverse exacte', () => {
    for (const [key, id] of Object.entries(CATEGORY_IDS)) {
      assert.equal(CATEGORY_BY_ID[id], key);
    }
  });

  it('renvoie undefined sur un identifiant inconnu', () => {
    // Comportement dont dépend `mapBentoItems` pour ignorer une 7e catégorie
    // déployée en base avant les clients.
    assert.equal(CATEGORY_BY_ID[99], undefined);
    assert.equal(CATEGORY_BY_ID[0], undefined);
  });

  it('décrit chaque catégorie', () => {
    for (const key of CATEGORY_ORDER) {
      assert.ok(CATEGORY_META[key].label.length > 0, `libellé manquant pour ${key}`);
      assert.ok(CATEGORY_META[key].stamp.length > 0, `tampon manquant pour ${key}`);
    }
  });
});

describe('popyKeyForPseudo', () => {
  it('est déterministe et insensible à la casse', () => {
    assert.equal(popyKeyForPseudo('Keremasan'), popyKeyForPseudo('keremasan'));
    assert.equal(popyKeyForPseudo('KEREMASAN'), popyKeyForPseudo('keremasan'));
  });

  it('renvoie toujours une clé connue', () => {
    for (let i = 0; i < 200; i++) {
      assert.ok(POPY_KEYS.includes(popyKeyForPseudo(`user_${i}`)));
    }
  });

  it('couvre les six variantes', () => {
    const seen = new Set(
      Array.from({ length: 500 }, (_, i) => popyKeyForPseudo(`user_${i}`)),
    );
    assert.equal(seen.size, POPY_KEYS.length);
  });

  /**
   * Valeurs figées. L'ordre de `POPY_KEYS` est significatif : le modifier
   * réattribuerait un autre avatar à chaque utilisateur existant, y compris
   * sur les bentos déjà partagés. Ce test rend ce changement impossible
   * par inadvertance.
   */
  it('conserve les attributions existantes', () => {
    assert.deepEqual(
      ['keremasan', 'darkhifus', 'elda', 'rob', 'buyt.k', 'thodalf'].map(popyKeyForPseudo),
      ['nani', 'nani', 'gene', 'fille', 'content', 'intello'],
    );
  });

  /**
   * Non-régression historique.
   *
   * `MOBILE_POPYS` et `mobileHash` sont la transcription littérale de
   * l'implémentation que l'app mobile portait avant de migrer vers ce
   * module partagé. Elle sert désormais d'oracle figé : elle prouve que
   * la mise en commun n'a réattribué son avatar à personne, y compris sur
   * les bentos déjà partagés.
   */
  it('conserve le comportement de l’implémentation historique', () => {
    const MOBILE_POPYS = ['content', 'intello', 'fille', 'gene', 'nani', 'diable'] as const;
    const mobileHash = (s: string): number => {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    };
    const mobilePopy = (p: string) =>
      MOBILE_POPYS[mobileHash(p.toLowerCase()) % MOBILE_POPYS.length];

    assert.deepEqual([...POPY_KEYS], [...MOBILE_POPYS], 'ordre des variantes divergent');

    const divergences: string[] = [];
    for (let i = 0; i < 5000; i++) {
      const pseudo = `user_${i}`;
      if (popyKeyForPseudo(pseudo) !== mobilePopy(pseudo)) divergences.push(pseudo);
    }
    for (const pseudo of ['keremasan', 'Dark_Hifus', 'buyt.k', 'a.b', 'ZZZ']) {
      if (popyKeyForPseudo(pseudo) !== mobilePopy(pseudo)) divergences.push(pseudo);
    }
    assert.deepEqual(divergences, [], 'divergences avec l’implémentation mobile');
  });
});
