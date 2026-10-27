/**
 * Contrôles « suivre un compte », chantier 23, lot 1.
 *
 * Contre un Supabase **local**, jamais la production : le script refuse toute
 * cible qui n'est pas sur 127.0.0.1 ou localhost. Il passe par le vrai
 * `supabase-js`, à la clé anonyme, avec de vrais comptes : ce qu'il garde vit
 * dans les fonctions, les droits et les règles de la base.
 *
 *   eval "$(supabase status -o env --workdir <dossier> | sed 's/^/export /')"
 *   TARGET="$API_URL" ANON_KEY="$ANON_KEY" SERVICE_KEY="$SERVICE_ROLE_KEY" \
 *   node scripts/check-follows.mjs
 *
 * Chaque « ok » est un comportement tenu, chaque « ECHEC » un défaut ; le
 * décompte final doit annoncer zéro échec. Tout ce que le script crée,
 * comptes, profils et bentos, est retiré à la fin, même après un échec.
 *
 * Ce que ces contrôles gardent, §6, §7.1 et §10 de la spécification :
 *
 *    1. suivre et ne plus suivre ; un profil requis ; jamais soi-même ni un
 *       inconnu ; aucune lecture ni écriture directe (D4, D5, DoD 1 et 7) ;
 *    2. la validation : la demande, l'accord, le refus, et le réglage éteint
 *       qui accepte ce qui attendait (D3, D11, DoD 4) ;
 *    3. retirer un abonné (D8, DoD 5) ;
 *    4. les nombres et les listes : les acceptés seuls, les demandes à leur
 *       titulaire, les pages, les comptes bloqués retirés, le web à la clé
 *       anonyme (D2, D8, D13, D16, DoD 3) ;
 *    5. le fil des abonnements, avec la sélection de « La table » (D1, D7,
 *       DoD 2) ;
 *    6. bloquer (D10, DoD 6) ;
 *    7. le rythme (D12, DoD 7) ;
 *    8. l'interrupteur (D22, DoD 8) ;
 *    9. les versions publiées : leurs lectures embarquées, et leur
 *       suppression d'un profil (D18, DoD 9) ;
 *   10. un profil éditorial (D6) ;
 *   11. l'export (D15) ;
 *   12. supprimer son compte (D15).
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const TARGET = process.env.TARGET;
const ANON_KEY = process.env.ANON_KEY;
const SERVICE_KEY = process.env.SERVICE_KEY;

if (!TARGET || !ANON_KEY || !SERVICE_KEY) {
  console.error('TARGET, ANON_KEY et SERVICE_KEY sont requis. Voir le docblock.');
  process.exit(1);
}
{
  const host = new URL(TARGET).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    console.error(`Refusé : ${TARGET} n'est pas local. Ce script écrit et supprime des comptes.`);
    process.exit(1);
  }
}

/** Même parade que `check-social.mjs` : ni WebSocket ni session rangée. */
const OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: class {} },
};
const anonClient = () => createClient(TARGET, ANON_KEY, OPTIONS);
const admin = createClient(TARGET, SERVICE_KEY, OPTIONS);
/** Le lecteur du web : la clé anonyme, sans session, comme la landing. */
const web = anonClient();

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok   ' : 'ECHEC'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
};

const tag = Math.random().toString(36).slice(2, 8);
const created = new Set();
const editorials = [];
/** Les comptes que `delete_own_account` a inscrits au registre. */
const registered = [];

/** La sélection du fil, recopiée de `src/lib/feed.ts`. */
const FEED_SELECT = `
  id, slug, is_primary, published_at, is_featured, edition_id, user_id,
  users:user_id ( pseudo, display_name, kind, avatar ),
  editions ( title, bento_categories ( key, prompt, stamp, gender, display_order ) ),
  bento_items ( category_id, bento_categories ( key ), items ( id, title, subtitle, image_url, image_credit ) )
`;

