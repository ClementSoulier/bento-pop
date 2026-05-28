-- Migration : catalogue maison (modération items + aliases + suggestions Wikipedia)
--
-- Bascule progressive depuis le catalogue alimenté par APIs externes
-- (TMDb / MusicBrainz / Wikidata / OSM) vers un catalogue maison modéré
-- par l'équipe. RÉTRO-COMPATIBLE : tout ce que fait l'ancien client en
-- prod (1.0.x) continue de marcher tel quel.
--
-- Hypothèses de rétro-compat conservées :
--   1. Les `items` existants restent `status='validated'` (default).
--   2. L'ancien client insère avec `external_source IN (tmdb, musicbrainz,
--      wikidata, osm, igdb, manual)` → trigger force `status='validated'`
--      à l'insert. Aucun risque qu'un item TMDb soit invisible.
--   3. Le nouveau client (1.1.0+) insère avec `external_source='user'` →
--      trigger force `status='pending'` + remplit `submitted_by/at`.
--   4. La RLS `items SELECT` est resserrée mais n'impacte que les items
--      `status != 'validated'`, qui n'existeront QUE par le nouveau flow.
--   5. Aucune nouvelle contrainte sur `bento_items` ou `bentos.published_at` :
--      le strict `can_publish_bento` arrive plus tard, quand l'adoption
--      de 1.1.0+ est suffisante.
--
-- À appliquer sur le projet Supabase mobile (ggjgktbcqumfxrixcdyx) via
-- le SQL editor du dashboard.

-- ─── 1. Enum lifecycle ────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'item_status') then
    create type public.item_status as enum (
      'draft',       -- créé en admin, pas encore publié
      'pending',     -- soumis par un user, en attente de modération
      'validated',   -- canonique, visible en recherche publique
      'rejected',    -- refusé par un admin
      'merged'       -- fusionné dans un autre item (cf. merged_into_id)
    );
  end if;
end$$;

-- ─── 2. Nouvelles colonnes sur items ──────────────────────────────────
-- Toutes nullable / avec default conservateur → aucun impact sur les
-- lignes existantes (qui restent en 'validated').
alter table public.items
  add column if not exists status public.item_status not null default 'validated',
  add column if not exists submitted_by uuid references public.users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  -- validated_by / rejected_by : pas de FK vers admin_users (cette table
  -- vit sur le projet landing/admin, pas sur le projet mobile). On stocke
  -- l'UUID de l'admin pour traçabilité, sans contrainte.
  add column if not exists validated_by uuid,
  add column if not exists validated_at timestamptz,
  add column if not exists rejected_by uuid,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_reason text,
  add column if not exists merged_into_id uuid references public.items(id) on delete set null,
  add column if not exists image_credit text;

comment on column public.items.status is
  'Lifecycle : draft (admin WIP) | pending (user soumis) | validated (recherche publique) | rejected | merged.';
comment on column public.items.submitted_by is
  'User auteur de la soumission (uniquement quand external_source=''user'').';
comment on column public.items.merged_into_id is
  'Si status=merged : pointe vers l''item canonique. bento_items.item_id est aussi réécrit au moment du merge.';
comment on column public.items.image_credit is
  'Texte d''attribution affiché en mini sous le visuel (Wikimedia CC-BY-SA notamment).';

-- Index utilitaires pour les queries admin (file de modération + suivi).
create index if not exists items_status_idx
  on public.items (status)
  where status != 'validated';  -- partial : la masse est validated, l'index ne traque que le résiduel.

create index if not exists items_submitted_at_idx
  on public.items (submitted_at)
  where status = 'pending';     -- partial : sert exclusivement à la file admin FIFO.

-- ─── 3. Trigger lifecycle à l'insert ──────────────────────────────────
-- Centralise la règle status pour qu'aucun client (ancien ou nouveau) ne
-- puisse contourner. Le service-role peut toujours INSERT directement
-- avec un status arbitraire (admin draft) parce que le trigger respecte
-- ce qui est posé pour `external_source='admin'`.
create or replace function public.items_set_status_on_insert()
returns trigger
language plpgsql
as $$
begin
  if new.external_source = 'user' then
    -- Soumission user : toujours pending, peu importe ce qui est demandé.
    new.status := 'pending';
    new.submitted_by := coalesce(new.submitted_by, (select auth.uid()));
    new.submitted_at := coalesce(new.submitted_at, now());
  elsif new.external_source = 'admin' then
    -- Admin créé via BO : on respecte status (draft ou validated).
    null;
  else
    -- Rétro-compat : ancien client (tmdb, musicbrainz, wikidata, osm,
    -- igdb, manual) → on force validated, peu importe le default.
    new.status := 'validated';
  end if;
  return new;
end;
$$;

drop trigger if exists items_set_status_on_insert on public.items;
create trigger items_set_status_on_insert
  before insert on public.items
  for each row execute function public.items_set_status_on_insert();

-- ─── 4. Trigger lifecycle à l'update ──────────────────────────────────
-- Pose validated_at / rejected_at quand l'admin bascule le status.
-- Ne touche pas à `merged_into_id` (mis manuellement par l'outil merge).
create or replace function public.items_touch_lifecycle_on_update()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'validated' and old.status != 'validated' then
      new.validated_at := coalesce(new.validated_at, now());
    elsif new.status = 'rejected' and old.status != 'rejected' then
      new.rejected_at := coalesce(new.rejected_at, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists items_touch_lifecycle_on_update on public.items;
create trigger items_touch_lifecycle_on_update
  before update on public.items
  for each row execute function public.items_touch_lifecycle_on_update();

-- ─── 5. Aliases : titres alternatifs pour la recherche ─────────────────
-- Alimentés exclusivement côté admin (saisie manuelle + au moment d'un
-- merge, les titres des losers deviennent alias du winner). Indexés
-- trigram comme `items.title` pour la fuzzy search.
create table if not exists public.item_aliases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  unique (item_id, alias)
);

create index if not exists item_aliases_item_idx
  on public.item_aliases (item_id);
create index if not exists item_aliases_alias_trgm_idx
  on public.item_aliases using gin (alias extensions.gin_trgm_ops);

comment on table public.item_aliases is
  'Titres alternatifs pour la recherche. Admin-only. Hydratés au merge.';

alter table public.item_aliases enable row level security;

drop policy if exists "item_aliases_read_all" on public.item_aliases;
create policy "item_aliases_read_all"
  on public.item_aliases
  for select
  using (true);
-- Pas de policy write : admin uniquement via service-role.

-- ─── 6. Suggestions d'illustration (Wikipedia) ────────────────────────
-- Pré-remplies par un job background à chaque insert d'item pending/draft.
-- L'admin accepte / dismiss côté fiche item, puis le download + upload
-- Storage se fait à l'acceptation.
create table if not exists public.item_image_suggestions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  source_url text not null,         -- URL Wikimedia originale
  thumbnail_url text,               -- preview 480px
  attribution text,                 -- crédit lisible à afficher mini
  license_code text,                -- 'cc-by-sa-4.0', 'public-domain'…
  wikipedia_page_url text,          -- page d'origine (debug admin)
  fetched_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  unique (item_id, source_url)
);

create index if not exists item_image_suggestions_item_idx
  on public.item_image_suggestions (item_id, status);

comment on table public.item_image_suggestions is
  'Propositions d''illustration Wikimedia générées en background. Admin uniquement.';

alter table public.item_image_suggestions enable row level security;
-- Pas de policy : tout passe par service-role admin.

-- ─── 7. RLS : resserrement de la lecture items ────────────────────────
-- L'ancien client lisait `items` via `using (true)`. On resserre à
-- `validated OR own pending` pour éviter que des items non modérés
-- (mots offensants, doublons) soient visibles publiquement.
--
-- Impact rétro-compat :
--   - Items existants : tous validated → toujours lisibles, OK.
--   - Inserts ancien client → trigger force validated → OK.
--   - Inserts nouveau client (user) → pending, lisible seulement par
--     son auteur (qui a besoin de l'afficher dans son composer).
drop policy if exists "items_read_all" on public.items;
create policy "items_read_validated_or_own_pending"
  on public.items
  for select
  using (
    status = 'validated'
    or (submitted_by is not null and submitted_by = (select auth.uid()))
  );

-- ─── 8. (Pas encore) : can_publish_bento strict ───────────────────────
-- Volontairement non implémenté dans cette migration. Tant que la base
-- d'utilisateurs n'est pas majoritairement sur 1.1.0+, on ne veut pas
-- empêcher un bento contenant un item pending d'être publié (la règle
-- vivra côté UI seulement). Une migration ultérieure ajoutera le
-- garde-fou SQL une fois l'adoption suffisante.
