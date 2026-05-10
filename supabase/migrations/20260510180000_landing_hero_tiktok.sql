-- Vidéo TikTok embarquée dans le hero (cellule verticale en col 1 lignes 2-3
-- du bento). Singleton, éditée depuis le BO.
--
-- Si `enabled = false` ou `tiktok_url` vide, la landing retombe sur le layout
-- legacy (mascotte Popy + cellule Paris Manga en col 1).

create table if not exists public.landing_hero_tiktok (
  id text primary key default 'singleton' check (id = 'singleton'),
  tiktok_url text,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

drop trigger if exists landing_hero_tiktok_updated_at on public.landing_hero_tiktok;
create trigger landing_hero_tiktok_updated_at
  before update on public.landing_hero_tiktok
  for each row execute function public.set_updated_at();

alter table public.landing_hero_tiktok enable row level security;

drop policy if exists "anon read hero tiktok" on public.landing_hero_tiktok;
create policy "anon read hero tiktok" on public.landing_hero_tiktok
  for select to anon, authenticated using (true);

drop policy if exists "admins write hero tiktok" on public.landing_hero_tiktok;
create policy "admins write hero tiktok" on public.landing_hero_tiktok
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.landing_hero_tiktok (id, tiktok_url, enabled)
values ('singleton', null, false)
on conflict (id) do nothing;
