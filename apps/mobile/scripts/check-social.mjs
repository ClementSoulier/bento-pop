/**
 * Contrôles « likes, commentaires et modération », chantier 22, lot 1.
 *
 * Contre un Supabase **local**, jamais la production : le script refuse toute
 * cible qui n'est pas sur 127.0.0.1 ou localhost. Il passe par le vrai
 * `supabase-js`, à la clé anonyme, avec de vrais comptes : ce qu'il garde vit
 * dans les fonctions, les droits et les règles de la base.
 *
 *   eval "$(supabase status -o env --workdir <dossier> | sed 's/^/export /')"
 *   TARGET="$API_URL" ANON_KEY="$ANON_KEY" SERVICE_KEY="$SERVICE_ROLE_KEY" \
 *   node scripts/check-social.mjs
 *
 * Chaque « ok » est un comportement tenu, chaque « ECHEC » un défaut ; le
 * décompte final doit annoncer zéro échec. Tout ce que le script crée,
 * comptes, profils, bentos, likes, commentaires, blocages et signalements,
 * est retiré à la fin, même après un échec.
 *
 * Ce que ces contrôles gardent, §6.1, §7.1 et §10 de la spécification :
 *
 *    1. aimer, ne plus aimer, une fois par compte, jamais le sien, ni chez
 *       qui refuse ou a bloqué (D5, D9, D14, DoD 1) ;
 *    2. commenter selon D3, et aucun autre chemin d'écriture (DoD 2) ;
 *    3. le filtre : les mots de sa liste et les liens refusés, les 20 mots
 *       de §1.2 acceptés (D6, DoD 3) ;
 *    4. la longueur, la ligne unique et le rythme (D6, D7) ;
 *    5. lire : les masqués pour leur seul auteur, avec leur motif, sans les
 *       comptes bloqués (D8, D9) ;
 *    6. supprimer : l'auteur, le propriétaire, personne d'autre (D8) ;
 *    7. refuser les commentaires, les likes, et l'interrupteur (D14, D15,
 *       DoD 6, DoD 9) ;
 *    8. signaler un commentaire, un compte ou un bento, depuis un compte sans
 *       profil compris, la copie du texte, un seul en attente (D10, DoD 4) ;
 *    9. les versions publiées : leur signalement accepté, leurs lectures du
 *       profil et de la configuration inchangées (§6.5) ;
 *   10. le blocage versé depuis le téléphone (D9) ;
 *   11. l'export de ses données (D21) ;
 *   12. supprimer son compte emporte likes, commentaires et blocages.
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

/**
 * `supabase-js` construit un client temps réel dès `createClient`, qui
 * réclame un WebSocket natif absent de Node 20 : même parade que
 * `check-account.mjs`. Sans stockage, aucune session n'est rangée.
 */
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
/** Les comptes que `delete_own_account` a inscrits au registre. */
const registered = [];

/** Un compte anonyme neuf, comme au premier lancement de l'app. */
async function anonymous() {
  const client = anonClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`connexion anonyme : ${error?.message}`);
  created.add(data.user.id);
  return { client, id: data.user.id };
}

/**
 * Un compte gardé, son adresse confirmée, comme après « Garde ton compte »
 * du chantier 28. Créé à la clé de service pour ne pas dépendre de Mailpit,
 * que `check-account.mjs` contrôle déjà.
 */
async function kept(name) {
  const email = `c22-${name}-${tag}@recette.test`;
  const password = `c22-${tag}-${name}-secret`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`compte gardé : ${error?.message}`);
  created.add(data.user.id);
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`connexion : ${signInError.message}`);
  return { client, id: data.user.id };
}

/** Un profil, et un bento publié ou non, posés à la clé de service. */
async function giveProfile(account, name, { published = true, slug = 'mon-bento' } = {}) {
  const pseudo = `c22${name}${tag}`.slice(0, 20);
  pseudos.push(pseudo);
  const { error: e1 } = await admin
    .from('users')
    .insert({ id: account.id, pseudo, terms_accepted_at: new Date().toISOString() });
  if (e1) throw new Error(`profil : ${e1.message}`);
  const bentoId = await giveBento(account, { published, slug, primary: true });
  return { ...account, pseudo, bentoId };
}

