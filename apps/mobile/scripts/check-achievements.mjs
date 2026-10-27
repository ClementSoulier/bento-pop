/**
 * Contrôles des succès, chantier 27, lot 1.
 *
 * Contre un Supabase **local**, jamais la production : le script refuse toute
 * cible qui n'est pas sur 127.0.0.1 ou localhost. Il passe par le vrai
 * `supabase-js`, à la clé anonyme, avec de vrais comptes : ce qu'il garde vit
 * dans les fonctions, les déclencheurs, les droits et les règles de la base.
 *
 *   eval "$(supabase status -o env --workdir <dossier> | sed 's/^/export /')"
 *   TARGET="$API_URL" ANON_KEY="$ANON_KEY" SERVICE_KEY="$SERVICE_ROLE_KEY" \
 *   node scripts/check-achievements.mjs
 *
 * Chaque « ok » est un comportement tenu, chaque « ECHEC » un défaut ; le
 * décompte final doit annoncer zéro échec. Tout ce que le script crée est
 * retiré à la fin, même après un échec. Les gestes se posent à la clé de
 * service, datés : les déclencheurs les voient comme ceux de l'app.
 *
 * Ce que ces contrôles gardent, §2, §4, §5 et §8 de la spécification :
 *
 *    1. personne ne pose ni ne lit la table (D8, DoD 5) ;
 *    2. les bentos : premier, trois, le même item dix fois (D4, D9, DoD 1) ;
 *    3. les items proposés : un, cinq, dix validés, fusions comprises ;
 *    4. les abonnés : un, dix ;
 *    5. acquis pour toujours (D3, DoD 4) ;
 *    6. le rattrapage, aux dates des données (D16, DoD 3) ;
 *    7. la lecture publique (D2, D13) ;
 *    8. « Notifs » (D14, DoD 2) ;
 *    9. l'interrupteur (D18) ;
 *   10. un profil éditorial (D21) ;
 *   11. l'export, et supprimer son compte (D17) ;
 *   12. les versions publiées (D19, DoD 7).
 */
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
const registered = [];

/** La sélection du fil, recopiée de `src/lib/feed.ts`. */
const FEED_SELECT = `
  id, slug, is_primary, published_at, is_featured, edition_id, user_id,
  users:user_id ( pseudo, display_name, kind, avatar ),
  editions ( title, bento_categories ( key, prompt, stamp, gender, display_order ) ),
  bento_items ( category_id, bento_categories ( key ), items ( id, title, subtitle, image_url, image_credit ) )
`;

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const sameInstant = (a, b) => a != null && b != null && new Date(a).getTime() === new Date(b).getTime();

async function anonymous() {
  const client = anonClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`connexion anonyme : ${error?.message}`);
  created.add(data.user.id);
  return { client, id: data.user.id };
}

async function member(name) {
  const account = await anonymous();
  const pseudo = `c27${name}${tag}`.slice(0, 20);
  const { error } = await admin.from('users').insert({ id: account.id, pseudo, terms_accepted_at: new Date().toISOString() });
  if (error) throw new Error(`profil : ${error.message}`);
  return { ...account, pseudo };
}

async function bento(account, { at = null, slug = 'mon-bento', primary = true } = {}) {
  const { data, error } = await admin
    .from('bentos')
    .insert({ user_id: account.id, slug, is_primary: primary, published_at: at })
    .select('id')
    .single();
  if (error) throw new Error(`bento : ${error.message}`);
  return data.id;
}

async function teamItem(title) {
  const { data, error } = await admin
    .from('items')
    .insert({ title: `${title} ${tag}`, type_id: 1, external_source: 'admin', status: 'validated', metadata: {} })
    .select('id')
    .single();
  if (error) throw new Error(`item : ${error.message}`);
  itemIds.push(data.id);
  return data.id;
}

async function propose(account, title) {
  const { data, error } = await admin
    .from('items')
    .insert({ title: `${title} ${tag}`, type_id: 1, external_source: 'user', submitted_by: account.id, metadata: {} })
    .select('id')
    .single();
  if (error) throw new Error(`proposition : ${error.message}`);
  itemIds.push(data.id);
  return data.id;
}

async function call(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  return { data, error: error ? error.message : null };
}

