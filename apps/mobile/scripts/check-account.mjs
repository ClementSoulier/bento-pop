/**
 * Contrôles « compte récupérable », chantier 28, lot 1.
 *
 * Contre un Supabase **local** et sa boîte Mailpit, jamais la production : le
 * script refuse toute cible qui n'est pas sur 127.0.0.1 ou localhost. Il
 * passe par le vrai `supabase-js` et la vraie authentification, parce que ce
 * qu'il garde vit dans GoTrue et dans sa configuration autant que dans SQL.
 *
 *   eval "$(supabase status -o env --workdir <dossier> | sed 's/^/export /')"
 *   TARGET="$API_URL" ANON_KEY="$ANON_KEY" SERVICE_KEY="$SERVICE_ROLE_KEY" \
 *   MAILPIT="$INBUCKET_URL" node scripts/check-account.mjs
 *
 * Chaque « ok » est un comportement tenu, chaque « ECHEC » un défaut ; le
 * décompte final doit annoncer zéro échec. Tout ce que le script crée, comptes,
 * profils, bentos, entrées au registre et mails, est retiré à la fin, même
 * après un échec.
 *
 * Ce que ces contrôles gardent, §6.1, §7.1 et §10 de la spécification :
 *
 *    1. garder son compte ne change pas son identifiant (DoD 1) ;
 *    2. une adresse n'est jamais rattachée sans son code (D7, DoD 3) ;
 *    3. une adresse déjà gardée n'est jamais prise par un autre compte (DoD 3) ;
 *    4. se reconnecter depuis un client neuf rend le même identifiant (DoD 2) ;
 *    5. une adresse inconnue ne crée aucun compte ;
 *    6. un code faux est refusé, un renvoi avant 60 secondes aussi (D7) ;
 *    7. `delete_own_account()` d'un compte gardé, avec profil : registre,
 *       profil, bento, compte et adresse (D8, DoD 7) ;
 *    8. `delete_own_account()` d'un compte vide : le compte seul, rien au
 *       registre (D2) ;
 *    9. la suppression des versions publiées, inchangée : le profil part, le
 *       compte reste (§6.5) ;
 *   10. la fonction refusée sans session ;
 *   11. une adresse supprimée ne retrouve plus aucun compte.
 *
 * La pile locale plafonne les comptes anonymes à 300 par heure et par IP
 * (`config.toml`) : un passage en crée sept.
 */
import { createClient } from '@supabase/supabase-js';

const TARGET = process.env.TARGET;
const ANON_KEY = process.env.ANON_KEY;
const SERVICE_KEY = process.env.SERVICE_KEY;
const MAILPIT = process.env.MAILPIT;

if (!TARGET || !ANON_KEY || !SERVICE_KEY || !MAILPIT) {
  console.error('TARGET, ANON_KEY, SERVICE_KEY et MAILPIT sont requis. Voir le docblock.');
  process.exit(1);
}
for (const url of [TARGET, MAILPIT]) {
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    console.error(`Refusé : ${url} n'est pas local. Ce script écrit et supprime des comptes.`);
    process.exit(1);
  }
}

/**
 * `supabase-js` construit un client temps réel dès `createClient`, qui
 * réclame un WebSocket natif absent de Node 20 : même parade que
 * `src/test/postgrest-stub.ts`. Sans stockage, aucune session n'est rangée.
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
const address = (name) => `c28-${name}-${tag}@recette.test`;
const created = new Set();
const pseudos = [];

/** Un compte anonyme neuf, comme au premier lancement de l'app. */
async function newAnonymous() {
  const client = anonClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`connexion anonyme : ${error?.message}`);
  created.add(data.user.id);
  return { client, id: data.user.id };
}

/**
 * Le dernier code reçu à cette adresse, lu dans Mailpit. Le corps du mail
 * porte un seul nombre de six chiffres, `{{ .Token }}`.
 */
