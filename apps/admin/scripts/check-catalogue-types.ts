/**
 * Vérifie la couche de données de l'écran « Types » et du catalogue par type,
 * contre le Supabase **local**.
 *
 * `src/lib/catalogue-types.test.ts` couvre les fonctions pures. Ce script
 * rejoue les accès à la base de `src/lib/catalogue-types.ts` : l'écran est
 * derrière une authentification de production, c'est la seule façon de les
 * vérifier sans session. Il écrit en base, donc **jamais contre la
 * production** : il refuse toute cible qui n'est pas `127.0.0.1`.
 *
 *   cd apps/mobile && supabase start && supabase db reset --local
 *   cd ../admin && npx tsx scripts/check-catalogue-types.ts
 *
 * Cf. `docs/UX-15-NOUVELLES-CATEGORIES.md`, lots 1 et 2.
 */
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@bento-pop/supabase-mobile/types';
import {
  caseKeyForType,
  changeItemType,
  createItemType,
  loadDuplicateGroups,
  loadItemTypes,
  setItemTypeActive,
  updateItemType,
  validateDrafts,
  type MobileClient,
} from '../src/lib/catalogue-types';
import { importStarterList, loadStarterStatuses } from '../src/lib/starter-import';

const status = Object.fromEntries(
  execSync('supabase status -o env', {
    cwd: new URL('../../mobile', `file://${__dirname}/`).pathname,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const cut = line.indexOf('=');
      return [line.slice(0, cut), line.slice(cut + 1).replace(/^"|"$/g, '')];
    }),
);
const URL_ = status.API_URL ?? '';
const SERVICE = status.SERVICE_ROLE_KEY ?? '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(URL_) || !SERVICE) {
  console.error(`Cible refusée : « ${URL_} ». Ce script n'écrit que dans le Supabase local.`);
  process.exit(1);
}

// Node 20 n'a pas de WebSocket natif, que `supabase-js` réclame dès `createClient`.
const db: MobileClient = createClient<Database>(URL_, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: class {} as never },
});

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok   ' : 'ÉCHEC'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

const stamp = Date.now().toString().slice(-6);
const ADMIN = '00000000-0000-4000-8000-000000000001';

