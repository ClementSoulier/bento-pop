-- Admin BO + migration des contenus statiques (events, team, links, ctas)
-- vers Supabase. Le BO `apps/admin` est l'auteur des écritures ; la landing
-- lit ces tables en anon SELECT (les loaders côté `apps/landing/src/content/*.ts`
-- gardent un fallback vers leurs valeurs en dur si la requête échoue).

-- ============================================================
-- 0. Helper : updated_at automatique
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1. admin_users : qui peut écrire dans le BO
-- ============================================================
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admins read own row" on public.admin_users;
create policy "admins read own row"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "admins read all admins" on public.admin_users;
create policy "admins read all admins"
  on public.admin_users for select
  to authenticated
  using (exists (select 1 from public.admin_users me where me.user_id = auth.uid()));

-- Pour qu'on puisse vérifier en RLS si auth.uid() est admin sans
-- refaire la jointure à chaque table :
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = uid);
$$;
grant execute on function public.is_admin(uuid) to anon, authenticated;

-- ============================================================
-- 2. Auto-promotion : le tout premier user qui s'inscrit devient admin.
--    Permet le bootstrap : sign-up #1 = compte propriétaire.
--    Les suivants sont créés via le BO (UI à venir) ou SQL manuel.
-- ============================================================
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admin_users) then
    insert into public.admin_users (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin
  after insert on auth.users
  for each row execute function public.handle_first_admin();

-- ============================================================
-- 3. landing_events : agenda public
-- ============================================================
create table if not exists public.landing_events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  place text not null,
  stand text not null default '',
  status text not null default 'soon' check (status in ('live', 'soon', 'done')),
  status_label text not null default 'Prochainement',
  replay_url text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_events_status_idx on public.landing_events (status);
create index if not exists landing_events_order_idx on public.landing_events (display_order);

drop trigger if exists landing_events_updated_at on public.landing_events;
create trigger landing_events_updated_at
  before update on public.landing_events
  for each row execute function public.set_updated_at();

alter table public.landing_events enable row level security;

drop policy if exists "anon read events" on public.landing_events;
create policy "anon read events" on public.landing_events
  for select to anon, authenticated using (true);

drop policy if exists "admins write events" on public.landing_events;
create policy "admins write events" on public.landing_events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 4. landing_team : membres affichés dans la section Team
-- ============================================================
create table if not exists public.landing_team (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nick text not null,
  bio text not null default '',
  popy_path text,
  photo_kind text not null default 'gradient' check (photo_kind in ('gradient', 'image')),
  photo_from text,
  photo_to text,
  photo_url text,
  initials text not null,
  rotation numeric not null default 0,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists landing_team_updated_at on public.landing_team;
create trigger landing_team_updated_at
  before update on public.landing_team
  for each row execute function public.set_updated_at();

alter table public.landing_team enable row level security;

drop policy if exists "anon read team" on public.landing_team;
create policy "anon read team" on public.landing_team
  for select to anon, authenticated using (true);

drop policy if exists "admins write team" on public.landing_team;
create policy "admins write team" on public.landing_team
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 5. landing_links : réseaux + plateformes podcast + contact email
-- ============================================================
create table if not exists public.landing_links (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'youtube','spotify','instagram','tiktok','x','discord','mail','deezer','apple'
  )),
  name text not null,
  url text not null default '',
  enabled boolean not null default false,
  /* À quoi sert ce lien sur la landing : socials du footer, plateformes du
     bloc podcast, ou contact-email. Une même destination peut servir 2 places
     (ex: youtube = social ET plateforme podcast) — d'où un array. */
  surfaces text[] not null default '{}',
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_links_enabled_idx on public.landing_links (enabled);

drop trigger if exists landing_links_updated_at on public.landing_links;
create trigger landing_links_updated_at
  before update on public.landing_links
  for each row execute function public.set_updated_at();

alter table public.landing_links enable row level security;

drop policy if exists "anon read links" on public.landing_links;
create policy "anon read links" on public.landing_links
  for select to anon, authenticated using (true);

drop policy if exists "admins write links" on public.landing_links;
create policy "admins write links" on public.landing_links
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 6. landing_ctas : boutons hero (primary / secondary)
-- ============================================================
create table if not exists public.landing_ctas (
  slot text primary key check (slot in ('primary','secondary')),
  label text not null,
  url text not null,
  icon_key text,
  updated_at timestamptz not null default now()
);

drop trigger if exists landing_ctas_updated_at on public.landing_ctas;
create trigger landing_ctas_updated_at
  before update on public.landing_ctas
  for each row execute function public.set_updated_at();

alter table public.landing_ctas enable row level security;

drop policy if exists "anon read ctas" on public.landing_ctas;
create policy "anon read ctas" on public.landing_ctas
  for select to anon, authenticated using (true);

drop policy if exists "admins write ctas" on public.landing_ctas;
create policy "admins write ctas" on public.landing_ctas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 7. Renforcement RLS des votes : seuls les admins peuvent écrire
--    une nouvelle semaine. Les réponses anonymes restent server-action only.
-- ============================================================
drop policy if exists "admins write vote weeks" on public.landing_vote_weeks;
create policy "admins write vote weeks" on public.landing_vote_weeks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 8. SEED — reprend les valeurs actuellement en dur dans
--    apps/landing/src/content/*.ts (agenda, team, footer, debriefs, hero ctas).
--    Idempotent via on conflict do nothing sur des clés naturelles.
-- ============================================================

-- 8.1 events
insert into public.landing_events (id, date, title, place, stand, status, status_label, display_order)
values
  ('11111111-1111-1111-1111-111111111101', '2026-07-03', 'Japan Expo',     'Paris Nord Villepinte',     'Stand B-12 · Hall 7', 'live', 'En direct',     1),
  ('11111111-1111-1111-1111-111111111102', '2026-09-12', 'Paris Manga',    'Porte de Versailles, Paris','Stand Pop·14',        'soon', 'Prochainement', 2),
  ('11111111-1111-1111-1111-111111111103', '2026-10-24', 'Comic Con',      'Paris Expo · Pavillon 5',   'Plateau Pop·22',      'soon', 'Prochainement', 3),
  ('11111111-1111-1111-1111-111111111104', '2026-02-14', 'Mang''Azur',     'Mandelieu-la-Napoule',      'Plateau Hall 1',      'done', 'Replay dispo',  4),
  ('11111111-1111-1111-1111-111111111105', '2025-11-08', 'TGS · Toulouse', 'Parc des Expositions',      'Stand A-09',          'done', 'Replay dispo',  5)
on conflict (id) do nothing;

-- 8.2 team
insert into public.landing_team (id, name, nick, bio, photo_kind, photo_from, photo_to, initials, rotation, display_order)
values
  ('22222222-2222-2222-2222-222222222201', 'Dark Hifus', 'Le Captain',  'Capitaine du plateau et voix de l''émission. Il pose les bonnes questions, et les piquantes aussi.', 'gradient', '#2a3142', '#4a5266', 'DH', -2,   1),
  ('22222222-2222-2222-2222-222222222202', 'ToDalf',     'Le Pilier',   'Mémoire vivante du gaming et du cinéma. Si c''est sorti, il l''a vu, joué, ou démonté.',           'gradient', '#c41e3a', '#882a3a', 'TD', 1.5,  2),
  ('22222222-2222-2222-2222-222222222203', 'Elda',       'L''Experte',  'Manga, Webtoon et K-culture. Quand elle parle de Séoul, c''est rarement depuis Paris.',           'gradient', '#ff8fb0', '#ff5588', 'EL', -1,   3),
  ('22222222-2222-2222-2222-222222222204', 'Rob',        'Le Visuel',   'Réalisation, montage et direction artistique. Il rend tout ça regardable — et beau.',             'gradient', '#2ec4b6', '#1a8a80', 'RB', 2,    4)
on conflict (id) do nothing;

-- 8.3 links — chaque ligne décrit son rôle dans surfaces[]
insert into public.landing_links (id, kind, name, url, enabled, surfaces, display_order)
values
  ('33333333-3333-3333-3333-333333333301', 'youtube',   'YouTube',         'https://www.youtube.com/@BentoPop.Officiel',           true,  array['social','podcast'], 1),
  ('33333333-3333-3333-3333-333333333302', 'spotify',   'Spotify',         'https://open.spotify.com/show/0HmT9Na37Ujd3pvTl4to89', true,  array['podcast'],          2),
  ('33333333-3333-3333-3333-333333333303', 'instagram', 'Instagram',       'https://www.instagram.com/bento.pop.officiel/',       true,  array['social'],           3),
  ('33333333-3333-3333-3333-333333333304', 'x',         'X (Twitter)',     '',                                                     false, array['social'],           4),
  ('33333333-3333-3333-3333-333333333305', 'tiktok',    'TikTok',          '',                                                     false, array['social'],           5),
  ('33333333-3333-3333-3333-333333333306', 'discord',   'Discord',         '',                                                     false, array['social'],           6),
  ('33333333-3333-3333-3333-333333333307', 'mail',      'Email pro',       'contact@bento-pop.com',                                true,  array['contact'],          7),
  ('33333333-3333-3333-3333-333333333308', 'deezer',    'Deezer',          '',                                                     false, array['podcast'],          8),
  ('33333333-3333-3333-3333-333333333309', 'apple',     'Apple Podcasts',  '',                                                     false, array['podcast'],          9)
on conflict (id) do nothing;

-- 8.4 ctas
insert into public.landing_ctas (slot, label, url, icon_key) values
  ('primary',   'Regarder le dernier épisode', 'https://www.youtube.com/@BentoPop.Officiel',           'play'),
  ('secondary', 'Écouter le Podcast',          'https://open.spotify.com/show/0HmT9Na37Ujd3pvTl4to89', 'spotify')
on conflict (slot) do nothing;
