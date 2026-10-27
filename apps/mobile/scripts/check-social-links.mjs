/**
 * Contrôles des comptes Instagram et TikTok, chantier 25, lot 1.
 *
 * Contre un Supabase **local**, jamais la production : le script refuse toute
 * cible qui n'est pas sur 127.0.0.1 ou localhost. Il passe par le vrai
 * `supabase-js`, à la clé anonyme, avec de vrais comptes : ce qu'il garde vit
 * dans les fonctions, les droits et les règles de la base.
 *
 *   eval "$(supabase status -o env --workdir <dossier> | sed 's/^/export /')"
 *   TARGET="$API_URL" ANON_KEY="$ANON_KEY" SERVICE_KEY="$SERVICE_ROLE_KEY" \
 *   node scripts/check-social-links.mjs
 *
 * Chaque « ok » est un comportement tenu, chaque « ECHEC » un défaut ; le
 * décompte final doit annoncer zéro échec. Tout ce que le script crée,
 * comptes, profils, bentos et le mot de filtre d'essai, est retiré à la fin,
 * même après un échec.
 *
 * Ce que ces contrôles gardent, §4, §6 et §9 de la spécification :
 *
 *    1. écrire et lire ses liens, normalisés (D4, D7, DoD 1 et 2) ;
 *    2. les formats des deux réseaux (D4, DoD 4) ;
 *    3. le filtre du 22 (D6, DoD 4) ;
 *    4. délier (DoD 1) ;
 *    5. « Afficher mes réseaux » (D3, D8, DoD 3) ;
 *    6. aucun chemin direct (D7, DoD 3) ;
 *    7. sans session ni profil ;
 *    8. l'interrupteur (D9) ;
 *    9. les versions publiées (D14, DoD 7) ;
 *   10. l'export (D13) ;
 *   11. supprimer son compte (D13) ;
 *   12. le back-office, à la clé de service (D6, DoD 5).
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
/** Le lecteur du web : la clé anonyme, sans session, comme la landing. */
const web = anonClient();

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok   ' : 'ECHEC'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
};

const tag = Math.random().toString(36).slice(2, 8);
/** Le mot d'essai du filtre, en lettres seules, comme la liste les veut. */
const BANNED = `zqx${tag.replace(/[^a-z]/g, '')}interdit`;
const created = new Set();
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
  const pseudo = `c25${name}${tag}`.slice(0, 20);
  const { error } = await admin
    .from('users')
    .insert({ id: account.id, pseudo, terms_accepted_at: new Date().toISOString() });
  if (error) throw new Error(`profil : ${error.message}`);
  return { ...account, pseudo };
}

async function member(name) {
  return giveProfile(await anonymous(), name);
}

/** Appelle une fonction ; rend `{ data, error }`, l'erreur réduite à son message. */
async function call(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  return { data, error: error ? error.message : null };
}

const row = (data) => (Array.isArray(data) ? data[0] : data);
const write = (account, instagram, tiktok) =>
  call(account.client, 'set_social_links', { p_instagram: instagram, p_tiktok: tiktok });
const read = async (client, account) => {
  const r = await call(client, 'social_links', { p_user: account.id });
  return { ...r, data: row(r.data) ?? null };
};

async function stored(account) {
  const { data } = await admin.from('account_links').select('instagram, tiktok').eq('user_id', account.id).maybeSingle();
  return data;
}

async function socialSwitch(on) {
  const { error } = await admin.from('app_config').update({ social_links_enabled: on }).eq('id', 1);
  if (error) throw new Error(`interrupteur : ${error.message}`);
}

