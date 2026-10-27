/**
 * Contrôles de la zone de notifications, chantier 24, lot 1.
 *
 * Contre un Supabase **local**, jamais la production : le script refuse toute
 * cible qui n'est pas sur 127.0.0.1 ou localhost. Il passe par le vrai
 * `supabase-js`, à la clé anonyme, avec de vrais comptes : ce qu'il garde vit
 * dans les fonctions, les droits et les règles de la base.
 *
 *   eval "$(supabase status -o env --workdir <dossier> | sed 's/^/export /')"
 *   TARGET="$API_URL" ANON_KEY="$ANON_KEY" SERVICE_KEY="$SERVICE_ROLE_KEY" \
 *   node scripts/check-notifications.mjs
 *
 * Chaque « ok » est un comportement tenu, chaque « ECHEC » un défaut ; le
 * décompte final doit annoncer zéro échec. Tout ce que le script crée,
 * comptes, profils, bentos et items, est retiré à la fin, même après un échec.
 * Les évènements se posent à la clé de service, datés : la zone les lit dans
 * leurs tables, quel que soit le chemin qui les a écrits (D4).
 *
 * Ce que ces contrôles gardent, §6, §7.1 et §10 de la spécification :
 *
 *    1. qui lit la zone : un compte, la sienne seule, jamais `anon` (DoD 8) ;
 *    2. les likes, anonymes et regroupés par bento (D6, D7) ;
 *    3. les commentaires, et le masquage qui les déplace chez leur auteur ;
 *    4. les abonnés et les demandes (D6) ;
 *    5. les bentos des comptes suivis, après l'abonnement (D14) ;
 *    6. les décisions de l'équipe (D2, D15) ;
 *    7. nouveau et plus tôt, et le nombre exact (D8, DoD 3 et 4) ;
 *    8. les 90 jours (D3, DoD 6) ;
 *    9. les blocages, dans les deux sens (D11, DoD 5) ;
 *   10. le curseur (D22) ;
 *   11. l'interrupteur (D13, DoD 9) ;
 *   12. les versions publiées (D16, DoD 10) ;
 *   13. l'export (D17) ;
 *   14. supprimer son compte (D17).
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
/** La clé anonyme sans session, comme la landing. */
const web = anonClient();

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok   ' : 'ECHEC'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
};

const tag = Math.random().toString(36).slice(2, 8);
const created = new Set();
const editorials = [];
const itemIds = [];
/** Les comptes que `delete_own_account` a inscrits au registre. */
const registered = [];

/** La sélection du fil, recopiée de `src/lib/feed.ts`. */
const FEED_SELECT = `
  id, slug, is_primary, published_at, is_featured, edition_id, user_id,
  users:user_id ( pseudo, display_name, kind, avatar ),
  editions ( title, bento_categories ( key, prompt, stamp, gender, display_order ) ),
  bento_items ( category_id, bento_categories ( key ), items ( id, title, subtitle, image_url, image_credit ) )
`;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
/** Une date du passé, à `ms` de maintenant. */
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const pseudo = `c24${name}${tag}`.slice(0, 20);
  const { error } = await admin
    .from('users')
    .insert({ id: account.id, pseudo, terms_accepted_at: new Date().toISOString() });
  if (error) throw new Error(`profil : ${error.message}`);
  return { ...account, pseudo };
}

async function member(name) {
  return giveProfile(await anonymous(), name);
}

async function giveBento(account, { published = true, at = ago(DAY), slug = 'mon-bento', primary = true } = {}) {
  const { data, error } = await admin
    .from('bentos')
    .insert({ user_id: account.id, slug, is_primary: primary, published_at: published ? at : null })
    .select('id')
    .single();
  if (error) throw new Error(`bento : ${error.message}`);
  return data.id;
}

/** Un item posé par l'équipe, validé. */
async function teamItem(title, type = 1) {
  const { data, error } = await admin
    .from('items')
    .insert({ title: `${title} ${tag}`, type_id: type, external_source: 'admin', status: 'validated', metadata: {} })
    .select('id')
    .single();
  if (error) throw new Error(`item : ${error.message}`);
  itemIds.push(data.id);
  return data.id;
}