async function main(): Promise<void> {
  const types = await loadItemTypes(db);
  const typeId = (key: string) => types.find((t) => t.key === key)?.id ?? -1;
  const { data: cases } = await db.from('bento_categories').select('id, key');
  const caseId = (key: string) => cases?.find((c) => c.key === key)?.id ?? -1;

  console.log('\nLes types\n');

  const person = types.find((t) => t.key === 'person');
  check(
    'neuf types au départ, dont quatre inactifs',
    types.length >= 9 && types.filter((t) => !t.active).length >= 4,
  );
  check(
    'Personne porte les cases Artiste musical et Créateur de contenu',
    person?.cases.join(',') === 'Artiste musical,Créateur de contenu',
    person?.cases.join(','),
  );

  const key = `jeu_${stamp}`;
  const created = await createItemType(db, { key, label: 'Jeu de société', order: 50 });
  check('création d’un type', created.ok);
  const again = await createItemType(db, { key, label: 'Doublon', order: 51 });
  check(
    'une clé en double est refusée en français',
    !again.ok && again.error === 'Cette clé de type existe déjà.',
    again.ok ? '' : again.error,
  );
  const bad = await createItemType(db, { key: 'Jeu-Société', label: 'x', order: 1 });
  check('une clé mal formée est refusée avant la base', !bad.ok);

  const fresh = (await loadItemTypes(db)).find((t) => t.key === key);
  check('un type créé naît inactif', fresh?.active === false);
  if (fresh) {
    const upd = await updateItemType(db, fresh.id, { label: 'Jeux de société', order: 12 });
    const after = (await loadItemTypes(db)).find((t) => t.key === key);
    check(
      'libellé et ordre se modifient',
      upd.ok && after?.label === 'Jeux de société' && after.order === 12,
    );
    const on = await setItemTypeActive(db, fresh.id, true);
    const off = await setItemTypeActive(db, fresh.id, false);
    check('un type sans case s’active et se désactive', on.ok && off.ok);
  }
  const blocked = await setItemTypeActive(db, typeId('person'), false);
  check('Personne ne se désactive pas', !blocked.ok, blocked.ok ? '' : blocked.error);

  check(
    'une case est trouvée pour Personne',
    (await caseKeyForType(db, typeId('person'))) === 'artist',
  );
  check('aucune case pour Livre', (await caseKeyForType(db, typeId('book'))) === null);

  console.log('\nChanger le type d’un item\n');

  const { data: arcane } = await db
    .from('items')
    .insert({
      category_id: caseId('creator'),
      external_source: 'admin',
      status: 'validated',
      title: `Arcane ${stamp}`,
    })
    .select('id, type_id')
    .single();
  const { data: guest } = await db
    .from('users')
    .insert({ pseudo: `invite${stamp}`, kind: 'editorial' })
    .select('id')
    .single();
  const { data: bento } = await db
    .from('bentos')
    .insert({ user_id: guest!.id })
    .select('id')
    .single();
  await db
    .from('bento_items')
    .insert({ bento_id: bento!.id, category_id: caseId('creator'), item_id: arcane!.id });

  const refused = await changeItemType(db, arcane!.id, typeId('series'));
  check(
    'un item posé en case Créateur ne passe pas en Série',
    !refused.ok,
    refused.ok ? '' : refused.error,
  );

  await db.from('bento_items').delete().eq('bento_id', bento!.id).eq('item_id', arcane!.id);
  const moved = await changeItemType(db, arcane!.id, typeId('series'));
  const { data: arcaneAfter } = await db
    .from('items')
    .select('type_id, category_id')
    .eq('id', arcane!.id)
    .single();
  check(
    'retiré du bento, il passe en Série, sans case d’origine',
    moved.ok && arcaneAfter?.type_id === typeId('series') && arcaneAfter.category_id === null,
    JSON.stringify(arcaneAfter),
  );

  console.log('\nValider des brouillons\n');

  const draftRows = await Promise.all(
    [1, 2, 3].map(async (n) => {
      const { data } = await db
        .from('items')
        .insert({
          type_id: typeId('book'),
          external_source: 'admin',
          status: 'draft',
          title: `Livre ${n} ${stamp}`,
        })
        .select('id')
        .single();
      return data!.id;
    }),
  );
  const { data: rejectedRow } = await db
    .from('items')
    .insert({
      type_id: typeId('book'),
      external_source: 'admin',
      status: 'rejected',
      title: `Refusé ${stamp}`,
    })
    .select('id')
    .single();
  const validated = await validateDrafts(db, [...draftRows, rejectedRow!.id], ADMIN);
  const { data: statuses } = await db
    .from('items')
    .select('id, status, validated_at')
    .in('id', [...draftRows, rejectedRow!.id]);
  check(
    'trois brouillons validés, et eux seuls',
    validated.ok && validated.value === 3,
    validated.ok ? String(validated.value) : validated.error,
  );
  check(
    'le refusé reste refusé, les validés ont leur date',
    statuses?.find((s) => s.id === rejectedRow!.id)?.status === 'rejected' &&
      draftRows.every((id) => {
        const row = statuses?.find((s) => s.id === id);
        return row?.status === 'validated' && row.validated_at !== null;
      }),
  );

  console.log('\nDoublons probables\n');

  const { data: asArtist } = await db
    .from('items')
    .insert({
      category_id: caseId('artist'),
      external_source: 'admin',
      status: 'validated',
      title: `Doublon Grenier ${stamp}`,
    })
    .select('id')
    .single();
  const { data: asCreator } = await db
    .from('items')
    .insert({
      category_id: caseId('creator'),
      external_source: 'admin',
      status: 'validated',
      title: `doublon grenier ${stamp}`,
    })
    .select('id')
    .single();
  const groups = await loadDuplicateGroups(db);
  const group = groups.find((g) => g.items.some((i) => i.id === asArtist!.id));
  check('un artiste et un créateur au même nom forment un groupe', group?.items.length === 2);

  const { error: mergeError } = await db.rpc('admin_merge_items', {
    canonical_id: group!.items[0]!.id,
    loser_ids: [group!.items[1]!.id],
  });
  const stillThere = (await loadDuplicateGroups(db)).some((g) =>
    g.items.some((i) => i.id === asCreator!.id),
  );
  check('fusionnés, ils sortent de la liste', !mergeError && !stillThere, mergeError?.message);

  console.log('\nListes de départ\n');

  // Un livre que l'équipe aurait déjà saisi, sous une autre casse.
  const princes = () =>
    db.from('items').select('id, external_source').eq('type_id', typeId('book')).ilike('title', 'le petit prince');
  if (((await princes()).data ?? []).length === 0) {
    await db
      .from('items')
      .insert({ type_id: typeId('book'), external_source: 'admin', status: 'validated', title: 'LE PETIT PRINCE' });
  }

  const statusOf = async (key: string) => (await loadStarterStatuses(db)).find((s) => s.typeKey === key);
  const bookBefore = await statusOf('book');
  check(
    'l’écran compte les candidats et ce qui est déjà là',
    (bookBefore?.candidates ?? 0) >= 100 && (bookBefore?.alreadyThere ?? 0) >= 1,
    JSON.stringify(bookBefore),
  );

  const first = await importStarterList(db, 'book');
  check(
    'le premier import crée ce que l’écran annonçait',
    first.ok && first.value.inserted === bookBefore?.toInsert,
    first.ok ? JSON.stringify(first.value) : first.error,
  );
  const again2 = await importStarterList(db, 'book');
  check('relancé, il ne crée rien', again2.ok && again2.value.inserted === 0);
  check(
    'un titre déjà saisi n’est pas importé une seconde fois',
    ((await princes()).data ?? []).length === 1,
  );

  const { data: imported } = await db
    .from('items')
    .select('status, category_id, external_source')
    .eq('type_id', typeId('book'))
    .like('external_id', 'starter:book:%');
  // Le trigger d'insertion valide d'office toute source autre que `user` et
  // `admin` : c'est ici qu'un import mal sourcé se verrait.
  check(
    'les importés restent des brouillons, sans case',
    (imported ?? []).length >= 100 &&
      (imported ?? []).every(
        (i) => i.status === 'draft' && i.category_id === null && i.external_source === 'admin',
      ),
    `${imported?.length} importés, statuts ${[...new Set((imported ?? []).map((i) => i.status))].join(', ')}`,
  );

  await db.from('items').update({ title: 'Dune, le cycle' }).eq('external_id', 'starter:book:dune');
  const afterRename = await importStarterList(db, 'book');
  check(
    'un brouillon importé puis renommé ne revient pas',
    afterRename.ok && afterRename.value.inserted === 0,
  );

  const dishBefore = await statusOf('dish');
  const [dishA, dishB] = await Promise.all([importStarterList(db, 'dish'), importStarterList(db, 'dish')]);
  check(
    'deux imports lancés en même temps ne doublent rien',
    dishA.ok && dishB.ok && dishA.value.inserted + dishB.value.inserted === dishBefore?.toInsert,
    dishA.ok && dishB.ok ? `${dishA.value.inserted} + ${dishB.value.inserted}` : '',
  );
  check('après import, rien ne reste à importer', (await statusOf('book'))?.toInsert === 0);

  console.log(failures === 0 ? '\nCouche de données conforme.\n' : `\n${failures} échec(s).\n`);
}

main().then(
  () => process.exit(failures === 0 ? 0 : 1),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
