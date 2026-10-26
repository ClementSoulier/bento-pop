/**
 * Contrôles « le pourquoi par case », chantier 12, lot 1.
 *
 * Contre un Supabase **local**, jamais la production : le script refuse toute
 * cible qui n'est pas sur 127.0.0.1 ou localhost. Il passe par le vrai
 * `supabase-js`, à la clé anonyme, avec de vrais comptes : ce qu'il garde vit
 * dans les fonctions, les droits et les règles de la base.
 *
 *   eval "$(supabase status -o env --workdir <dossier> | sed 's/^/export /')"
 *   TARGET="$API_URL" ANON_KEY="$ANON_KEY" SERVICE_KEY="$SERVICE_ROLE_KEY" \
 *   DB_CONTAINER=supabase_db_<projet> node scripts/check-whys.mjs
 *
 * `DB_CONTAINER` est facultatif : avec lui, le script pose dans le coffre de
 * la pile locale l'adresse d'un récepteur qu'il ouvre lui-même, et vérifie que
 * chaque écriture d'un pourquoi purge la page web (D16). Il retire ces deux
 * secrets à la fin.
 *
 * Chaque « ok » est un comportement tenu, chaque « ECHEC » un défaut ; le
 * décompte final doit annoncer zéro échec. Tout ce que le script crée,
 * comptes, profils, bentos, items, pourquoi et signalements, est retiré à la
 * fin, même après un échec.
 *
 * Ce que ces contrôles gardent, §6, §7.1 et §10 de la spécification :
 *
 *    1. écrire, remplacer, effacer le pourquoi d'une case de son bento, et
 *       d'aucun autre ; aucune écriture directe (D2, D3, DoD 1) ;
 *    2. le texte : la longueur, la ligne unique, le filtre, les 20 mots
 *       courants acceptés (D5, DoD 2) ;
 *    3. lire : visible, bento publié, item validé, interrupteur allumé ;
 *       jamais le motif ; le propriétaire lit les siens (D1, D10, DoD 3) ;
 *    4. masqué, puis réécrit (D8) ;
 *    5. quand la case change, par l'app comme par la 1.1 ; la fusion des
 *       doublons (D7, D17, DoD 4) ;
 *    6. signaler un pourquoi, depuis un compte sans profil (D8, DoD 5) ;
 *    7. le rythme (D18) ;
 *    8. les versions publiées et la landing : leurs lectures embarquées et
 *       leur signalement inchangés (§4.7, DoD 9) ;
 *    9. l'export (D13) ;
 *   10. supprimer son compte emporte ses pourquoi ;
 *   11. la purge de la page web (D16, DoD 7), avec `DB_CONTAINER`.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';

const TARGET = process.env.TARGET;
const ANON_KEY = process.env.ANON_KEY;
const SERVICE_KEY = process.env.SERVICE_KEY;
const DB_CONTAINER = process.env.DB_CONTAINER;

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

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok   ' : 'ECHEC'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
};

const tag = Math.random().toString(36).slice(2, 8);
const created = new Set();
const pseudos = [];
const itemIds = [];
/** Les comptes que `delete_own_account` a inscrits au registre. */
const registered = [];

/** Les cases du bento principal, leur identifiant et leur type d'item. */
const CASES = {
  film: { id: 1, type: 1 },
  series: { id: 2, type: 2 },
  artist: { id: 3, type: 3 },
  track: { id: 4, type: 4 },
  creator: { id: 5, type: 3 },
  place: { id: 6, type: 5 },
};

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
  const pseudo = `c12${name}${tag}`.slice(0, 20);
  pseudos.push(pseudo);
  const { error } = await admin
    .from('users')
    .insert({ id: account.id, pseudo, terms_accepted_at: new Date().toISOString() });
  if (error) throw new Error(`profil : ${error.message}`);
  return { ...account, pseudo };
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

