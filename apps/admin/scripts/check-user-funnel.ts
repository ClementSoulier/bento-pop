/**
 * Vérifie la couche de données de l'écran « Utilisateurs » contre la vraie
 * base.
 *
 * `user-funnel.test.ts` couvre les fonctions pures. Ce script couvre ce
 * qu'elles ne peuvent pas voir : la **forme des réponses PostgREST**. Le
 * comptage des cases passe par `bento_items(count)`, dont l'agrégat arrive
 * sous la forme `[{ count: n }]` ; un changement de forme donnerait zéro case
 * partout, sans la moindre erreur.
 *
 * L'écran étant derrière une authentification, c'est aussi la seule façon de
 * contrôler ses chiffres sans session d'administration.
 *
 *   set -a && . apps/admin/.env && set +a
 *   npx tsx apps/admin/scripts/check-user-funnel.ts
 */
import {
  buildOrphanRows,
  buildUserRows,
  computeFunnel,
  filterUsers,
  type AuthAccount,
  type BentoRow,
  type ProfileRow,
} from '../src/lib/user-funnel';

const URL_ = process.env.MOBILE_SUPABASE_URL;
const KEY = process.env.MOBILE_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error('MOBILE_SUPABASE_URL et MOBILE_SUPABASE_SERVICE_ROLE_KEY sont requis.');
  process.exit(1);
}
const headers = { apikey: KEY, authorization: `Bearer ${KEY}` };

/** Référence relevée le 12 septembre 2026. */
const EXPECTED = { installs: 106, members: 70, started: 56, published: 26, slots: 282 };

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok   ' : 'ECHEC'} ${label}${detail ? ` ${detail}` : ''}`);
  if (!ok) failures += 1;
};

async function main() {
  const accounts: AuthAccount[] = [];
  for (let page = 1; ; page += 1) {
    const res = await fetch(`${URL_}/auth/v1/admin/users?page=${page}&per_page=200`, { headers });
    const users = ((await res.json()) as { users?: { id: string; created_at: string }[] }).users ?? [];
    accounts.push(...users.map((u) => ({ id: u.id, createdAt: u.created_at })));
    if (users.length < 200) break;
  }

  const profiles = (await (
    await fetch(
      `${URL_}/rest/v1/users?select=id,pseudo,display_name,kind,created_at,last_seen_at,platform,app_version`,
      { headers },
    )
  ).json()) as ProfileRow[];

  const raw = (await (
    await fetch(`${URL_}/rest/v1/bentos?select=user_id,published_at,is_featured,bento_items(count)`, {
      headers,
    })
  ).json()) as { user_id: string; published_at: string | null; is_featured: boolean; bento_items: unknown }[];

  const bentos: BentoRow[] = raw.map((b) => ({
    user_id: b.user_id,
    published_at: b.published_at,
    is_featured: b.is_featured,
    slots: (b.bento_items as { count: number }[] | null)?.[0]?.count ?? 0,
  }));

  console.log(`écran Utilisateurs sur ${URL_}\n`);
  console.log('[entonnoir]');
  const funnel = computeFunnel(accounts, profiles, bentos);
  check('installations', funnel.installs === EXPECTED.installs, `${funnel.installs}`);
  check('membres', funnel.members === EXPECTED.members, `${funnel.members}`);
  check('bentos commencés', funnel.started === EXPECTED.started, `${funnel.started}`);
  check('bentos publiés', funnel.published === EXPECTED.published, `${funnel.published}`);
  check(
    'installations sans pseudo',
    funnel.orphans === EXPECTED.installs - EXPECTED.members,
    `${funnel.orphans}`,
  );

  console.log('\n[forme des réponses]');
  const rows = buildUserRows(profiles, bentos, new Set(accounts.map((a) => a.id)));
  const totalSlots = rows.reduce((sum, r) => sum + r.slots, 0);
  // Le contrôle qui compte : si l'agrégat changeait de forme, ce total
  // tomberait à zéro sans qu'aucune requête n'échoue.
  check("l'agrégat bento_items(count) est lu", totalSlots === EXPECTED.slots, `${totalSlots} cases`);
  check('une ligne par profil', rows.length === profiles.length, `${rows.length}`);
  check(
    'chaque ligne a un pseudo',
    rows.every((r) => r.pseudo.length > 0),
  );
  check(
    'le tri place les visites récentes en tête',
    rows.every(
      (r, i) => i === 0 || (rows[i - 1]!.lastSeenAt ?? rows[i - 1]!.createdAt) >= (r.lastSeenAt ?? r.createdAt),
    ),
  );

  const orphans = buildOrphanRows(accounts, profiles);
  check('les orphelins concordent', orphans.length === funnel.orphans, `${orphans.length}`);
  check(
    'aucun orphelin ne porte de profil',
    orphans.every((o) => !profiles.some((p) => p.id === o.id)),
  );

  console.log('\n[recherche]');
  const sample = rows[0]?.pseudo ?? '';
  check(
    'retrouve un pseudo existant',
    sample.length > 0 && filterUsers(rows, sample).some((r) => r.pseudo === sample),
    sample ? `@${sample}` : '',
  );
  check('rend tout sur une requête vide', filterUsers(rows, '').length === rows.length);

  console.log(failures === 0 ? '\nTout est vert.' : `\n${failures} contrôle(s) en échec.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
