import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type AnnounceableEdition,
  announcementTtlSeconds,
  isAnnounceable,
  planAnnouncements,
} from './announce';

// Jeudi 24 septembre 2026, 18 h 05 à Paris.
const maintenant = new Date('2026-09-24T16:05:00Z');

const edition = (id: number, released_at: string | null, over: Partial<AnnounceableEdition> = {}) => ({
  id,
  slug: `edition-${id}`,
  title: `Édition ${id}`,
  released_at,
  announced_at: null,
  ...over,
});

describe('une édition s’annonce dans les 24 heures qui suivent sa sortie (D16)', () => {
  it('sortie depuis 5 minutes, elle s’annonce', () => {
    assert.equal(isAnnounceable(edition(1, '2026-09-24T16:00:00Z'), maintenant), true);
  });

  it('à la seconde de sa sortie, elle s’annonce', () => {
    // La lecture publique filtre `released_at <= now()` : même limite ici.
    assert.equal(isAnnounceable(edition(1, '2026-09-24T16:05:00Z'), maintenant), true);
  });

  it('programmée, pas encore', () => {
    assert.equal(isAnnounceable(edition(1, '2026-10-01T16:00:00Z'), maintenant), false);
  });

  it('brouillon, jamais', () => {
    assert.equal(isAnnounceable(edition(1, null), maintenant), false);
  });

  it('sortie depuis 25 heures, plus jamais', () => {
    assert.equal(isAnnounceable(edition(1, '2026-09-23T15:05:00Z'), maintenant), false);
  });

  it('déjà annoncée, plus jamais', () => {
    const e = edition(1, '2026-09-24T16:00:00Z', { announced_at: '2026-09-24T16:00:30Z' });
    assert.equal(isAnnounceable(e, maintenant), false);
  });

  it('une date illisible ne s’annonce pas', () => {
    assert.equal(isAnnounceable(edition(1, 'jeudi'), maintenant), false);
  });
});

describe('deux éditions dues au même battement', () => {
  it('la plus récente s’annonce, l’autre est marquée sans envoi', () => {
    const plan = planAnnouncements(
      [edition(1, '2026-09-24T08:00:00Z'), edition(2, '2026-09-24T16:00:00Z'), edition(3, null)],
      maintenant,
    );
    assert.equal(plan.announce?.id, 2);
    assert.deepEqual(plan.skip.map((e) => e.id), [1]);
  });

  it('rien de dû, rien à faire', () => {
    const plan = planAnnouncements([edition(1, '2026-10-01T16:00:00Z')], maintenant);
    assert.deepEqual(plan, { announce: null, skip: [] });
  });
});

describe('la durée de vie de l’annonce', () => {
  it('jusqu’à la fin de la fenêtre', () => {
    // Sortie à 18 h 00, annoncée à 18 h 05 : il reste 23 h 55.
    assert.equal(announcementTtlSeconds('2026-09-24T16:00:00Z', maintenant), 23 * 3600 + 55 * 60);
  });

  it('jamais moins d’une minute', () => {
    assert.equal(announcementTtlSeconds('2026-09-23T16:05:00Z', maintenant), 60);
  });
});
