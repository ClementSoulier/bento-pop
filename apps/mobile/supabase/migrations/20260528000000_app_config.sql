-- Migration : table de configuration runtime de l'app mobile.
--
-- Objectif : permettre depuis le BO admin de (a) basculer l'app en mode
-- maintenance (écran bloquant pendant qu'on déploie une migration majeure),
-- et (b) imposer une version minimale supportée (force update).
--
-- Pattern singleton (id=1) cohérent avec landing_settings côté projet
-- landing/admin.
--
-- À appliquer sur le projet Supabase mobile (ggjgktbcqumfxrixcdyx) via le
-- SQL editor du dashboard.

create table if not exists public.app_config (
  id smallint primary key default 1 check (id = 1),
  maintenance_mode boolean not null default false,
  maintenance_title text not null default 'On revient vite',
  maintenance_message text not null default 'Mon Bento Pop est en maintenance, on revient dans quelques minutes.',
  ios_min_version text not null default '0.0.1',
  ios_latest_version text not null default '0.0.1',
  android_min_version text,
  android_latest_version text,
  updated_at timestamptz not null default now()
);

comment on table public.app_config is
  'Configuration runtime de l''app mobile. Singleton (id=1). '
  'Lu au boot + sur retour foreground pour décider maintenance / force update.';

-- Auto-update du timestamp à chaque modification (réutilise touch_updated_at).
drop trigger if exists app_config_touch_updated_at on public.app_config;
create trigger app_config_touch_updated_at
  before update on public.app_config
  for each row execute function public.touch_updated_at();

-- Seed la ligne singleton si elle n'existe pas.
insert into public.app_config (id)
values (1)
on conflict (id) do nothing;

-- RLS : lecture publique (l'app doit pouvoir lire sans auth avant même
-- l'init de la session anonyme). Écriture exclusivement via service-role
-- depuis le BO admin (pas de policy write).
alter table public.app_config enable row level security;

drop policy if exists "app_config_read_all" on public.app_config;
create policy "app_config_read_all"
  on public.app_config
  for select
  using (true);