/** Ses succès, lus en base : { clé: date }. */
async function stored(account) {
  const { data } = await admin.from('account_achievements').select('key, unlocked_at').eq('user_id', account.id);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.unlocked_at]));
}

async function achievementsSwitch(on) {
  const { error } = await admin.from('app_config').update({ achievements_enabled: on }).eq('id', 1);
  if (error) throw new Error(`interrupteur : ${error.message}`);
}

async function run() {
  const alice = await member('alice');
  const bob = await member('bob');
  let r;

  // ─── 1. Personne ne pose ni ne lit la table (D8) ───────────────────────
  console.log('Personne ne pose ni ne lit la table');
  {
    const { error: readError } = await alice.client.from('account_achievements').select('key').limit(1);
    check('aucune lecture directe', readError !== null, readError ? '' : 'lecture acceptée');
    const { error: insertError } = await alice.client
      .from('account_achievements')
      .insert({ user_id: alice.id, key: 'ten_followers', unlocked_at: new Date().toISOString() });
    check('aucune écriture directe', insertError !== null, insertError ? '' : 'insertion acceptée');
    r = await call(alice.client, 'award_achievements', { p_user: alice.id });
    check('ni la pose par l\'API', r.error !== null, r.error ? '' : 'appel accepté');
    r = await call(alice.client, 'achievement_candidates', { p_user: alice.id });
    check('ni la lecture des règles', r.error !== null, r.error ? '' : 'appel accepté');
  }

  // ─── 2. Les bentos (D4, D9) ────────────────────────────────────────────
  console.log('Les bentos');
  const draft = await bento(alice);
  check('un brouillon ne gagne rien', Object.keys(await stored(alice)).length === 0);
  const firstAt = ago(30 * DAY);
  await admin.from('bentos').update({ published_at: firstAt }).eq('id', draft);
  check('publier : « Premier bento », daté de la publication', sameInstant((await stored(alice)).first_bento, firstAt), JSON.stringify(await stored(alice)));
  await bento(alice, { slug: 'brouillon', primary: false });
  await bento(alice, { at: ago(20 * DAY), slug: 'deux', primary: false });
  check('deux bentos et un brouillon : pas encore trois', !(await stored(alice)).three_bentos);
  const thirdAt = ago(10 * DAY);
  await bento(alice, { at: thirdAt, slug: 'trois', primary: false });
  check('trois : « Trois bentos », daté du troisième', sameInstant((await stored(alice)).three_bentos, thirdAt));
  {
    const fan = await member('fan');
    const film = await teamItem('Film fétiche');
    let tenthAt = null;
    for (let i = 1; i <= 10; i += 1) {
      const at = ago((30 - i) * DAY);
      const id = await bento(fan, { at, slug: i === 1 ? 'mon-bento' : `bento-${i}`, primary: i === 1 });
      const { error } = await admin.from('bento_items').insert({ bento_id: id, category_id: 1, item_id: film });
      if (error) throw new Error(`case : ${error.message}`);
      if (i === 9) check('neuf fois le même item : pas encore', !(await stored(fan)).same_item_ten);
      if (i === 10) tenthAt = at;
    }
    check('dix : « Inconditionnel », daté du dixième bento', sameInstant((await stored(fan)).same_item_ten, tenthAt), JSON.stringify(await stored(fan)));
  }

  // ─── 3. Les items proposés ─────────────────────────────────────────────
  console.log('Les items proposés');
  {
    const ids = [];
    for (let i = 1; i <= 10; i += 1) ids.push(await propose(bob, `Proposé ${i}`));
    check('en attente, rien', !(await stored(bob)).first_item);
    await admin.from('items').update({ status: 'validated' }).eq('id', ids[0]);
    const { data: first } = await admin.from('items').select('validated_at').eq('id', ids[0]).single();
    check('un validé : « Défricheur », daté de sa validation', sameInstant((await stored(bob)).first_item, first.validated_at));
    await admin.from('items').update({ status: 'rejected', rejected_reason: 'Non' }).eq('id', ids[1]);
    check('un refus ne compte pas', !(await stored(bob)).five_items);
    const kept = await teamItem('Gardé');
    r = await call(admin, 'admin_merge_items', { canonical_id: kept, loser_ids: [ids[2]] });
    for (const id of ids.slice(3, 6)) await admin.from('items').update({ status: 'validated' }).eq('id', id);
    check('cinq, fusion comprise : « Éclaireur »', !!(await stored(bob)).five_items, JSON.stringify(Object.keys(await stored(bob))));
    for (const id of ids.slice(6)) await admin.from('items').update({ status: 'validated' }).eq('id', id);
    check('neuf : pas encore « Pionnier »', !(await stored(bob)).ten_items);
    const extra = await propose(bob, 'Dixième');
    await admin.from('items').update({ status: 'validated' }).eq('id', extra);
    check('dix : « Pionnier »', !!(await stored(bob)).ten_items);
  }

  // ─── 4. Les abonnés ────────────────────────────────────────────────────
  console.log('Les abonnés');
  {
    const star = await member('star');
    const fans = [];
    for (let i = 1; i <= 10; i += 1) fans.push(await member(`f${i}`));
    r = await call(fans[0].client, 'set_follow', { p_user: star.id, p_on: true });
    const { data: link } = await admin
      .from('account_follows')
      .select('accepted_at')
      .eq('follower_id', fans[0].id)
      .eq('followed_id', star.id)
      .single();
    check('un abonné : « Premier abonné », daté de l\'accord', sameInstant((await stored(star)).first_follower, link?.accepted_at));
    for (const f of fans.slice(1, 8)) await call(f.client, 'set_follow', { p_user: star.id, p_on: true });
    await admin.from('users').update({ follow_approval: true }).eq('id', star.id);
    await call(fans[9].client, 'set_follow', { p_user: star.id, p_on: true });
    await call(fans[8].client, 'set_follow', { p_user: star.id, p_on: true });
    check('huit, et deux demandes : rien de plus', !(await stored(star)).ten_followers);
    await call(star.client, 'answer_follow', { p_follower: fans[8].id, p_accept: true });
    check('neuf, et une demande : pas encore dix', !(await stored(star)).ten_followers);
    await call(star.client, 'answer_follow', { p_follower: fans[9].id, p_accept: true });
    check('acceptée : « Dix abonnés »', !!(await stored(star)).ten_followers);

    // ─── 5. Acquis pour toujours (D3) ────────────────────────────────────
    console.log('Acquis pour toujours');
    for (const f of fans) await call(f.client, 'set_follow', { p_user: star.id, p_on: false });
    check('perdre ses abonnés ne retire rien', !!(await stored(star)).first_follower && !!(await stored(star)).ten_followers);
  }
  {
    const before = await stored(alice);
    await admin.from('bentos').update({ published_at: null }).eq('user_id', alice.id);
    const after = await stored(alice);
    check('dépublier ne retire rien', sameInstant(after.first_bento, before.first_bento) && sameInstant(after.three_bentos, before.three_bentos));
    await admin.from('bentos').update({ published_at: ago(5 * DAY) }).eq('id', draft);
    const again = await stored(alice);
    check('republier ne redate ni ne retire rien', sameInstant(again.first_bento, before.first_bento) && sameInstant(again.three_bentos, before.three_bentos));
  }

  // ─── 6. Le rattrapage (D16) ────────────────────────────────────────────
  console.log('Le rattrapage');
  {
    const before = await stored(bob);
    await admin.from('account_achievements').delete().eq('user_id', bob.id);
    r = await call(admin, 'award_achievements', { p_user: bob.id });
    const after = await stored(bob);
    check('rejoué, il pose ce qui manque', !r.error && Object.keys(after).sort().join() === Object.keys(before).sort().join(), r.error ?? JSON.stringify(Object.keys(after)));
    check('aux dates des données', Object.keys(before).every((k) => sameInstant(after[k], before[k])));
    r = await call(admin, 'award_achievements', { p_user: bob.id });
    check('rejoué encore, rien de plus', Object.keys(await stored(bob)).length === Object.keys(after).length);
  }

  // ─── 7. La lecture publique (D2, D13) ──────────────────────────────────
  console.log('La lecture publique');
  r = await call(web, 'account_achievements_of', { p_user: bob.id });
  check('le web lit les succès d\'un compte', !r.error && (r.data ?? []).some((x) => x.key === 'first_item'), r.error ?? JSON.stringify(r.data));
  check('du plus ancien au plus récent', (r.data ?? []).every((x, i, a) => i === 0 || a[i - 1].unlocked_at <= x.unlocked_at));
  r = await call(alice.client, 'account_achievements_of', { p_user: bob.id });
  check('un autre compte aussi', (r.data ?? []).length > 0);

  // ─── 8. « Notifs » (D14) ───────────────────────────────────────────────
  console.log('Notifs');
  {
    r = await call(bob.client, 'list_notifications', {});
    const rows = (r.data ?? []).filter((x) => x.kind === 'achievement');
    check('chaque succès, une ligne', !r.error && rows.length === Object.keys(await stored(bob)).length, r.error ?? String(rows.length));
    check('sa clé en détail', rows.some((x) => x.detail === 'first_item' && x.group_key === 'achievement:first_item'));
    const n = (await call(bob.client, 'notification_badge', {})).data;
    check('et comptés nouveaux', typeof n === 'number' && n >= rows.length, String(n));
  }

  // ─── 9. L'interrupteur (D18) ───────────────────────────────────────────
  console.log('L\'interrupteur');
  await achievementsSwitch(false);
  let late;
  try {
    r = await call(web, 'account_achievements_of', { p_user: bob.id });
    check('éteint, rien ne se lit', !r.error && (r.data ?? []).length === 0);
    r = await call(bob.client, 'list_notifications', {});
    check('ni dans « Notifs »', !(r.data ?? []).some((x) => x.kind === 'achievement'));
    late = await member('late');
    await bento(late, { at: ago(DAY) });
    check('les succès se posent toujours', !!(await stored(late)).first_bento);
  } finally {
    await achievementsSwitch(true);
  }
  r = await call(web, 'account_achievements_of', { p_user: late.id });
  check('rallumé, rien ne manque', (r.data ?? []).some((x) => x.key === 'first_bento'));

  // ─── 10. Un profil éditorial (D21) ─────────────────────────────────────
  console.log('Un profil éditorial');
  {
    const guest = { id: crypto.randomUUID(), pseudo: `c27guest${tag}`.slice(0, 20) };
    const { error } = await admin.from('users').insert({ id: guest.id, pseudo: guest.pseudo, kind: 'editorial' });
    if (error) throw new Error(`profil éditorial : ${error.message}`);
    editorials.push(guest.id);
    await bento(guest, { at: ago(DAY) });
    check('il ne gagne rien', Object.keys(await stored(guest)).length === 0);
  }

  // ─── 11. L'export, et supprimer son compte (D17) ───────────────────────
  console.log('L\'export et la suppression');
  r = await call(bob.client, 'my_social_export', {});
  check('l\'export rend ses succès', !r.error && Array.isArray(r.data?.achievements) && r.data.achievements.some((x) => x.key === 'first_item'), r.error ?? '');
  check('les parts d\'avant toujours là', !!r.data?.social_links && !!r.data?.notifications && !!r.data?.follows);
  {
    const leaver = await member('leaver');
    await bento(leaver, { at: ago(DAY) });
    const had = Object.keys(await stored(leaver)).length > 0;
    r = await call(leaver.client, 'delete_own_account', {});
    check('supprimer son compte efface ses succès', had && !r.error && Object.keys(await stored(leaver)).length === 0, r.error ?? '');
    created.delete(leaver.id);
    registered.push(leaver.id);
  }

  // ─── 12. Les versions publiées (D19) ───────────────────────────────────
  console.log('Les versions publiées');
  {
    // Qu'une pose en échec ne bloque pas la publication se prouve en base,
    // par un défaut injecté : `defauts.sh`, à la fin.
    const { data, error: readError } = await web.from('bentos').select(FEED_SELECT).eq('id', draft).maybeSingle();
    check('la sélection du fil lit toujours un bento', !readError && data?.id === draft, readError?.message ?? '');
    const { data: profile, error: profileError } = await web.from('users').select('pseudo').eq('id', alice.id).maybeSingle();
    check('et un profil', !profileError && profile?.pseudo === alice.pseudo, profileError?.message ?? '');
  }
}

async function cleanup() {
  await achievementsSwitch(true).catch(() => {});
  for (const id of [...created]) {
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
