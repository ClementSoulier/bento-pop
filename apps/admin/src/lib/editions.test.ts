import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type EditionCase,
  caseKey,
  caseVerdicts,
  editionStatus,
  explainEditionError,
  validateCases,
  validateEdition,
} from './editions';

/**
 * Les règles des éditions, sans base.
 *
 * L'écran est derrière une authentification, donc ces fonctions sont le seul
 * endroit vérifiable sans session. Les accès à la base se rejouent, eux,
 * contre le Supabase local.
 */

const cas = (order: number, prompt: string, over: Partial<EditionCase> = {}): EditionCase => ({
  order,
  prompt,
  stamp: 'FILM',
  gender: 'm',
  typeId: 1,
  ...over,
});

describe('l’état d’une édition se lit dans sa date', () => {
  const maintenant = new Date('2026-09-17T12:00:00Z');

  it('sans date, c’est un brouillon', () => {
    assert.equal(editionStatus(null, maintenant), 'brouillon');
  });

  it('date à venir, c’est programmé', () => {
    assert.equal(editionStatus('2026-09-24T16:00:00Z', maintenant), 'programmee');
  });

  it('date passée, c’est sorti', () => {
    assert.equal(editionStatus('2026-09-10T16:00:00Z', maintenant), 'sortie');
  });

  it('à la seconde près, c’est sorti', () => {
    // La lecture publique filtre `released_at <= now()` : la limite doit dire
    // la même chose des deux côtés, sinon le back-office annonce « programmée »
    // une édition que tout le monde voit déjà.
    assert.equal(editionStatus('2026-09-17T12:00:00Z', maintenant), 'sortie');
  });
});

describe('le cadre d’une édition', () => {
  const bon = { title: 'La semaine du film qui pique', slug: 'semaine-38', releasedAt: null };

  it('accepte un titre, une adresse et pas de date', () => {
    assert.deepEqual(validateEdition(bon), { ok: true });
  });

  it('refuse un titre vide', () => {
    const res = validateEdition({ ...bon, title: '   ' });
    assert.equal(res.ok, false);
  });

  it('refuse un titre trop long : 30 caractères au plus, comme la base', () => {
    assert.equal(validateEdition({ ...bon, title: 'x'.repeat(31) }).ok, false);
    assert.equal(validateEdition({ ...bon, title: 'x'.repeat(30) }).ok, true);
    // Le titre de la recette, 28 caractères, passe.
    assert.equal(validateEdition({ ...bon, title: 'La semaine du film qui pique' }).ok, true);
  });

  for (const slug of ['Semaine-38', 'se', 'semaine_38', '-semaine', 'semaine-']) {
    it(`refuse l’adresse « ${slug} »`, () => {
      assert.equal(validateEdition({ ...bon, slug }).ok, false);
    });
  }

  it('refuse une date illisible', () => {
    assert.equal(validateEdition({ ...bon, releasedAt: 'jeudi prochain' }).ok, false);
  });
});

