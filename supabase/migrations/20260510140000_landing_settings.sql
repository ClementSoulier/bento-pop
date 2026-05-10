-- Réglages globaux de la landing (singleton).
-- À chaque nouveau réglage on ajoute simplement une colonne ici (alter table)
-- et on étend le loader côté `apps/landing/src/lib/content/settings.ts`.

create table if not exists public.landing_settings (
  id text primary key default 'singleton' check (id = 'singleton'),
  season_number int not null default 2 check (season_number >= 1 and season_number <= 99),
  updated_at timestamptz not null default now()
);

drop trigger if exists landing_settings_updated_at on public.landing_settings;
create trigger landing_settings_updated_at
  before update on public.landing_settings
  for each row execute function public.set_updated_at();

alter table public.landing_settings enable row level security;

drop policy if exists "anon read settings" on public.landing_settings;
create policy "anon read settings" on public.landing_settings
  for select to anon, authenticated using (true);

drop policy if exists "admins write settings" on public.landing_settings;
create policy "admins write settings" on public.landing_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.landing_settings (id, season_number) values ('singleton', 2)
on conflict (id) do nothing;
