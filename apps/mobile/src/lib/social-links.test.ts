import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleFromInput, isValidHandle, socialProfileUrl } from '@bento-pop/supabase-mobile/bento';
import {
  readHandleInput,
  shownNetworks,
  socialErrorFor,
  socialLinkHint,
  socialLinkLabel,
  toSocialLinks,
} from './social-links';

describe('une saisie réduite à un pseudo (D4)', () => {
  it('retire les blancs et les « @ », passe en minuscules', () => {
    assert.equal(handleFromInput('instagram', '  @@Lea_Cine '), 'lea_cine');
    assert.equal(handleFromInput('tiktok', '@Lea.Cine'), 'lea.cine');
  });

  it('lit une adresse de profil collée', () => {
    assert.equal(handleFromInput('instagram', 'https://www.instagram.com/lea_cine/'), 'lea_cine');
    assert.equal(handleFromInput('instagram', 'instagram.com/lea_cine?igsh=abc'), 'lea_cine');
    assert.equal(handleFromInput('instagram', 'https://m.instagram.com/Lea_Cine'), 'lea_cine');
    assert.equal(handleFromInput('tiktok', 'https://www.tiktok.com/@lea.cine?lang=fr'), 'lea.cine');
    assert.equal(handleFromInput('tiktok', 'tiktok.com/@Lea.Cine/video/123'), 'lea.cine');
  });

  it('une adresse d\'un autre réseau reste une saisie, refusée ensuite', () => {
    assert.equal(handleFromInput('tiktok', 'instagram.com/lea'), 'instagram.com/lea');
    assert.equal(readHandleInput('tiktok', 'instagram.com/lea').ok, false);
  });

  it('vide, rien', () => {
    assert.equal(handleFromInput('instagram', '   '), null);
    assert.equal(handleFromInput('instagram', '@'), null);
  });
});

describe('les formats des réseaux (§4.1)', () => {
  it('Instagram : 1 à 30 caractères, sans point en tête, en fin ni double', () => {
    for (const ok of ['a', 'lea_cine', 'lea.cine', 'x'.repeat(30), '_lea_']) assert.ok(isValidHandle('instagram', ok), ok);
    for (const ko of ['.lea', 'lea.', 'le..a', 'x'.repeat(31), 'lea cine', 'lea-cine', 'léa']) {
      assert.ok(!isValidHandle('instagram', ko), ko);
    }
  });

  it('TikTok : 2 à 24 caractères, sans point en fin', () => {
    for (const ok of ['ab', '.ab', 'lea.cine', 'y'.repeat(24)]) assert.ok(isValidHandle('tiktok', ok), ok);
    for (const ko of ['a', 'lea.', 'y'.repeat(25), 'lea/cine']) assert.ok(!isValidHandle('tiktok', ko), ko);
  });

  it('un champ refusé le dit sous lui', () => {
    assert.deepEqual(readHandleInput('instagram', 'lea.'), { ok: false, message: "Ce n'est pas un pseudo Instagram." });
    assert.deepEqual(readHandleInput('tiktok', 'a'), { ok: false, message: "Ce n'est pas un pseudo TikTok." });
    assert.deepEqual(readHandleInput('instagram', ''), { ok: true, handle: null });
    assert.deepEqual(readHandleInput('instagram', '@Lea_Cine'), { ok: true, handle: 'lea_cine' });
  });
});

describe('les adresses des profils (D5)', () => {
  it('Instagram et TikTok, chacun la sienne', () => {
    assert.equal(socialProfileUrl('instagram', 'lea_cine'), 'https://www.instagram.com/lea_cine/');
    assert.equal(socialProfileUrl('tiktok', 'lea.cine'), 'https://www.tiktok.com/@lea.cine');
  });
});

describe('ce que montre une page', () => {
  it('les réseaux qui ont un lien, Instagram d\'abord', () => {
    assert.deepEqual(shownNetworks({ instagram: 'a', tiktok: 'bb', visible: true }), [
      { network: 'instagram', handle: 'a' },
      { network: 'tiktok', handle: 'bb' },
    ]);
    assert.deepEqual(shownNetworks({ instagram: null, tiktok: 'bb', visible: true }), [{ network: 'tiktok', handle: 'bb' }]);
  });

  it('rien quand ils sont masqués, ou absents (D3, D11)', () => {
    assert.deepEqual(shownNetworks({ instagram: 'a', tiktok: 'bb', visible: false }), []);
    assert.deepEqual(shownNetworks(null), []);
    assert.equal(toSocialLinks(null), null);
  });

  it('le lecteur d\'écran nomme le réseau, le compte et le lien (D12)', () => {
    assert.equal(socialLinkLabel('instagram', 'lea.cine', 'lea_cine'), 'Instagram de @lea.cine : @lea_cine');
    assert.equal(socialLinkHint('tiktok'), 'Ouvre TikTok');
  });
});

describe('les refus de la base', () => {
  it('visent leur champ', () => {
    assert.deepEqual(socialErrorFor(new Error('social_invalid_tiktok')), {
      network: 'tiktok',
      message: "Ce n'est pas un pseudo TikTok.",
    });
    assert.deepEqual(socialErrorFor(new Error('social_filtered_instagram')), {
      network: 'instagram',
      message: "Ce pseudo n'est pas accepté.",
    });
  });

  it('ou l\'écran entier', () => {
    assert.equal(socialErrorFor(new Error('social_needs_profile')).message, 'Publie ton bento pour relier tes réseaux.');
    assert.equal(socialErrorFor(new Error('social_closed')).network, null);
    assert.match(socialErrorFor(new Error('fetch failed')).message, /Vérifie ta connexion/);
  });
});