async function giveBento(account, { published, slug, primary }) {
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

async function setting(account, column, value) {
  const { error } = await account.client.from('users').update({ [column]: value }).eq('id', account.id);
  if (error) throw new Error(`réglage ${column} : ${error.message}`);
}

async function commentsSwitch(on) {
  const { error } = await admin.from('app_config').update({ comments_enabled: on }).eq('id', 1);
  if (error) throw new Error(`interrupteur : ${error.message}`);
}

async function run() {
  const owner = await giveProfile(await kept('proprio'), 'proprio');
  const author = await giveProfile(await kept('auteur'), 'auteur');
  const stranger = await giveProfile(await kept('tiers'), 'tiers');
  const anonWithBento = await giveProfile(await anonymous(), 'anonyme');
  const keptNoBento = await kept('sansbento');
  // Un pseudo et ses règles, mais rien en ligne : 36 profils en production.
  const keptDraft = await giveProfile(await kept('brouillon'), 'brouillon', { published: false });
  const visitor = await anonymous();
  const draftId = await giveBento(stranger, { published: false, slug: 'brouillon', primary: false });

  // ─── 1. Aimer ──────────────────────────────────────────────────────────
  console.log('Aimer');
  let r = await call(visitor.client, 'set_like', { p_bento: owner.bentoId, p_liked: true });
  check('un compte anonyme sans profil aime un bento', !r.error && row(r.data)?.likes === 1 && row(r.data)?.liked === true, r.error ?? JSON.stringify(row(r.data)));
  r = await call(visitor.client, 'set_like', { p_bento: owner.bentoId, p_liked: true });
  check('aimer deux fois ne compte qu\'une fois', !r.error && row(r.data)?.likes === 1, r.error ?? JSON.stringify(row(r.data)));
  r = await call(author.client, 'set_like', { p_bento: owner.bentoId, p_liked: true });
  check('un deuxième compte fait deux', !r.error && row(r.data)?.likes === 2, r.error ?? JSON.stringify(row(r.data)));
  r = await call(author.client, 'set_like', { p_bento: owner.bentoId, p_liked: false });
  check('ne plus aimer retire son cœur', !r.error && row(r.data)?.likes === 1 && row(r.data)?.liked === false, r.error ?? JSON.stringify(row(r.data)));
  r = await call(owner.client, 'set_like', { p_bento: owner.bentoId, p_liked: true });
  check('jamais son propre bento', r.error === 'like_not_allowed', r.error ?? 'accepté');
  r = await call(visitor.client, 'set_like', { p_bento: draftId, p_liked: true });
  check('jamais un bento non publié', r.error === 'bento_not_found', r.error ?? 'accepté');
  {
    const { error } = await visitor.client.from('bento_likes').insert({ bento_id: stranger.bentoId, user_id: visitor.id });
    check('aucune écriture directe dans bento_likes', Boolean(error), error?.code ?? 'acceptée');
  }

  await setting(owner, 'accept_likes', false);
  r = await call(author.client, 'set_like', { p_bento: owner.bentoId, p_liked: true });
  check('un propriétaire qui refuse les likes n\'en reçoit aucun', r.error === 'like_not_allowed', r.error ?? 'accepté');
  {
    const { data } = await anonymous().then((a) => a.client.rpc('bento_social', { p_bentos: [owner.bentoId] }));
    const s = row(data);
    check('refusés, ni nombre ni cœur, lu à la clé anonyme', s && s.likes === null && s.accepts_likes === false, JSON.stringify(s));
  }
  await setting(owner, 'accept_likes', true);

  await call(owner.client, 'set_block', { p_blocked: author.id, p_on: true });
  r = await call(author.client, 'set_like', { p_bento: owner.bentoId, p_liked: true });
  check('un compte bloqué n\'aime plus les bentos de qui l\'a bloqué', r.error === 'like_not_allowed', r.error ?? 'accepté');
  await call(owner.client, 'set_block', { p_blocked: author.id, p_on: false });

  // ─── 2. Qui peut commenter (D3) ────────────────────────────────────────
  console.log('Qui peut commenter');
  r = await call(visitor.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'Bonjour' });
  check('un compte anonyme sans profil ne commente pas', r.error === 'comment_needs_bento', r.error ?? 'accepté');
  r = await call(keptNoBento.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'Bonjour' });
  check('un compte gardé sans bento ne commente pas', r.error === 'comment_needs_bento', r.error ?? 'accepté');
  r = await call(keptDraft.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'Bonjour' });
  check('un compte gardé avec un pseudo mais sans bento en ligne ne commente pas', r.error === 'comment_needs_bento', r.error ?? 'accepté');
  r = await call(anonWithBento.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'Bonjour' });
  check('un compte anonyme qui a publié ne commente pas', r.error === 'comment_needs_kept_account', r.error ?? 'accepté');
  r = await call(author.client, 'post_comment', { p_bento: owner.bentoId, p_body: '  Super bento,\n\ntrès bon choix !  ' });
  const first = row(r.data);
  check('un compte gardé qui a publié commente', !r.error && first?.author_pseudo === author.pseudo, r.error ?? '');
  check('le texte tient sur une ligne, sans espaces autour', first?.body === 'Super bento, très bon choix !', JSON.stringify(first?.body));
  {
    const { error } = await author.client
      .from('bento_comments')
      .insert({ bento_id: owner.bentoId, author_id: author.id, body: 'direct' });
    check('aucune écriture directe dans bento_comments', Boolean(error), error?.code ?? 'acceptée');
    const { data } = await visitor.client.from('bento_comments').select('id');
    check('aucune lecture directe de bento_comments', !data || data.length === 0, `${data?.length ?? 0} lignes`);
  }

  // ─── 3. Le filtre (D6) ─────────────────────────────────────────────────
  console.log('Le filtre');
  const refused = [
    'quel connard',
    'QUEL C0NNARD',
    'quel connnnnard',
    'espèce d\'enculé',
    'fdp',
    'sale​ pute',
    'nigger',
    'va voir www.exemple.com',
    'https://exemple.org/x',
    'écris-moi sur exemple.fr',
    'mon.mail@gmail.com',
  ];
  for (const text of refused) {
    const { data } = await admin.rpc('comment_filter_hit', { p_body: text });
    check(`refusé : « ${text.replace('​', '·')} »`, typeof data === 'string', data ?? 'accepté');
  }
  const accepted = [
    'réputation', 'une dispute', 'computer', 'je suis en retard', 'un espresso',
    'administration', 'officiel', 'Picasso', 'grosso modo', 'Spice Girls',
    'un fagot', 'la crise', 'Zelda', 'Naruto', 'le Parrain',
    'député', 'Mario Kart', 'Assassin\'s Creed', 'Twin Peaks', 'Kill Bill',
  ];
  const wrongly = [];
  for (const text of accepted) {
    const { data } = await admin.rpc('comment_filter_hit', { p_body: text });
    if (data) wrongly.push(`${text} (${data})`);
  }
  check('aucun des 20 mots de §1.2 refusé', wrongly.length === 0, wrongly.join(', '));
  {
    const { data } = await admin.rpc('comment_filter_hit', { p_body: 'Le Niger, un pique-nique et les Negroni' });
    check('ni « Niger », ni « pique-nique », ni « Negroni »', data === null, data ?? '');
  }
  r = await call(author.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'quel c0nnard' });
  check('un commentaire refusé par le filtre ne s\'écrit pas', r.error === 'comment_refused_filter', r.error ?? 'accepté');

  // ─── 4. Longueur ───────────────────────────────────────────────────────
  console.log('Longueur');
  r = await call(author.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'a'.repeat(281) });
  check('281 caractères refusés', r.error === 'comment_invalid', r.error ?? 'accepté');
  r = await call(author.client, 'post_comment', { p_bento: owner.bentoId, p_body: ' \n\t ' });
  check('un commentaire vide refusé', r.error === 'comment_invalid', r.error ?? 'accepté');
  r = await call(author.client, 'post_comment', { p_bento: owner.bentoId, p_body: `${'é'.repeat(279)}🍙` });
  check('280 caractères acceptés, émoji compris', !r.error, r.error ?? '');

  // ─── 5. Lire ───────────────────────────────────────────────────────────
  console.log('Lire');
  r = await call(stranger.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'Je passe par là' });
  const strangerComment = row(r.data);
  let list = await call(visitor.client, 'list_bento_comments', { p_bento: owner.bentoId });
  check('trois commentaires visibles', list.data?.length === 3, `${list.data?.length}`);
  check(
    'du plus récent au plus ancien',
    list.data?.[0]?.id === strangerComment?.id && list.data?.[2]?.id === first?.id,
    (list.data ?? []).map((c) => c.author_pseudo).join(', '),
  );
  check(
    'le lecteur ne supprime pas ceux des autres',
    (list.data ?? []).every((c) => c.can_delete === false && c.is_mine === false),
  );
  list = await call(owner.client, 'list_bento_comments', { p_bento: owner.bentoId });
  check('le propriétaire peut tous les supprimer', (list.data ?? []).every((c) => c.can_delete === true));

  await admin
    .from('bento_comments')
    .update({ status: 'hidden', hidden_reason: 'Harcèlement ou insultes', hidden_at: new Date().toISOString(), hidden_by: 'recette' })
    .eq('id', first.id);
  list = await call(visitor.client, 'list_bento_comments', { p_bento: owner.bentoId });
  check('un commentaire masqué disparaît pour les autres', !(list.data ?? []).some((c) => c.id === first.id), `${list.data?.length}`);
  list = await call(author.client, 'list_bento_comments', { p_bento: owner.bentoId });
  const hidden = (list.data ?? []).find((c) => c.id === first.id);
  check(
    'son auteur le voit, avec le motif',
    hidden?.status === 'hidden' && hidden?.hidden_reason === 'Harcèlement ou insultes',
    JSON.stringify(hidden ?? null),
  );
  list = await call(stranger.client, 'list_bento_comments', { p_bento: owner.bentoId });
  check(
    'le motif ne se lit pas ailleurs',
    (list.data ?? []).every((c) => c.hidden_reason === null),
  );
  // Rétabli par l'équipe, le motif oublié dans la ligne : la base ne le rend
  // toujours qu'à l'auteur.
  await admin.from('bento_comments').update({ status: 'visible' }).eq('id', first.id);
  list = await call(stranger.client, 'list_bento_comments', { p_bento: owner.bentoId });
  check(
    'un commentaire rétabli ne dit pas son ancien motif aux autres',
    (list.data ?? []).some((c) => c.id === first.id && c.hidden_reason === null),
    JSON.stringify((list.data ?? []).find((c) => c.id === first.id) ?? null),
  );
  await admin.from('bento_comments').update({ status: 'hidden' }).eq('id', first.id);
  {
    const { data } = await visitor.client.rpc('bento_social', { p_bentos: [owner.bentoId, author.bentoId] });
    const s = (data ?? []).find((x) => x.bento_id === owner.bentoId);
    check('le nombre ne compte pas le masqué', s?.comments === 2, JSON.stringify(s));
    check('un nombre par bento demandé', (data ?? []).length === 2, `${data?.length}`);
  }

  await call(visitor.client, 'set_block', { p_blocked: stranger.id, p_on: true });
  list = await call(visitor.client, 'list_bento_comments', { p_bento: owner.bentoId });
  check('qui bloque ne voit plus les commentaires du bloqué', !(list.data ?? []).some((c) => c.author_id === stranger.id));
  list = await call(author.client, 'list_bento_comments', { p_bento: owner.bentoId });
  check('les autres les voient toujours', (list.data ?? []).some((c) => c.author_id === stranger.id));
  await call(visitor.client, 'set_block', { p_blocked: stranger.id, p_on: false });

  await call(owner.client, 'set_block', { p_blocked: stranger.id, p_on: true });
  list = await call(author.client, 'list_bento_comments', { p_bento: owner.bentoId });
  check('bloqué par le propriétaire, ses commentaires disparaissent pour tous', !(list.data ?? []).some((c) => c.author_id === stranger.id));
  r = await call(stranger.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'Encore moi' });
  check('et il ne peut plus commenter', r.error === 'comment_not_allowed', r.error ?? 'accepté');
  await call(owner.client, 'set_block', { p_blocked: stranger.id, p_on: false });

  // ─── 6. Supprimer ──────────────────────────────────────────────────────
  console.log('Supprimer');
  r = await call(stranger.client, 'delete_comment', { p_comment: first.id });
  check('un autre ne supprime pas', r.data === false, JSON.stringify(r));
  r = await call(author.client, 'delete_comment', { p_comment: first.id });
  check('l\'auteur supprime le sien, même masqué', r.data === true, JSON.stringify(r));
  r = await call(owner.client, 'delete_comment', { p_comment: strangerComment.id });
  check('le propriétaire supprime celui d\'un autre sur son bento', r.data === true, JSON.stringify(r));

  // ─── 7. Refuser, l'interrupteur ────────────────────────────────────────
  console.log('Refuser et couper');
  await setting(owner, 'accept_comments', false);
  r = await call(author.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'Toujours là ?' });
  check('un propriétaire qui refuse les commentaires n\'en reçoit aucun', r.error === 'comments_closed', r.error ?? 'accepté');
  {
    const fresh = await anonymous();
    const { data: rows } = await fresh.client.rpc('list_bento_comments', { p_bento: owner.bentoId });
    const { data: social } = await fresh.client.rpc('bento_social', { p_bentos: [owner.bentoId] });
    check(
      'ceux déjà écrits sont masqués, vérifié à la clé anonyme',
      (rows ?? []).length === 0 && row(social)?.comments === null && row(social)?.accepts_comments === false,
      `${rows?.length} lignes, ${JSON.stringify(row(social))}`,
    );
  }
  await setting(owner, 'accept_comments', true);
  list = await call(visitor.client, 'list_bento_comments', { p_bento: owner.bentoId });
  check('rallumé, ils reviennent', (list.data ?? []).length === 1, `${list.data?.length}`);
  {
    const { error } = await stranger.client.from('users').update({ accept_comments: false }).eq('id', owner.id);
    const { data } = await admin.from('users').select('accept_comments').eq('id', owner.id).single();
    check('personne ne change le réglage d\'un autre', !error && data?.accept_comments === true, error?.message ?? '');
  }

  await commentsSwitch(false);
  r = await call(author.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'Coupé ?' });
  check('l\'interrupteur éteint refuse d\'écrire', r.error === 'comments_closed', r.error ?? 'accepté');
  list = await call(visitor.client, 'list_bento_comments', { p_bento: owner.bentoId });
  check('et ne rend plus rien', (list.data ?? []).length === 0, `${list.data?.length}`);
  {
    const { data } = await visitor.client.rpc('bento_social', { p_bentos: [owner.bentoId] });
    check('les likes restent', row(data)?.likes === 1 && row(data)?.comments === null, JSON.stringify(row(data)));
  }
  await commentsSwitch(true);

  // ─── 8. Signaler ───────────────────────────────────────────────────────
  console.log('Signaler');
  r = await call(author.client, 'post_comment', { p_bento: owner.bentoId, p_body: 'À signaler' });
  const target = row(r.data);
  r = await call(visitor.client, 'submit_report', {
    p_target_kind: 'comment',
    p_target: target.id,
    p_reason: 'harassment',
    p_details: '  vu dans la page  ',
  });
  const reportId = r.data;
  check('un compte sans profil signale un commentaire', !r.error && typeof reportId === 'string', r.error ?? '');
  {
    const { data } = await admin.from('reports').select('*').eq('id', reportId).single();
    check(
      'la cible lue en base, le texte copié',
      data?.target_kind === 'comment' && data?.target_text === 'À signaler' && data?.target_user_id === author.id &&
        data?.target_pseudo === author.pseudo && data?.target_bento_id === owner.bentoId && data?.details === 'vu dans la page' &&
        data?.status === 'pending',
      JSON.stringify(data),
    );
  }
  r = await call(visitor.client, 'submit_report', { p_target_kind: 'comment', p_target: target.id, p_reason: 'spam' });
  check('un seul signalement en attente par cible', r.data === reportId, JSON.stringify(r));
  r = await call(visitor.client, 'submit_report', { p_target_kind: 'account', p_target: author.id, p_reason: 'hate' });
  check('signaler un compte', !r.error, r.error ?? '');
  r = await call(visitor.client, 'submit_report', { p_target_kind: 'bento', p_target: owner.bentoId, p_reason: 'other' });
  check('signaler un bento', !r.error, r.error ?? '');
  r = await call(author.client, 'submit_report', { p_target_kind: 'account', p_target: author.id, p_reason: 'spam' });
  check('pas soi-même', r.error === 'report_invalid', r.error ?? 'accepté');
  r = await call(visitor.client, 'submit_report', { p_target_kind: 'comment', p_target: target.id, p_reason: 'nimporte' });
  check('un motif inconnu refusé', r.error === 'report_invalid', r.error ?? 'accepté');
  await call(author.client, 'delete_comment', { p_comment: target.id });
  {
    const { data } = await admin.from('reports').select('target_comment_id, target_text').eq('id', reportId).single();
    check('le texte survit à la suppression du commentaire', data?.target_comment_id === null && data?.target_text === 'À signaler', JSON.stringify(data));
  }
  {
    // L'insertion de `src/lib/report.ts` des versions publiées, telle quelle.
    const { error } = await visitor.client.from('reports').insert({
      reporter_id: visitor.id,
      target_kind: 'bento',
      target_pseudo: owner.pseudo,
      target_bento_id: owner.bentoId,
      reason: null,
    });
    check('le signalement des versions publiées, depuis un compte sans profil', !error, error?.message ?? '');
    const { error: statusError } = await visitor.client.from('reports').insert({
      reporter_id: visitor.id,
      target_kind: 'bento',
      target_pseudo: owner.pseudo,
      status: 'dismissed',
    });
    check('un signalement naît toujours en attente', Boolean(statusError), statusError?.code ?? 'accepté');
  }
  {
    // Les autres lectures des versions publiées sur ce que la migration
    // touche : le profil en entier, et la configuration par ses colonnes.
    const { data: profile, error: profileError } = await visitor.client.from('users').select('*').eq('id', owner.id).single();
    check('le profil se lit toujours en entier', !profileError && profile?.pseudo === owner.pseudo, profileError?.message ?? '');
    const { error: configError } = await visitor.client
      .from('app_config')
      .select('maintenance_mode, maintenance_title, maintenance_message, ios_min_version, ios_latest_version, android_min_version, android_latest_version')
      .eq('id', 1)
      .maybeSingle();
    check('la configuration se lit toujours par ses colonnes', !configError, configError?.message ?? '');
  }

  // ─── 9. Le rythme (D7) ─────────────────────────────────────────────────
  console.log('Le rythme');
  const quick = [];
  for (let i = 0; i < 6; i += 1) {
    quick.push(await call(stranger.client, 'post_comment', { p_bento: author.bentoId, p_body: `Rafale ${i}` }));
  }
  check(
    'au-delà de 5 par minute, refusé',
    quick.slice(0, 5).every((x) => !x.error) && quick[5].error === 'comment_too_fast',
    quick.map((x) => x.error ?? 'ok').join(', '),
  );

  // ─── 10. Le blocage versé ──────────────────────────────────────────────
  console.log('Le blocage versé');
  r = await call(visitor.client, 'sync_blocks', {
    p_blocked: [author.id, '00000000-0000-4000-8000-000000000000', visitor.id],
  });
  check(
    'la liste locale versée, sans compte disparu ni soi-même',
    !r.error && r.data?.length === 1 && r.data[0].blocked_id === author.id && r.data[0].pseudo === author.pseudo,
    r.error ?? JSON.stringify(r.data),
  );
  r = await call(visitor.client, 'set_block', { p_blocked: visitor.id, p_on: true });
  check('pas soi-même', r.error === 'block_invalid', r.error ?? 'accepté');
  {
    const { data } = await visitor.client.from('account_blocks').select('*');
    check('aucune lecture directe des blocages', !data || data.length === 0, `${data?.length ?? 0} lignes`);
  }

  // ─── 11. L'export (D21) ────────────────────────────────────────────────
  console.log('L\'export');
  r = await call(visitor.client, 'my_social_export', {});
  check(
    'ses likes et ses blocages',
    r.data?.likes?.length === 1 && r.data?.blocks?.length === 1 && Array.isArray(r.data?.comments),
    JSON.stringify(r.data),
  );

  // ─── 12. Supprimer son compte ──────────────────────────────────────────
  console.log('Supprimer son compte');
  await call(stranger.client, 'set_like', { p_bento: owner.bentoId, p_liked: true });
  r = await call(stranger.client, 'delete_own_account', {});
  check('delete_own_account du chantier 28', !r.error, r.error ?? '');
  {
    const [{ count: c1 }, { count: c2 }, { count: c3 }] = await Promise.all([
      admin.from('bento_comments').select('id', { count: 'exact', head: true }).eq('author_id', stranger.id),
      admin.from('bento_likes').select('bento_id', { count: 'exact', head: true }).eq('user_id', stranger.id),
      admin.from('account_blocks').select('blocker_id', { count: 'exact', head: true }).or(`blocker_id.eq.${stranger.id},blocked_id.eq.${stranger.id}`),
    ]);
    check('ses commentaires, ses likes et ses blocages partent avec lui', c1 === 0 && c2 === 0 && c3 === 0, `${c1}, ${c2}, ${c3}`);
    created.delete(stranger.id);
    registered.push(stranger.id);
  }
}

async function cleanup() {
  await commentsSwitch(true).catch(() => {});
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
  // `delete_own_account` inscrit le compte supprimé au registre : on retire
  // cette entrée-là seulement.
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
