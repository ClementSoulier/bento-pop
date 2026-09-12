/**
 * Vérifie la migration `20260913000000_admin_users.sql` contre la vraie base.
 *
 * Cette migration retire une clé étrangère sur la table d'identité. C'est
 * l'opération la plus risquée faite jusqu'ici sur ce schéma : dix-sept
 * politiques RLS reposent sur l'égalité entre `users.id` et `auth.uid()`, et
 * une erreur ici se traduirait soit par une fuite, soit par une app muette.
 *
 * Le script fait donc trois choses, dans cet ordre :
 *
 *   1. il **compare les comptages** à la référence d'avant migration, pour
 *      qu'une cascade inattendue ne passe pas inaperçue ;
 *   2. il **rejoue les lectures publiques avec la clé anonyme**, c'est-à-dire
 *      exactement ce que fait l'app, pour vérifier que la RLS n'a pas bougé ;
 *   3. il **crée puis supprime un profil éditorial**, pour prouver qu'un
 *      profil peut exister sans compte d'authentification et que le compteur
 *      `auth.users` n'augmente pas (critère C7).
 *
 *   set -a && . apps/admin/.env && set +a
 *   TARGET="$MOBILE_SUPABASE_URL" \
 *   SERVICE_KEY="$MOBILE_SUPABASE_SERVICE_ROLE_KEY" \
 *   ANON_KEY="$MOBILE_SUPABASE_ANON_KEY" \
 *     node apps/mobile/scripts/check-admin-users.mjs
 *
 * `ANON_KEY` est facultative : sans elle, les contrôles de RLS sont sautés
 * et signalés comme tels plutôt que passés sous silence.
 */
const TARGET = process.env.TARGET;
const SERVICE_KEY = process.env.SERVICE_KEY;
const ANON_KEY = process.env.ANON_KEY;

if (!TARGET || !SERVICE_KEY) {
  console.error('TARGET et SERVICE_KEY sont requis. Voir le docblock.');
  process.exit(1);
}

/** Comptages relevés le 12 septembre 2026, juste avant application. */
const BEFORE = {
  auth_users: 106,
  users: 70,
  bentos: 56,
  bento_items: 282,
  items: 324,
  reports: 3,
};

const svc = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` };
const anon = ANON_KEY ? { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}` } : null;

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok   ' : 'ECHEC'} ${label}${detail ? ` ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const skip = (label, why) => console.log(`  passe ${label} (${why})`);

/** Compte les lignes d'une table. `key` doit exister : `bento_items` n'a pas d'`id`. */
async function count(table, key = 'id') {
  const res = await fetch(`${TARGET}/rest/v1/${table}?select=${key}`, {
    headers: { ...svc, Prefer: 'count=exact', Range: '0-0' },
  });
  return Number((res.headers.get('content-range') ?? '').split('/')[1]);
}

