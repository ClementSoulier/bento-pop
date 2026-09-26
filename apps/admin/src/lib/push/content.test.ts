import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PUSH_CHANNEL,
  PUSH_TITLE_MAX,
  buildMessage,
  editionReleasedText,
  itemModeratedText,
  shorten,
} from './content';

describe('ce que dit la notification d’un item modéré', () => {
  it('une validation : le verdict en titre, l’item nommé dessous (D24)', () => {
    assert.deepEqual(itemModeratedText({ status: 'validated', title: 'Interstellar' }), {
      title: 'Proposition validée',
      body: '« Interstellar » est au catalogue : ta case est en ligne.',
    });
  });

  it('chaque verdict tient dans la ligne de titre mesurée, 28 caractères', () => {
    // Mesuré le 23 septembre 2026 au simulateur iPhone 17 Pro : au-delà, le
    // titre d'une notification se coupe, et le verdict disparaissait.
    const titres = [
      itemModeratedText({ status: 'validated', title: 'x' }).title,
      itemModeratedText({ status: 'merged', title: 'x', keptTitle: 'y' }).title,
      itemModeratedText({ status: 'rejected', title: 'x', reason: 'z' }).title,
      itemModeratedText({ status: 'validated', title: 'x', published: true }).title,
      editionReleasedText('x').title,
    ];
    for (const titre of titres) assert.ok(Array.from(titre).length <= 28, titre);
  });

  it('une validation qui publie le bento : « Bento publié », l’item nommé dessous (chantier 18, D4)', () => {
    assert.deepEqual(itemModeratedText({ status: 'validated', title: 'Interstellar', published: true }), {
      title: 'Bento publié',
      body: '« Interstellar » est validé : ton bento est en ligne.',
    });
  });

  it('une fusion qui publie le bento nomme l’item conservé', () => {
    const text = itemModeratedText({
      status: 'merged',
      title: 'interstelar',
      keptTitle: 'Interstellar',
      published: true,
    });
    assert.equal(text.title, 'Bento publié');
    assert.equal(text.body, '« Interstellar » est validé : ton bento est en ligne.');
  });

  it('un bento publié sans titre d’item : la phrase seule', () => {
    assert.equal(
      itemModeratedText({ status: 'validated', title: '  ', published: true }).body,
      'Ton bento est en ligne.',
    );
  });

  it('un refus ne dit jamais « publié »', () => {
    assert.equal(
      itemModeratedText({ status: 'rejected', title: 'Film X', published: true }).title,
      'Proposition non retenue',
    );
  });

  it('une fusion nomme l’item conservé, qui remplit la case (D12)', () => {
    const text = itemModeratedText({
      status: 'merged',
      title: 'interstelar',
      keptTitle: 'Interstellar',
    });
    assert.equal(text.title, 'Proposition validée');
    assert.equal(text.body, '« Interstellar » est au catalogue : ta case est en ligne.');
  });

  it('une fusion sans titre conservé retombe sur le titre proposé', () => {
    const text = itemModeratedText({ status: 'merged', title: 'Interstellar', keptTitle: '  ' });
    assert.equal(text.body, '« Interstellar » est au catalogue : ta case est en ligne.');
  });

  it('un refus donne sa raison quand elle existe', () => {
    assert.deepEqual(
      itemModeratedText({ status: 'rejected', title: 'Film X', reason: 'Déjà au catalogue sous un autre titre.' }),
      { title: 'Proposition non retenue', body: '« Film X » : Déjà au catalogue sous un autre titre.' },
    );
  });

  it('un refus sans raison propose d’en choisir un autre', () => {
    for (const reason of [null, undefined, '', '   ']) {
      assert.equal(
        itemModeratedText({ status: 'rejected', title: 'Film X', reason }).body,
        '« Film X » n\'a pas été retenu. Tu peux choisir un autre item pour cette case.',
      );
    }
  });

  it('une raison longue se coupe, espaces resserrés', () => {
    const body = itemModeratedText({
      status: 'rejected',
      title: 'Film X',
      reason: `Trop\n\nlong ${'mot '.repeat(80)}`,
    }).body;
    const raison = body.slice('« Film X » : '.length);
    assert.ok(body.startsWith('« Film X » : Trop long mot'));
    assert.ok(Array.from(raison).length <= 200, `${Array.from(raison).length} caractères`);
    assert.ok(body.endsWith('…'));
  });

  it('un titre vide ne laisse pas de guillemets orphelins', () => {
    assert.equal(itemModeratedText({ status: 'validated', title: '  ' }).body, 'Ta case est en ligne.');
    assert.equal(
      itemModeratedText({ status: 'rejected', title: '' }).body,
      'Tu peux choisir un autre item pour cette case.',
    );
    assert.equal(
      itemModeratedText({ status: 'rejected', title: '', reason: 'Doublon.' }).body,
      'Doublon.',
    );
  });

  it('un titre long se coupe sur un mot, sans virgule pendante', () => {
    // Les 59 premiers caractères s'arrêtent dans « version » : la coupe se
    // fait avant ce mot, et la virgule qui le précédait tombe.
    const title = 'Le Seigneur des anneaux : La Communauté de l’anneau, version longue restaurée';
    const text = itemModeratedText({ status: 'validated', title });
    assert.equal(
      text.body,
      '« Le Seigneur des anneaux : La Communauté de l’anneau… » est au catalogue : ta case est en ligne.',
    );
  });

  it('des guillemets dans le titre restent tels quels', () => {
    assert.equal(
      itemModeratedText({ status: 'validated', title: 'Le « Parrain » "II"' }).body,
      '« Le « Parrain » "II" » est au catalogue : ta case est en ligne.',
    );
  });
});

