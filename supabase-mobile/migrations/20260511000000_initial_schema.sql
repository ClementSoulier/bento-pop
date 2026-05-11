-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  Mon Bento Pop — Schéma initial                                       ║
-- ║  Tables : bento_categories, users, items, bentos, bento_items         ║
-- ║  Auth   : Supabase Anonymous Sign-In (auth.uid() = users.id)          ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─── 1. Extensions ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp" with schema extensions;

-- ─── 2. Trigger générique updated_at ──────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── 3. Table de référence : catégories ──────────────────────────────
-- Évolutive : ajouter une catégorie = INSERT, pas de migration de code.
create table public.bento_categories (
  id smallint primary key generated always as identity,
  key text not null unique,
  label_fr text not null,
  display_order int not null default 0,
  api_source text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.bento_categories is
  'Catégories d''items qu''un user peut placer dans son bento (film, série, etc.). Évolutive.';

-- ─── 4. Users ─────────────────────────────────────────────────────────
-- Liés 1:1 à auth.users via l''uid (anonymous sign-in au MVP).
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pseudo_format check (pseudo ~ '^[A-Za-z0-9_.]{3,20}$')
);

-- Pseudo unique case-insensitive (index fonctionnel)
create unique index users_pseudo_lower_idx on public.users (lower(pseudo));

create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_updated_at();

comment on table public.users is
  'Profils publics. id = auth.users.id (anonymous sign-in MVP, claim email/pwd en v2).';

-- ─── 5. Items : catalogue mutualisé ───────────────────────────────────
create table public.items (
  id uuid primary key default gen_random_uuid(),
  category_id smallint not null references public.bento_categories(id),
  external_source text not null,    -- 'tmdb', 'musicbrainz', 'wikidata', 'osm', 'igdb', 'manual'
  external_id text,                 -- null pour manual
  title text not null,
  subtitle text,
  year int,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (external_source, external_id)
);

create index items_category_idx on public.items (category_id);
create index items_title_trgm_idx on public.items using gin (title gin_trgm_ops);

-- Trigram pour la recherche fuzzy (« inception 2010 » → trouve "Inception (2010)")
create extension if not exists pg_trgm with schema extensions;

comment on table public.items is
  'Catalogue d''items issu des APIs externes (TMDb, MusicBrainz, etc.) ou manuel. Mutualisé : tous les users peuvent référencer un même item.';

-- ─── 6. Bentos ────────────────────────────────────────────────────────
-- Un bento par user (au MVP, contrainte UNIQUE). Levable plus tard si on
-- veut autoriser plusieurs bentos par user (thématiques, annuels…).
create table public.bentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  is_featured boolean not null default false,
  featured_order int,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bentos_featured_idx on public.bentos (is_featured, featured_order) where is_featured = true;
create index bentos_published_idx on public.bentos (published_at) where published_at is not null;

create trigger bentos_touch_updated_at
  before update on public.bentos
  for each row execute function public.touch_updated_at();

comment on table public.bentos is
  'Un bento (= une composition culturelle) appartient à un user. is_featured = mise en avant manuelle équipe.';

-- ─── 7. Bento ↔ Items (1 slot par catégorie) ──────────────────────────
create table public.bento_items (
  bento_id uuid not null references public.bentos(id) on delete cascade,
  category_id smallint not null references public.bento_categories(id),
  item_id uuid not null references public.items(id) on delete restrict,
  added_at timestamptz not null default now(),
  primary key (bento_id, category_id)
);

create index bento_items_item_idx on public.bento_items (item_id);

comment on table public.bento_items is
  'Composition d''un bento : 1 item par catégorie max. PK = (bento_id, category_id).';

-- ─── 8. RLS (Row Level Security) ──────────────────────────────────────

alter table public.bento_categories enable row level security;
alter table public.users enable row level security;
alter table public.items enable row level security;
alter table public.bentos enable row level security;
alter table public.bento_items enable row level security;

-- 8.1 — Catégories : lecture publique (seulement les actives).
create policy "bento_categories_read_active"
  on public.bento_categories
  for select
  using (is_active = true);

-- 8.2 — Items : lecture publique + insertion authenticated (incl. anon sign-in).
create policy "items_read_all"
  on public.items
  for select
  using (true);

create policy "items_insert_authenticated"
  on public.items
  for insert
  to authenticated
  with check (true);

-- 8.3 — Users : lecture publique (recherche par pseudo), insertion & update sur soi.
create policy "users_read_all"
  on public.users
  for select
  using (true);

create policy "users_insert_own"
  on public.users
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "users_update_own"
  on public.users
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 8.4 — Bentos : lecture publique des bentos publiés ; CRUD sur les siens.
create policy "bentos_read_published"
  on public.bentos
  for select
  using (published_at is not null or user_id = (select auth.uid()));

create policy "bentos_insert_own"
  on public.bentos
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "bentos_update_own"
  on public.bentos
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "bentos_delete_own"
  on public.bentos
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- 8.5 — Bento_items : lecture si bento publié, write sur son propre bento.
create policy "bento_items_read_published"
  on public.bento_items
  for select
  using (
    exists (
      select 1 from public.bentos b
      where b.id = bento_items.bento_id
        and (b.published_at is not null or b.user_id = (select auth.uid()))
    )
  );

create policy "bento_items_write_own"
  on public.bento_items
  for all
  to authenticated
  using (
    exists (
      select 1 from public.bentos b
      where b.id = bento_items.bento_id and b.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.bentos b
      where b.id = bento_items.bento_id and b.user_id = (select auth.uid())
    )
  );

-- ─── 9. Seed des catégories MVP ───────────────────────────────────────
insert into public.bento_categories (key, label_fr, display_order, api_source) values
  ('film',    'Film',                1, 'tmdb'),
  ('series',  'Série',               2, 'tmdb'),
  ('artist',  'Artiste musical',     3, 'musicbrainz'),
  ('track',   'Chanson',             4, 'musicbrainz'),
  ('creator', 'Créateur de contenu', 5, 'wikidata'),
  ('place',   'Lieu de voyage',      6, 'osm');
