import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CODE_LENGTH,
  accountError,
  accountErrorMessage,
  cleanCode,
  isCompleteCode,
  isValidEmail,
  keptEmail,
  maskEmail,
  normalizeEmail,
  waitSeconds,
} from './account';

describe('les adresses', () => {
  it('se rangent sans espaces autour et en minuscules', () => {
    assert.equal(normalizeEmail('  Clement.S@Gmail.COM '), 'clement.s@gmail.com');
  });

  it('acceptent une adresse ordinaire', () => {
    assert.ok(isValidEmail('popy@bento-pop.com'));
    assert.ok(isValidEmail('a.b+bento@sous.domaine.fr'));
  });

  it('refusent une faute de frappe évidente', () => {
    for (const bad of ['', 'popy', 'popy@', '@bento-pop.com', 'popy@bento', 'po py@bento-pop.com', 'popy@bento-pop.c']) {
      assert.equal(isValidEmail(bad), false, bad);
    }
  });

  it('refusent plus de 254 caractères', () => {
    assert.equal(isValidEmail(`${'a'.repeat(250)}@b.fr`), false);
  });

  it('se masquent à la première lettre et au domaine (D13)', () => {
    assert.equal(maskEmail('clement@gmail.com'), 'c•••@gmail.com');
    assert.equal(maskEmail('a@x.fr'), 'a•••@x.fr');
  });
});

describe('le code', () => {
  it('ne garde que les chiffres, six au plus', () => {
    assert.equal(cleanCode(' 12 34-56 78'), '123456');
    assert.equal(cleanCode('12a3'), '123');
  });

  it('est complet à six chiffres', () => {
    assert.equal(CODE_LENGTH, 6);
    assert.ok(isCompleteCode('012345'));
    assert.equal(isCompleteCode('12345'), false);
    assert.equal(isCompleteCode('12345a'), false);
  });
});

describe('keptEmail', () => {
  it('rend l\'adresse d\'un compte gardé', () => {
    assert.equal(keptEmail({ is_anonymous: false, email: 'popy@bento-pop.com' }), 'popy@bento-pop.com');
  });

  /**
   * Une adresse demandée mais pas encore vérifiée vit dans `new_email` ; le
   * compte reste anonyme et `email` vide, mesuré contre la pile locale.
   */
  it('ne rend rien pour un compte anonyme, même avec une adresse en attente', () => {
    assert.equal(keptEmail({ is_anonymous: true, email: '' }), null);
    assert.equal(keptEmail({ is_anonymous: true, email: null }), null);
    assert.equal(keptEmail(null), null);
  });
});

describe('accountError', () => {
  const cases: [unknown, string][] = [
    [{ code: 'email_exists', status: 422 }, 'email-taken'],
    [{ code: 'otp_expired', status: 403 }, 'wrong-code'],
    [{ code: 'otp_disabled', status: 422 }, 'no-account'],
    [{ code: 'email_address_invalid', status: 400 }, 'invalid-email'],
    [
      {
        code: 'over_email_send_rate_limit',
        status: 429,
        message: 'For security purposes, you can only request this after 42 seconds.',
      },
      'too-soon',
    ],
    [{ code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' }, 'too-many'],
    [{ status: 500, code: 'unexpected_failure', message: 'Error sending magic link email' }, 'send-failed'],
    [{ name: 'AuthRetryableFetchError', status: 0, message: 'Network request failed' }, 'network'],
    [new TypeError('Network request failed'), 'network'],
    [{ status: 500, code: 'unexpected_failure', message: 'boom' }, 'unknown'],
    [null, 'unknown'],
  ];
  for (const [error, kind] of cases) {
    it(`${JSON.stringify(error) ?? String(error)} → ${kind}`, () => {
      assert.equal(accountError(error), kind);
    });
  }
});

describe('accountErrorMessage', () => {
  it('dit combien de secondes attendre quand le refus le donne', () => {
    const error = {
      code: 'over_email_send_rate_limit',
      status: 429,
      message: 'For security purposes, you can only request this after 42 seconds.',
    };
    assert.equal(waitSeconds(error), 42);
    assert.equal(accountErrorMessage(error), 'Attends encore 42 secondes avant de demander un nouveau code.');
  });

  it('accorde la seconde au singulier', () => {
    const error = { status: 429, message: 'you can only request this after 1 second.' };
    assert.equal(accountErrorMessage(error), 'Attends encore 1 seconde avant de demander un nouveau code.');
  });

  it("renvoie vers « J'ai déjà un compte » pour une adresse déjà gardée", () => {
    assert.match(accountErrorMessage({ code: 'email_exists' }), /J'ai déjà un compte/);
  });

  it('ne montre jamais le message technique', () => {
    assert.equal(accountErrorMessage({ status: 500, message: 'boom' }), "Ça n'a pas marché. Réessaie dans un instant.");
  });
});
