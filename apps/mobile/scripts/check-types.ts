/**
 * Vérifie le modèle type et case contre le Supabase **local**.
 *
 * Ce que la migration `20260915100000_item_types_and_cases.sql` promet : le
 * type d'un élément est séparé de la case qui l'accueille, la recherche d'une
 * case cherche dans son type, et une case n'accepte jamais un item d'un autre
 * type. Le parcours des versions publiées, lui, est rejoué par
 * `check-privileges.ts`, qui doit rester vert à côté de celui-ci.
 *
 * Il crée des comptes et écrit en base : **jamais contre la production**. Le
 * script refuse toute cible qui n'est pas `127.0.0.1`.
 *
 *   cd apps/mobile
 *   supabase start && supabase db reset --local
 *   npx tsx scripts/check-types.ts
 *
 * Cf. `docs/UX-15-NOUVELLES-CATEGORIES.md`.
 */
import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { STUB_CLIENT_OPTIONS } from '../src/test/postgrest-stub';

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

const client = (token?: string): SupabaseClient =>
  createClient(URL_, ANON, {
    ...STUB_CLIENT_OPTIONS,
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
const service: SupabaseClient = createClient(URL_, SERVICE, STUB_CLIENT_OPTIONS);
const anon = client();
const stamp = Date.now().toString().slice(-6);

type Row = { id: number; key: string; type_id?: number; is_active?: boolean };

// Pas d'`await` au niveau du module : `tsx` compile ce paquet en CommonJS.
async function main(): Promise<void> {
  const { data: typeRows } = await service
    .from('item_types')
    .select('id, key, is_active')
    .order('display_order');
  const types = (typeRows ?? []) as Row[];
  const typeId = (key: string) => types.find((t) => t.key === key)?.id ?? -1;
  const { data: caseRows } = await service.from('bento_categories').select('id, key, type_id');
  const cases = (caseRows ?? []) as Row[];
  const caseRow = (key: string) => cases.find((c) => c.key === key);

  console.log('\nLes types et les cases\n');

  // Les neuf types de la migration, et pas « exactement neuf » : le
  // back-office en crée d'autres, et un script lancé avant celui-ci aussi.
  const seeded: Record<string, boolean> = {
    film: true,
    series: true,
    person: true,
    song: true,
    place: true,
    video_game: false,
    book: false,
    dish: false,
    activity: false,
  };
  check(
    'les neuf types de la migration, les quatre nouveaux inactifs',
    Object.entries(seeded).every(
      ([key, active]) => types.find((t) => t.key === key)?.is_active === active,
    ),
    types.map((t) => `${t.key}${t.is_active ? '' : '°'}`).join(' '),
  );
  const expected: Record<string, string> = {
    film: 'film',
    series: 'series',
    artist: 'person',
    track: 'song',
    creator: 'person',
    place: 'place',
  };
  check(
    'chaque case du bento principal a son type',
    Object.entries(expected).every(([c, t]) => caseRow(c)?.type_id === typeId(t)),
  );
  {
    const { data } = await anon.from('item_types').select('key');
    const active = types
      .filter((t) => t.is_active)
      .map((t) => t.key)
      .sort();
    const seen = ((data ?? []) as { key: string }[]).map((t) => t.key).sort();
    check(
      'un visiteur ne lit que les types actifs',
      seen.join(',') === active.join(','),
      seen.join(', '),
    );
  }

  const create = async (caseKey: string, title: string) => {
    const { data, error } = await service
      .from('items')
      .insert({
        category_id: caseRow(caseKey)?.id,
        external_source: 'admin',
        status: 'validated',
        title,
      })
      .select('id, type_id')
      .single();
    if (error || !data) throw new Error(`création de « ${title} » : ${error?.message}`);
    return data as { id: string; type_id: number };
  };
  const creator = await create('creator', `Créatrice ${stamp}`);
  const film = await create('film', `Film ${stamp}`);
  check('un item de la case Créateur est une Personne', creator.type_id === typeId('person'));

  console.log('\nLa recherche par type\n');

  {
    const { data } = await anon.rpc('search_items', {
      q: `créatrice ${stamp}`,
      category_key: 'artist',
      lim: 5,
    });
    const rows = (data ?? []) as { id: string }[];
    check(
      'la case Artiste trouve une Personne rangée comme créateur',
      rows.some((r) => r.id === creator.id),
    );
  }
  {
    const { data } = await anon.rpc('popular_items', {
      category_key: 'artist',
      lim: 200,
      exclude_item: null,
    });
    const rows = (data ?? []) as { id: string }[];
    check(
      '« Au menu » de la case Artiste propose les Personnes',
      rows.some((r) => r.id === creator.id),
    );
  }
  {
    const { data } = await anon.rpc('find_similar_items', {
      q: `créatrice ${stamp}`,
      category_key: 'artist',
      threshold: 0.4,
      lim: 3,
    });
    const rows = (data ?? []) as { id: string }[];
    check(
      'l’anti-doublon de la case Artiste la voit aussi',
      rows.some((r) => r.id === creator.id),
    );
  }
  {
    const { data } = await anon.rpc('search_items', {
      q: `créatrice ${stamp}`,
      category_key: 'film',
      lim: 5,
    });
    const rows = (data ?? []) as { id: string }[];
    check('la case Film ne la trouve pas', !rows.some((r) => r.id === creator.id));
  }

  console.log('\nLe parcours d’un membre\n');

  const member = await client().auth.signInAnonymously();
  const token = member.data.session?.access_token;
  const uid = member.data.user?.id;
  if (!token || !uid) throw new Error(`inscription anonyme : ${member.error?.message}`);
  const me = client(token);
  await me
    .from('users')
    .insert({ id: uid, pseudo: `typ${stamp}`, terms_accepted_at: new Date().toISOString() });

  {
    const { data } = await me
      .from('items')
      .insert({
        category_id: caseRow('creator')?.id,
        external_source: 'user',
        title: `Proposition ${stamp}`,
      })
      .select('type_id, status')
      .single();
    check(
      'une proposition des versions publiées reçoit le type de sa case',
      data?.type_id === typeId('person') && data?.status === 'pending',
      JSON.stringify(data),
    );
  }
  {
    const { data } = await me
      .from('items')
      .insert({
        category_id: caseRow('creator')?.id,
        type_id: typeId('dish'),
        external_source: 'user',
        title: `Détour ${stamp}`,
      })
      .select('type_id')
      .single();
    check(
      'un client n’impose pas un autre type que celui de la case',
      data?.type_id === typeId('person'),
      JSON.stringify(data),
    );
  }

  const { data: bento } = await me.from('bentos').insert({ user_id: uid }).select('id').single();
  const bentoId = (bento as { id: string } | null)?.id ?? '';
  {
    const { error } = await me
      .from('bento_items')
      .upsert(
        { bento_id: bentoId, category_id: caseRow('artist')?.id, item_id: creator.id },
        { onConflict: 'bento_id,category_id' },
      );
    check('une Personne se pose dans la case Artiste', !error, error?.message);
  }
  {
    const { error } = await me
      .from('bento_items')
      .insert({ bento_id: bentoId, category_id: caseRow('place')?.id, item_id: film.id });
    check('un film est refusé dans la case Lieu', !!error, error?.message);
  }
  {
    const { error } = await me
      .from('item_types')
      .insert({ key: `pirate${stamp}`, label_fr: 'Pirate' });
    check('un client ne crée pas de type', !!error, error?.message);
  }
  {
    const { error } = await me
      .from('bento_categories')
      .update({ type_id: typeId('dish') })
      .eq('key', 'artist');
    check('un client ne change pas le type d’une case', !!error, error?.message);
  }

  console.log('\nLe back-office\n');

  {
    const { data, error } = await service
      .from('items')
      .insert({
        type_id: typeId('book'),
        external_source: 'admin',
        status: 'draft',
        title: `Livre ${stamp}`,
      })
      .select('type_id, category_id')
      .single();
    check(
      'un livre se crée sans case',
      !error && data?.category_id === null && data?.type_id === typeId('book'),
      error?.message ?? JSON.stringify(data),
    );
  }
  {
    const twin = await create('artist', `Créatrice bis ${stamp}`);
    const { error } = await service.rpc('admin_merge_items', {
      canonical_id: creator.id,
      loser_ids: [twin.id],
    });
    check('deux Personnes se fusionnent', !error, error?.message);
  }
  {
    const { error } = await service
      .from('items')
      .update({ category_id: null, type_id: typeId('series') })
      .eq('id', creator.id);
    check('un item posé ne change pas pour un autre type que sa case', !!error, error?.message);
  }
  {
    const loose = await create('creator', `Arcane ${stamp}`);
    const { data, error } = await service
      .from('items')
      .update({ category_id: caseRow('series')?.id })
      .eq('id', loose.id)
      .select('type_id')
      .single();
    check(
      'un item jamais posé se range dans une autre case, et prend son type',
      !error && data?.type_id === typeId('series'),
      error?.message ?? JSON.stringify(data),
    );
  }

  console.log(failures === 0 ? '\nModèle conforme.\n' : `\n${failures} échec(s).\n`);
}

main().then(
  () => process.exit(failures === 0 ? 0 : 1),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