describe('ce que dit la notification d’une édition', () => {
  it('le verdict en titre, l’édition nommée dessous, et l’invitation à composer', () => {
    assert.deepEqual(editionReleasedText('Les films de l’été'), {
      title: 'Nouvelle édition',
      body: '« Les films de l’été » est sortie. Compose ton bento de la semaine.',
    });
  });

  it('sans titre, l’invitation seule', () => {
    assert.equal(editionReleasedText(' ').body, 'Compose ton bento de la semaine.');
  });
});

describe('la coupe d’un texte', () => {
  it('un texte court reste entier', () => {
    assert.equal(shorten('Interstellar', PUSH_TITLE_MAX), 'Interstellar');
  });

  it('un mot sans espace se coupe net', () => {
    const out = shorten('a'.repeat(100), 10);
    assert.equal(out, `${'a'.repeat(9)}…`);
  });

  it('un emoji ne se coupe pas en deux', () => {
    const out = shorten('🍙'.repeat(20), 10);
    assert.equal(Array.from(out).length, 10);
    assert.ok(!out.includes('�'));
    assert.equal(out, `${'🍙'.repeat(9)}…`);
  });

  it('la ponctuation avant la coupe disparaît', () => {
    assert.equal(shorten('Un deux trois, quatre cinq six sept', 17), 'Un deux trois…');
  });
});

describe('le message Expo d’un appareil', () => {
  it('porte le canal Android de son type, et le type dans ses données', () => {
    const message = buildMessage(
      'ExponentPushToken[abc]',
      'item_moderated',
      { title: 'T', body: 'B' },
      { status: 'validated', itemId: 'i-1' },
    );
    assert.deepEqual(message, {
      to: 'ExponentPushToken[abc]',
      title: 'T',
      body: 'B',
      data: { type: 'item_moderated', status: 'validated', itemId: 'i-1' },
      channelId: 'items',
      sound: 'default',
      priority: 'default',
    });
  });

  it('une édition passe par le canal des éditions, avec sa durée de vie', () => {
    const message = buildMessage('t', 'edition_released', { title: 'T', body: 'B' }, { editionId: 3 }, 3600);
    assert.equal(message.channelId, 'editions');
    assert.equal(message.ttl, 3600);
  });

  it('les deux canaux sont ceux que l’app crée', () => {
    // `apps/mobile/src/lib/push-runtime.ts`, `ensureAndroidChannels`.
    assert.deepEqual(PUSH_CHANNEL, { item_moderated: 'items', edition_released: 'editions' });
  });
});
