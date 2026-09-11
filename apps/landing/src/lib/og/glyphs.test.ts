import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { coveredCodePoints, missingGlyphs, normalizeForOg } from './glyphs';

const EXTENDA = readFileSync(
  path.join(process.cwd(), '../../packages/brand/assets/fonts/extenda-100-yotta.otf'),
);

describe('normalizeForOg', () => {
  it('ramène les tirets typographiques au tiret ASCII', () => {
    // `C‐C‐C` est un titre réel du catalogue, avec un U+2010 qu'Extenda
    // ne couvre pas alors qu'il est visuellement indiscernable d'un `-`.
    assert.equal(normalizeForOg('C‐C‐C'), 'C-C-C');
    assert.equal(normalizeForOg('a–b—c'), 'a-b-c');
  });

  it('ramène les guillemets typographiques aux droits', () => {
    assert.equal(normalizeForOg('l’armoire'), "l'armoire");
    assert.equal(normalizeForOg('“bonjour”'), '"bonjour"');
  });

  it('développe les points de suspension', () => {
    assert.equal(normalizeForOg('suite…'), 'suite...');
  });

  it('ramène les espaces spéciales à l’espace ordinaire', () => {
    assert.equal(normalizeForOg('a b c d'), 'a b c d');
  });

  it('laisse un texte ordinaire intact', () => {
    assert.equal(normalizeForOg('Inception'), 'Inception');
    assert.equal(normalizeForOg('Émilie & Cie'), 'Émilie & Cie');
    // Ce qui n'a pas d'équivalent latin n'est pas altéré : c'est le rôle
    // de la police de repli, pas de la normalisation.
    assert.equal(normalizeForOg('稲葉曇'), '稲葉曇');
  });
});

describe('coveredCodePoints', () => {
  const covered = coveredCodePoints(EXTENDA);

  /**
   * Verrouille le relevé qui a dicté la stratégie de polices. Si Extenda
   * est un jour remplacée par une version à couverture différente, ce test
   * échoue et oblige à reconsidérer le repli plutôt qu'à découvrir des
   * carrés vides dans un aperçu de partage.
   */
  it('lit une couverture non vide dans la table cmap', () => {
    assert.ok(covered.size > 500, `seulement ${covered.size} points de code`);
  });

  it('couvre le latin, les accents français et la ponctuation', () => {
    for (const char of "ABCXYZabcxyz0189 .,:;!?'\"()[]-&/@ÀÂÇÉÈÊËÎÔÙÛÜŸàâçéèêëîôùûüÿ") {
      assert.ok(covered.has(char.codePointAt(0)!), `manque « ${char} »`);
    }
  });

  it('ne couvre ni le japonais ni les symboles décoratifs', () => {
    for (const char of '稲葉曇ロストアンブレラ★☆') {
      assert.ok(!covered.has(char.codePointAt(0)!), `couvre « ${char} », relevé à revoir`);
    }
  });

  it('ne lève pas sur un tampon invalide', () => {
    // Une police corrompue ne doit jamais faire échouer la génération de
    // l'image ; l'appelant retombe simplement sans repli.
    assert.doesNotThrow(() => coveredCodePoints(Buffer.from([0, 1, 2, 3])));
  });
});

describe('missingGlyphs', () => {
  const covered = coveredCodePoints(EXTENDA);

  it('ne signale rien sur du texte entièrement couvert', () => {
    assert.equal(missingGlyphs(['Inception', 'Orelsan', '@keremasan'], covered), '');
  });

  it('signale les caractères non couverts, sans doublon', () => {
    const out = missingGlyphs(['稲葉曇', '稲葉曇'], covered);
    assert.equal(out, '稲葉曇');
  });

  it('applique la normalisation avant de conclure', () => {
    // Le tiret U+2010 n'est pas couvert, mais il devient `-` : le
    // demander en repli serait un aller-retour réseau inutile.
    assert.equal(missingGlyphs(['C‐C'], covered), '');
  });

  it('ignore les caractères de contrôle', () => {
    assert.equal(missingGlyphs(['a\nb\tc'], covered), '');
  });

  it('renvoie une chaîne vide quand la couverture est inconnue', () => {
    // Police illisible : mieux vaut ne rien demander que de réclamer un
    // sous-ensemble contenant tout le texte de la page.
    assert.equal(missingGlyphs(['稲葉曇'], new Set()), '');
  });

  it('agrège plusieurs textes', () => {
    const out = missingGlyphs(['Inception', '稲', 'Madoka★Magica'], covered);
    assert.equal([...out].sort().join(''), ['稲', '★'].sort().join(''));
  });
});