/** Un compte anonyme neuf, comme au premier lancement de l'app. */
async function anonymous() {
  const client = anonClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`connexion anonyme : ${error?.message}`);
  created.add(data.user.id);
  return { client, id: data.user.id };
}

/** Un profil, comme après la première publication : pseudo et règles. */
async function giveProfile(account, name) {
  const pseudo = `c23${name}${tag}`.slice(0, 20);
  const { error } = await admin
    .from('users')
    .insert({ id: account.id, pseudo, terms_accepted_at: new Date().toISOString() });
  if (error) throw new Error(`profil : ${error.message}`);
  return { ...account, pseudo };
}

async function member(name) {
  return giveProfile(await anonymous(), name);
}

async function giveBento(account, { published = true, slug = 'mon-bento', primary = true } = {}) {
  const { data, error } = await admin
    .from('bentos')
    .insert({
      user_id: account.id,
      slug,
      is_primary: primary,
      published_at: published ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`bento : ${error.message}`);
  return data.id;
}

/** Appelle une fonction ; rend `{ data, error }`, l'erreur réduite à son message. */
async function call(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  return { data, error: error ? error.message : null };
}

const row = (data) => (Array.isArray(data) ? data[0] : data);
const follow = (account, target, on = true) =>
  call(account.client, 'set_follow', { p_user: target.id, p_on: on });
const summary = async (client, target) => row((await call(client, 'follow_summary', { p_user: target.id })).data);
const list = (client, target, kind, more = {}) =>
  call(client, 'follow_list', { p_user: target.id, p_kind: kind, ...more });
const pseudosOf = (data) => (data ?? []).map((r) => r.pseudo).sort();

async function link(follower, followed) {
  const { data } = await admin
    .from('account_follows')
    .select('status, accepted_at')
    .eq('follower_id', follower.id)
    .eq('followed_id', followed.id)
    .maybeSingle();
  return data;
}

async function setApproval(account, on) {
  const { error } = await account.client.from('users').update({ follow_approval: on }).eq('id', account.id);
  if (error) throw new Error(`réglage : ${error.message}`);
}

async function followsSwitch(on) {
  const { error } = await admin.from('app_config').update({ follows_enabled: on }).eq('id', 1);
  if (error) throw new Error(`interrupteur : ${error.message}`);
}

async function journal(account) {
  const { count } = await admin
    .from('account_follow_writes')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', account.id);
  return count;
}

async function run() {
  const alice = await member('alice');
  alice.bentoId = await giveBento(alice);
  alice.draftId = await giveBento(alice, { published: false, slug: 'brouillon', primary: false });
  const bob = await member('bob');
  const carol = await member('carol');
  carol.bentoId = await giveBento(carol);
  const eve = await member('eve');
  eve.bentoId = await giveBento(eve);
  const nobody = await anonymous();
  let r;

  // ─── 1. Suivre et ne plus suivre (D4, D5) ──────────────────────────────
  console.log('Suivre et ne plus suivre');
  r = await follow(nobody, alice);
  check('un compte sans profil ne suit pas', r.error === 'follow_needs_profile', r.error ?? 'accepté');
  r = await call(web, 'set_follow', { p_user: alice.id, p_on: true });
  check('ni la clé anonyme sans session', r.error !== null, r.error ? '' : 'accepté');
  r = await follow(bob, alice);
  check('suivre un compte ouvert : accepté tout de suite', r.data === 'accepted', r.error ?? String(r.data));
  check('la ligne en base, datée de son accord', (await link(bob, alice))?.accepted_at != null);
  r = await follow(bob, alice);
  check(
    'suivre deux fois ne fait rien, et ne compte qu\'une fois au rythme',
    r.data === 'accepted' && (await journal(bob)) === 1,
    `${r.data}, journal ${await journal(bob)}`,
  );
  r = await follow(bob, bob);
  check('jamais soi-même', r.error === 'follow_invalid', r.error ?? 'accepté');
  r = await call(bob.client, 'set_follow', { p_user: randomUUID(), p_on: true });
  check('ni un compte inconnu', r.error === 'follow_invalid', r.error ?? 'accepté');
  {
    const { error: insertError } = await bob.client
      .from('account_follows')
      .insert({ follower_id: bob.id, followed_id: carol.id });
    check('aucune écriture directe', insertError !== null, insertError ? '' : 'insertion acceptée');
    const { error: readError } = await bob.client.from('account_follows').select('follower_id').limit(1);
    check('aucune lecture directe', readError !== null, readError ? '' : 'lecture acceptée');
    const { error: journalError } = await bob.client.from('account_follow_writes').select('user_id').limit(1);
    check('ni du journal', journalError !== null, journalError ? '' : 'lecture acceptée');
    await bob.client.from('users').update({ follow_approval: true }).eq('id', alice.id);
    const { data: still } = await admin.from('users').select('follow_approval').eq('id', alice.id).single();
    check('le réglage d\'un autre ne s\'écrit pas', still?.follow_approval === false);
  }
  r = await follow(bob, alice, false);
  check('ne plus suivre', !r.error && r.data === null && (await link(bob, alice)) === null, r.error ?? '');
  r = await follow(bob, alice);
  check('suivre à nouveau', r.data === 'accepted', r.error ?? String(r.data));

  // ─── 2. La validation (D3, D11) ────────────────────────────────────────
  console.log('La validation');
  await setApproval(carol, true);
  r = await follow(bob, carol);
  check('un compte qui valide : une demande', r.data === 'pending', r.error ?? String(r.data));
  {
    const seen = await summary(bob.client, carol);
    check(
      'le demandeur lit « en attente », sans les demandes de l\'autre',
      seen?.my_status === 'pending' && seen?.followers === 0 && seen?.requests === null && seen?.approval === true,
      JSON.stringify(seen),
    );
    const own = await summary(carol.client, carol);
    check('le titulaire lit sa demande', own?.requests === 1 && own?.followers === 0, JSON.stringify(own));
  }
  r = await list(carol.client, carol, 'requests');
  check('ses demandes, au titulaire', !r.error && pseudosOf(r.data).join() === bob.pseudo, r.error ?? pseudosOf(r.data).join());
  r = await list(bob.client, carol, 'requests');
  check('à lui seul', !r.error && (r.data ?? []).length === 0, r.error ?? pseudosOf(r.data).join());
  r = await call(eve.client, 'answer_follow', { p_follower: bob.id, p_accept: true });
  check('un autre ne répond pas à sa place', r.data === false && (await link(bob, carol))?.status === 'pending', r.error ?? String(r.data));
  r = await call(carol.client, 'answer_follow', { p_follower: bob.id, p_accept: true });
  check('accepter', r.data === true && (await link(bob, carol))?.status === 'accepted', r.error ?? String(r.data));
  check('l\'accord daté', (await link(bob, carol))?.accepted_at != null);
  check('il compte alors', (await summary(web, carol))?.followers === 1);
  r = await follow(eve, carol);
  r = await call(carol.client, 'answer_follow', { p_follower: eve.id, p_accept: false });
  check('refuser efface la demande', r.data === true && (await link(eve, carol)) === null, r.error ?? String(r.data));
  r = await follow(eve, carol);
  check('qui peut demander à nouveau', r.data === 'pending', r.error ?? String(r.data));
  await setApproval(carol, false);
  {
    const after = await link(eve, carol);
    check('éteindre le réglage accepte ce qui attendait', after?.status === 'accepted' && after?.accepted_at != null, JSON.stringify(after));
  }
  await setApproval(carol, true);
  check(
    'le rallumer ne retire personne',
    (await link(bob, carol))?.status === 'accepted' && (await link(eve, carol))?.status === 'accepted',
  );
  await setApproval(carol, false);

  // ─── 3. Retirer un abonné (D8) ─────────────────────────────────────────
  console.log('Retirer un abonné');
  r = await call(carol.client, 'remove_follower', { p_follower: eve.id });
  check('retirer', r.data === true && (await link(eve, carol)) === null, r.error ?? String(r.data));
  r = await call(carol.client, 'remove_follower', { p_follower: eve.id });
  check('deux fois ne fait rien', r.data === false, r.error ?? String(r.data));
  r = await call(eve.client, 'remove_follower', { p_follower: bob.id });
  check('on ne retire que ses abonnés', r.data === false && (await link(bob, carol))?.status === 'accepted', r.error ?? String(r.data));

  // ─── 4. Les nombres et les listes (D2, D8, D13, D16) ───────────────────
  console.log('Les nombres et les listes');
  const fans = [];
  for (const name of ['f1', 'f2', 'f3']) {
    const fan = await member(name);
    r = await follow(fan, alice);
    fans.push(fan);
  }
  const frank = await member('frank');
  await setApproval(frank, true);
  r = await follow(eve, alice);
  r = await follow(frank, alice);
  r = await follow(alice, frank);
  check('frank valide : alice attend', r.data === 'pending', r.error ?? String(r.data));
  {
    const seen = await summary(web, alice);
    check(
      'le web lit les nombres à la clé anonyme, sans les demandes',
      seen?.followers === 6 && seen?.following === 0 && seen?.requests === null && seen?.my_status === null,
      JSON.stringify(seen),
    );
    const ofFrank = await summary(web, frank);
    check('une demande ne compte pas', ofFrank?.followers === 0, JSON.stringify(ofFrank));
    const ofBob = await summary(bob.client, bob);
    check('ses abonnements acceptés', ofBob?.following === 2 && ofBob?.requests === 0, JSON.stringify(ofBob));
  }
  r = await call(web, 'follow_list', { p_user: alice.id, p_kind: 'followers' });
  check('les listes demandent une session', r.error !== null, r.error ? '' : 'servies');
  r = await list(nobody.client, alice, 'followers');
  check(
    'les abonnés, lus par tout compte',
    !r.error && pseudosOf(r.data).join() === [bob, eve, frank, ...fans].map((a) => a.pseudo).sort().join(),
    r.error ?? pseudosOf(r.data).join(),
  );
  r = await list(nobody.client, bob, 'following');
  check('les abonnements', !r.error && pseudosOf(r.data).join() === [alice.pseudo, carol.pseudo].sort().join(), r.error ?? pseudosOf(r.data).join());
  r = await list(nobody.client, alice, 'following');
  check('sans la demande envoyée', !r.error && (r.data ?? []).length === 0, r.error ?? pseudosOf(r.data).join());
  {
    const first = await list(nobody.client, alice, 'followers', { p_limit: 2 });
    const last = row((first.data ?? []).slice(-1));
    const second = await list(nobody.client, alice, 'followers', {
      p_limit: 50,
      p_before: last?.since,
      p_before_id: last?.user_id,
    });
    const all = [...(first.data ?? []), ...(second.data ?? [])].map((x) => x.user_id);
    check(
      'les pages : deux, puis le reste, sans doublon ni trou',
      first.data?.length === 2 && all.length === 6 && new Set(all).size === 6,
      `${first.data?.length} puis ${second.data?.length}`,
    );
    const dates = all.length === 6 ? [...(first.data ?? []), ...(second.data ?? [])].map((x) => x.since) : [];
    check('de la plus récente à la plus ancienne', dates.every((d, i) => i === 0 || dates[i - 1] >= d));
  }
  r = await call(nobody.client, 'set_block', { p_blocked: bob.id, p_on: true });
  r = await list(nobody.client, alice, 'followers');
  check('sans les comptes que qui lit a bloqués', !r.error && !pseudosOf(r.data).includes(bob.pseudo) && (r.data ?? []).length === 5, r.error ?? pseudosOf(r.data).join());
  check('les nombres restent ceux de tous', (await summary(nobody.client, alice))?.followers === 6);
  r = await call(nobody.client, 'set_block', { p_blocked: bob.id, p_on: false });

  // ─── 5. Le fil des abonnements (D1, D7) ────────────────────────────────
  console.log('Le fil des abonnements');
  frank.bentoId = await giveBento(frank);
  r = await follow(bob, frank);
  check('frank valide : bob attend', r.data === 'pending', r.error ?? String(r.data));
  {
    const { data, error } = await bob.client
      .rpc('following_bentos')
      .select(FEED_SELECT)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(8);
    const ids = (data ?? []).map((b) => b.id).sort();
    check(
      'les bentos publiés des comptes suivis, acceptés',
      !error && ids.join() === [alice.bentoId, carol.bentoId].sort().join(),
      error?.message ?? `${ids.length} bentos`,
    );
    const first = data?.[0];
    check('avec la sélection de « La table »', !error && typeof first?.users?.pseudo === 'string' && Array.isArray(first?.bento_items), error?.message ?? '');
    check('sans le brouillon, ni la demande en attente, ni un compte non suivi', !ids.includes(alice.draftId) && !ids.includes(frank.bentoId) && !ids.includes(eve.bentoId));
    const cursor = first ? `published_at.lt.${first.published_at},and(published_at.eq.${first.published_at},id.lt.${first.id})` : '';
    const { data: next, error: nextError } = await bob.client
      .rpc('following_bentos')
      .select(FEED_SELECT)
      .or(cursor)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(8);
    check('le curseur du fil s\'y applique', !nextError && (next ?? []).length === 1 && next[0].id !== first?.id, nextError?.message ?? `${next?.length}`);
    const { data: none, error: noneError } = await nobody.client.rpc('following_bentos').select('id');
    check('rien pour qui ne suit personne', !noneError && (none ?? []).length === 0, noneError?.message ?? `${none?.length}`);
    const { error: webError } = await web.rpc('following_bentos').select('id');
    check('ni pour la clé anonyme', webError !== null, webError ? '' : 'servi');
  }

  // ─── 6. Bloquer (D10) ──────────────────────────────────────────────────
  console.log('Bloquer');
  r = await follow(alice, eve);
  check('alice suit eve, qui la suit', r.data === 'accepted' && (await link(eve, alice))?.status === 'accepted', r.error ?? String(r.data));
  r = await call(alice.client, 'set_block', { p_blocked: eve.id, p_on: true });
  check(
    'bloquer retire l\'abonnement dans les deux sens',
    !r.error && (await link(alice, eve)) === null && (await link(eve, alice)) === null,
    r.error ?? '',
  );
  r = await follow(eve, alice);
  check('le bloqué ne peut plus suivre', r.error === 'follow_blocked', r.error ?? String(r.data));
  r = await follow(alice, eve);
  check('ni qui bloque', r.error === 'follow_blocked', r.error ?? String(r.data));
  r = await follow(eve, frank);
  check('eve demande à frank', r.data === 'pending', r.error ?? String(r.data));
  r = await call(frank.client, 'set_block', { p_blocked: eve.id, p_on: true });
  check('bloquer retire aussi une demande', !r.error && (await link(eve, frank)) === null, r.error ?? '');
  r = await call(alice.client, 'set_block', { p_blocked: eve.id, p_on: false });
  check('débloquer ne rend rien', !r.error && (await link(eve, alice)) === null, r.error ?? '');
  r = await follow(eve, alice);
  check('et laisse suivre à nouveau', r.data === 'accepted', r.error ?? String(r.data));

  // ─── 7. Le rythme (D12) ────────────────────────────────────────────────
  console.log('Le rythme');
  {
    const rapid = await member('rapid');
    const now = Date.now();
    const rows = Array.from({ length: 59 }, (_, i) => ({
      user_id: rapid.id,
      written_at: new Date(now - (i + 1) * 30_000).toISOString(),
    }));
    rows.push({ user_id: rapid.id, written_at: new Date(now - 2 * 86_400_000).toISOString() });
    const { error } = await admin.from('account_follow_writes').insert(rows);
    if (error) throw new Error(`journal : ${error.message}`);
    r = await follow(rapid, alice);
    check('le soixantième de l\'heure passe', r.data === 'accepted', r.error ?? String(r.data));
    r = await follow(rapid, carol);
    check('le soixante et unième non', r.error === 'follow_too_fast', r.error ?? String(r.data));
    r = await follow(rapid, alice, false);
    check('ne plus suivre n\'est pas compté', !r.error, r.error ?? '');
    check('le journal oublie ce qui a plus d\'un jour', (await journal(rapid)) === 60, `${await journal(rapid)}`);
  }

  // ─── 8. L'interrupteur (D22) ───────────────────────────────────────────
  console.log('L\'interrupteur');
  await followsSwitch(false);
  try {
    r = await follow(bob, eve);
    check('éteint, rien ne se suit', r.error === 'follows_closed', r.error ?? String(r.data));
    r = await follow(bob, alice, false);
    check('ni ne se défait', r.error === 'follows_closed', r.error ?? String(r.data));
    r = await call(carol.client, 'remove_follower', { p_follower: bob.id });
    check('ni ne se retire', r.error === 'follows_closed', r.error ?? String(r.data));
    check('les nombres se taisent', (await summary(web, alice)) === undefined);
    r = await list(nobody.client, alice, 'followers');
    check('les listes aussi', !r.error && (r.data ?? []).length === 0, r.error ?? `${r.data?.length}`);
    const { data, error } = await bob.client.rpc('following_bentos').select('id');
    check('et le fil', !error && (data ?? []).length === 0, error?.message ?? `${data?.length}`);
    check('les abonnements restent en base', (await link(bob, alice))?.status === 'accepted');
  } finally {
    await followsSwitch(true);
  }
  check('rallumé, tout revient', (await summary(web, alice))?.followers === 6);

  // ─── 9. Les versions publiées (§4.7, D18) ──────────────────────────────
  console.log('Les versions publiées');
  {
    const v11 = [
      'id, published_at, is_featured, bento_items(category_id, items(id, title, subtitle, year, image_url, image_credit, external_source, external_id))',
      'id, published_at, bento_items(category_id, item_id, items(id, title, subtitle, image_url, external_source, external_id))',
      'id, bento_items(category_id, items(id, title, subtitle, image_url, image_credit, status))',
      'id, published_at, is_featured, featured_order, users:user_id(id, pseudo, display_name), bento_items(category_id, items(id, title, subtitle, image_url))',
      'id, is_featured, featured_order, published_at, created_at, updated_at, bento_items(category_id, added_at, items(id, title, subtitle, year, image_url, external_source, external_id, metadata))',
    ];
    const broken = [];
    for (const select of v11) {
      const { error } = await nobody.client.from('bentos').select(select).eq('id', alice.bentoId);
      if (error) broken.push(`${select.slice(0, 40)}… : ${error.message}`);
    }
    check('les cinq lectures embarquées de la 1.1 et de la 0.1.0', broken.length === 0, broken.join(' | '));
    const { error: profileError } = await nobody.client.from('users').select('*').eq('id', alice.id).single();
    check('leur lecture d\'un profil', !profileError, profileError?.message ?? '');
    const { error: landingError } = await web
      .from('users')
      .select(
        'pseudo, display_name, kind, searchable, avatar, bentos(id, slug, is_primary, edition_id, published_at, is_featured, editions(slug, title, bento_categories(key, prompt, stamp, gender, display_order)), bento_items(category_id, bento_categories(key), items(id, title, subtitle, year, image_url, image_credit), bento_whys(id, body)))',
      )
      .eq('pseudo', alice.pseudo);
    check('la requête de la landing', !landingError, landingError?.message ?? '');
    const { error: adminError } = await admin
      .from('users')
      .select('id, pseudo, bentos(id, slug, is_primary, published_at, bento_items(count))')
      .eq('id', alice.id);
    check('celle des utilisateurs au back-office', !adminError, adminError?.message ?? '');
    const old = await member('ancien');
    r = await follow(old, alice);
    r = await follow(bob, old);
    const { error: deleteError } = await old.client.from('users').delete().eq('id', old.id);
    check(
      'leur suppression d\'un profil emporte ses abonnements et ses abonnés',
      !deleteError && (await link(old, alice)) === null && (await link(bob, old)) === null,
      deleteError?.message ?? '',
    );
  }

  // ─── 10. Un profil éditorial (D6) ──────────────────────────────────────
  console.log('Un profil éditorial');
  {
    const guest = { id: randomUUID(), pseudo: `c23guest${tag}`.slice(0, 20) };
    const { error } = await admin.from('users').insert({ id: guest.id, pseudo: guest.pseudo, kind: 'editorial' });
    if (error) throw new Error(`profil éditorial : ${error.message}`);
    editorials.push(guest.id);
    r = await follow(bob, guest);
    check('il se suit, toujours ouvert', r.data === 'accepted', r.error ?? String(r.data));
    check('et compte', (await summary(web, guest))?.followers === 1);
  }

  // ─── 11. L'export (D15) ────────────────────────────────────────────────
  console.log('L\'export');
  r = await call(bob.client, 'my_social_export', {});
  {
    const following = r.data?.follows?.following ?? [];
    const toCarol = following.find((f) => f.pseudo === carol.pseudo);
    check(
      'ses abonnements, avec leur pseudo, leur état et leur date',
      !r.error && following.length >= 3 && toCarol?.status === 'accepted' && toCarol?.accepted_at != null,
      r.error ?? JSON.stringify(following.slice(0, 2)),
    );
    check('ses abonnés', Array.isArray(r.data?.follows?.followers));
    check('les parts du 22 et du 12 toujours là', ['comments', 'likes', 'blocks', 'whys'].every((k) => Array.isArray(r.data?.[k])));
  }
  r = await call(frank.client, 'my_social_export', {});
  {
    const followers = r.data?.follows?.followers ?? [];
    check('les demandes reçues, avec leur état', followers.some((f) => f.pseudo === bob.pseudo && f.status === 'pending'), JSON.stringify(followers));
  }

  // ─── 12. Supprimer son compte (D15) ────────────────────────────────────
  console.log('Supprimer son compte');
  {
    const leaver = await member('leaver');
    r = await follow(leaver, alice);
    r = await follow(bob, leaver);
    r = await call(leaver.client, 'delete_own_account', {});
    check('delete_own_account du chantier 28', !r.error, r.error ?? '');
    check(
      'ses abonnements, ses abonnés et son journal partent avec lui',
      (await link(leaver, alice)) === null && (await link(bob, leaver)) === null && (await journal(leaver)) === 0,
    );
    created.delete(leaver.id);
    registered.push(leaver.id);
  }
}

async function cleanup() {
  await followsSwitch(true).catch(() => {});
  const ids = [...created];
  for (const id of ids) {
    await admin.from('users').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }
  if (editorials.length > 0) await admin.from('users').delete().in('id', editorials);
  if (registered.length > 0) await admin.from('user_deletions').delete().in('deleted_user_id', registered);
}

try {
  await run();
} catch (error) {
  failures += 1;
  console.log(`  ECHEC le passage s'est interrompu : ${error.message}`);
} finally {
  await cleanup();
}

console.log(failures === 0 ? '\nAucun échec.' : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
