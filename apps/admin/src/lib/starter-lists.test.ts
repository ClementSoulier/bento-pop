import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeTitle } from './catalogue-types';
import { starterExternalId } from './starter-import';
import { STARTER_LISTS, STARTER_TYPE_KEYS } from './starter-lists';

describe('listes de départ', () => {
  it('couvrent les quatre nouveaux types', () => {
    assert.deepEqual(Object.keys(STARTER_LISTS).sort(), [...STARTER_TYPE_KEYS].sort());
  });

  for (const typeKey of STARTER_TYPE_KEYS) {
    const list = STARTER_LISTS[typeKey];

    describe(typeKey, () => {
      it('propose une centaine de candidats, pour viser 50 validés', () => {
        assert.ok(list.length >= 100 && list.length <= 130, `${list.length} candidats`);
      });

      it('ne contient aucun doublon, une fois les titres normalisés', () => {
        const seen = new Map<string, string>();
        for (const { title } of list) {
          const normalized = normalizeTitle(title);
          assert.ok(!seen.has(normalized), `« ${title} » double « ${seen.get(normalized)} »`);
          seen.set(normalized, title);
        }
      });

      it('donne à chaque candidat un identifiant stable et distinct', () => {
        const ids = list.map((c) => starterExternalId(typeKey, c.title));
        assert.equal(new Set(ids).size, ids.length);
        for (const id of ids) {
          assert.match(id, new RegExp(`^starter:${typeKey}:[a-z0-9]+(-[a-z0-9]+)*$`), id);
        }
      });

      it('écrit des titres et sous-titres propres', () => {
        for (const { title, subtitle } of list) {
          assert.equal(title, title.trim(), `espaces autour de « ${title} »`);
          assert.ok(title.length > 0 && title.length <= 120, `longueur de « ${title} »`);
          assert.doesNotMatch(title, /\u2014|\s{2}/, `« ${title} »`);
          if (subtitle !== undefined) {
            assert.equal(subtitle, subtitle.trim(), `espaces autour de « ${subtitle} »`);
            assert.ok(subtitle.length > 0, `sous-titre vide pour « ${title} »`);
            assert.doesNotMatch(subtitle, /\u2014|\s{2}/, `« ${subtitle} »`);
          }
        }
      });
    });
  }

  it('ne donne un sous-titre qu’aux jeux et aux livres', () => {
    assert.ok(STARTER_LISTS.dish.every((c) => c.subtitle === undefined));
    assert.ok(STARTER_LISTS.activity.every((c) => c.subtitle === undefined));
  });
});
