import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  PROMPT_FONT_SIZE,
  PROMPT_LETTER_SPACING,
  PROMPT_TIGHT_RATIO,
  boxTileTextWidth,
  bungeeTextWidth,
  promptFit,
} from '@bento-pop/supabase-mobile/bento';

/**
 * Les largeurs de Bungee, redérivées du vrai fichier de police.
 *
 * `bento.ts` porte une table de largeurs d'avance, parce qu'un back-office en
 * Node n'a pas de canevas pour mesurer du texte et que l'app ne peut pas
 * mesurer avant de dessiner. Une table recopiée, c'est une table qui dort
 * périmée : celle-ci se compare donc au fichier `.ttf` à chaque exécution.
 *
 * On lit `head` pour `unitsPerEm`, `hhea` pour `numberOfHMetrics`, `hmtx`
 * pour les avances et `cmap` format 4 pour la correspondance caractère vers
 * glyphe. Une centaine de lignes, aucune dépendance de plus.
 */

const TTF = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'node_modules',
  '.pnpm',
  '@expo-google-fonts+bungee@0.4.1',
  'node_modules',
  '@expo-google-fonts',
  'bungee',
  '400Regular',
  'Bungee_400Regular.ttf',
);

/** Avance de chaque caractère, en em, lue dans le fichier. */
function avancesDepuisLaPolice(chemin: string): Map<string, number> {
  const buf = readFileSync(chemin);
  const u16 = (o: number) => buf.readUInt16BE(o);
  const i16 = (o: number) => buf.readInt16BE(o);
  const u32 = (o: number) => buf.readUInt32BE(o);

  const tables = new Map<string, number>();
  for (let i = 0; i < u16(4); i += 1) {
    const rec = 12 + i * 16;
    tables.set(buf.toString('ascii', rec, rec + 4), u32(rec + 8));
  }
  const head = tables.get('head');
  const hhea = tables.get('hhea');
  const hmtx = tables.get('hmtx');
  const cmap = tables.get('cmap');
  assert.ok(head && hhea && hmtx && cmap, 'tables de police manquantes');

  const unitsPerEm = u16(head + 18);
  const numberOfHMetrics = u16(hhea + 34);
  const avance = (glyphe: number) =>
    u16(hmtx + Math.min(glyphe, numberOfHMetrics - 1) * 4);

  // Sous-table cmap format 4, la seule dont on a besoin ici.
  let sub: number | null = null;
  for (let i = 0; i < u16(cmap + 2); i += 1) {
    const rec = cmap + 4 + i * 8;
    const plateforme = u16(rec);
    const encodage = u16(rec + 2);
    if ((plateforme === 3 && (encodage === 1 || encodage === 10)) || plateforme === 0) {
      const cand = cmap + u32(rec + 4);
      if (u16(cand) === 4) { sub = cand; break; }
    }
  }
  assert.ok(sub !== null, 'aucune sous-table cmap format 4');

  const segCountX2 = u16(sub + 6);
  const finBase = sub + 14;
  const debutBase = finBase + segCountX2 + 2;
  const deltaBase = debutBase + segCountX2;
  const rangeBase = deltaBase + segCountX2;

  const glyphePour = (code: number): number => {
    for (let s = 0; s < segCountX2 / 2; s += 1) {
      if (code > u16(finBase + s * 2)) continue;
      const debut = u16(debutBase + s * 2);
      if (code < debut) return 0;
      const delta = i16(deltaBase + s * 2);
      const rangeOffset = u16(rangeBase + s * 2);
      if (rangeOffset === 0) return (code + delta) & 0xffff;
      const g = u16(rangeBase + s * 2 + rangeOffset + (code - debut) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };

  const CARACTERES =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    'ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸÆŒÑ' +
    '0123456789' +
    " '’-‐.,:;!?()«» &+/%…";

  const table = new Map<string, number>();
  for (const ch of CARACTERES) {
    table.set(ch, Math.round((avance(glyphePour(ch.codePointAt(0)!)) / unitsPerEm) * 10000) / 10000);
  }
  return table;
}

describe('largeurs de Bungee', () => {
  const dispo = existsSync(TTF);

  it('trouve le fichier de police', () => {
    // Si ce test échoue après une montée de version d'`@expo-google-fonts`,
    // c'est le chemin qu'il faut corriger, pas la table.
    assert.ok(dispo, `police introuvable : ${TTF}`);
  });

  if (!dispo) return;

  const reference = avancesDepuisLaPolice(TTF);

  it('la table de `bento.ts` dit la même chose que la police', () => {
    const ecarts: string[] = [];
    for (const [char, attendu] of reference) {
      // On isole un caractère en mesurant sans interlettrage.
      const mesure = bungeeTextWidth(char, 1, 0);
      if (Math.abs(mesure - attendu) > 0.0001) {
        ecarts.push(`${JSON.stringify(char)} : table ${mesure}, police ${attendu}`);
      }
    }
    assert.deepEqual(ecarts, [], `largeurs divergentes :\n  ${ecarts.join('\n  ')}`);
  });

  it('couvre tous les caractères lus dans la police', () => {
    // Témoin : une table vide passerait le test précédent sans rien comparer.
    assert.ok(reference.size >= 70, `${reference.size} caractères lus`);
  });
});

describe('mesure d’un intitulé', () => {
  /**
   * Recoupement indépendant : le 16 septembre 2026, les mêmes textes ont été
   * mesurés dans un vrai navigateur, police Bungee réellement chargée, au
   * canevas. Les deux méthodes doivent tomber d'accord à moins de 1 %.
   */
  const MESURES_NAVIGATEUR: readonly (readonly [string, number])[] = [
    ["Le film qui t’a fait pleurer", 199.3],
    ['Créateur de contenu', 145.7],
    ['Artiste', 54.9],
    ['Ta pire séance ciné', 136.9],
  ];

  for (const [texte, attendu] of MESURES_NAVIGATEUR) {
    it(`retrouve la mesure navigateur de « ${texte} »`, () => {
      const calcule = bungeeTextWidth(texte, PROMPT_FONT_SIZE, PROMPT_LETTER_SPACING);
      const ecart = Math.abs(calcule - attendu) / attendu;
      assert.ok(
        ecart < 0.01,
        `${calcule.toFixed(1)} contre ${attendu} au navigateur, ${(ecart * 100).toFixed(1)} % d’écart`,
      );
    });
  }

  it('met les minuscules en capitales, comme la case', () => {
    assert.equal(bungeeTextWidth('film'), bungeeTextWidth('FILM'));
  });
});

describe('un intitulé tient-il dans sa case', () => {
  /**
   * Le verdict que le back-office applique avant d'enregistrer. Les six
   * intitulés du bento principal doivent passer partout, y compris dans une
   * rangée à trois : ils y sont affichés depuis le premier jour.
   */
  const PRINCIPAUX = ['Film', 'Série', 'Artiste', 'Chanson', 'Créateur de contenu', 'Lieu'];

  for (const prompt of PRINCIPAUX) {
    it(`« ${prompt} » tient dans une rangée à trois`, () => {
      const fit = promptFit(prompt, 3);
      assert.ok(fit.fits, `${fit.lines} lignes pour ${fit.usableWidth.toFixed(1)} pt utiles`);
    });
  }

  const QUESTIONS = [
    "Le film qui t’a fait pleurer",
    'La série que tu caches',
    "Le jeu qui t’a volé ton été",
    'Ta pire séance ciné',
  ];

  for (const prompt of QUESTIONS) {
    it(`« ${prompt} » ne tient pas dans une rangée à trois`, () => {
      assert.equal(promptFit(prompt, 3).fits, false);
    });

    it(`« ${prompt} » tient dans une rangée à deux`, () => {
      const fit = promptFit(prompt, 2);
      assert.ok(fit.fits, `${fit.lines} lignes pour ${fit.usableWidth.toFixed(1)} pt utiles`);
    });

    it(`« ${prompt} » tient sur une rangée pleine largeur`, () => {
      assert.ok(promptFit(prompt, 1).fits);
    });
  }

  it('nomme le mot qui ne tiendra jamais', () => {
    const fit = promptFit('Ton anticonstitutionnellement préféré', 3);
    assert.equal(fit.fits, false);
    assert.equal(fit.tooLongWord, 'anticonstitutionnellement');
  });

  it('refuse un intitulé vide', () => {
    assert.equal(promptFit('   ', 2).fits, false);
    assert.equal(promptFit('', 1).fits, false);
  });

  it('mesure contre la largeur utile réelle, sans marge', () => {
    assert.equal(promptFit('x', 3).usableWidth, boxTileTextWidth(3));
  });

  /**
   * L'avertissement, et le cas qui l'a fait naître. « Créateur de contenu »
   * occupe 77,5 des 81 points utiles d'une rangée à trois, soit 96 % : il
   * tient à l'échelle de référence, mais au calcul il déborde dans le fil sur
   * iPhone SE, 6 % plus serré. À vérifier sur appareil, chantier 29.
   */
  it('signale « Créateur de contenu » comme serré, sans le refuser', () => {
    const fit = promptFit('Créateur de contenu', 3);
    assert.equal(fit.fits, true);
    assert.equal(fit.tight, true);
    assert.ok(fit.widestLine / fit.usableWidth > PROMPT_TIGHT_RATIO);
  });

  it('ne signale pas comme serré ce qui a de la place', () => {
    const fit = promptFit('Film', 3);
    assert.equal(fit.fits, true);
    assert.equal(fit.tight, false);
  });
});
