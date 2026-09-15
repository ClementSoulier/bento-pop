-- Migration : sépare le type d'un élément de la case qui l'accueille.
--
-- Chantier 15, cf. `docs/UX-15-NOUVELLES-CATEGORIES.md`. Décidé le
-- 15 septembre 2026 : « il faut qu'on décorrèle la typologie de case et
-- l'intitulé. Créateur de contenu = Personne, Artiste musical = Personne,
-- Mangaka = Personne… Lieu de voyage = Lieu, Lieu de vie = Lieu. »
--
--   - le TYPE dit ce qu'est un élément, et donc où l'on cherche ;
--   - la CASE porte un intitulé, un tampon et un type.
--
-- `bento_categories` jouait les deux rôles : `items.category_id` y disait le
-- type, `bento_items.category_id` la case. D'où Joueur du Grenier et
-- lesadpanda en double, artistes et créateurs à la fois, et une recherche de
-- Squeezie dans la case Artiste qui répondait « Queen » (mesuré en production).
--
-- **Ce qui ne change pas, et pourquoi.** Les versions publiées ne lisent que
-- `bento_items.category_id`, jamais `items.category_id`, et appellent la
-- recherche par clé de case (relevé sur `main` et sur `6426779`, la 0.1.0 du
-- Play Store). Les six lignes de `bento_categories` restent donc les six cases
-- du bento principal, avec leurs identifiants et leurs clés. Les fonctions de
-- recherche gardent leur signature et résolvent case vers type : toutes les
-- versions cherchent par type dès l'application, sans mise à jour.
--
-- Conséquence assumée (décision D11 de la spec) : la case Artiste trouve et
-- propose aussi les créateurs, et inversement, puisque tous sont des Personnes.
--
-- Mesuré avant d'écrire : sur les 162 cases publiées, aucune ne porte un item
-- d'une autre catégorie que la sienne. Le contrôle strict de la section 5 ne
-- casse donc rien d'existant.
--
-- Éprouvée sur le Supabase local construit depuis les migrations :
-- `scripts/check-privileges.ts` (le parcours des versions publiées) et
-- `scripts/check-types.ts` (ce modèle) passent entièrement.
--
-- À appliquer à la main dans le SQL editor du dashboard du projet mobile
-- (`ggjgktbcqumfxrixcdyx`) : il n'y a pas de lanceur de migrations.