/** Un item du catalogue, validé par défaut, posé par l'équipe. */
async function item(title, type, status = 'validated') {
  const { data, error } = await admin
    .from('items')
    .insert({ title: `${title} ${tag}`, type_id: type, external_source: 'admin', status, metadata: {} })
    .select('id')
    .single();
  if (error) throw new Error(`item : ${error.message}`);
  itemIds.push(data.id);
  return data.id;
}

/** Remplit des cases à la clé de service : `{ film: itemId, … }`. */
async function fill(bentoId, slots) {
  const rows = Object.entries(slots).map(([key, itemId]) => ({
    bento_id: bentoId,
    category_id: CASES[key].id,
    item_id: itemId,
  }));
  const { error } = await admin.from('bento_items').insert(rows);
  if (error) throw new Error(`cases : ${error.message}`);
}

/** Appelle une fonction ; rend `{ data, error }`, l'erreur réduite à son message. */
async function call(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  return { data, error: error ? error.message : null };
}

const row = (data) => (Array.isArray(data) ? data[0] : data);
const why = (account, bentoId, key, body) =>
  call(account.client, 'set_bento_why', { p_bento: bentoId, p_case: key, p_body: body });

/** Ce qu'un lecteur reçoit des pourquoi d'un bento, par la requête embarquée de la page. */
async function readEmbedded(client, bentoId) {
  const { data, error } = await client
    .from('bentos')
    .select('id, bento_items(category_id, bento_whys(body))')
    .eq('id', bentoId)
    .maybeSingle();
  if (error) return { error: error.message, whys: {} };
  const whys = {};
  for (const bi of data?.bento_items ?? []) {
    const w = Array.isArray(bi.bento_whys) ? bi.bento_whys[0] : bi.bento_whys;
    if (w?.body) whys[bi.category_id] = w.body;
  }
  return { error: null, whys };
}

async function whysSwitch(on) {
  const { error } = await admin.from('app_config').update({ whys_enabled: on }).eq('id', 1);
  if (error) throw new Error(`interrupteur : ${error.message}`);
}

async function stored(bentoId, key) {
  const { data } = await admin
    .from('bento_whys')
    .select('id, body, status, hidden_reason')
    .eq('bento_id', bentoId)
    .eq('category_id', CASES[key].id)
    .maybeSingle();
  return data;
}

// ─── Le récepteur de la purge (D16) ────────────────────────────────────────

const RECEIVER_PORT = 54399;
/** Tiré au hasard à chaque passage : un jeton écrit dans le source se fait signaler. */
const RECEIVER_TOKEN = randomBytes(18).toString('base64url');
const received = [];
let receiver = null;

function psql(sql) {
  return execFileSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
  });
}

async function openReceiver() {
  receiver = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        received.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      } catch {
        received.push({ url: req.url, auth: req.headers.authorization, body: null });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"revalidated":true}');
    });
  });
  await new Promise((resolve) => receiver.listen(RECEIVER_PORT, '0.0.0.0', resolve));
  psql(
    `delete from vault.secrets where name in ('landing_base_url', 'landing_revalidate_token');` +
      `select vault.create_secret('http://host.docker.internal:${RECEIVER_PORT}', 'landing_base_url');` +
      `select vault.create_secret('${RECEIVER_TOKEN}', 'landing_revalidate_token');`,
  );
}

async function closeReceiver() {
  if (!DB_CONTAINER) return;
  try {
    psql(`delete from vault.secrets where name in ('landing_base_url', 'landing_revalidate_token');`);
  } catch {
    // La pile est peut-être déjà arrêtée.
  }
  if (receiver) await new Promise((resolve) => receiver.close(resolve));
}

