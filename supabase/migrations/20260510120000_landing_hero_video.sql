-- Vidéo embarquée dans le hero de la landing.
-- Singleton : une seule ligne possible (id = 'singleton'), éditée depuis le BO.

create table if not exists public.landing_hero_video (
  id text primary key default 'singleton' check (id = 'singleton'),
  youtube_id text not null,
  title text not null,
  episode_label text not null,
  live boolean not null default false,
  updated_at timestamptz not null default now()
);

drop trigger if exists landing_hero_video_updated_at on public.landing_hero_video;
create trigger landing_hero_video_updated_at
  before update on public.landing_hero_video
  for each row execute function public.set_updated_at();

alter table public.landing_hero_video enable row level security;

drop policy if exists "anon read hero video" on public.landing_hero_video;
create policy "anon read hero video" on public.landing_hero_video
  for select to anon, authenticated using (true);

drop policy if exists "admins write hero video" on public.landing_hero_video;
create policy "admins write hero video" on public.landing_hero_video
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Seed : reprend les valeurs actuellement hardcodées dans
-- apps/landing/src/content/hero.ts (cellule vidéo du bento).
insert into public.landing_hero_video (id, youtube_id, title, episode_label, live)
values ('singleton', '8JVSPC2ozOw', 'Replay · Dernier épisode', 'EP. 24 · 1h12', false)
on conflict (id) do nothing;
