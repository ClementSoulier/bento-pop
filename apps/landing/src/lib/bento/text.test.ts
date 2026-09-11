import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanTitle, initialOf, joinReadable, truncateAtWord } from './text';

describe('cleanTitle', () => {
  it('retire les parenthèses de désambiguïsation', () => {
    assert.equal(cleanTitle('Inception (film)'), 'Inception');
    assert.equal(cleanTitle('LUMIÈRE (FROM CALIFORNICATION)'), 'LUMIÈRE');
    assert.equal(cleanTitle('Quentin Dupieux (réalisateur français)'), 'Quentin Dupieux');
  });

  it('gère une parenthèse jamais refermée', () => {
    // Certaines sources renvoient des titres tronqués.
    assert.equal(cleanTitle('Foo (incomplete'), 'Foo');
  });

  it('retire les crochets', () => {
    assert.equal(cleanTitle('Severance [edit]'), 'Severance');
  });

  it('laisse un titre simple intact', () => {
    assert.equal(cleanTitle('Breaking Bad'), 'Breaking Bad');
    assert.equal(cleanTitle('稲葉曇'), '稲葉曇');
    assert.equal(cleanTitle('Puella Magi Madoka★Magica'), 'Puella Magi Madoka★Magica');
  });

  it('réduit les espaces multiples', () => {
    assert.equal(cleanTitle('  Breaking    Bad  '), 'Breaking Bad');
  });

  it('renvoie une chaîne vide sur une entrée vide', () => {
    assert.equal(cleanTitle(''), '');
    assert.equal(cleanTitle('   '), '');
  });

  it('tronque à une frontière de mot', () => {
    const out = cleanTitle('A very long song title that overflows', 20);
    assert.ok(out.length <= 20, `trop long : ${out.length}`);
    assert.ok(out.endsWith('…'));
    assert.ok(!out.includes('  '));
  });

  it('tronque en dur quand le premier mot dépasse déjà la limite', () => {
    const out = cleanTitle('Anticonstitutionnellement', 10);
    assert.equal(out.length, 10);
    assert.ok(out.endsWith('…'));
  });

  it('ne laisse pas de séparateur avant l’ellipsis', () => {
    // Sous-titre réel du catalogue. Sans nettoyage, la coupe donnait
    // « FR · Person ·… », qui se lit comme une erreur d'affichage.
    const out = cleanTitle('FR · Person · French rapper', 18);
    assert.ok(out.endsWith('…'), out);
    assert.ok(!/[·,;:\s-]…$/.test(out), out);
  });

  /** Le titre le plus long du catalogue en production, 70 caractères. */
  it('gère le pire cas réel du catalogue', () => {
    const longest =
      'Le Monde de Narnia : Le Lion, la sorcière blanche et l’armoire magique';
    assert.equal(cleanTitle(longest), longest);
    assert.ok(cleanTitle(longest, 32).length <= 32);
  });
});

describe('initialOf', () => {
  it('prend la première lettre en majuscule', () => {
    assert.equal(initialOf('Interstellar'), 'I');
    assert.equal(initialOf('orelsan'), 'O');
  });

  it('saute la ponctuation initiale', () => {
    assert.equal(initialOf('« Severance »'), 'S');
    assert.equal(initialOf('...Baby One More Time'), 'B');
    assert.equal(initialOf('  Dune'), 'D');
  });

  it('gère les accents', () => {
    assert.equal(initialOf('Émilie'), 'É');
    assert.equal(initialOf('à la folie'), 'À');
  });

  it('gère les chiffres', () => {
    assert.equal(initialOf('1984'), '1');
  });

  /**
   * L'app mobile utilise `[A-Za-zÀ-ÿ0-9]` et affiche donc « ? » sur les six
   * titres japonais du catalogue. La version web couvre l'Unicode entier.
   */
  it('gère les caractères non latins présents en base', () => {
    assert.equal(initialOf('稲葉曇'), '稲');
    assert.equal(initialOf('ロストアンブレラ'), 'ロ');
  });

  it('retombe sur « ? » quand il n’y a rien d’alphanumérique', () => {
    assert.equal(initialOf(''), '?');
    assert.equal(initialOf('   '), '?');
    assert.equal(initialOf('!!!'), '?');
    assert.equal(initialOf('🍱'), '?');
  });
});

describe('truncateAtWord', () => {
  it('laisse passer une chaîne plus courte que la limite', () => {
    assert.equal(truncateAtWord('Bonjour', 20), 'Bonjour');
  });

  it('respecte strictement la limite', () => {
    const out = truncateAtWord('a'.repeat(10) + ' ' + 'b'.repeat(200), 160);
    assert.ok(out.length <= 160, `longueur ${out.length}`);
  });

  it('ne coupe pas au milieu d’un mot quand c’est évitable', () => {
    const source = 'Interstellar, Severance et Orelsan sont mes choix';
    const out = truncateAtWord(source, 30);

    assert.ok(out.endsWith('…'), out);
    const body = out.slice(0, -1);
    assert.ok(source.startsWith(body), 'le début doit être conservé tel quel');
    // Le caractère suivant dans la source est une espace : la coupe tombe
    // donc bien sur une frontière de mot, jamais au milieu.
    assert.equal(source[body.length], ' ', `coupe au milieu de « ${source.slice(body.length - 3, body.length + 5)} »`);
  });

  it('normalise les espaces avant de mesurer', () => {
    assert.equal(truncateAtWord('  a   b  ', 20), 'a b');
  });
});

describe('joinReadable', () => {
  it('compose une énumération française', () => {
    assert.equal(joinReadable(['A']), 'A');
    assert.equal(joinReadable(['A', 'B']), 'A et B');
    assert.equal(joinReadable(['A', 'B', 'C']), 'A, B et C');
  });

  it('ignore les entrées vides', () => {
    assert.equal(joinReadable(['A', '', '  ', 'B']), 'A et B');
    assert.equal(joinReadable([]), '');
    assert.equal(joinReadable(['', ' ']), '');
  });
});