/** Attend une purge qui contient ce chemin ; rend la requête, ou `null` après 5 s. */
async function purgeOf(path, after) {
  for (let i = 0; i < 50; i += 1) {
    const hit = received.slice(after).find((r) => r.body?.paths?.includes(path));
    if (hit) return hit;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

async function run() {
  // Les items : deux films pour remplacer, deux fiches d'une même personne
  // pour la fusion, un item par autre case.
  const film = await item('Film', 1);
  const film2 = await item('Autre film', 1);
  const series = await item('Série', 2);
  const person = await item('Personne', 3);
  const personDouble = await item('Personne doublon', 3);
  const track = await item('Chanson', 4);
  const place = await item('Lieu', 5);

  const owner = await giveProfile(await anonymous(), 'proprio');
  owner.bentoId = await giveBento(owner);
  // Les deux fiches de la même personne, l'une artiste, l'autre créatrice :
  // la fusion vidait la première case (§4.8).
  await fill(owner.bentoId, { film, series, artist: personDouble, track, creator: person, place });
  owner.secondId = await giveBento(owner, { slug: 'second', primary: false });
  owner.draftId = await giveBento(owner, { published: false, slug: 'brouillon', primary: false });
  await fill(owner.draftId, { film });

  const other = await giveProfile(await anonymous(), 'autre');
  other.bentoId = await giveBento(other);
  await fill(other.bentoId, { film });

  const visitor = await anonymous();
  const reader = anonClient();

  // ─── 1. Écrire (D2, D3) ────────────────────────────────────────────────
  console.log('Écrire');
  let r = await why(owner, owner.bentoId, 'film', 'Le premier film vu au cinéma avec mon père.');
  check(
    'le propriétaire écrit le pourquoi d\'une case',
    !r.error && row(r.data)?.case_key === 'film' && row(r.data)?.body === 'Le premier film vu au cinéma avec mon père.' &&
      row(r.data)?.status === 'visible',
    r.error ?? JSON.stringify(row(r.data)),
  );
  r = await why(owner, owner.bentoId, 'film', 'Le premier film vu au cinéma.');
  check('il le remplace', !r.error && (await stored(owner.bentoId, 'film'))?.body === 'Le premier film vu au cinéma.', r.error ?? '');
  r = await why(owner, owner.bentoId, 'series', 'Pour la musique du générique.');
  check('une deuxième case', !r.error, r.error ?? '');
  r = await why(owner, owner.bentoId, 'series', '   ');
  check(
    'vide, il s\'efface',
    !r.error && (r.data ?? []).length === 0 && (await stored(owner.bentoId, 'series')) === null,
    r.error ?? JSON.stringify(r.data),
  );
  r = await why(other, owner.bentoId, 'film', 'Je passe par là.');
  check('jamais sur le bento d\'un autre', r.error === 'why_not_yours', r.error ?? 'accepté');
  r = await why(visitor, owner.bentoId, 'film', 'Je passe par là.');
  check('ni depuis un compte sans profil', r.error === 'why_not_yours', r.error ?? 'accepté');
  {
    // Un profil d'avant les règles, sans `terms_accepted_at`, et son bento.
    const noTerms = await anonymous();
    const pseudo = `c12regles${tag}`.slice(0, 20);
    pseudos.push(pseudo);
    const { error } = await admin.from('users').insert({ id: noTerms.id, pseudo, terms_accepted_at: null });
    if (error) throw new Error(`profil sans règles : ${error.message}`);
    const bentoId = await giveBento(noTerms);
    await fill(bentoId, { film: film2 });
    r = await why(noTerms, bentoId, 'film', 'Sans les règles.');
    check('ni sans les règles acceptées', r.error === 'why_not_yours', r.error ?? 'accepté');
  }
  {
    const { error } = await reader.rpc('set_bento_why', { p_bento: owner.bentoId, p_case: 'film', p_body: 'Sans session' });
    check('ni sans session', Boolean(error), error?.message ?? 'accepté');
  }
  r = await why(owner, owner.draftId, 'series', 'Une case vide.');
  check('ni sur une case vide', r.error === 'why_case_empty', r.error ?? 'accepté');
  r = await call(owner.client, 'set_bento_why', { p_bento: owner.bentoId, p_case: 'inconnue', p_body: 'Une case qui n\'existe pas.' });
  check('ni sur une case inconnue', r.error === 'why_case_empty', r.error ?? 'accepté');
  {
    const { error } = await owner.client
      .from('bento_whys')
      .insert({ bento_id: owner.bentoId, category_id: CASES.track.id, body: 'En direct' });
    check('aucune insertion directe', Boolean(error), error?.code ?? 'acceptée');
    const { error: e2, data: d2 } = await owner.client
      .from('bento_whys')
      .update({ body: 'Changé en direct' })
      .eq('bento_id', owner.bentoId)
      .select('id');
    check(
      'aucune modification directe',
      Boolean(e2) || (d2 ?? []).length === 0,
      e2?.code ?? `${d2?.length} lignes`,
    );
  }

  // ─── 2. Le texte (D5) ──────────────────────────────────────────────────
  console.log('Le texte');
  r = await why(owner, owner.bentoId, 'track', 'a'.repeat(120));
  check('120 caractères acceptés', !r.error, r.error ?? '');
  r = await why(owner, owner.bentoId, 'track', 'a'.repeat(121));
  check('121 refusés', r.error === 'why_invalid', r.error ?? 'accepté');
  r = await why(owner, owner.bentoId, 'track', '  Un   refrain\n\nqui\treste  ');
  check('une ligne, les blancs réduits', row(r.data)?.body === 'Un refrain qui reste', r.error ?? JSON.stringify(row(r.data)));
  r = await why(owner, owner.bentoId, 'track', 'Une cloche \u0007 ici');
  check('un caractère de contrôle refusé', r.error === 'why_invalid', r.error ?? 'accepté');
  r = await why(owner, owner.bentoId, 'track', 'Elle me donne envie de danser 💃🎶');
  check('les émojis passent', !r.error && row(r.data)?.body?.includes('💃'), r.error ?? '');
  for (const text of ['quel c0nnard', 'va voir www.exemple.com', 'écris-moi sur exemple.fr']) {
    r = await why(owner, owner.bentoId, 'place', text);
    check(`refusé par le filtre : « ${text} »`, r.error === 'why_refused_filter', r.error ?? 'accepté');
  }
  {
    // Un compte à part : ces vingt écritures ne doivent pas peser sur le
    // rythme des autres contrôles.
    const words = await giveProfile(await anonymous(), 'mots');
    words.bentoId = await giveBento(words);
    await fill(words.bentoId, { film: film2 });
    const accepted = [
      'réputation', 'une dispute', 'computer', 'je suis en retard', 'un espresso',
      'administration', 'officiel', 'Picasso', 'grosso modo', 'Spice Girls',
      'un fagot', 'la crise', 'Zelda', 'Naruto', 'le Parrain',
      'député', 'Mario Kart', 'Assassin\'s Creed', 'Twin Peaks', 'Kill Bill',
    ];
    const wrongly = [];
    for (const text of accepted) {
      const x = await why(words, words.bentoId, 'film', `Pour ${text}, voilà.`);
      if (x.error) wrongly.push(`${text} (${x.error})`);
    }
    check('aucun des 20 mots courants refusé', wrongly.length === 0, wrongly.join(', '));
  }

  // ─── 3. Lire (D1, D10) ─────────────────────────────────────────────────
  console.log('Lire');
  {
    const seen = await readEmbedded(reader, owner.bentoId);
    check(
      'à la clé anonyme, la page embarque le pourquoi sous sa case',
      !seen.error && seen.whys[CASES.film.id] === 'Le premier film vu au cinéma.',
      seen.error ?? JSON.stringify(seen.whys),
    );
    const { error } = await reader.from('bento_whys').select('status').limit(1);
    check('l\'état ne se lit pas', Boolean(error), error?.code ?? 'lu');
    const { error: e2 } = await reader.from('bento_whys').select('hidden_reason').limit(1);
    check('le motif non plus', Boolean(e2), e2?.code ?? 'lu');
  }
  r = await why(owner, owner.draftId, 'film', 'Un brouillon, pas encore en ligne.');
  check('il écrit sur un bento non publié', !r.error, r.error ?? '');
  {
    const seen = await readEmbedded(reader, owner.draftId);
    const { data } = await reader.from('bento_whys').select('body').eq('bento_id', owner.draftId);
    check(
      'qui ne se lit pas tant qu\'il n\'est pas publié',
      Object.keys(seen.whys).length === 0 && (data ?? []).length === 0,
      JSON.stringify(seen.whys),
    );
  }
  {
    // Un item proposé par le propriétaire, en attente de validation.
    const { data: proposed, error } = await owner.client
      .from('items')
      .insert({ category_id: CASES.film.id, external_source: 'user', title: `Proposé ${tag}` })
      .select('id')
      .single();
    if (error) throw new Error(`proposition : ${error.message}`);
    itemIds.push(proposed.id);
    const { error: e2 } = await owner.client
      .from('bento_items')
      .upsert({ bento_id: owner.secondId, category_id: CASES.film.id, item_id: proposed.id }, { onConflict: 'bento_id,category_id' });
    if (e2) throw new Error(`case en attente : ${e2.message}`);
    r = await why(owner, owner.secondId, 'film', 'Mon film préféré, pas encore au catalogue.');
    check('il écrit sur la case d\'un item en attente', !r.error, r.error ?? '');
    const { data } = await reader.from('bento_whys').select('body').eq('bento_id', owner.secondId);
    check('qui ne se lit pas avant la validation', (data ?? []).length === 0, JSON.stringify(data));
    const mine = await call(owner.client, 'my_bento_whys', { p_bento: owner.secondId });
    check('son propriétaire le lit', mine.data?.length === 1, mine.error ?? JSON.stringify(mine.data));
    await admin.from('items').update({ status: 'validated' }).eq('id', proposed.id);
    const { data: after } = await reader.from('bento_whys').select('body').eq('bento_id', owner.secondId);
    check('validé, il se lit', (after ?? []).length === 1, JSON.stringify(after));
  }
  await whysSwitch(false);
  {
    const seen = await readEmbedded(reader, owner.bentoId);
    check('l\'interrupteur éteint, rien ne se lit', Object.keys(seen.whys).length === 0, JSON.stringify(seen.whys));
    r = await why(owner, owner.bentoId, 'place', 'Pendant la coupure');
    check('et rien ne s\'écrit', r.error === 'whys_closed', r.error ?? 'accepté');
  }
  await whysSwitch(true);
  {
    const seen = await readEmbedded(reader, owner.bentoId);
    check('rallumé, tout revient', seen.whys[CASES.film.id] === 'Le premier film vu au cinéma.', JSON.stringify(seen.whys));
  }

  // ─── 4. Masqué, puis réécrit (D8) ──────────────────────────────────────
  console.log('Masqué, puis réécrit');
  {
    await admin
      .from('bento_whys')
      .update({ status: 'hidden', hidden_reason: 'Spam ou arnaque', hidden_at: new Date().toISOString(), hidden_by: 'recette' })
      .eq('bento_id', owner.bentoId)
      .eq('category_id', CASES.track.id);
    const seen = await readEmbedded(reader, owner.bentoId);
    check('masqué, il ne se lit plus', !(CASES.track.id in seen.whys), JSON.stringify(seen.whys));
    const mine = await call(owner.client, 'my_bento_whys', { p_bento: owner.bentoId });
    const hidden = (mine.data ?? []).find((w) => w.case_key === 'track');
    check(
      'son propriétaire le lit masqué, avec le motif',
      hidden?.status === 'hidden' && hidden?.hidden_reason === 'Spam ou arnaque',
      mine.error ?? JSON.stringify(hidden),
    );
    const others = await call(other.client, 'my_bento_whys', { p_bento: owner.bentoId });
    check('personne d\'autre', !others.error && (others.data ?? []).length === 0, others.error ?? JSON.stringify(others.data));
    r = await why(owner, owner.bentoId, 'track', 'Elle me donne envie de danser 💃🎶');
    check(
      'le même texte réenregistré reste masqué',
      row(r.data)?.status === 'hidden' && (await stored(owner.bentoId, 'track'))?.status === 'hidden',
      r.error ?? JSON.stringify(row(r.data)),
    );
    r = await why(owner, owner.bentoId, 'track', 'Le refrain de mes vacances.');
    const back = await stored(owner.bentoId, 'track');
    check(
      'un autre texte revient, sans l\'ancien motif',
      row(r.data)?.status === 'visible' && back?.status === 'visible' && back?.hidden_reason === null,
      r.error ?? JSON.stringify(back),
    );
  }

  // ─── 5. Quand la case change (D7, D17) ─────────────────────────────────
  console.log('Quand la case change');
  {
    // Le remplacement de la 1.1 et de la 0.1.0 : un `upsert` des trois colonnes.
    const { error } = await owner.client
      .from('bento_items')
      .upsert({ bento_id: owner.bentoId, category_id: CASES.film.id, item_id: film2 }, { onConflict: 'bento_id,category_id' });
    check('remplacer l\'item, comme la 1.1', !error, error?.message ?? '');
    check('efface son pourquoi', (await stored(owner.bentoId, 'film')) === null, JSON.stringify(await stored(owner.bentoId, 'film')));
    r = await why(owner, owner.bentoId, 'film', 'Le nouveau, alors.');
    const { error: e2 } = await owner.client
      .from('bento_items')
      .upsert({ bento_id: owner.bentoId, category_id: CASES.film.id, item_id: film2 }, { onConflict: 'bento_id,category_id' });
    check(
      'réécrire le même item le garde',
      !e2 && (await stored(owner.bentoId, 'film'))?.body === 'Le nouveau, alors.',
      e2?.message ?? JSON.stringify(await stored(owner.bentoId, 'film')),
    );
    r = await why(owner, owner.bentoId, 'place', 'On y retourne chaque été.');
    const { error: e3 } = await owner.client
      .from('bento_items')
      .delete()
      .eq('bento_id', owner.bentoId)
      .eq('category_id', CASES.place.id);
    check('vider la case, comme la 1.1', !e3, e3?.message ?? '');
    check('l\'efface aussi', (await stored(owner.bentoId, 'place')) === null, '');
    await fill(owner.bentoId, { place });

    r = await why(owner, owner.bentoId, 'artist', 'Sa voix, dès la première note.');
    const r2 = await why(owner, owner.bentoId, 'creator', 'Ses vidéos du dimanche.');
    check('deux pourquoi sur les deux fiches d\'une même personne', !r.error && !r2.error, r.error ?? r2.error ?? '');
    const { error: e4 } = await admin.rpc('admin_merge_items', { canonical_id: person, loser_ids: [personDouble] });
    check('la fusion des deux fiches', !e4, e4?.message ?? '');
    const { data: cases } = await admin
      .from('bento_items')
      .select('category_id, item_id')
      .eq('bento_id', owner.bentoId)
      .in('category_id', [CASES.artist.id, CASES.creator.id]);
    check(
      'ne vide plus la case de la fiche fusionnée',
      cases?.length === 2 && cases.every((c) => c.item_id === person),
      JSON.stringify(cases),
    );
    check(
      'et garde ses deux pourquoi',
      (await stored(owner.bentoId, 'artist'))?.body === 'Sa voix, dès la première note.' &&
        (await stored(owner.bentoId, 'creator'))?.body === 'Ses vidéos du dimanche.',
      '',
    );
    // Le drapeau de la fusion ne vit que dans sa transaction : remplacer
    // ensuite efface toujours.
    const { error: e5 } = await owner.client
      .from('bento_items')
      .upsert({ bento_id: owner.bentoId, category_id: CASES.creator.id, item_id: personDouble }, { onConflict: 'bento_id,category_id' });
    check(
      'après la fusion, remplacer efface toujours',
      !e5 && (await stored(owner.bentoId, 'creator')) === null,
      e5?.message ?? JSON.stringify(await stored(owner.bentoId, 'creator')),
    );
  }

  // ─── 6. Signaler (D8) ──────────────────────────────────────────────────
  console.log('Signaler');
  {
    const target = await stored(owner.bentoId, 'track');
    r = await call(visitor.client, 'submit_report', { p_target_kind: 'why', p_target: target.id, p_reason: 'spam' });
    check('un compte sans profil signale un pourquoi', !r.error && typeof r.data === 'string', r.error ?? '');
    const reportId = r.data;
    const { data: rep } = await admin
      .from('reports')
      .select('target_kind, target_why_id, target_text, target_bento_id, target_user_id, target_pseudo, reason_code')
      .eq('id', reportId)
      .single();
    check(
      'le texte copié, le bento et son auteur notés',
      rep?.target_kind === 'why' && rep.target_why_id === target.id && rep.target_text === 'Le refrain de mes vacances.' &&
        rep.target_bento_id === owner.bentoId && rep.target_user_id === owner.id && rep.target_pseudo === owner.pseudo,
      JSON.stringify(rep),
    );
    r = await call(visitor.client, 'submit_report', { p_target_kind: 'why', p_target: target.id, p_reason: 'hate' });
    check('un seul en attente par signaleur et par cible', r.data === reportId, r.error ?? String(r.data));
    r = await call(owner.client, 'submit_report', { p_target_kind: 'why', p_target: target.id, p_reason: 'spam' });
    check('jamais le sien', r.error === 'report_invalid', r.error ?? 'accepté');
    await owner.client.from('bento_items').delete().eq('bento_id', owner.bentoId).eq('category_id', CASES.track.id);
    const { data: kept } = await admin.from('reports').select('target_why_id, target_text').eq('id', reportId).single();
    check(
      'la trace survit à son effacement',
      kept?.target_why_id === null && kept?.target_text === 'Le refrain de mes vacances.',
      JSON.stringify(kept),
    );
    await fill(owner.bentoId, { track });
  }

  // ─── 7. Le rythme (D18) ────────────────────────────────────────────────
  console.log('Le rythme');
  {
    const quick = await giveProfile(await anonymous(), 'rythme');
    quick.bentoId = await giveBento(quick);
    await fill(quick.bentoId, { film });
    const results = [];
    for (let i = 0; i < 31; i += 1) {
      results.push(await why(quick, quick.bentoId, 'film', `Version ${i}`));
    }
    check(
      'au-delà de 30 écritures par heure, refusé',
      results.slice(0, 30).every((x) => !x.error) && results[30].error === 'why_too_fast',
      results.map((x) => x.error ?? 'ok').slice(28).join(', '),
    );
    r = await why(quick, quick.bentoId, 'film', 'Version 29');
    check('au plafond, le même texte passe : il ne compte pas', !r.error && row(r.data)?.body === 'Version 29', r.error ?? '');
    r = await why(quick, quick.bentoId, 'film', '');
    check('effacer reste permis', !r.error && (await stored(quick.bentoId, 'film')) === null, r.error ?? '');
    owner.quick = quick;
  }

  // ─── 8. Les versions publiées et la landing (§4.7) ─────────────────────
  console.log('Les versions publiées et la landing');
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
      const { error } = await visitor.client.from('bentos').select(select).eq('id', owner.bentoId);
      if (error) broken.push(`${select.slice(0, 40)}… : ${error.message}`);
    }
    check('les cinq lectures embarquées de la 1.1 et de la 0.1.0', broken.length === 0, broken.join(' | '));
    const { error: landingError } = await reader
      .from('users')
      .select(
        'pseudo, display_name, kind, searchable, avatar, bentos(id, slug, is_primary, edition_id, published_at, is_featured, editions(slug, title, bento_categories(key, prompt, stamp, gender, display_order)), bento_items(category_id, bento_categories(key), items(id, title, subtitle, year, image_url, image_credit)))',
      )
      .eq('pseudo', owner.pseudo);
    check('la requête de la landing', !landingError, landingError?.message ?? '');
    const { error: adminError } = await admin
      .from('users')
      .select('id, pseudo, bentos(id, slug, is_primary, published_at, bento_items(count))')
      .eq('id', owner.id);
    check('celle des utilisateurs au back-office', !adminError, adminError?.message ?? '');
    const { error: reportError } = await visitor.client.from('reports').insert({
      reporter_id: visitor.id,
      target_kind: 'bento',
      target_pseudo: owner.pseudo,
      target_bento_id: owner.bentoId,
      reason: null,
    });
    check('le signalement de la 1.1 passe toujours', !reportError, reportError?.message ?? '');
  }

  // ─── 9. L'export (D13) ─────────────────────────────────────────────────
  console.log('L\'export');
  r = await call(owner.client, 'my_social_export', {});
  {
    const whys = r.data?.whys ?? [];
    const artist = whys.find((w) => w.case === 'artist' && w.bento_id === owner.bentoId);
    check(
      'ses pourquoi, avec la clé de leur case et leur état',
      !r.error && whys.length >= 4 && artist?.body === 'Sa voix, dès la première note.' && artist?.status === 'visible',
      r.error ?? JSON.stringify(whys.slice(0, 2)),
    );
  }

  // ─── 10. Supprimer son compte ──────────────────────────────────────────
  console.log('Supprimer son compte');
  {
    const quick = owner.quick;
    r = await call(quick.client, 'delete_own_account', {});
    check('delete_own_account du chantier 28', !r.error, r.error ?? '');
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      admin.from('bento_whys').select('id', { count: 'exact', head: true }).eq('bento_id', quick.bentoId),
      admin.from('bento_why_writes').select('user_id', { count: 'exact', head: true }).eq('user_id', quick.id),
    ]);
    check('ses pourquoi et son journal partent avec lui', c1 === 0 && c2 === 0, `${c1}, ${c2}`);
    created.delete(quick.id);
    registered.push(quick.id);
  }

  // ─── 11. La page web suit (D16) ────────────────────────────────────────
  console.log('La page web suit');
  if (!DB_CONTAINER) {
    console.log('  (sans DB_CONTAINER : la purge n\'est pas contrôlée)');
    return;
  }
  await openReceiver();
  {
    const path = `/u/${owner.pseudo.toLowerCase()}`;
    let mark = received.length;
    r = await why(owner, owner.bentoId, 'series', 'Pour le générique, encore.');
    let hit = await purgeOf(path, mark);
    check(
      'écrire purge la page du bento, avec le jeton',
      hit !== null && hit.url === '/api/revalidate' && hit.auth === `Bearer ${RECEIVER_TOKEN}` &&
        hit.body.paths.includes(`${path}/mon-bento`),
      hit ? JSON.stringify(hit.body) : 'aucune purge',
    );
    mark = received.length;
    await admin
      .from('bento_whys')
      .update({ status: 'hidden', hidden_reason: 'Autre', hidden_at: new Date().toISOString(), hidden_by: 'recette' })
      .eq('bento_id', owner.bentoId)
      .eq('category_id', CASES.series.id);
    hit = await purgeOf(path, mark);
    check('masquer aussi', hit !== null, hit ? '' : 'aucune purge');
    mark = received.length;
    r = await why(owner, owner.bentoId, 'series', '');
    hit = await purgeOf(path, mark);
    check('effacer aussi', hit !== null, hit ? '' : 'aucune purge');
    mark = received.length;
    r = await why(owner, owner.draftId, 'film', 'Toujours pas en ligne.');
    hit = await purgeOf(`${path}/brouillon`, mark);
    check('rien pour un bento non publié', hit === null, hit ? JSON.stringify(hit.body) : '');
  }
}

async function cleanup() {
  await whysSwitch(true).catch(() => {});
  await closeReceiver();
  const ids = [...created];
  if (ids.length > 0) {
    await admin.from('reports').delete().in('reporter_id', ids);
    await admin.from('reports').delete().in('target_user_id', ids);
  }
  if (pseudos.length > 0) await admin.from('reports').delete().in('target_pseudo', pseudos);
  for (const id of ids) {
    await admin.from('users').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }
  if (registered.length > 0) await admin.from('user_deletions').delete().in('deleted_user_id', registered);
  // Les items en dernier : une case les retient (`on delete restrict`).
  if (itemIds.length > 0) {
    await admin.from('item_aliases').delete().in('item_id', itemIds);
    await admin.from('items').delete().in('id', itemIds);
  }
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
