import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { POPY_KEYS } from '@bento-pop/supabase-mobile/bento';
import type { NotificationRow } from '@/supabase/types';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_KEYS,
  LONGEST_WORD_WIDTH,
  MEDAL_GAP,
  achievementLabel,
  isAchievementKey,
  medalGrid,
  shownAchievements,
} from './achievements';
import { toNotification, type NotificationViewer } from './notifications';

/**
 * Les succès du chantier 27, sans réseau ni React : le catalogue d'accord avec
 * la base, les médailles d'un compte, leur grille, et « Notifs ».
 *
 * **Le catalogue se compare au SQL**, comme les cases de
 * `bento-cases-vs-app.test.ts` : la base refuse toute clé hors de sa liste, et
 * une clé qu'elle poserait sans que l'app la connaisse ne s'afficherait pas.
 */

const MIGRATION = join(__dirname, '..', '..', 'supabase', 'migrations', '20261027400000_achievements.sql');

function keysOfSql(): string[] {
  const sql = readFileSync(MIGRATION, 'utf8');
  const check = /key text not null check \(key in \(([^)]*)\)\)/.exec(sql);
  assert.ok(check?.[1], 'la liste des clés est introuvable dans la migration');
  return [...check[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? '');
}

describe('le catalogue (D4, D6)', () => {
  it('a les clés de la base, dans le même ordre', () => {
    assert.deepEqual([...ACHIEVEMENT_KEYS], keysOfSql());
  });

  it('nomme chaque médaille, dit ce qu\'elle dit, et lui donne un Popy', () => {
    for (const key of ACHIEVEMENT_KEYS) {
      const meta = ACHIEVEMENTS[key];
      assert.ok(meta.title.length > 0 && meta.description.length > 0, key);
      assert.ok((POPY_KEYS as readonly string[]).includes(meta.popy), key);
    }
    assert.equal(new Set(ACHIEVEMENT_KEYS.map((k) => ACHIEVEMENTS[k].title)).size, ACHIEVEMENT_KEYS.length);
  });

  it('reconnaît ses clés, pas les autres', () => {
    assert.ok(isAchievementKey('first_bento'));
    assert.ok(!isAchievementKey('first_like'));
    assert.ok(!isAchievementKey(null));
  });
});

describe('les médailles d\'un compte (D11, D22)', () => {
  it('dans l\'ordre du catalogue, quelle que soit leur date', () => {
    const shown = shownAchievements([
      { key: 'first_follower', unlocked_at: '2026-10-01T00:00:00Z' },
      { key: 'first_item', unlocked_at: '2026-09-01T00:00:00Z' },
      { key: 'first_bento', unlocked_at: '2026-10-20T00:00:00Z' },
    ]);
    assert.deepEqual(shown.map((m) => m.key), ['first_bento', 'first_item', 'first_follower']);
    assert.equal(shown[0]?.title, 'Premier bento');
    assert.equal(shown[0]?.unlockedAt, '2026-10-20T00:00:00Z');
  });

  it('saute une clé inconnue, et ne montre une médaille qu\'une fois', () => {
    const shown = shownAchievements([
      { key: 'first_like', unlocked_at: '2026-10-01T00:00:00Z' },
      { key: 'first_bento', unlocked_at: '2026-10-02T00:00:00Z' },
      { key: 'first_bento', unlocked_at: '2026-10-03T00:00:00Z' },
    ]);
    assert.deepEqual(shown.map((m) => [m.key, m.unlockedAt]), [['first_bento', '2026-10-02T00:00:00Z']]);
  });

  it('rien sans succès, ni avant la réponse', () => {
    assert.deepEqual(shownAchievements([]), []);
    assert.deepEqual(shownAchievements(undefined), []);
    assert.deepEqual(shownAchievements(null), []);
  });

  it('le lecteur d\'écran lit le nom et ce qu\'elle dit (D12)', () => {
    assert.equal(achievementLabel('first_bento'), 'Premier bento : un bento publié');
    assert.equal(achievementLabel('first_item'), "Défricheur : un item validé par l'équipe");
    assert.equal(achievementLabel('same_item_ten'), 'Inconditionnel : le même item dans dix bentos');
  });
});

describe('la grille des médailles', () => {
  const total = (g: { columns: number; medalWidth: number }) => g.columns * g.medalWidth + (g.columns - 1) * MEDAL_GAP;

  // Les largeurs mesurées dans le cadre, à la taille de texte par défaut.
  const PRO = 301;
  const SE = 273;

  it('trois par rangée au 17 Pro, deux au SE', () => {
    assert.equal(medalGrid(PRO, 1).columns, 3);
    assert.equal(medalGrid(SE, 1).columns, 2);
  });

  it('ne coupe jamais « Inconditionnel », du SE au plus large, texte agrandi compris', () => {
    for (let width = SE; width <= 420; width += 1) {
      for (const scale of [1, 1.1, 1.2, 1.3, 1.4]) {
        const g = medalGrid(width, scale);
        assert.ok(g.medalWidth >= LONGEST_WORD_WIDTH * scale, `${width} pt à ${scale} : ${g.medalWidth} pt`);
        assert.ok(total(g) <= width, `${width} pt à ${scale}`);
      }
    }
  });

  it('deux quand le texte grandit, jamais moins', () => {
    assert.equal(medalGrid(PRO, 1.4).columns, 2);
    assert.equal(medalGrid(200, 1.4).columns, 2);
  });

  it('quatre au plus, même large', () => {
    assert.equal(medalGrid(800, 1).columns, 4);
  });
});

describe('« Notifs » (D14)', () => {
  const viewer: NotificationViewer = { id: 'f0e1d2c3-b4a5-4968-8776-655443322110', pseudo: 'alice' };
  const row = (detail: string | null): NotificationRow => ({
    kind: 'achievement',
    group_key: `achievement:${detail}`,
    is_new: true,
    latest_at: '2026-10-27T10:00:00.000Z',
    events: 1,
    actors: 0,
    actor_pseudos: [],
    actor_avatar: null,
    bento_id: null,
    bento_slug: null,
    bento_primary: null,
    edition_title: null,
    owner_pseudo: null,
    item_id: null,
    kept_item_id: null,
    item_status: null,
    item_titles: [],
    detail,
  });

  it('« Succès débloqué », le Popy de la médaille, et sa page', () => {
    const n = toNotification(row('five_items'), viewer);
    assert.equal(n.text, 'Succès débloqué : Éclaireur');
    assert.deepEqual(n.avatar, { kind: 'achievement', popy: 'nani' });
    assert.deepEqual(n.target, { kind: 'page', href: '/u/alice' });
  });

  it('une clé inconnue se lit sans son nom', () => {
    const n = toNotification(row('first_like'), viewer);
    assert.equal(n.text, 'Nouveau succès débloqué');
    assert.deepEqual(n.avatar, { kind: 'team' });
    assert.deepEqual(n.target, { kind: 'page', href: '/u/alice' });
  });
});
