/**
 * Vérifie les privilèges du projet mobile contre le Supabase **local**.
 *
 * Deux moitiés, qui ne valent rien l'une sans l'autre. Les attaques d'abord :
 * ce qu'un client malveillant ferait avec la clé publique et une session
 * anonyme, que la migration `20260915000000_close_privilege_gaps.sql` doit
 * refuser ou neutraliser. Le parcours de l'app ensuite, rejoué avec les
 * fonctions de l'app quand elles prennent leur client en paramètre, et avec
 * les chaînes recopiées de `bento-actions.ts`, `items.ts`, `session.ts` et
 * `report.ts` sinon : un droit retiré de trop casserait les versions déjà
 * publiées, qui envoient exactement ces requêtes-là.
 *
 * Il crée des comptes et écrit en base : **jamais contre la production**. Le
 * script refuse toute cible qui n'est pas `127.0.0.1`.
 *
 *   cd apps/mobile
 *   supabase start && supabase db reset --local
 *   npx tsx scripts/check-privileges.ts
 *
 * Cf. `docs/MON-BENTO-POP-UX-ROADMAP.md`, ménage en attente.
 */
import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadFeedPage } from '../src/lib/feed';
import { isPseudoTaken } from '../src/lib/pseudo-availability';
import { loadPublicBento } from '../src/lib/public-bento';
import { loadSharedItems, searchBentos } from '../src/lib/search';
import { loadSuggestions } from '../src/lib/suggestions';
import { describeApp, recordVisit } from '../src/lib/telemetry';
import { STUB_CLIENT_OPTIONS } from '../src/test/postgrest-stub';
import type { Database } from '../src/supabase/types';

type Typed = SupabaseClient<Database>;
type Raw = SupabaseClient;

const status = Object.fromEntries(
  execSync('supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const cut = line.indexOf('=');
      return [line.slice(0, cut), line.slice(cut + 1).replace(/^"|"$/g, '')];
    }),
);
const URL_ = status.API_URL ?? '';
const ANON = status.ANON_KEY ?? '';
const SERVICE = status.SERVICE_ROLE_KEY ?? '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(URL_) || !ANON || !SERVICE) {
  console.error(`Cible refusée : « ${URL_} ». Ce script n'écrit que dans le Supabase local.`);
  process.exit(1);
}

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok   ' : 'ÉCHEC'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

