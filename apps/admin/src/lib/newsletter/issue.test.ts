import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkIssue,
  checkSchedule,
  fillUnsubscribe,
  formatParisDate,
  hasBlockingError,
  injectPreheader,
  renderIssue,
  type IssueContent,
} from './issue';

const HTML =
  '<!DOCTYPE html><html><head><title>N°01</title></head><body style="margin:0"><p>Salut</p>' +
  '<a href="{{desinscription}}">Se désinscrire</a></body></html>';

const ok: IssueContent = {
  subject: 'Le bento de la semaine',
  preheader: 'Openings, manga et Toulouse',
  html: HTML,
  text: 'Salut\n\nSe désinscrire : {{desinscription}}',
};

describe('rendu d’un numéro', () => {
  it('remplace chaque repère, espaces tolérés, et rien d’autre', () => {
    const html = '<a href="{{desinscription}}">a</a><a href="{{ desinscription }}">b</a>{{autre}}';
    assert.equal(
      fillUnsubscribe(html, 'https://x.test/u'),
      '<a href="https://x.test/u">a</a><a href="https://x.test/u">b</a>{{autre}}',
    );
  });

  it('ne lit pas le lien comme un motif de remplacement', () => {
    assert.equal(fillUnsubscribe('{{desinscription}}', '$&$1'), '$&$1');
  });

  it('glisse le texte d’aperçu juste après <body>, échappé', () => {
    const out = injectPreheader(HTML, 'Tom & Jerry <3');
    const at = out.indexOf('<body style="margin:0">') + '<body style="margin:0">'.length;
    assert.ok(out.slice(at).startsWith('<div style="display:none;'));
    assert.ok(out.includes('Tom &amp; Jerry &lt;3'));
    assert.ok(out.endsWith('<p>Salut</p><a href="{{desinscription}}">Se désinscrire</a></body></html>'));
  });

  it('laisse le HTML intact sans texte d’aperçu', () => {
    assert.equal(injectPreheader(HTML, '   '), HTML);
  });

  it('met l’aperçu en tête d’un HTML sans <body>', () => {
    assert.ok(injectPreheader('<table></table>', 'Hop').startsWith('<div style="display:none;'));
  });

  it('rend le HTML et le texte avec le lien donné', () => {
    const { html, text } = renderIssue(ok, '{{{RESEND_UNSUBSCRIBE_URL}}}');
    assert.ok(html.includes('href="{{{RESEND_UNSUBSCRIBE_URL}}}"'));
    assert.ok(text.endsWith('Se désinscrire : {{{RESEND_UNSUBSCRIBE_URL}}}'));
    assert.ok(!html.includes('{{desinscription}}'));
  });
});

describe('contrôles d’avant envoi', () => {
  it('ne signale rien sur un numéro complet', () => {
    assert.deepEqual(checkIssue(ok), []);
  });

  it('bloque sans objet, sans HTML ou sans lien de désinscription', () => {
    assert.ok(hasBlockingError(checkIssue({ ...ok, subject: ' ' })));
    assert.ok(hasBlockingError(checkIssue({ ...ok, html: '' })));
    const noLink = checkIssue({ ...ok, html: '<body>Salut</body>' });
    assert.ok(hasBlockingError(noLink));
    assert.match(noLink[0]?.message ?? '', /\{\{desinscription\}\}/);
  });

  it('avertit des images de /_next/, sans bloquer', () => {
    const html = HTML.replace(
      '<p>Salut</p>',
      '<img src="https://bento-pop.com/_next/static/media/popy.png"><img src="https://bento-pop.com/_next/image?url=x">',
    );
    const checks = checkIssue({ ...ok, html });
    assert.equal(hasBlockingError(checks), false);
    assert.match(checks[0]?.message ?? '', /^2 images chargées depuis \/_next\//);
  });

  it('avertit au-delà de 100 Ko, le poids de Gmail', () => {
    const big = HTML.replace('<p>Salut</p>', `<p>${'é'.repeat(50_100)}</p>`);
    assert.ok(checkIssue({ ...ok, html: big }).some((c) => /Gmail le coupe/.test(c.message)));
    const small = HTML.replace('<p>Salut</p>', `<p>${'e'.repeat(90_000)}</p>`);
    assert.ok(!checkIssue({ ...ok, html: small }).some((c) => /Gmail/.test(c.message)));
  });

  it('avertit d’une version texte vide ou sans lien', () => {
    assert.match(checkIssue({ ...ok, text: '' })[0]?.message ?? '', /version texte est vide/);
    assert.match(checkIssue({ ...ok, text: 'Salut' })[0]?.message ?? '', /version texte ne contient pas/);
  });

  it('repère un fichier mal encodé', () => {
    const checks = checkIssue({ ...ok, html: HTML.replace('Salut', 'L�a Yuna') });
    assert.ok(checks.some((c) => /UTF-8/.test(c.message)));
  });

  it('repère un bloc d’aperçu déjà présent quand le champ est rempli', () => {
    const html = HTML.replace('<p>Salut</p>', '<div style="display:none;max-height:0">Déjà là</div><p>Salut</p>');
    assert.ok(checkIssue({ ...ok, html }).some((c) => /bloc d’aperçu/.test(c.message)));
    assert.ok(!checkIssue({ ...ok, html, preheader: '' }).some((c) => /bloc d’aperçu/.test(c.message)));
  });
});

describe('programmation', () => {
  const now = Date.parse('2026-12-05T08:00:00Z');

  it('accepte entre 10 minutes et 30 jours', () => {
    assert.equal(checkSchedule('2026-12-05T08:10:00Z', now), null);
    assert.equal(checkSchedule('2027-01-04T08:00:00Z', now), null);
  });

  it('refuse trop tôt, trop tard ou illisible', () => {
    assert.match(checkSchedule('2026-12-05T08:09:00Z', now) ?? '', /10 minutes/);
    assert.match(checkSchedule('2027-01-04T08:01:00Z', now) ?? '', /30 jours/);
    assert.match(checkSchedule('demain', now) ?? '', /invalide/);
  });

  it('dit la date à l’heure de Paris', () => {
    assert.equal(formatParisDate('2026-12-05T08:00:00Z'), 'samedi 5 décembre 2026 à 09:00');
    assert.equal(formatParisDate(null), '');
  });
});