async function countAuthUsers() {
  let page = 1;
  let total = 0;
  // Paginer même à 106 comptes : sans ça le compteur se figerait
  // silencieusement à la taille de page le jour où la base grossira.
  for (;;) {
    const res = await fetch(`${TARGET}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: svc,
    });
    const users = (await res.json()).users ?? [];
    total += users.length;
    if (users.length < 200) return total;
    page += 1;
  }
}

async function main() {
  console.log(`migration admin_users sur ${TARGET}\n`);

  console.log('[schéma]');
  const sample = await (
    await fetch(`${TARGET}/rest/v1/users?select=*&limit=1`, { headers: svc })
  ).json();
  const columns = Object.keys(sample[0] ?? {});
  if (columns.length === 0) {
    console.error('Aucun profil en base, impossible de lire les colonnes.');
    process.exit(1);
  }
  for (const col of ['kind', 'last_seen_at', 'platform', 'app_version']) {
    check(`colonne users.${col}`, columns.includes(col));
  }
  check(
    'les profils existants sont des membres',
    sample[0].kind === 'member',
    `kind = ${JSON.stringify(sample[0].kind)}`,
  );

  const deletions = await fetch(`${TARGET}/rest/v1/user_deletions?select=id&limit=1`, {
    headers: svc,
  });
  check('table user_deletions', deletions.ok, `HTTP ${deletions.status}`);

  const purge = await fetch(`${TARGET}/rest/v1/rpc/purge_user_deletions`, {
    method: 'POST',
    headers: { ...svc, 'content-type': 'application/json' },
    body: '{}',
  });
  check('fonction purge_user_deletions', purge.ok, `HTTP ${purge.status}`);

  console.log('\n[comptages, avant → après]');
  const after = {
    auth_users: await countAuthUsers(),
    users: await count('users'),
    bentos: await count('bentos'),
    bento_items: await count('bento_items', 'bento_id'),
    items: await count('items'),
    reports: await count('reports'),
  };
  for (const [table, before] of Object.entries(BEFORE)) {
    check(table, after[table] === before, `${before} → ${after[table]}`);
  }

  console.log('\n[RLS inchangée, vue par la clé anonyme]');
  if (!anon) {
    skip('lectures publiques', 'ANON_KEY absente');
  } else {
    const publicBentos = await fetch(
      `${TARGET}/rest/v1/bentos?select=id&published_at=not.is.null`,
      { headers: anon },
    );
    const list = await publicBentos.json();
    check(
      'les bentos publiés restent lisibles',
      Array.isArray(list) && list.length > 0,
      `${Array.isArray(list) ? list.length : '?'} lignes`,
    );

    const drafts = await (
      await fetch(`${TARGET}/rest/v1/bentos?select=id,published_at`, { headers: anon })
    ).json();
    check(
      'les brouillons restent masqués',
      Array.isArray(drafts) && drafts.every((b) => b.published_at !== null),
      `${Array.isArray(drafts) ? drafts.length : '?'} lignes visibles`,
    );

    const registry = await (
      await fetch(`${TARGET}/rest/v1/user_deletions?select=id`, { headers: anon })
    ).json();
    // RLS activée sans policy : résultat vide, pas d'erreur.
    check(
      'le registre de suppression est invisible',
      Array.isArray(registry) && registry.length === 0,
      Array.isArray(registry) ? `${registry.length} lignes` : JSON.stringify(registry).slice(0, 60),
    );

    const forbidden = await fetch(`${TARGET}/rest/v1/rpc/purge_user_deletions`, {
      method: 'POST',
      headers: { ...anon, 'content-type': 'application/json' },
      body: '{}',
    });
    check('la purge est refusée en anonyme', !forbidden.ok, `HTTP ${forbidden.status}`);
  }

  console.log('\n[profil éditorial : le cœur de la migration]');
  const authBefore = after.auth_users;
  const pseudo = `verif${Date.now().toString().slice(-8)}`;
  const created = await fetch(`${TARGET}/rest/v1/users`, {
    method: 'POST',
    headers: { ...svc, 'content-type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ pseudo, display_name: 'Vérification', kind: 'editorial' }),
  });
  const body = await created.json();
  const profile = Array.isArray(body) ? body[0] : null;
  check(
    'un profil se crée sans compte d\'authentification',
    created.ok && Boolean(profile?.id),
    created.ok ? `id ${profile?.id}` : JSON.stringify(body).slice(0, 140),
  );

  if (profile?.id) {
    check(
      'auth.users n\'a pas bougé',
      (await countAuthUsers()) === authBefore,
      `${authBefore} attendu`,
    );

    // La contrainte doit refuser des CGU sur un profil sans compte.
    const terms = await fetch(`${TARGET}/rest/v1/users?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers: { ...svc, 'content-type': 'application/json' },
      body: JSON.stringify({ terms_accepted_at: new Date().toISOString() }),
    });
    check('un profil éditorial refuse des CGU acceptées', !terms.ok, `HTTP ${terms.status}`);

    const gone = await fetch(`${TARGET}/rest/v1/users?id=eq.${profile.id}`, {
      method: 'DELETE',
      headers: svc,
    });
    check('le profil de vérification est supprimé', gone.ok, `HTTP ${gone.status}`);
    check('users revient à son compte initial', (await count('users')) === BEFORE.users);
  }

  console.log(failures === 0 ? '\nTout est vert.' : `\n${failures} contrôle(s) en échec.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