/** Un item proposé par un compte : la base le met en attente. */
async function propose(account, title, type = 1) {
  const { data, error } = await admin
    .from('items')
    .insert({ title: `${title} ${tag}`, type_id: type, external_source: 'user', submitted_by: account.id, metadata: {} })
    .select('id, status')
    .single();
  if (error) throw new Error(`proposition : ${error.message}`);
  itemIds.push(data.id);
  return data.id;
}

async function like(account, bentoId, at = ago(10 * MINUTE)) {
  const { error } = await admin.from('bento_likes').insert({ bento_id: bentoId, user_id: account.id, created_at: at });
  if (error) throw new Error(`like : ${error.message}`);
}

async function comment(account, bentoId, body, at = ago(10 * MINUTE)) {
  const { data, error } = await admin
    .from('bento_comments')
    .insert({ bento_id: bentoId, author_id: account.id, body, created_at: at })
    .select('id')
    .single();
  if (error) throw new Error(`commentaire : ${error.message}`);
  return data.id;
}

async function block(blocker, blocked) {
  const { error } = await admin.from('account_blocks').insert({ blocker_id: blocker.id, blocked_id: blocked.id });
  if (error) throw new Error(`blocage : ${error.message}`);
}

/** Appelle une fonction ; rend `{ data, error }`, l'erreur réduite à son message. */
async function call(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  return { data, error: error ? error.message : null };
}

/** Toute la zone d'un compte, page après page. */
async function zone(account, limit = 50) {
  const rows = [];
  let before = null;
  let beforeKey = null;
  for (let guard = 0; guard < 20; guard += 1) {
    const r = await call(account.client, 'list_notifications', {
      p_before: before,
      p_before_key: beforeKey,
      p_limit: limit,
    });
    if (r.error) throw new Error(`list_notifications : ${r.error}`);
    rows.push(...(r.data ?? []));
    if (!r.data || r.data.length < limit) break;
    const last = r.data[r.data.length - 1];
    before = last.latest_at;
    beforeKey = last.group_key;
  }
  return rows;
}

async function badge(account) {
  const r = await call(account.client, 'notification_badge', {});
  if (r.error) throw new Error(`notification_badge : ${r.error}`);
  return r.data;
}

const groupOf = (rows, key, fresh) =>
  rows.find((r) => r.group_key === key && (fresh === undefined || r.is_new === fresh));
const freshCount = (rows) => rows.filter((r) => r.is_new).length;

async function notificationsSwitch(on) {
  const { error } = await admin.from('app_config').update({ notifications_enabled: on }).eq('id', 1);
  if (error) throw new Error(`interrupteur : ${error.message}`);
}

async function seenAt(account) {
  const { data } = await admin.from('notification_reads').select('seen_at').eq('user_id', account.id).maybeSingle();
  return data?.seen_at ?? null;
}