async function run() {
  {
    const { error } = await admin.from('blocked_terms').insert({ term: BANNED, kind: 'word', label: 'essai c25' });
    if (error) throw new Error(`mot d'essai : ${error.message}`);
  }
  const alice = await member('alice');
  const bob = await member('bob');
  const nobody = await anonymous();
  let r;

  // ─── 1. Écrire et lire (D4, D7) ────────────────────────────────────────
  console.log('Écrire et lire');
  r = await write(alice, '  @Lea_Cine ', '@@Lea.Cine');
  check('écrire ses deux liens, normalisés', !r.error && row(r.data)?.instagram === 'lea_cine' && row(r.data)?.tiktok === 'lea.cine', r.error ?? JSON.stringify(r.data));
  check('en base, en minuscules, sans « @ »', JSON.stringify(await stored(alice)) === JSON.stringify({ instagram: 'lea_cine', tiktok: 'lea.cine' }));
  r = await read(web, alice);
  check('le web les lit, à la clé anonyme', !r.error && r.data?.instagram === 'lea_cine' && r.data?.tiktok === 'lea.cine', r.error ?? JSON.stringify(r.data));
  r = await read(bob.client, alice);
  check('un autre compte aussi', r.data?.instagram === 'lea_cine');
  r = await read(alice.client, alice);
  check('son titulaire, avec son réglage', r.data?.visible === true, JSON.stringify(r.data));
  r = await write(alice, 'lea_cine', null);
  check('un seul lien, l\'autre retiré', !r.error && JSON.stringify(await stored(alice)) === JSON.stringify({ instagram: 'lea_cine', tiktok: null }), r.error ?? '');
  r = await read(web, bob);
  check('sans lien, aucune ligne', !r.error && r.data === null, JSON.stringify(r.data));

  // ─── 2. Les formats (D4) ───────────────────────────────────────────────
  console.log('Les formats');
  for (const bad of ['.lea', 'lea.', 'le..a', 'a'.repeat(31), 'lea cine', 'lea-cine', 'léa']) {
    r = await write(alice, bad, null);
    check(`Instagram refuse « ${bad.length > 12 ? `${bad.slice(0, 8)}… (${bad.length})` : bad} »`, r.error === 'social_invalid_instagram', r.error ?? 'accepté');
  }
  for (const bad of ['a', 'b'.repeat(25), 'lea.', 'lea cine', 'lea/cine']) {
    r = await write(alice, null, bad);
    check(`TikTok refuse « ${bad.length > 12 ? `${bad.slice(0, 8)}… (${bad.length})` : bad} »`, r.error === 'social_invalid_tiktok', r.error ?? 'accepté');
  }
  r = await write(alice, 'a', '.ab');
  check('les bornes : un caractère pour Instagram, un point en tête pour TikTok', !r.error && row(r.data)?.instagram === 'a' && row(r.data)?.tiktok === '.ab', r.error ?? '');
  r = await write(alice, 'c'.repeat(30), 'd'.repeat(24));
  check('30 et 24 caractères', !r.error, r.error ?? '');
  {
    const { error } = await admin.from('account_links').update({ instagram: 'Pas.Bon' }).eq('user_id', alice.id);
    check('la base tient le format, même à la clé de service', error !== null, error ? '' : 'accepté');
  }
  r = await write(alice, 'refus.ok', 'refus_ok');
  check('rien ne change après un refus', JSON.stringify(await stored(alice)) === JSON.stringify({ instagram: 'refus.ok', tiktok: 'refus_ok' }));
  r = await write(alice, 'lea..x', 'nouveau');
  check('un refus n\'écrit rien, même l\'autre lien', r.error === 'social_invalid_instagram' && (await stored(alice))?.tiktok === 'refus_ok');

  // ─── 3. Le filtre du 22 (D6) ───────────────────────────────────────────
  console.log('Le filtre');
  r = await write(alice, BANNED, null);
  check('un pseudo Instagram filtré', r.error === 'social_filtered_instagram', r.error ?? 'accepté');
  r = await write(alice, null, `ok.${BANNED}_x`);
  check('un pseudo TikTok filtré, points et soulignés lus comme des espaces', r.error === 'social_filtered_tiktok', r.error ?? 'accepté');
  r = await write(alice, `${BANNED}x`, null);
  check('un mot plus long, non', !r.error, r.error ?? '');

  // ─── 4. Délier ─────────────────────────────────────────────────────────
  console.log('Délier');
  r = await write(alice, '', '  ');
  check('deux vides effacent la ligne', !r.error && (await stored(alice)) === null, r.error ?? '');
  r = await read(web, alice);
  check('et plus rien ne se lit', r.data === null);
  r = await write(alice, 'lea_cine', 'lea.cine');

  // ─── 5. « Afficher mes réseaux » (D3, D8) ──────────────────────────────
  console.log('Afficher mes réseaux');
  {
    const { data } = await admin.from('users').select('social_visible').eq('id', bob.id).single();
    check('allumé par défaut', data?.social_visible === true);
  }
  {
    const { error } = await alice.client.from('users').update({ social_visible: false }).eq('id', alice.id);
    check('son titulaire l\'éteint', !error, error?.message ?? '');
  }
  r = await read(web, alice);
  check('éteint, le web ne lit plus rien', !r.error && r.data === null, JSON.stringify(r.data));
  r = await read(bob.client, alice);
  check('un autre compte non plus', r.data === null);
  r = await read(alice.client, alice);
  check('son titulaire les lit encore, réglage éteint', r.data?.instagram === 'lea_cine' && r.data?.visible === false, JSON.stringify(r.data));
  check('les liens restent enregistrés', (await stored(alice))?.instagram === 'lea_cine');
  await bob.client.from('users').update({ social_visible: true }).eq('id', alice.id);
  {
    const { data } = await admin.from('users').select('social_visible').eq('id', alice.id).single();
    check('le réglage d\'un autre ne s\'écrit pas', data?.social_visible === false);
  }
  await alice.client.from('users').update({ social_visible: true }).eq('id', alice.id);
  check('rallumé, tout revient', (await read(web, alice)).data?.instagram === 'lea_cine');

  // ─── 6. Aucun chemin direct (D7) ───────────────────────────────────────
  console.log('Aucun chemin direct');
  {
    const { error: readError } = await bob.client.from('account_links').select('instagram').limit(1);
    check('aucune lecture directe', readError !== null, readError ? '' : 'lecture acceptée');
    const { error: webError } = await web.from('account_links').select('instagram').limit(1);
    check('ni à la clé anonyme', webError !== null, webError ? '' : 'lecture acceptée');
    const { error: insertError } = await bob.client.from('account_links').insert({ user_id: bob.id, instagram: 'direct' });
    check('aucune écriture directe', insertError !== null, insertError ? '' : 'insertion acceptée');
    const { error: updateError } = await bob.client.from('account_links').update({ instagram: 'pirate' }).eq('user_id', alice.id);
    const still = await stored(alice);
    check('ni sur la ligne d\'un autre', still?.instagram === 'lea_cine', updateError?.message ?? JSON.stringify(still));
  }

  // ─── 7. Sans session ni profil ─────────────────────────────────────────
  console.log('Sans session ni profil');
  r = await call(web, 'set_social_links', { p_instagram: 'x', p_tiktok: null });
  check('la clé anonyme sans session n\'écrit rien', r.error !== null, r.error ? '' : 'accepté');
  r = await write(nobody, 'nobody', null);
  check('un compte sans profil non plus', r.error === 'social_needs_profile', r.error ?? 'accepté');

  // ─── 8. L'interrupteur (D9) ────────────────────────────────────────────
  console.log('L\'interrupteur');
  await socialSwitch(false);
  try {
    r = await write(alice, 'ferme', null);
    check('éteint, rien ne s\'écrit', r.error === 'social_closed', r.error ?? 'accepté');
    r = await read(web, alice);
    check('rien ne se lit', !r.error && r.data === null);
    r = await read(alice.client, alice);
    check('pas même par son titulaire', r.data === null);
  } finally {
    await socialSwitch(true);
  }
  check('rallumé, les liens restés là', (await read(web, alice)).data?.instagram === 'lea_cine');

  // ─── 9. Les versions publiées (D14) ────────────────────────────────────
  console.log('Les versions publiées');
  {
    const { data: bento, error: bentoError } = await admin
      .from('bentos')
      .insert({ user_id: alice.id, slug: 'mon-bento', is_primary: true, published_at: new Date().toISOString() })
      .select('id')
      .single();
    if (bentoError) throw new Error(`bento : ${bentoError.message}`);
    const { data, error } = await web.from('bentos').select(FEED_SELECT).eq('id', bento.id).maybeSingle();
    check('la sélection du fil lit toujours un bento', !error && data?.id === bento.id, error?.message ?? '');
    const { data: profile, error: profileError } = await web.from('users').select('pseudo, display_name').eq('id', alice.id).maybeSingle();
    check('et un profil', !profileError && profile?.pseudo === alice.pseudo, profileError?.message ?? '');
    const old = await member('old');
    await write(old, 'old_account', null);
    const { error: deleteError } = await old.client.from('users').delete().eq('id', old.id);
    check('leur suppression d\'un profil emporte ses liens', !deleteError && (await stored(old)) === null, deleteError?.message ?? '');
  }

  // ─── 10. L'export (D13) ────────────────────────────────────────────────
  console.log('L\'export');
  r = await call(alice.client, 'my_social_export', {});
  {
    // `jsonb` range ses clés à sa façon : champ par champ, pas en chaîne.
    const links = r.data?.social_links;
    check(
      'ses liens et son réglage',
      !r.error && links?.instagram === 'lea_cine' && links?.tiktok === 'lea.cine' && links?.visible === true,
      r.error ?? JSON.stringify(links),
    );
  }
  check(
    'les parts du 22, du 12, du 23 et du 24 toujours là',
    ['comments', 'likes', 'blocks', 'whys'].every((k) => Array.isArray(r.data?.[k])) && !!r.data?.follows && !!r.data?.notifications,
  );

  // ─── 11. Supprimer son compte (D13) ────────────────────────────────────
  console.log('Supprimer son compte');
  {
    const leaver = await member('leaver');
    await write(leaver, 'partant', 'partant');
    const had = (await stored(leaver)) !== null;
    r = await call(leaver.client, 'delete_own_account', {});
    check('delete_own_account du chantier 28', !r.error, r.error ?? '');
    check('ses liens partent avec lui', had && (await stored(leaver)) === null);
    created.delete(leaver.id);
    registered.push(leaver.id);
  }

  // ─── 12. Le back-office (D6) ───────────────────────────────────────────
  console.log('Le back-office');
  {
    const { error } = await admin.from('account_links').delete().eq('user_id', alice.id);
    check('la clé de service efface les liens d\'un compte', !error && (await stored(alice)) === null, error?.message ?? '');
    check('et le web ne les lit plus', (await read(web, alice)).data === null);
  }
}

async function cleanup() {
  await socialSwitch(true).catch(() => {});
  await admin.from('blocked_terms').delete().eq('term', BANNED);
  const ids = [...created];
  for (const id of ids) {
    await admin.from('users').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }
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