async function codeFor(email, { after = 0 } = {}) {
  for (let i = 0; i < 40; i += 1) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages = [] } = await res.json();
    const fresh = messages.filter((m) => Date.parse(m.Created) >= after);
    if (fresh.length > 0) {
      const latest = fresh.sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created))[0];
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${latest.ID}`)).json();
      const match = /\b(\d{6})\b/.exec(full.Text ?? full.HTML ?? '');
      if (match) return { code: match[1], subject: full.Subject };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`aucun code reçu à ${email}`);
}

async function authUser(id) {
  const { data, error } = await admin.auth.admin.getUserById(id);
  return error ? null : data.user;
}

/** Un profil et un bento publié, posés à la clé de service. */
async function giveProfile(id, name) {
  const pseudo = `c28${name}${tag}`.slice(0, 20);
  pseudos.push(pseudo);
  const { error: e1 } = await admin
    .from('users')
    .insert({ id, pseudo, terms_accepted_at: new Date().toISOString() });
  if (e1) throw new Error(`profil : ${e1.message}`);
  const { data, error: e2 } = await admin
    .from('bentos')
    .insert({ user_id: id, slug: 'mon-bento', is_primary: true, published_at: new Date().toISOString() })
    .select('id')
    .single();
  if (e2) throw new Error(`bento : ${e2.message}`);
  return { pseudo, bentoId: data.id };
}

async function run() {
  // ─── 1 à 3 : garder son compte ────────────────────────────────────────
  console.log('Garder son compte');
  const kept = await newAnonymous();
  const keptEmail = address('garde');
  const sentAt = Date.now() - 1000;
  const { error: keepError } = await kept.client.auth.updateUser({ email: keptEmail });
  check('updateUser envoie un code à l\'adresse', !keepError, keepError?.message);

  const pending = await authUser(kept.id);
  check(
    'sans son code, l\'adresse n\'est pas rattachée',
    pending && !pending.email && pending.is_anonymous === true,
    `email=${pending?.email ?? 'aucun'}, anonyme=${pending?.is_anonymous}`,
  );

  const { error: wrongError } = await kept.client.auth.verifyOtp({
    email: keptEmail,
    token: '000000',
    type: 'email_change',
  });
  check('un code faux est refusé', Boolean(wrongError), wrongError?.code ?? 'accepté');

  const { error: resendError } = await kept.client.auth.updateUser({ email: keptEmail });
  check(
    'un renvoi avant 60 secondes est refusé',
    resendError?.status === 429,
    resendError ? `${resendError.status} ${resendError.code}` : 'renvoyé',
  );

  const keepMail = await codeFor(keptEmail, { after: sentAt });
  check('le mail porte le sujet de D12', keepMail.subject === 'Ton code pour garder ton compte', keepMail.subject);
  const { data: verified, error: verifyError } = await kept.client.auth.verifyOtp({
    email: keptEmail,
    token: keepMail.code,
    type: 'email_change',
  });
  check('le bon code garde le compte', !verifyError, verifyError?.message);
  const keptUser = await authUser(kept.id);
  check('l\'identifiant ne change pas', verified?.user?.id === kept.id, verified?.user?.id);
  check(
    'le compte n\'est plus anonyme et porte l\'adresse',
    keptUser?.is_anonymous === false && keptUser?.email === keptEmail,
    `email=${keptUser?.email}, anonyme=${keptUser?.is_anonymous}`,
  );
  check(
    'l\'adresse est une identité du compte',
    (keptUser?.identities ?? []).some((i) => i.provider === 'email'),
    (keptUser?.identities ?? []).map((i) => i.provider).join(',') || 'aucune',
  );

  const thief = await newAnonymous();
  const { error: takenError } = await thief.client.auth.updateUser({ email: keptEmail });
  const thiefUser = await authUser(thief.id);
  check(
    'une adresse déjà gardée est refusée à un autre compte',
    Boolean(takenError) && !thiefUser?.email && !thiefUser?.new_email,
    takenError ? `${takenError.status} ${takenError.code}` : 'acceptée',
  );

  // ─── 4 et 5 : se reconnecter ──────────────────────────────────────────
  console.log('Se reconnecter');
  const phone = anonClient();
  const askedAt = Date.now() - 1000;
  const { error: otpError } = await phone.auth.signInWithOtp({
    email: keptEmail,
    options: { shouldCreateUser: false },
  });
  check('un téléphone neuf reçoit un code', !otpError, otpError?.message);
  const signInMail = await codeFor(keptEmail, { after: askedAt });
  check('le mail porte le sujet de D12', signInMail.subject === 'Ton code pour te reconnecter', signInMail.subject);
  const { data: back, error: backError } = await phone.auth.verifyOtp({
    email: keptEmail,
    token: signInMail.code,
    type: 'email',
  });
  check('le code reconnecte au même identifiant', !backError && back?.user?.id === kept.id, backError?.message ?? back?.user?.id);

  const unknownEmail = address('inconnue');
  const { error: unknownError } = await anonClient().auth.signInWithOtp({
    email: unknownEmail,
    options: { shouldCreateUser: false },
  });
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  check(
    'une adresse inconnue ne crée aucun compte',
    unknownError?.code === 'otp_disabled' && !list.users.some((u) => u.email === unknownEmail),
    unknownError ? `${unknownError.status} ${unknownError.code}` : 'acceptée',
  );

  // ─── 7 : supprimer un compte gardé ────────────────────────────────────
  console.log('Supprimer son compte');
  const { bentoId } = await giveProfile(kept.id, 'g');
  // Le téléphone neuf de 4, qui tient la session retrouvée, en mémoire.
  const { error: deleteError } = await phone.rpc('delete_own_account');
  check('delete_own_account répond', !deleteError, deleteError?.message);
  const { data: profileAfter } = await admin.from('users').select('id').eq('id', kept.id);
  const { data: bentoAfter } = await admin.from('bentos').select('id').eq('id', bentoId);
  check('le profil et le bento sont partis', profileAfter?.length === 0 && bentoAfter?.length === 0);
  check('le compte d\'authentification est parti, son adresse avec', (await authUser(kept.id)) === null);
  const { data: registry } = await admin
    .from('user_deletions')
    .select('kind, reason, deleted_by')
    .eq('deleted_user_id', kept.id);
  check(
    'une entrée au registre, signée « app »',
    registry?.length === 1 && registry[0].deleted_by === 'app' && registry[0].kind === 'member',
    JSON.stringify(registry),
  );

  // ─── 11 : l'adresse supprimée ne retrouve rien ────────────────────────
  const { error: goneError } = await anonClient().auth.signInWithOtp({
    email: keptEmail,
    options: { shouldCreateUser: false },
  });
  // Le refus d'une adresse sans compte, et non un autre : un renvoi trop
  // proche répondrait 429 et passerait pour le bon refus.
  check(
    'une adresse supprimée ne retrouve plus de compte',
    goneError?.code === 'otp_disabled',
    goneError ? `${goneError.status} ${goneError.code}` : 'acceptée',
  );

  // ─── 8 : le compte vide d'un téléphone neuf ───────────────────────────
  const empty = await newAnonymous();
  const { error: emptyError } = await empty.client.rpc('delete_own_account');
  const { data: emptyRegistry } = await admin.from('user_deletions').select('id').eq('deleted_user_id', empty.id);
  check(
    'un compte vide part seul, sans entrée au registre',
    !emptyError && (await authUser(empty.id)) === null && emptyRegistry?.length === 0,
    emptyError?.message,
  );

  // ─── 9 : le chemin des versions publiées ──────────────────────────────
  const legacy = await newAnonymous();
  await giveProfile(legacy.id, 'l');
  const { error: legacyError } = await legacy.client.from('users').delete().eq('id', legacy.id);
  const { data: legacyProfile } = await admin.from('users').select('id').eq('id', legacy.id);
  check(
    'la 1.1 supprime toujours son profil et garde son compte, comme avant',
    !legacyError && legacyProfile?.length === 0 && (await authUser(legacy.id)) !== null,
    legacyError?.message,
  );

  // ─── 10 : sans session ────────────────────────────────────────────────
  // Refusée par le droit d'exécution, et non par la garde de la fonction :
  // les deux répondent 42501, seul le message les distingue.
  const { error: noSessionError } = await anonClient().rpc('delete_own_account');
  check(
    'sans session, la fonction est refusée par son droit d\'exécution',
    /permission denied/i.test(noSessionError?.message ?? ''),
    noSessionError?.message ?? 'acceptée',
  );

  // Le compte du voleur de 3, encore anonyme, n'a rien à perdre : il sert à
  // vérifier que la fonction ne touche que le compte appelant.
  check('le compte d\'un autre n\'a pas bougé', (await authUser(thief.id)) !== null);
}

async function cleanup() {
  for (const id of created) {
    await admin.from('user_deletions').delete().eq('deleted_user_id', id);
    await admin.from('users').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(tag)}`);
  const { messages = [] } = await res.json();
  if (messages.length > 0) {
    await fetch(`${MAILPIT}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ IDs: messages.map((m) => m.ID) }),
    });
  }
}

try {
  await run();
} catch (e) {
  failures += 1;
  console.log(`  ECHEC arrêt du script : ${e.message}`);
} finally {
  await cleanup();
}
console.log(failures === 0 ? '\nZéro échec.' : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