const typed = (): Typed => createClient<Database>(URL_, ANON, STUB_CLIENT_OPTIONS);
const raw = (token?: string): Raw =>
  createClient(URL_, ANON, {
    ...STUB_CLIENT_OPTIONS,
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
const service: Raw = createClient(URL_, SERVICE, STUB_CLIENT_OPTIONS);
const anon = raw();

/** Une session anonyme, comme au premier lancement de l'app. */
async function member() {
  const client = typed();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session || !data.user)
    throw new Error(`inscription anonyme : ${error?.message}`);
  return { client, uid: data.user.id, rawClient: raw(data.session.access_token) };
}

const stamp = Date.now().toString().slice(-7);
const today = () => new Date().toISOString();

// Pas d'`await` au niveau du module : `tsx` compile ce paquet en CommonJS.
async function main(): Promise<void> {
  // ─── Données de départ, posées par le service comme le back-office ────────
  const categories = ['film', 'series', 'artist', 'track', 'creator', 'place'] as const;
  const catalogue: Record<string, string> = {};
  for (const [index, key] of categories.entries()) {
    const { data, error } = await service
      .from('items')
      .insert({
        category_id: index + 1,
        external_source: 'admin',
        status: 'validated',
        title: `Catalogue ${key} ${stamp}`,
      })
      .select('id, status')
      .single();
    if (error || !data) throw new Error(`catalogue : ${error?.message}`);
    catalogue[key] = data.id as string;
  }

  const alice = await member();
  const bob = await member();
  const alicePseudo = `alice${stamp}`;
  const bobPseudo = `bob${stamp}`;

  console.log('\nParcours de l’app, tel que les versions publiées l’envoient\n');

  check('pseudo libre', !(await isPseudoTaken(alice.client, alicePseudo)));
  {
    const { error } = await alice.client
      .from('users')
      .insert({ id: alice.uid, pseudo: alicePseudo, terms_accepted_at: today() });
    check('création du profil (pseudo.tsx)', !error, error?.message);
  }
  {
    const { error } = await bob.client
      .from('users')
      .insert({ id: bob.uid, pseudo: bobPseudo, terms_accepted_at: today() });
    check('création d’un second profil', !error, error?.message);
  }
  {
    const { error } = await alice.client
      .from('users')
      .update({ terms_accepted_at: today() })
      .eq('id', alice.uid);
    check('réacceptation des CGU (terms.tsx)', !error, error?.message);
  }
  {
    const { data, error } = await alice.client
      .from('users')
      .select('*')
      .eq('id', alice.uid)
      .maybeSingle();
    check(
      'lecture du profil en select * (session.ts)',
      !error && data?.pseudo === alicePseudo,
      error?.message,
    );
  }
  check(
    'télémétrie écrite (telemetry.ts)',
    await recordVisit(alice.client, alice.uid, describeApp('ios', '1.2.0')),
  );

  let bentoId = '';
  {
    const { data: existing } = await alice.client
      .from('bentos')
      .select('id')
      .eq('user_id', alice.uid)
      .maybeSingle();
    const { data: created, error } = await alice.client
      .from('bentos')
      .insert({ user_id: alice.uid })
      .select('id')
      .single();
    bentoId = created?.id ?? '';
    check('création du bento (ensureBento)', !existing && !error && !!bentoId, error?.message);
  }
  for (const [index, key] of categories.entries()) {
    const { error } = await alice.client
      .from('bento_items')
      .upsert(
        { bento_id: bentoId, category_id: index + 1, item_id: catalogue[key]! },
        { onConflict: 'bento_id,category_id' },
      );
    check(`case ${key} remplie (setBentoSlot)`, !error, error?.message);
  }
  {
    const { data, error } = await alice.client
      .from('items')
      .insert({ category_id: 1, external_source: 'user', title: `Proposition ${stamp}` })
      .select('id')
      .single();
    check('proposition d’item (submitItem)', !error && !!data?.id, error?.message);
    const { data: own } = await alice.rawClient
      .from('items')
      .select('status')
      .eq('id', data?.id ?? '')
      .maybeSingle();
    check('la proposition attend la modération', own?.status === 'pending', own?.status);
  }
  {
    const { data, error } = await alice.client
      .from('bentos')
      .select(
        'id, published_at, bento_items ( category_id, items ( id, title, subtitle, image_url, image_credit, status ) )',
      )
      .eq('user_id', alice.uid)
      .maybeSingle();
    check(
      'relecture du bento (hydrateBentoFromRemote)',
      !error && data?.id === bentoId,
      error?.message,
    );
  }
  {
    const { error } = await alice.client
      .from('bentos')
      .update({ published_at: today() })
      .eq('id', bentoId)
      .is('published_at', null);
    check('publication (publishBento)', !error, error?.message);
  }
  {
    const page = await loadFeedPage(anon as unknown as Typed);
    check(
      'le fil montre le bento publié',
      page.bentos.some((b) => b.pseudo === alicePseudo),
    );
  }
  {
    const result = await loadPublicBento(anon as unknown as Typed, alicePseudo);
    check('la page publique le montre', result?.bento != null);
  }
  {
    const rows = await searchBentos(anon as unknown as Typed, alicePseudo);
    check(
      '« Trouver » le trouve par pseudo',
      rows.some((row) => row.pseudo === alicePseudo),
    );
  }
  check(
    'les items partagés se chargent',
    Array.isArray(await loadSharedItems(anon as unknown as Typed)),
  );
  check(
    'les suggestions se chargent',
    Array.isArray(await loadSuggestions(anon as unknown as Typed, 'film')),
  );
  {
    const { data: profile, error: profileError } = await alice.client
      .from('users')
      .select('*')
      .eq('id', alice.uid)
      .maybeSingle();
    const { error: bentoError } = await alice.client
      .from('bentos')
      .select(
        'id, is_featured, featured_order, published_at, created_at, updated_at, bento_items ( category_id, added_at, items ( id, title, subtitle, year, image_url, external_source, external_id, metadata ) )',
      )
      .eq('user_id', alice.uid)
      .maybeSingle();
    check(
      'export des données (data-export.ts)',
      !profileError && !!profile && !bentoError,
      profileError?.message ?? bentoError?.message,
    );
  }
  {
    const { error } = await bob.client.from('reports').insert({
      reporter_id: bob.uid,
      target_kind: 'bento',
      target_pseudo: alicePseudo,
      target_bento_id: null,
      reason: null,
    });
    check('signalement (report.ts)', !error, error?.message);
  }

  console.log('\nAttaques, à refuser ou à neutraliser\n');

  {
    const { data } = await anon
      .from('users')
      .select('last_seen_at, platform, app_version')
      .eq('id', alice.uid)
      .maybeSingle();
    check(
      'un visiteur ne lit aucune télémétrie',
      data != null &&
        data.last_seen_at === null &&
        data.platform === null &&
        data.app_version === null,
      JSON.stringify(data),
    );
    const { data: kept } = await service
      .from('user_telemetry')
      .select('platform, app_version, last_seen_at')
      .eq('user_id', alice.uid)
      .maybeSingle();
    check(
      'le back-office la retrouve dans user_telemetry',
      kept?.platform === 'ios' && kept?.app_version === '1.2.0',
      JSON.stringify(kept),
    );
  }
  {
    const { error } = await alice.rawClient
      .from('users')
      .update({ kind: 'editorial', terms_accepted_at: null })
      .eq('id', alice.uid);
    const { data } = await anon.from('users').select('kind').eq('id', alice.uid).maybeSingle();
    check('un membre ne se déclare pas invité', !!error && data?.kind === 'member', error?.message);
  }
  {
    const eve = await member();
    const { error } = await eve.rawClient
      .from('users')
      .insert({ id: eve.uid, pseudo: `eve${stamp}`, kind: 'editorial' });
    check('un profil ne naît pas invité', !!error, error?.message);
  }
  {
    const { error } = await alice.rawClient
      .from('users')
      .update({ pseudo: `renomme${stamp}` })
      .eq('id', alice.uid);
    check('un membre ne change pas son pseudo par l’API', !!error, error?.message);
  }
  for (const attempt of [
    { external_source: 'tmdb', title: `Titre libre tmdb ${stamp}` },
    { external_source: 'admin', status: 'validated', title: `Titre libre admin ${stamp}` },
  ]) {
    const { data, error } = await alice.rawClient
      .from('items')
      .insert({ category_id: 1, ...attempt })
      .select('id, status')
      .single();
    check(
      `un item ${attempt.external_source} n’entre pas validé`,
      !!error || data?.status === 'pending',
      error?.message ?? data?.status,
    );
  }
  {
    const { data } = await anon.rpc('search_items', {
      q: `titre libre`,
      category_key: 'film',
      lim: 10,
    });
    const leaked =
      (data as { title: string }[] | null)?.filter((row) => row.title.includes(stamp)) ?? [];
    check(
      'la recherche publique ne les montre pas',
      leaked.length === 0,
      leaked.map((row) => row.title).join(', '),
    );
  }
  {
    // Avant la migration, la RLS rendait déjà « 0 ligne » : on vérifie le titre
    // en base, pas seulement le code de retour.
    const { error } = await alice.rawClient
      .from('items')
      .update({ title: `Détourné ${stamp}` })
      .eq('id', catalogue.film!);
    const { data } = await service.from('items').select('title').eq('id', catalogue.film!).single();
    check(
      'un membre ne modifie pas un item',
      data?.title === `Catalogue film ${stamp}`,
      error?.message ?? data?.title,
    );
  }
  {
    const { error: patchError } = await alice.rawClient
      .from('bentos')
      .update({ is_featured: true })
      .eq('id', bentoId);
    check('un membre ne se met pas en avant par mise à jour', !!patchError, patchError?.message);
    const { error: deleteError } = await alice.rawClient
      .from('bentos')
      .delete()
      .eq('user_id', alice.uid);
    const { error: insertError } = await alice.rawClient
      .from('bentos')
      .insert({ user_id: alice.uid, is_featured: true, featured_order: 1, published_at: today() });
    check(
      'ni en supprimant puis réinsérant son bento',
      !deleteError && !!insertError,
      insertError?.message ?? deleteError?.message,
    );
    const { data: featured } = await anon.from('bentos').select('user_id').eq('is_featured', true);
    check('aucun coup de cœur usurpé', !(featured ?? []).some((row) => row.user_id === alice.uid));
  }
  {
    const { error } = await bob.rawClient.from('reports').insert({
      reporter_id: bob.uid,
      target_kind: 'pseudo',
      target_pseudo: alicePseudo,
      status: 'dismissed',
    });
    check('un signalement ne naît pas classé', !!error, error?.message);
  }
  {
    const { error } = await alice.rawClient.rpc('admin_merge_items', {
      canonical_id: catalogue.film,
      loser_ids: [catalogue.series],
    });
    check('admin_merge_items refusé à un membre', !!error, error?.message);
  }

  console.log('\nBack-office, par la clé de service\n');

  {
    const { data, error } = await service
      .from('users')
      .insert({ pseudo: `invite${stamp}`, display_name: 'Invité', kind: 'editorial' })
      .select('id')
      .single();
    check('création d’un profil éditorial', !error && !!data?.id, error?.message);
    const { data: bento, error: bentoError } = await service
      .from('bentos')
      .insert({ user_id: data?.id })
      .select('id')
      .single();
    const { error: featureError } = await service
      .from('bentos')
      .update({ published_at: today(), is_featured: true })
      .eq('id', bento?.id ?? '');
    check(
      'son bento publié et mis en avant',
      !bentoError && !featureError,
      bentoError?.message ?? featureError?.message,
    );
  }
  {
    const { error } = await service.rpc('admin_merge_items', {
      canonical_id: catalogue.film,
      loser_ids: [],
    });
    check('admin_merge_items reste ouvert au service', !error, error?.message);
  }
  {
    const { error } = await bob.client.from('users').delete().eq('id', bob.uid);
    check('suppression de son compte (deleteOwnAccount)', !error, error?.message);
  }

  console.log(failures === 0 ? '\nTout est conforme.\n' : `\n${failures} échec(s).\n`);
}

main().then(
  () => process.exit(failures === 0 ? 0 : 1),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