-- ─── 1. Les types ─────────────────────────────────────────────────────
--
-- Neuf au départ (D6, D10). Les quatre derniers restent inactifs jusqu'au
-- chantier 13, qui les montrera dans les éditions hebdomadaires : un type
-- inactif est invisible des clients, et sa recherche ne rend rien.
--
-- La clé est définitive ; le libellé se modifie dans le back-office. Aucune
-- couleur : la palette d'une tuile dépend de l'item (D4).
create table if not exists public.item_types (
  id smallint primary key generated always as identity,
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{2,19}$'),
  label_fr text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.item_types enable row level security;

drop policy if exists "item_types_read_active" on public.item_types;
create policy "item_types_read_active"
  on public.item_types
  for select
  using (is_active = true);

-- Écrits par le seul back-office, en service-role. Même régime que les
-- privilèges fermés par `20260915000000_close_privilege_gaps.sql`.
revoke insert, update, delete on public.item_types from anon, authenticated;

comment on table public.item_types is
  'Ce qu''est un élément du catalogue : Film, Personne, Lieu… Décide où '
  'l''on cherche. Distinct de la case qui accueille l''élément. Cf. '
  'docs/UX-15-NOUVELLES-CATEGORIES.md.';

insert into public.item_types (key, label_fr, display_order, is_active) values
  ('film',       'Film',      1, true),
  ('series',     'Série',     2, true),
  ('person',     'Personne',  3, true),
  ('song',       'Chanson',   4, true),
  ('place',      'Lieu',      5, true),
  ('video_game', 'Jeu vidéo', 6, false),
  ('book',       'Livre',     7, false),
  ('dish',       'Plat',      8, false),
  ('activity',   'Activité',  9, false)
on conflict (key) do nothing;

-- ─── 2. Chaque case du bento principal a un type ─────────────────────
--
-- Les intitulés et les tampons de ces six cases restent dans l'app (D8) :
-- rien ne change à l'écran. Artiste et Créateur de contenu deviennent deux
-- cases de type Personne.
alter table public.bento_categories
  add column if not exists type_id smallint references public.item_types(id);

update public.bento_categories as c
set type_id = t.id
from (values
  ('film', 'film'),
  ('series', 'series'),
  ('artist', 'person'),
  ('track', 'song'),
  ('creator', 'person'),
  ('place', 'place')
) as v(case_key, type_key)
join public.item_types t on t.key = v.type_key
where c.key = v.case_key;

alter table public.bento_categories alter column type_id set not null;

-- Écrites par le seul back-office, comme les types.
revoke insert, update, delete on public.bento_categories from anon, authenticated;

comment on table public.bento_categories is
  'Les six cases du bento principal. Chacune a un type (type_id). Le nom de '
  'la table est historique : ce ne sont plus des catégories d''items depuis '
  '20260915100000_item_types_and_cases.sql.';

-- ─── 3. Chaque item a un type ─────────────────────────────────────────
--
-- Repris de sa case d'origine. `category_id` devient facultatif : un livre
-- créé dans le back-office n'a pas de case dans le bento principal. Aucun
-- client ne lit cette colonne ; les versions publiées l'écrivent encore en
-- proposant un item, et la section 4 en déduit le type.
alter table public.items
  add column if not exists type_id smallint references public.item_types(id);

update public.items as i
set type_id = c.type_id
from public.bento_categories c
where c.id = i.category_id
  and i.type_id is null;

alter table public.items alter column type_id set not null;
alter table public.items alter column category_id drop not null;

create index if not exists items_type_status_idx on public.items (type_id, status);

comment on column public.items.category_id is
  'Case d''origine, facultative. Le type de l''item est type_id, déduit de '
  'cette case quand elle est posée.';

-- ─── 4. Le type d'un item suit sa case ────────────────────────────────
--
-- Quand un item a une case, son type est celui de la case, quoi que demande
-- l'appelant. Une proposition envoyée par une version publiée, qui ne connaît
-- que la case, reçoit ainsi son type ; et un client ne peut pas annoncer un
-- type qui ne correspond pas à la case (mesuré en local). Un item sans case,
-- créé par le back-office, garde le type qu'on lui donne.
create or replace function public.items_set_type_from_case()
returns trigger
language plpgsql
as $$
begin
  if new.category_id is not null then
    select c.type_id into new.type_id
    from public.bento_categories c
    where c.id = new.category_id;
  end if;
  return new;
end;
$$;

revoke all on function public.items_set_type_from_case() from public;
revoke all on function public.items_set_type_from_case() from anon;
revoke all on function public.items_set_type_from_case() from authenticated;

drop trigger if exists items_set_type_from_case on public.items;
create trigger items_set_type_from_case
  before insert or update of category_id, type_id on public.items
  for each row execute function public.items_set_type_from_case();

-- ─── 5. Une case n'accepte que son type ───────────────────────────────
--
-- D12 : « si un item est de type Lieu il ne doit jamais se retrouver dans une
-- case film ». Vaut aussi pour `admin_merge_items`, qui ne peut plus reporter
-- un film dans une case Personne.
--
-- `security definer` : la RLS de l'appelant masque les items en attente des
-- autres, et une lecture filtrée ferait passer un item existant pour absent.
-- `search_path` vide et noms qualifiés, comme `purge_user_deletions`.
create or replace function public.bento_items_check_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_type smallint;
  v_case_type smallint;
begin
  select i.type_id into v_item_type from public.items i where i.id = new.item_id;
  select c.type_id into v_case_type from public.bento_categories c where c.id = new.category_id;
  if v_item_type is distinct from v_case_type then
    raise exception 'Cet item n''est pas du type de la case.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.bento_items_check_type() from public;
revoke all on function public.bento_items_check_type() from anon;
revoke all on function public.bento_items_check_type() from authenticated;

drop trigger if exists bento_items_check_type on public.bento_items;
create trigger bento_items_check_type
  before insert or update of item_id, category_id on public.bento_items
  for each row execute function public.bento_items_check_type();

-- L'autre porte : changer le type d'un item déjà posé. Le catalogue en aura
-- besoin, des items ont été proposés dans la mauvaise case (« Arcane » ou
-- « Glitch Productions » en créateurs, donc Personnes après la section 3).
-- Les retyper reste possible, mais pas en laissant une case porter un item
-- d'un autre type : il faut d'abord le retirer ou le fusionner.
create or replace function public.items_check_type_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type_id is distinct from old.type_id
     and exists (
       select 1
       from public.bento_items bi
       join public.bento_categories c on c.id = bi.category_id
       where bi.item_id = new.id
         and c.type_id is distinct from new.type_id
     ) then
    raise exception 'Cet item est posé dans une case d''un autre type.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.items_check_type_change() from public;
revoke all on function public.items_check_type_change() from anon;
revoke all on function public.items_check_type_change() from authenticated;

-- Nommé pour passer après `items_set_type_from_case` : les triggers d'un même
-- moment s'enchaînent par ordre alphabétique, et le type contrôlé doit être
-- celui que la case a déjà imposé.
drop trigger if exists items_zz_check_type_change on public.items;
create trigger items_zz_check_type_change
  before update of category_id, type_id on public.items
  for each row execute function public.items_check_type_change();

-- ─── 6. La recherche d'une case cherche dans son type ────────────────
--
-- Signatures inchangées, `category_key` compris : les versions publiées les
-- appellent ainsi. Seule la première étape change, et le filtre qui en
-- découle. Le reste est repris tel quel de `20260529000000` et `20260912000000`.

create or replace function public.search_items(
  q text,
  category_key text,
  lim int default 20
)
returns table (
  id uuid,
  title text,
  subtitle text,
  year int,
  image_url text,
  image_credit text,
  score real
)
language sql
stable
as $$
  -- La clé désigne une case ; on cherche dans son type, s'il est actif.
  with cat as (
    select c.type_id
    from public.bento_categories c
    join public.item_types t on t.id = c.type_id and t.is_active = true
    where c.key = category_key and c.is_active = true
    limit 1
  ),
  scored as (
    select
      i.id,
      i.title,
      i.subtitle,
      i.year,
      i.image_url,
      i.image_credit,
      greatest(
        similarity(i.title, q),
        coalesce(
          (select max(similarity(a.alias, q))
             from public.item_aliases a
             where a.item_id = i.id),
          0
        )
      ) as score
    from public.items i
    where i.type_id = (select type_id from cat)
      and i.status = 'validated'
      -- Borne basse pour éviter le bruit : pg_trgm renvoie souvent du
      -- 0.05-0.1 pour des chaînes sans rapport. 0.15 = noise floor empirique.
      and (
        similarity(i.title, q) > 0.15
        or exists (
          select 1 from public.item_aliases a
          where a.item_id = i.id and similarity(a.alias, q) > 0.15
        )
      )
  )
  select id, title, subtitle, year, image_url, image_credit, score
  from scored
  order by score desc, title asc
  limit lim;
$$;

comment on function public.search_items(text, text, int) is
  'Recherche fuzzy dans le catalogue validé du type d''une case. Score = max '
  'similarity sur titre + aliases. Filtré par RLS (invisible pour les items '
  'non-validated dont on n''est pas l''auteur).';

create or replace function public.find_similar_items(
  q text,
  category_key text,
  threshold real default 0.4,
  lim int default 3
)
returns table (
  id uuid,
  title text,
  subtitle text,
  year int,
  image_url text,
  score real
)
language sql
stable
as $$
  -- La clé désigne une case ; on cherche dans son type, s'il est actif.
  with cat as (
    select c.type_id
    from public.bento_categories c
    join public.item_types t on t.id = c.type_id and t.is_active = true
    where c.key = category_key and c.is_active = true
    limit 1
  )
  select
    i.id,
    i.title,
    i.subtitle,
    i.year,
    i.image_url,
    greatest(
      similarity(i.title, q),
      coalesce(
        (select max(similarity(a.alias, q))
           from public.item_aliases a
           where a.item_id = i.id),
        0
      )
    ) as score
  from public.items i
  where i.type_id = (select type_id from cat)
    and i.status = 'validated'
    and (
      similarity(i.title, q) > threshold
      or exists (
        select 1 from public.item_aliases a
        where a.item_id = i.id and similarity(a.alias, q) > threshold
      )
    )
  order by score desc
  limit lim;
$$;

comment on function public.find_similar_items(text, text, real, int) is
  'Cherche des items validés proches d''une chaîne, dans le type d''une case. '
  'Sert au popup anti-doublon avant soumission user. Threshold 0.4 par défaut.';

create or replace function public.popular_items(
  category_key text,
  lim int default 12,
  exclude_item uuid default null
)
returns table (
  id uuid,
  title text,
  subtitle text,
  year int,
  image_url text,
  image_credit text,
  picks int
)
language sql
stable
as $$
  -- La clé désigne une case ; on cherche dans son type, s'il est actif.
  with cat as (
    select c.type_id
    from public.bento_categories c
    join public.item_types t on t.id = c.type_id and t.is_active = true
    where c.key = category_key and c.is_active = true
    limit 1
  ),
  tally as (
    select bi.item_id, count(*)::int as n
    from public.bento_items bi
    join public.bentos b on b.id = bi.bento_id
    where b.published_at is not null
    group by bi.item_id
  )
  select
    i.id,
    i.title,
    i.subtitle,
    i.year,
    i.image_url,
    i.image_credit,
    coalesce(t.n, 0) as picks
  from public.items i
  left join tally t on t.item_id = i.id
  where i.type_id = (select type_id from cat)
    and i.status = 'validated'
    and (exclude_item is null or i.id <> exclude_item)
  order by
    coalesce(t.n, 0) desc,
    (i.image_url is not null) desc,
    i.created_at desc,
    i.id
  limit lim;
$$;

comment on function public.popular_items(text, int, uuid) is
  'Propositions par défaut de la recherche d''item : catalogue validé du type '
  'd''une case, les plus choisis d''abord, items avec image en priorité. '
  'Compte uniquement les bentos publiés. Cf. docs/UX-03-RECHERCHE-ITEM.md §6.1 '
  'et docs/UX-15-NOUVELLES-CATEGORIES.md.';

notify pgrst, 'reload schema';

-- ─── Contrôles, à lancer après application ───────────────────────────
--
-- 1. Les six cases et leur type. Attendu :
--    film → film, series → series, artist → person, track → song,
--    creator → person, place → place
--
--   select c.key as case_key, t.key as type_key
--     from public.bento_categories c
--     join public.item_types t on t.id = c.type_id
--    order by c.id;
--
-- 2. Aucun item sans type, et aucune case qui porte un item d'un autre type.
--    Attendu : 0 et 0.
--
--   select (select count(*) from public.items where type_id is null) as sans_type,
--          (select count(*)
--             from public.bento_items bi
--             join public.items i on i.id = bi.item_id
--             join public.bento_categories c on c.id = bi.category_id
--            where i.type_id <> c.type_id) as cases_incoherentes;
--
-- 3. Les items par type. Attendu : neuf lignes, les quatre nouveaux types à
--    zéro, `person` égal à l'ancien total des cases artist et creator.
--
--   select t.key, t.is_active, count(i.id) as items
--     from public.item_types t
--     left join public.items i on i.type_id = t.id
--    group by t.key, t.is_active, t.display_order
--    order by t.display_order;
--
-- 4. Aucun droit d'écriture client sur les types et les cases. Attendu, pour
--    `anon` comme pour `authenticated`, sur les deux tables :
--    REFERENCES, SELECT, TRIGGER, TRUNCATE
--
--   select table_name, grantee,
--          string_agg(privilege_type, ', ' order by privilege_type) as privileges
--     from information_schema.role_table_grants
--    where table_schema = 'public'
--      and table_name in ('item_types', 'bento_categories')
--      and grantee in ('anon', 'authenticated')
--    group by 1, 2 order by 1, 2;
--
-- 5. À la clé anonyme, sans rien écrire : cinq types lisibles, et la case
--    Artiste qui trouve Amixem, rangé jusqu'ici comme créateur.
--
--   GET  /rest/v1/item_types?select=key
--   POST /rest/v1/rpc/search_items {"q": "amixem", "category_key": "artist"}
