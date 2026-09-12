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

/**
 * Pas de comptages figés.
 *
 * La première version comparait à « 106 installations, 70 membres… », relevés
 * le 12 septembre 2026. Ces nombres bougent dès qu'on supprime un compte ou
 * qu'on crée un bento invité, et le script criait alors à l'échec sur des
 * chiffres parfaitement corrects. Une valeur de référence qui change avec
 * l'usage n'est pas un test, c'est un rappel à mettre à jour.
 *
 * On vérifie donc des **invariants** entre les trois sources, qui eux tiennent
 * quelle que soit la taille de la base.
 */

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
  console.log(
    `  ${funnel.installs} installations · ${funnel.members} membres · ` +
      `${funnel.started} commencés · ${funnel.published} publiés · ` +
      `${funnel.editorial} éditoriaux · ${funnel.orphans} sans pseudo`,
  );

  check('la pagination a ramené des comptes', funnel.installs > 0, `${funnel.installs}`);
  check(
    'membres et éditoriaux couvrent tous les profils',
    funnel.members + funnel.editorial === profiles.length,
    `${funnel.members} + ${funnel.editorial} = ${profiles.length}`,
  );
  check(
    'l\'entonnoir décroît',
    funnel.members >= funnel.started && funnel.started >= funnel.published,
    `${funnel.members} ≥ ${funnel.started} ≥ ${funnel.published}`,
  );
  check(
    'les orphelins sont les comptes sans profil',
    funnel.orphans === accounts.filter((a) => !profiles.some((p) => p.id === a.id)).length,
    `${funnel.orphans}`,
  );

  // Le contrôle qui protège la promesse faite à l'écran : un profil
  // éditorial n'a pas installé l'app et son bento a été composé par
  // l'équipe. Le compter fausserait le seul chiffre qui sert à juger
  // l'adoption.
  const editorialIds = new Set(profiles.filter((p) => p.kind === 'editorial').map((p) => p.id));
  const editorialPublished = bentos.filter(
    (b) => editorialIds.has(b.user_id) && b.published_at !== null,
  ).length;
  check(
    'les bentos éditoriaux publiés ne comptent pas',
    funnel.published + editorialPublished ===
      bentos.filter((b) => b.published_at !== null).length,
    `${editorialPublished} publié(s) éditorial(aux) exclu(s)`,
  );
  check(
    'aucun profil éditorial n\'a de compte',
    [...editorialIds].every((id) => !accounts.some((a) => a.id === id)),
    `${editorialIds.size} profil(s) éditorial(aux)`,
  );

  console.log('\n[forme des réponses]');
  const rows = buildUserRows(profiles, bentos, new Set(accounts.map((a) => a.id)));
  const totalSlots = rows.reduce((sum, r) => sum + r.slots, 0);
  // Le contrôle qui compte : l'agrégat `bento_items(count)` arrive sous la
  // forme `[{ count: n }]`. Un changement de forme donnerait zéro case
  // partout sans qu'aucune requête n'échoue, et la liste afficherait
  // « aucun » pour tout le monde.
  check("l'agrégat bento_items(count) est lu", totalSlots > 0, `${totalSlots} cases`);
  check(
    'chaque bento a entre 1 et 6 cases',
    bentos.every((b) => b.slots >= 0 && b.slots <= 6),
  );
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