async function run() {
  const alice = await member('alice');
  alice.bentoId = await giveBento(alice);
  alice.draftId = await giveBento(alice, { published: false, slug: 'brouillon', primary: false });
  const bob = await member('bob');
  const carol = await member('carol');
  carol.oldBentoId = await giveBento(carol, { at: ago(2 * DAY) });
  const dave = await member('dave');
  const erin = await member('erin');
  const frank = await member('frank');
  const stranger = await anonymous();
  let r;
  let rows;

  // ─── 1. Qui lit la zone ────────────────────────────────────────────────
  console.log('Qui lit la zone');
  r = await call(web, 'list_notifications', {});
  check('la clé anonyme sans session ne lit aucune zone', r.error !== null, r.error ? '' : 'lue');
  r = await call(web, 'notification_badge', {});
  check('ni son nombre', r.error !== null, r.error ? '' : 'lu');
  r = await call(web, 'mark_notifications_seen', { p_until: new Date().toISOString() });
  check('ni ne la marque lue', r.error !== null, r.error ? '' : 'accepté');
  r = await call(bob.client, 'notification_events', { p_viewer: alice.id });
  check('la fonction interne ne s\'appelle pas : personne ne lit la zone d\'un autre', r.error !== null, r.error ? '' : 'lue');
  {
    const { error } = await bob.client.from('notification_reads').select('user_id').limit(1);
    check('aucune lecture directe des dates de lecture', error !== null, error ? '' : 'lecture acceptée');
    const { error: writeError } = await bob.client
      .from('notification_reads')
      .insert({ user_id: bob.id, seen_at: new Date().toISOString() });
    check('ni écriture', writeError !== null, writeError ? '' : 'insertion acceptée');
  }
  r = await call(stranger.client, 'notification_badge', {});
  check('sans profil : rien', r.data === 0, r.error ?? String(r.data));
  r = await call(stranger.client, 'mark_notifications_seen', { p_until: new Date().toISOString() });
  check('et rien à marquer', !r.error && r.data === null, r.error ?? String(r.data));

  // ─── 2. Les likes (D6, D7) ─────────────────────────────────────────────
  console.log('Les likes');
  await like(bob, alice.bentoId, ago(30 * MINUTE));
  await like(carol, alice.bentoId, ago(29 * MINUTE));
  await like(stranger, alice.bentoId, ago(28 * MINUTE));
  await like(alice, alice.bentoId, ago(27 * MINUTE));
  await like(bob, alice.draftId, ago(27 * MINUTE));
  rows = await zone(alice);
  {
    const g = groupOf(rows, `like:${alice.bentoId}`);
    check('trois likes, une ligne', g?.events === 3, JSON.stringify(g));
    check('sans un pseudo : un like est anonyme', g && g.actor_pseudos.length === 0 && g.actor_avatar === null, JSON.stringify(g?.actor_pseudos));
    check('le sien ne compte pas', g?.events === 3);
    check('ni ceux d\'un brouillon', !rows.some((x) => x.group_key === `like:${alice.draftId}`));
    check('la ligne porte son bento', g?.bento_id === alice.bentoId && g?.bento_slug === 'mon-bento' && g?.owner_pseudo === alice.pseudo);
    check('et se lit nouvelle', g?.is_new === true);
  }
  await admin.from('bento_likes').delete().eq('bento_id', alice.bentoId).eq('user_id', stranger.id);
  rows = await zone(alice);
  check('retirer son like le retire de la zone', groupOf(rows, `like:${alice.bentoId}`)?.events === 2);

  // ─── 3. Les commentaires ───────────────────────────────────────────────
  console.log('Les commentaires');
  await comment(bob, alice.bentoId, 'Premier', ago(26 * MINUTE));
  const hiddenId = await comment(carol, alice.bentoId, 'Masqué bientôt', ago(25 * MINUTE));
  await comment(bob, alice.bentoId, 'Deuxième de bob', ago(24 * MINUTE));
  await comment(dave, alice.bentoId, 'Le plus récent', ago(23 * MINUTE));
  await comment(alice, alice.bentoId, 'Le mien', ago(22 * MINUTE));
  rows = await zone(alice);
  {
    const g = groupOf(rows, `comment:${alice.bentoId}`);
    check('quatre commentaires d\'autres, une ligne', g?.events === 4, JSON.stringify(g));
    check('trois auteurs', g?.actors === 3, String(g?.actors));
    check(
      'les deux plus récents nommés, chacun une fois',
      JSON.stringify(g?.actor_pseudos) === JSON.stringify([dave.pseudo, bob.pseudo]),
      JSON.stringify(g?.actor_pseudos),
    );
    check('le texte du plus récent', g?.detail === 'Le plus récent', g?.detail);
  }
  await admin
    .from('bento_comments')
    .update({ status: 'hidden', hidden_reason: 'Hors sujet', hidden_at: ago(21 * MINUTE), hidden_by: 'check' })
    .eq('id', hiddenId);
  rows = await zone(alice);
  {
    const g = groupOf(rows, `comment:${alice.bentoId}`);
    check('masqué, il sort de la zone du bento', g?.events === 3 && g?.actors === 2, JSON.stringify(g));
  }
  rows = await zone(carol);
  {
    const g = groupOf(rows, `comment_hidden:${hiddenId}`);
    check('et entre chez son auteur, avec le motif', g?.detail === 'Hors sujet' && g?.bento_id === alice.bentoId, JSON.stringify(g));
    check('le bento commenté nommé par son titulaire', g?.owner_pseudo === alice.pseudo);
  }
  rows = await zone(alice);
  check('le masquage ne s\'annonce qu\'à l\'auteur', !groupOf(rows, `comment_hidden:${hiddenId}`));

  // ─── 4. Les abonnés et les demandes (D6) ───────────────────────────────
  console.log('Les abonnés et les demandes');
  r = await call(bob.client, 'set_follow', { p_user: alice.id, p_on: true });
  r = await call(dave.client, 'set_follow', { p_user: alice.id, p_on: true });
  rows = await zone(alice);
  {
    const g = groupOf(rows, 'follow');
    check('deux abonnés, une ligne', g?.events === 2 && g?.actors === 2, JSON.stringify(g));
    check('nommés', [...(g?.actor_pseudos ?? [])].sort().join() === [bob.pseudo, dave.pseudo].sort().join());
    check('l\'avatar du plus récent', g && 'actor_avatar' in g);
  }
  await admin.from('users').update({ follow_approval: true }).eq('id', erin.id);
  r = await call(dave.client, 'set_follow', { p_user: erin.id, p_on: true });
  rows = await zone(erin);
  check('une demande : sa ligne, pas un abonné', groupOf(rows, 'follow_request')?.events === 1 && !groupOf(rows, 'follow'));
  await sleep(1100);
  r = await call(erin.client, 'answer_follow', { p_follower: dave.id, p_accept: true });
  rows = await zone(erin);
  check('acceptée, elle devient un abonné', groupOf(rows, 'follow')?.events === 1 && !groupOf(rows, 'follow_request'));
  r = await call(dave.client, 'set_follow', { p_user: alice.id, p_on: false });
  rows = await zone(alice);
  check('ne plus suivre le retire', groupOf(rows, 'follow')?.events === 1);

  // ─── 5. Les bentos des comptes suivis (D14) ────────────────────────────
  console.log('Les bentos des comptes suivis');
  r = await call(bob.client, 'set_follow', { p_user: carol.id, p_on: true });
  {
    const { data: link } = await admin
      .from('account_follows')
      .select('accepted_at')
      .eq('follower_id', bob.id)
      .eq('followed_id', carol.id)
      .single();
    const after = new Date(new Date(link.accepted_at).getTime() + 500).toISOString();
    carol.newBentoId = await giveBento(carol, { at: after, slug: 'nouveau', primary: false });
    carol.draftId = await giveBento(carol, { published: false, slug: 'brouillon', primary: false });
    await sleep(1100);
  }
  rows = await zone(bob);
  {
    const g = groupOf(rows, `followed_bento:${carol.newBentoId}`);
    check('un bento publié après l\'abonnement', g?.owner_pseudo === carol.pseudo && g?.bento_slug === 'nouveau', JSON.stringify(g));
    check('son auteur nommé', JSON.stringify(g?.actor_pseudos) === JSON.stringify([carol.pseudo]));
    check('pas celui d\'avant l\'abonnement', !groupOf(rows, `followed_bento:${carol.oldBentoId}`));
    check('ni un brouillon', !groupOf(rows, `followed_bento:${carol.draftId}`));
  }
  {
    r = await call(frank.client, 'set_follow', { p_user: erin.id, p_on: true });
    const waiting = r.data === 'pending';
    await sleep(600);
    erin.bentoId = await giveBento(erin, { at: new Date(Date.now() - 300).toISOString() });
    await sleep(600);
    rows = await zone(frank);
    check('une demande en attente n\'annonce pas ses bentos', waiting && !groupOf(rows, `followed_bento:${erin.bentoId}`), String(r.data));
    await call(frank.client, 'set_follow', { p_user: erin.id, p_on: false });
  }
  {
    const guest = { id: randomUUID(), pseudo: `c24guest${tag}`.slice(0, 20) };
    const { error } = await admin.from('users').insert({ id: guest.id, pseudo: guest.pseudo, kind: 'editorial' });
    if (error) throw new Error(`profil éditorial : ${error.message}`);
    editorials.push(guest.id);
    r = await call(bob.client, 'set_follow', { p_user: guest.id, p_on: true });
    const { data: link } = await admin
      .from('account_follows')
      .select('accepted_at')
      .eq('follower_id', bob.id)
      .eq('followed_id', guest.id)
      .single();
    const at = new Date(new Date(link.accepted_at).getTime() + 500).toISOString();
    guest.bentoId = await giveBento(guest, { at });
    await sleep(1100);
    rows = await zone(bob);
    check('un profil éditorial suivi annonce aussi ses bentos', !!groupOf(rows, `followed_bento:${guest.bentoId}`));
  }

  // ─── 6. Les décisions de l'équipe (D2, D15) ────────────────────────────
  console.log('Les décisions de l\'équipe');
  const kept = await teamItem('Gardé');
  const validated = await propose(alice, 'Validé');
  const merged = await propose(alice, 'Fusionné');
  const rejected = await propose(alice, 'Refusé');
  const others = await propose(bob, 'De bob');
  {
    const { data } = await admin.from('items').select('status, submitted_by').eq('id', validated).single();
    check('une proposition arrive en attente', data?.status === 'pending' && data?.submitted_by === alice.id, JSON.stringify(data));
  }
  rows = await zone(alice);
  check('en attente, elle n\'annonce rien', !groupOf(rows, 'item_validated') && !groupOf(rows, `item_rejected:${rejected}`));
  await admin.from('items').update({ status: 'validated' }).eq('id', validated);
  await admin.from('items').update({ status: 'validated' }).eq('id', others);
  await sleep(50);
  r = await call(admin, 'admin_merge_items', { canonical_id: kept, loser_ids: [merged] });
  check('la fusion du back-office', !r.error, r.error ?? '');
  {
    const { data } = await admin.from('items').select('status, merged_at, merged_into_id').eq('id', merged).single();
    check('pose merged_at', data?.status === 'merged' && data?.merged_at != null && data?.merged_into_id === kept, JSON.stringify(data));
  }
  await admin.from('items').update({ status: 'rejected', rejected_reason: 'Doublon' }).eq('id', rejected);
  rows = await zone(alice);
  {
    const g = groupOf(rows, 'item_validated');
    check('validé et fusionné : une ligne, deux items', g?.events === 2, JSON.stringify(g));
    check('le plus récent en tête, la fusion vers l\'item gardé', g?.item_id === merged && g?.kept_item_id === kept && g?.item_status === 'merged', JSON.stringify(g));
    check('les deux titres, la fusion sous celui de l\'item gardé', g?.item_titles?.length === 2 && g.item_titles[0] === `Gardé ${tag}` && g.item_titles[1] === `Validé ${tag}`, JSON.stringify(g?.item_titles));
    const no = groupOf(rows, `item_rejected:${rejected}`);
    check('le refus, sa ligne et son motif', no?.detail === 'Doublon' && no?.item_status === 'rejected', JSON.stringify(no));
  }
  rows = await zone(bob);
  check('chacun ses propositions', groupOf(rows, 'item_validated')?.events === 1);
  await admin.from('bentos').update({ auto_published_at: ago(5 * MINUTE) }).eq('id', alice.bentoId);
  {
    const film = await teamItem('Film du pourquoi');
    await admin.from('bento_items').insert({ bento_id: alice.bentoId, category_id: 1, item_id: film });
    const { data: w, error } = await admin
      .from('bento_whys')
      .insert({
        bento_id: alice.bentoId,
        category_id: 1,
        body: 'Parce que',
        status: 'hidden',
        hidden_reason: 'Insultant',
        hidden_at: ago(4 * MINUTE),
        hidden_by: 'check',
      })
      .select('id')
      .single();
    if (error) throw new Error(`pourquoi : ${error.message}`);
    rows = await zone(alice);
    check('le bento publié à la validation', !!groupOf(rows, `bento_published:${alice.bentoId}`));
    const g = groupOf(rows, `why_hidden:${w.id}`);
    check('le pourquoi masqué, son motif et le titre de sa case', g?.detail === 'Insultant' && g?.item_titles?.[0] === `Film du pourquoi ${tag}`, JSON.stringify(g));
    rows = await zone(bob);
    check('à son seul titulaire', !rows.some((x) => x.kind === 'why_hidden' || x.kind === 'bento_published'));
  }

  // ─── 7. Nouveau et plus tôt (D8) ───────────────────────────────────────
  console.log('Nouveau et plus tôt');
  rows = await zone(alice);
  {
    const n = await badge(alice);
    check('le nombre égale les lignes nouvelles', n === freshCount(rows) && n === rows.length, `${n} pour ${freshCount(rows)} sur ${rows.length}`);
    check('les plus récentes d\'abord', rows.every((x, i) => i === 0 || rows[i - 1].latest_at >= x.latest_at));
    const until = rows[0].latest_at;
    r = await call(alice.client, 'mark_notifications_seen', { p_until: until });
    check('marquer lu rend la date posée', r.data && new Date(r.data).getTime() === new Date(until).getTime(), `${r.data} pour ${until}`);
  }
  rows = await zone(alice);
  check('plus rien de nouveau', (await badge(alice)) === 0 && freshCount(rows) === 0);
  {
    const before = await seenAt(alice);
    await call(alice.client, 'mark_notifications_seen', { p_until: ago(30 * DAY) });
    check('la date ne recule pas', (await seenAt(alice)) === before, `${await seenAt(alice)} pour ${before}`);
    await call(alice.client, 'mark_notifications_seen', { p_until: new Date(Date.now() + 365 * DAY).toISOString() });
    const after = new Date(await seenAt(alice)).getTime();
    check('ni ne passe maintenant', after <= Date.now() + 5000, new Date(after).toISOString());
  }
  await sleep(1100);
  await like(erin, alice.bentoId, new Date(Date.now() - 200).toISOString());
  await sleep(300);
  rows = await zone(alice);
  {
    const fresh = groupOf(rows, `like:${alice.bentoId}`, true);
    const old = groupOf(rows, `like:${alice.bentoId}`, false);
    check('un like de plus : une ligne nouvelle', fresh?.events === 1, JSON.stringify(fresh));
    check('l\'ancienne reste plus bas', old?.events === 2 && rows.indexOf(fresh) < rows.indexOf(old), JSON.stringify(old));
    check('le nombre suit', (await badge(alice)) === 1 && freshCount(rows) === 1);
    check('la nouvelle en tête', rows[0] === fresh);
  }

  // ─── 8. Les 90 jours (D3) ──────────────────────────────────────────────
  console.log('Les 90 jours');
  {
    const g0 = groupOf(await zone(alice), `like:${alice.bentoId}`, false)?.events ?? 0;
    await like(frank, alice.bentoId, ago(91 * DAY));
    const g1 = groupOf(await zone(alice), `like:${alice.bentoId}`, false)?.events ?? 0;
    check('un like de plus de 90 jours n\'y est pas', g1 === g0, `${g1} pour ${g0}`);
    await admin.from('bento_likes').update({ created_at: ago(89 * DAY) }).eq('bento_id', alice.bentoId).eq('user_id', frank.id);
    const g2 = groupOf(await zone(alice), `like:${alice.bentoId}`, false)?.events ?? 0;
    check('à 89 jours, si', g2 === g0 + 1, `${g2} pour ${g0 + 1}`);
  }

  // ─── 9. Les blocages, dans les deux sens (D11) ─────────────────────────
  console.log('Les blocages');
  {
    const likesBefore = (await zone(alice))
      .filter((x) => x.group_key === `like:${alice.bentoId}`)
      .reduce((s, x) => s + x.events, 0);
    await block(alice, bob);
    rows = await zone(alice);
    const likes = rows.filter((x) => x.group_key === `like:${alice.bentoId}`).reduce((s, x) => s + x.events, 0);
    const c = rows.filter((x) => x.group_key === `comment:${alice.bentoId}`);
    check('bloquer retire ses likes', likes === likesBefore - 1, `${likes} pour ${likesBefore - 1}`);
    check('et ses commentaires', c.every((x) => !x.actor_pseudos.includes(bob.pseudo)) && c.reduce((s, x) => s + x.events, 0) === 1, JSON.stringify(c));
    check('et son abonnement', !groupOf(rows, 'follow'));
    await block(frank, alice);
    rows = await zone(alice);
    const likes2 = rows.filter((x) => x.group_key === `like:${alice.bentoId}`).reduce((s, x) => s + x.events, 0);
    check('être bloqué retire aussi ce qui vient de lui', likes2 === likes - 1, `${likes2} pour ${likes - 1}`);
    check('et le nombre reste exact', (await badge(alice)) === freshCount(rows));
  }

  // ─── 10. Le curseur (D22) ──────────────────────────────────────────────
  console.log('Le curseur');
  {
    const all = await zone(alice, 50);
    const paged = await zone(alice, 2);
    const keys = paged.map((x) => `${x.group_key}|${x.is_new}`);
    check('page à page, la même liste', JSON.stringify(paged) === JSON.stringify(all), `${paged.length} pour ${all.length}`);
    check('sans doublon', new Set(keys).size === keys.length);
    r = await call(alice.client, 'list_notifications', { p_limit: 500 });
    check('50 lignes au plus par page', !r.error && (r.data ?? []).length <= 50);
  }

  // ─── 11. L'interrupteur (D13) ──────────────────────────────────────────
  console.log('L\'interrupteur');
  await notificationsSwitch(false);
  try {
    check('éteint, aucune ligne', (await zone(alice)).length === 0);
    check('aucun nombre', (await badge(alice)) === 0);
    r = await call(alice.client, 'mark_notifications_seen', { p_until: new Date().toISOString() });
    check('rien à marquer', !r.error && r.data === null, r.error ?? String(r.data));
  } finally {
    await notificationsSwitch(true);
  }
  check('rallumé, tout revient', (await zone(alice)).length > 0);

  // ─── 12. Les versions publiées (D16) ───────────────────────────────────
  console.log('Les versions publiées');
  {
    const { data, error } = await web.from('bentos').select(FEED_SELECT).eq('id', alice.bentoId).maybeSingle();
    check('la sélection du fil lit toujours un bento', !error && data?.id === alice.bentoId, error?.message ?? '');
    const late = await propose(dave, 'Tardif');
    await admin.from('items').update({ status: 'validated' }).eq('id', late);
    const { data: it } = await admin.from('items').select('validated_at, merged_at').eq('id', late).single();
    check('une validation pose toujours validated_at, et rien d\'autre', it?.validated_at != null && it?.merged_at === null, JSON.stringify(it));
    const old = await member('old');
    await call(old.client, 'mark_notifications_seen', { p_until: new Date().toISOString() });
    const had = (await seenAt(old)) !== null;
    const { error: deleteError } = await old.client.from('users').delete().eq('id', old.id);
    check('leur suppression d\'un profil emporte sa date de lecture', had && !deleteError && (await seenAt(old)) === null, deleteError?.message ?? '');
  }

  // ─── 13. L'export (D17) ────────────────────────────────────────────────
  console.log('L\'export');
  r = await call(alice.client, 'my_social_export', {});
  {
    const seen = await seenAt(alice);
    check(
      'la date de lecture',
      !r.error && r.data?.notifications && new Date(r.data.notifications.seen_at).getTime() === new Date(seen).getTime(),
      r.error ?? JSON.stringify(r.data?.notifications),
    );
    check('les parts du 22, du 12 et du 23 toujours là', ['comments', 'likes', 'blocks', 'whys'].every((k) => Array.isArray(r.data?.[k])) && !!r.data?.follows);
  }
  r = await call(carol.client, 'my_social_export', {});
  check('jamais lue : une date vide', !r.error && r.data?.notifications?.seen_at === null, JSON.stringify(r.data?.notifications));

  // ─── 14. Supprimer son compte (D17) ────────────────────────────────────
  console.log('Supprimer son compte');
  {
    const leaver = await member('leaver');
    await call(leaver.client, 'mark_notifications_seen', { p_until: new Date().toISOString() });
    const had = (await seenAt(leaver)) !== null;
    r = await call(leaver.client, 'delete_own_account', {});
    check('delete_own_account du chantier 28', !r.error, r.error ?? '');
    check('sa date de lecture part avec lui', had && (await seenAt(leaver)) === null);
    created.delete(leaver.id);
    registered.push(leaver.id);
  }
}

async function cleanup() {
  await notificationsSwitch(true).catch(() => {});
  const ids = [...created];
  for (const id of ids) {
    await admin.from('users').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }
  if (editorials.length > 0) await admin.from('users').delete().in('id', editorials);
  if (itemIds.length > 0) await admin.from('items').delete().in('id', itemIds);
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