describe('les cases, face à la disposition', () => {
  it('refuse une édition d’une seule case', () => {
    assert.equal(validateCases([cas(1, 'Film')]).ok, false);
  });

  it('refuse une édition de sept cases', () => {
    const sept = Array.from({ length: 7 }, (_, i) => cas(i + 1, 'Film'));
    assert.equal(validateCases(sept).ok, false);
  });

  it('refuse un trou dans les rangs', () => {
    assert.equal(validateCases([cas(1, 'Film'), cas(3, 'Série')]).ok, false);
  });

  it('refuse deux cases au même rang', () => {
    assert.equal(validateCases([cas(1, 'Film'), cas(1, 'Série')]).ok, false);
  });

  it('accepte deux cases du même type', () => {
    // La question que la roadmap croyait bloquante : deux « film » dans une
    // édition sont deux cases distinctes, et la clé primaire de `bento_items`
    // dit déjà « un item par case ».
    const deux = [cas(1, 'Le film qui pique', { typeId: 1 }), cas(2, 'Le film doux', { typeId: 1 })];
    assert.deepEqual(validateCases(deux), { ok: true });
  });

  it('refuse un intitulé vide', () => {
    assert.equal(validateCases([cas(1, 'Film'), cas(2, '  ')]).ok, false);
  });

  it('refuse un tampon trop long', () => {
    assert.equal(validateCases([cas(1, 'Film'), cas(2, 'Série', { stamp: 'BEAUCOUP-TROP' })]).ok, false);
  });

  /**
   * Le cœur de la règle. Une même question passe ou casse selon le nombre de
   * cases, parce que le nombre décide de la disposition : à cinq, la question
   * est dans une rangée à deux ; à six, dans une rangée à trois.
   */
  it('accepte une question à cinq cases et la refuse à six', () => {
    const base = [
      cas(1, 'Le film qui pique'),
      cas(2, 'La série du soir'),
      cas(3, 'Un bon son'),
      cas(4, 'Un lieu'),
    ];
    const cinq = [...base, cas(5, 'Le jeu qui t’a volé ton été')];
    assert.deepEqual(validateCases(cinq), { ok: true });

    const six = [...cinq, cas(6, 'Un plat')];
    const res = validateCases(six);
    assert.equal(res.ok, false);
    assert.match(res.ok ? '' : res.error, /rangée à 3/);
  });

  it('nomme le mot trop long pour la case où il tombe', () => {
    // À deux cases, les deux rangées font 303 points utiles et le mot y tient.
    // Il ne casse qu'en rangée étroite, d'où une édition à six cases et le mot
    // en dernière position, dans la rangée à trois.
    const six = [
      cas(1, 'Le film'), cas(2, 'La série'), cas(3, 'Le son'),
      cas(4, 'Le lieu'), cas(5, 'Le plat'), cas(6, 'Anticonstitutionnellement'),
    ];
    const res = validateCases(six);
    assert.equal(res.ok, false);
    assert.match(res.ok ? '' : res.error, /Anticonstitutionnellement/);
  });

  it('accepte ce même mot là où la rangée est large', () => {
    const deux = [cas(1, 'Anticonstitutionnellement'), cas(2, 'Le film')];
    assert.deepEqual(validateCases(deux), { ok: true });
  });

  it('laisse passer ce qui est seulement serré', () => {
    // `tight` avertit, il ne bloque pas : une règle qui refuse ce que le bento
    // principal affiche depuis toujours serait fausse.
    const six = Array.from({ length: 6 }, (_, i) => cas(i + 1, 'Créateur de contenu'));
    const verdicts = caseVerdicts(six);
    assert.ok(verdicts.some((v) => v.tight), 'aucune case signalée serrée');
    assert.deepEqual(validateCases(six), { ok: true });
  });
});

describe('le verdict par case', () => {
  it('donne à chaque case la rangée de sa disposition', () => {
    const cinq = Array.from({ length: 5 }, (_, i) => cas(i + 1, 'Film'));
    assert.deepEqual(caseVerdicts(cinq).map((v) => v.casesInRow), [1, 2, 2, 2, 2]);
  });

  it('suit l’ordre des rangs, pas celui du tableau', () => {
    const desordre = [cas(3, 'Trois'), cas(1, 'Un'), cas(2, 'Deux')];
    assert.deepEqual(caseVerdicts(desordre).map((v) => v.order), [1, 2, 3]);
  });

  it('distingue une case pas encore écrite d’une case coupée', () => {
    // Recette du 16 septembre : « coupé · 0 lignes » pour un intitulé vide.
    const [vide, ecrite] = caseVerdicts([cas(1, '  '), cas(2, 'Série')]);
    assert.equal(vide!.empty, true);
    assert.equal(ecrite!.empty, false);
    // La validation la refuse toujours : vide ne veut pas dire acceptable.
    assert.equal(validateCases([cas(1, ''), cas(2, 'Série')]).ok, false);
  });

  it('rend une part de ligne exploitable', () => {
    const [court] = caseVerdicts([cas(1, 'Film'), cas(2, 'Série')]);
    assert.ok(court!.ratio > 0 && court!.ratio < 0.3, `part mesurée : ${court!.ratio}`);
  });
});

describe('la clé d’une case', () => {
  it('porte son édition et son rang', () => {
    assert.equal(caseKey(38, 2), 'ed38_2');
  });

  it('ne collisionne pas entre éditions', () => {
    assert.notEqual(caseKey(3, 82), caseKey(38, 2));
  });
});

describe('les erreurs de la base, en français', () => {
  it('traduit une adresse déjà prise', () => {
    assert.match(
      explainEditionError('duplicate key value violates unique constraint "editions_slug_key"'),
      /déjà prise/,
    );
  });

  it('laisse passer ce qu’elle ne connaît pas', () => {
    assert.equal(explainEditionError('connexion perdue'), 'connexion perdue');
  });
});
