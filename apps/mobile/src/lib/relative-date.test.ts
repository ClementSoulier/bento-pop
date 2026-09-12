import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { relativeDate } from './relative-date';

/** Horloge de référence fixe : les tests ne doivent pas dépendre du jour. */
const NOW = Date.parse('2026-09-11T12:00:00.000Z');

/** Date à `ms` millisecondes avant `NOW`. */
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

describe('relativeDate', () => {
  it('rend « à l’instant » sous la minute', () => {
    assert.equal(relativeDate(ago(0), NOW), "à l'instant");
    assert.equal(relativeDate(ago(59 * SECOND), NOW), "à l'instant");
  });

  it('bascule en minutes à 60 s', () => {
    assert.equal(relativeDate(ago(60 * SECOND), NOW), 'il y a 1 min');
    assert.equal(relativeDate(ago(59 * MINUTE), NOW), 'il y a 59 min');
  });

  it('bascule en heures à 60 min', () => {
    assert.equal(relativeDate(ago(60 * MINUTE), NOW), 'il y a 1 h');
    assert.equal(relativeDate(ago(23 * HOUR + 59 * MINUTE), NOW), 'il y a 23 h');
  });

  /**
   * `hier` absorbe toute la tranche 24h-48h. « il y a 1 jour » ne doit jamais
   * sortir : c'est la formulation qu'un lecteur trouve maladroite et qu'il
   * « corrigerait » en supprimant la branche `hier`.
   */
  it('bascule sur « hier » à 24 h et jamais sur « il y a 1 jour »', () => {
    assert.equal(relativeDate(ago(DAY), NOW), 'hier');
    assert.equal(relativeDate(ago(DAY + HOUR), NOW), 'hier');
    assert.equal(relativeDate(ago(2 * DAY - SECOND), NOW), 'hier');

    for (let ms = DAY; ms < 8 * DAY; ms += HOUR) {
      assert.notEqual(relativeDate(ago(ms), NOW), 'il y a 1 jour');
    }
  });

  it('bascule en jours à 48 h', () => {
    assert.equal(relativeDate(ago(2 * DAY), NOW), 'il y a 2 jours');
    assert.equal(relativeDate(ago(6 * DAY + 23 * HOUR), NOW), 'il y a 6 jours');
  });

  it('bascule en semaines à 7 jours, avec le bon pluriel', () => {
    assert.equal(relativeDate(ago(WEEK), NOW), 'il y a 1 semaine');
    assert.equal(relativeDate(ago(2 * WEEK), NOW), 'il y a 2 semaines');
    assert.equal(relativeDate(ago(5 * WEEK - SECOND), NOW), 'il y a 4 semaines');
  });

  it('bascule en mois à 5 semaines', () => {
    assert.equal(relativeDate(ago(5 * WEEK), NOW), 'il y a 1 mois');
    assert.equal(relativeDate(ago(120 * DAY), NOW), 'il y a 4 mois');
  });

  /**
   * Les années se dérivent des mois. Une division indépendante par 365 jours
   * rendrait « il y a 0 an » sur la tranche 360-365 jours, puisque douze mois
   * de 30 jours n'en font que 360.
   */
  it('ne rend jamais « il y a 0 an » à la bascule des années', () => {
    assert.equal(relativeDate(ago(360 * DAY), NOW), 'il y a 1 an');
    assert.equal(relativeDate(ago(364 * DAY), NOW), 'il y a 1 an');
    assert.equal(relativeDate(ago(365 * DAY), NOW), 'il y a 1 an');
    assert.equal(relativeDate(ago(730 * DAY), NOW), 'il y a 2 ans');
  });

  /**
   * Balayage complet de deux ans. Le pas est la minute sur les trois
   * premières heures, puis l'heure : un pas horaire uniforme enjamberait
   * entièrement le palier des minutes, qui ne couvre que [60 s, 60 min[.
   *
   * Aucune borne ne doit laisser passer une chaîne vide, un `NaN` ou une forme
   * non prévue, et chacun des huit paliers doit être atteint : c'est ce qui
   * garantit qu'un réglage de borne n'en a pas rendu un inaccessible.
   */
  it('couvre les huit paliers sans trou sur deux ans', () => {
    const TIERS: readonly (readonly [string, RegExp])[] = [
      ['instant', /^à l'instant$/],
      ['minutes', /^il y a \d+ min$/],
      ['heures', /^il y a \d+ h$/],
      ['hier', /^hier$/],
      ['jours', /^il y a [2-6] jours$/],
      ['semaines', /^il y a [1-4] semaines?$/],
      ['mois', /^il y a \d+ mois$/],
      ['années', /^il y a \d+ ans?$/],
    ];
    const seen = new Set<string>();

    for (let ms = 0; ms < 730 * DAY; ms += ms < 3 * HOUR ? MINUTE : HOUR) {
      const value = relativeDate(ago(ms), NOW);
      const tier = TIERS.find(([, pattern]) => pattern.test(value));
      assert.ok(tier, `forme inattendue à ${ms / HOUR} h : « ${value} »`);
      assert.ok(!value.includes('NaN'), `NaN à ${ms / HOUR} h`);
      seen.add(tier[0]);
    }

    assert.deepEqual(
      TIERS.map(([name]) => name).filter((name) => !seen.has(name)),
      [],
      'paliers jamais atteints',
    );
  });

  it('ramène une date future à « à l’instant »', () => {
    assert.equal(relativeDate(new Date(NOW + 3 * MINUTE).toISOString(), NOW), "à l'instant");
    assert.equal(relativeDate(new Date(NOW + 10 * DAY).toISOString(), NOW), "à l'instant");
  });

  it('rend une chaîne vide sur une entrée inexploitable', () => {
    assert.equal(relativeDate('', NOW), '');
    assert.equal(relativeDate('pas une date', NOW), '');
  });

  it('accepte la forme exacte renvoyée par PostgREST', () => {
    // Décalage `+00:00` explicite plutôt que `Z`, six décimales : c'est ce que
    // PostgREST sérialise pour un `timestamptz`. Écart choisi loin d'une
    // borne, pour que le test porte sur l'analyse de la chaîne et non sur un
    // arrondi.
    assert.equal(relativeDate('2026-09-11T08:00:00.227431+00:00', NOW), 'il y a 3 h');
  });
});
