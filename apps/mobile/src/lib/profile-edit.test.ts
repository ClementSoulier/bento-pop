import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { isPopyKey, popyKeyFor, popyKeyForPseudo } from '@bento-pop/supabase-mobile/bento';
import {
  DISPLAY_NAME_MAX,
  ProfileWriteFailure,
  changePseudo,
  checkDisplayName,
  displayNameLength,
  formatChangeDate,
  nameAction,
  nextPseudoChangeAt,
  profileWriteError,
  profileWriteMessage,
  pseudoFieldMessage,
  writeAvatar,
  writeDisplayName,
  type ProfileClient,
} from './profile-edit';
import { STUB_CLIENT_OPTIONS, startPostgrestStub, type PostgrestStub } from '../test/postgrest-stub';
import type { Database } from '@/supabase/types';

/**
 * Modifier son profil, chantier 21 : ce que l'écran dit avant d'écrire, et la
 * forme des écritures et de leurs refus, contre un bouchon PostgREST.
 */

const NOW = Date.parse('2026-10-24T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

describe('checkDisplayName', () => {
  it('garde le nom débarrassé de ses blancs, et lit le vide comme « pas de nom »', () => {
    assert.deepEqual(checkDisplayName('  Alice  '), { status: 'ok', value: 'Alice' });
    assert.deepEqual(checkDisplayName('   '), { status: 'ok', value: null });
  });

  it('compte les caractères comme la base : trente passent, trente et un non', () => {
    assert.equal(checkDisplayName('n'.repeat(DISPLAY_NAME_MAX)).status, 'ok');
    assert.equal(checkDisplayName('n'.repeat(DISPLAY_NAME_MAX + 1)).status, 'too-long');
    // Un emoji est un caractère, deux unités UTF-16.
    assert.equal(checkDisplayName('🍙'.repeat(DISPLAY_NAME_MAX)).status, 'ok');
  });

  it('refuse un nom sur deux lignes', () => {
    assert.equal(checkDisplayName('Alice\nMartin').status, 'multiline');
    assert.equal(checkDisplayName('Alice\tMartin').status, 'multiline');
  });
});

describe('le champ du nom', () => {
  it('compte ce que la base gardera', () => {
    assert.equal(displayNameLength('  Alice  '), 5);
    assert.equal(displayNameLength('🍙🍙'), 2);
  });

  it('ne propose rien tant que le nom ne change pas, blancs compris', () => {
    assert.deepEqual(nameAction('Alice', 'Alice'), { kind: 'none' });
    assert.deepEqual(nameAction('  Alice ', 'Alice'), { kind: 'none' });
    assert.deepEqual(nameAction('', null), { kind: 'none' });
    assert.deepEqual(nameAction('   ', null), { kind: 'none' });
  });

  it('enregistre un nom changé, retire un nom vidé', () => {
    assert.deepEqual(nameAction('Alice B.', 'Alice'), { kind: 'save' });
    assert.deepEqual(nameAction('Alice', null), { kind: 'save' });
    assert.deepEqual(nameAction('  ', 'Alice'), { kind: 'remove' });
  });

  it('dit pourquoi un nom ne passe pas', () => {
    assert.deepEqual(nameAction('n'.repeat(DISPLAY_NAME_MAX + 1), null), {
      kind: 'invalid',
      message: `${DISPLAY_NAME_MAX} caractères au plus.`,
    });
    assert.deepEqual(nameAction('deux\nlignes', null), { kind: 'invalid', message: 'Une seule ligne.' });
  });
});

describe('pseudoFieldMessage', () => {
  it('se tait au repos, annonce le libre et le refusé', () => {
    assert.equal(pseudoFieldMessage({ status: 'idle' }), null);
    assert.equal(pseudoFieldMessage({ status: 'available' })?.tone, 'ok');
    for (const status of ['taken', 'reserved', 'forbidden', 'too-short', 'too-long', 'invalid', 'error'] as const) {
      assert.equal(pseudoFieldMessage({ status })?.tone, 'error', status);
    }
    assert.equal(pseudoFieldMessage({ status: 'current' })?.tone, 'neutral');
  });

  /** Un ancien pseudo d'un autre compte est « pris » : personne ne le récupère (D6). */
  it('dit « pris » d’un pseudo pris, et « non autorisé » d’un pseudo interdit', () => {
    assert.equal(pseudoFieldMessage({ status: 'taken' })?.text, 'Déjà pris.');
    assert.equal(pseudoFieldMessage({ status: 'forbidden' })?.text, 'Ce pseudo n’est pas autorisé.');
  });
});

describe('nextPseudoChangeAt', () => {
  it('n’attend rien pour un pseudo jamais changé', () => {
    assert.equal(nextPseudoChangeAt(null, NOW), null);
  });

  it('attend 30 jours après un changement, microsecondes de PostgREST comprises', () => {
    const changed = '2026-10-14T12:00:00.123456+00:00';
    assert.equal(nextPseudoChangeAt(changed, NOW)?.toISOString(), '2026-11-13T12:00:00.123Z');
  });

  it('n’attend plus rien passé ce délai', () => {
    assert.equal(nextPseudoChangeAt(new Date(NOW - 31 * DAY).toISOString(), NOW), null);
  });
});

describe('profileWriteError et profileWriteMessage', () => {
  it('lit chaque code des fonctions du chantier', () => {
    assert.deepEqual(profileWriteError({ code: '22001' }), { kind: 'too-long' });
    assert.deepEqual(profileWriteError({ code: '22023' }), { kind: 'invalid' });
    assert.deepEqual(profileWriteError({ code: '23505' }), { kind: 'taken' });
    assert.deepEqual(profileWriteError({ code: '23514' }), { kind: 'forbidden' });
    assert.deepEqual(profileWriteError({ code: '42501' }), { kind: 'auth' });
    assert.deepEqual(profileWriteError({ code: 'XX000' }), { kind: 'unknown' });
  });

  it('lit la date du prochain changement dans l’indice', () => {
    const reason = profileWriteError({ code: 'P0001', hint: '2026-11-13T12:00:00Z' });
    assert.equal(reason.kind, 'too-soon');
    assert.equal(reason.kind === 'too-soon' ? reason.nextAt?.toISOString() : '', '2026-11-13T12:00:00.000Z');
    assert.deepEqual(profileWriteError({ code: 'P0001', hint: null }), { kind: 'too-soon', nextAt: null });
  });

  it('dit chaque refus en une phrase, selon le champ', () => {
    assert.equal(profileWriteMessage({ kind: 'taken' }, 'pseudo'), 'Ce pseudo est déjà pris.');
    assert.equal(profileWriteMessage({ kind: 'forbidden' }, 'name'), 'Ce nom n’est pas autorisé.');
    assert.equal(profileWriteMessage({ kind: 'forbidden' }, 'pseudo'), 'Ce pseudo n’est pas autorisé.');
    assert.equal(profileWriteMessage({ kind: 'invalid' }, 'name'), 'Une seule ligne.');
    assert.equal(
      profileWriteMessage({ kind: 'too-soon', nextAt: new Date('2026-11-13T12:00:00Z') }, 'pseudo', NOW),
      'Prochain changement de pseudo possible le 13 novembre.',
    );
  });

  it('écrit l’année seulement quand elle change', () => {
    assert.equal(formatChangeDate(new Date('2027-01-05T12:00:00Z'), NOW), '5 janvier 2027');
  });
});

describe('le Popy d’un compte', () => {
  it('prend le Popy choisi, sinon celui du pseudo', () => {
    assert.equal(popyKeyFor('alice', 'nani'), 'nani');
    assert.equal(popyKeyFor('alice', null), popyKeyForPseudo('alice'));
  });

  it('lit une clé inconnue comme pas de choix', () => {
    assert.equal(isPopyKey('licorne'), false);
    assert.equal(popyKeyFor('alice', 'licorne'), popyKeyForPseudo('alice'));
  });
});

let stub: PostgrestStub;
let client: ProfileClient;

before(async () => {
  stub = await startPostgrestStub();
  client = createClient<Database>(stub.url, 'stub-anon-key', STUB_CLIENT_OPTIONS);
});

after(async () => {
  await stub.close();
});

beforeEach(() => {
  stub.requests.length = 0;
});

describe('les écritures', () => {
  it('enregistre le nom nettoyé par `set_display_name`, et le vide en `null`', async () => {
    stub.enqueue('Alice');
    assert.equal(await writeDisplayName(client, '  Alice '), 'Alice');
    stub.enqueue(null);
    await writeDisplayName(client, '   ');

    assert.equal(stub.requests[0]!.path, '/rest/v1/rpc/set_display_name');
    assert.deepEqual(JSON.parse(stub.requests[0]!.body), { p_display_name: 'Alice' });
    assert.deepEqual(JSON.parse(stub.requests[1]!.body), { p_display_name: null });
  });

  it('refuse un nom trop long sans rien envoyer', async () => {
    await assert.rejects(
      () => writeDisplayName(client, 'n'.repeat(DISPLAY_NAME_MAX + 1)),
      (e: unknown) => e instanceof ProfileWriteFailure && e.reason.kind === 'too-long',
    );
    assert.equal(stub.requests.length, 0);
  });

  it('enregistre le Popy par `set_avatar`', async () => {
    stub.enqueue('gene');
    assert.equal(await writeAvatar(client, 'gene'), 'gene');
    assert.equal(stub.requests[0]!.path, '/rest/v1/rpc/set_avatar');
    assert.deepEqual(JSON.parse(stub.requests[0]!.body), { p_avatar: 'gene' });
  });

  it('change de pseudo en passant le Popy affiché, à figer', async () => {
    stub.enqueue('nouveau');
    assert.equal(await changePseudo(client, ' nouveau ', 'diable'), 'nouveau');
    assert.equal(stub.requests[0]!.path, '/rest/v1/rpc/change_pseudo');
    assert.deepEqual(JSON.parse(stub.requests[0]!.body), { p_pseudo: 'nouveau', p_keep_avatar: 'diable' });
  });

  it('lit un refus de la base, et la date d’un changement trop tôt', async () => {
    stub.enqueue({ code: '23505', message: 'Ce pseudo est déjà pris.', details: null, hint: null }, 409);
    await assert.rejects(
      () => changePseudo(client, 'pris', 'content'),
      (e: unknown) => e instanceof ProfileWriteFailure && e.reason.kind === 'taken',
    );
    stub.enqueue(
      { code: 'P0001', message: 'Trop tôt.', details: null, hint: '2026-11-13T12:00:00Z' },
      400,
    );
    await assert.rejects(
      () => changePseudo(client, 'encore', 'content'),
      (e: unknown) =>
        e instanceof ProfileWriteFailure &&
        e.reason.kind === 'too-soon' &&
        e.reason.nextAt?.toISOString() === '2026-11-13T12:00:00.000Z',
    );
  });
});
