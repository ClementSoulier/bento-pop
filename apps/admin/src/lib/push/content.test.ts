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
  it('une validation nomme l’item', () => {
    assert.deepEqual(itemModeratedText({ status: 'validated', title: 'Interstellar' }), {
      title: '« Interstellar » est validé',
      body: 'Ta case est en ligne.',
    });
  });

  it('une fusion nomme l’item conservé, qui remplit la case (D12)', () => {
    const text = itemModeratedText({
      status: 'merged',
      title: 'interstelar',
      keptTitle: 'Interstellar',
    });
    assert.equal(text.title, '« Interstellar » est validé');
  });

  it('une fusion sans titre conservé retombe sur le titre proposé', () => {
    const text = itemModeratedText({ status: 'merged', title: 'Interstellar', keptTitle: '  ' });
    assert.equal(text.title, '« Interstellar » est validé');
  });

  it('un refus donne sa raison quand elle existe', () => {
    assert.deepEqual(
      itemModeratedText({ status: 'rejected', title: 'Film X', reason: 'Déjà au catalogue sous un autre titre.' }),
      { title: '« Film X » n\'a pas été retenu', body: 'Déjà au catalogue sous un autre titre.' },
    );
  });

  it('un refus sans raison propose d’en choisir un autre', () => {
    for (const reason of [null, undefined, '', '   ']) {
      assert.equal(
        itemModeratedText({ status: 'rejected', title: 'Film X', reason }).body,
        'Tu peux choisir un autre item pour cette case.',
      );
    }
  });

  it('une raison longue se coupe, espaces resserrés', () => {
    const body = itemModeratedText({
      status: 'rejected',
      title: 'Film X',
      reason: `Trop\n\nlong ${'mot '.repeat(80)}`,
    }).body;
    assert.ok(Array.from(body).length <= 200, `${Array.from(body).length} caractères`);
    assert.ok(body.startsWith('Trop long mot'));
    assert.ok(body.endsWith('…'));
  });

  it('un titre vide ne laisse pas de guillemets orphelins', () => {
    assert.equal(itemModeratedText({ status: 'validated', title: '  ' }).title, 'Ton item est validé');
    assert.equal(
      itemModeratedText({ status: 'rejected', title: '' }).title,
      'Ton item n\'a pas été retenu',
    );
  });

  it('un titre long se coupe sur un mot, sans virgule pendante', () => {
    // Les 59 premiers caractères s'arrêtent dans « version » : la coupe se
    // fait avant ce mot, et la virgule qui le précédait tombe.
    const title = 'Le Seigneur des anneaux : La Communauté de l’anneau, version longue restaurée';
    const text = itemModeratedText({ status: 'validated', title });
    assert.equal(text.title, '« Le Seigneur des anneaux : La Communauté de l’anneau… » est validé');
  });

  it('des guillemets dans le titre restent tels quels', () => {
    assert.equal(
      itemModeratedText({ status: 'validated', title: 'Le « Parrain » "II"' }).title,
      '« Le « Parrain » "II" » est validé',
    );
  });
});

describe('ce que dit la notification d’une édition', () => {
  it('le titre de l’édition, et l’invitation à composer', () => {
    assert.deepEqual(editionReleasedText('Les films de l’été'), {
      title: '« Les films de l’été » est sortie',
      body: 'Compose ton bento de la semaine.',
    });
  });

  it('sans titre, une phrase générique', () => {
    assert.equal(editionReleasedText(' ').title, 'Une nouvelle édition est sortie');
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
