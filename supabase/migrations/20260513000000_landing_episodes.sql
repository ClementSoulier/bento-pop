-- Catalogue d'épisodes : émissions YouTube (Bento Pop, S1 = 17 ép.)
-- et épisodes podcast (Spotify, ~20 ép.). Mêmes patterns que les autres
-- tables landing_* : admin écrit via BO, landing lit en SELECT anon.
--
-- Différence vs events/team : on a un statut draft/published. Anon ne voit
-- que les `published`, les admins voient tout (read OR write via is_admin).
--
-- Animateurs : relation N:N vers landing_team (les hôtes sont des entités
-- réutilisables). Invités one-shot, mentions et chapitres : jsonb inline
-- (37 épisodes au total, zéro réutilisation transverse — surdimensionner
-- en tables séparées n'apporte rien).

-- ============================================================
-- 1. landing_show_episodes : épisodes YouTube (émission Bento Pop)
-- ============================================================
create table if not exists public.landing_show_episodes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  youtube_id text not null,
  thumbnail_url text,
  duration_seconds int,
  published_at timestamptz,
  season int not null default 1,
  episode_number int,
  status text not null default 'draft' check (status in ('draft','published')),
  display_order int not null default 0,
  seo_title text,
  seo_description text,
  /* invités one-shot : [{name: string, role?: string, photo_url?: string}] */
  guests jsonb not null default '[]'::jsonb,
  /* œuvres mentionnées : [{type: 'game'|'movie'|'series'|'book'|'other',
     title: string, url?: string, cover_url?: string}] */
  mentions jsonb not null default '[]'::jsonb,
  /* timecodes : [{label: string, start_seconds: int}] */
  chapters jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_show_episodes_status_idx on public.landing_show_episodes (status);
create index if not exists landing_show_episodes_published_at_idx on public.landing_show_episodes (published_at desc);
create index if not exists landing_show_episodes_order_idx on public.landing_show_episodes (display_order desc, published_at desc);
create index if not exists landing_show_episodes_season_idx on public.landing_show_episodes (season, episode_number);

drop trigger if exists landing_show_episodes_updated_at on public.landing_show_episodes;
create trigger landing_show_episodes_updated_at
  before update on public.landing_show_episodes
  for each row execute function public.set_updated_at();

alter table public.landing_show_episodes enable row level security;

drop policy if exists "read published or admin show episodes" on public.landing_show_episodes;
create policy "read published or admin show episodes" on public.landing_show_episodes
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());

drop policy if exists "admins write show episodes" on public.landing_show_episodes;
create policy "admins write show episodes" on public.landing_show_episodes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 2. landing_podcast_episodes : épisodes Spotify
-- ============================================================
create table if not exists public.landing_podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  /* L'ID Spotify suffit : embed via
     https://open.spotify.com/embed/episode/{spotify_episode_id} */
  spotify_episode_id text not null,
  thumbnail_url text,
  duration_seconds int,
  published_at timestamptz,
  season int not null default 1,
  episode_number int,
  status text not null default 'draft' check (status in ('draft','published')),
  display_order int not null default 0,
  seo_title text,
  seo_description text,
  guests jsonb not null default '[]'::jsonb,
  mentions jsonb not null default '[]'::jsonb,
  chapters jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_podcast_episodes_status_idx on public.landing_podcast_episodes (status);
create index if not exists landing_podcast_episodes_published_at_idx on public.landing_podcast_episodes (published_at desc);
create index if not exists landing_podcast_episodes_order_idx on public.landing_podcast_episodes (display_order desc, published_at desc);
create index if not exists landing_podcast_episodes_season_idx on public.landing_podcast_episodes (season, episode_number);

drop trigger if exists landing_podcast_episodes_updated_at on public.landing_podcast_episodes;
create trigger landing_podcast_episodes_updated_at
  before update on public.landing_podcast_episodes
  for each row execute function public.set_updated_at();

alter table public.landing_podcast_episodes enable row level security;

drop policy if exists "read published or admin podcast episodes" on public.landing_podcast_episodes;
create policy "read published or admin podcast episodes" on public.landing_podcast_episodes
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());

drop policy if exists "admins write podcast episodes" on public.landing_podcast_episodes;
create policy "admins write podcast episodes" on public.landing_podcast_episodes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 3. landing_show_episode_hosts : N:N émission <-> animateurs (landing_team)
-- ============================================================
create table if not exists public.landing_show_episode_hosts (
  episode_id uuid not null references public.landing_show_episodes(id) on delete cascade,
  team_member_id uuid not null references public.landing_team(id) on delete cascade,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (episode_id, team_member_id)
);

create index if not exists landing_show_episode_hosts_episode_idx on public.landing_show_episode_hosts (episode_id);
create index if not exists landing_show_episode_hosts_team_idx on public.landing_show_episode_hosts (team_member_id);

alter table public.landing_show_episode_hosts enable row level security;

drop policy if exists "anon read show hosts" on public.landing_show_episode_hosts;
create policy "anon read show hosts" on public.landing_show_episode_hosts
  for select to anon, authenticated using (true);

drop policy if exists "admins write show hosts" on public.landing_show_episode_hosts;
create policy "admins write show hosts" on public.landing_show_episode_hosts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 4. landing_podcast_episode_hosts : N:N podcast <-> animateurs
-- ============================================================
create table if not exists public.landing_podcast_episode_hosts (
  episode_id uuid not null references public.landing_podcast_episodes(id) on delete cascade,
  team_member_id uuid not null references public.landing_team(id) on delete cascade,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (episode_id, team_member_id)
);

create index if not exists landing_podcast_episode_hosts_episode_idx on public.landing_podcast_episode_hosts (episode_id);
create index if not exists landing_podcast_episode_hosts_team_idx on public.landing_podcast_episode_hosts (team_member_id);

alter table public.landing_podcast_episode_hosts enable row level security;

drop policy if exists "anon read podcast hosts" on public.landing_podcast_episode_hosts;
create policy "anon read podcast hosts" on public.landing_podcast_episode_hosts
  for select to anon, authenticated using (true);

drop policy if exists "admins write podcast hosts" on public.landing_podcast_episode_hosts;
create policy "admins write podcast hosts" on public.landing_podcast_episode_hosts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
