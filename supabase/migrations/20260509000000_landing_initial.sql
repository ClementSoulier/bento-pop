-- Landing page (bento-pop.com) — V1
-- Tables nécessaires au moment où l'app `apps/landing` traite des saisies
-- utilisateur (votes hebdomadaires + abonnements newsletter).
-- Le reste du contenu (agenda, team, univers…) reste statique en V1
-- dans `apps/landing/src/content/*.ts` et migrera vers Supabase au moment
-- de la livraison du backoffice.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------- 1. Vote — semaines ----------
create table if not exists public.landing_vote_weeks (
  id uuid primary key default gen_random_uuid(),
  week_tag text not null,
  question text not null,
  options jsonb not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

-- Une seule semaine peut être marquée courante simultanément.
create unique index if not exists landing_vote_weeks_one_current
  on public.landing_vote_weeks (is_current)
  where is_current;

alter table public.landing_vote_weeks enable row level security;

drop policy if exists "anon read vote weeks" on public.landing_vote_weeks;
create policy "anon read vote weeks"
  on public.landing_vote_weeks
  for select
  to anon, authenticated
  using (true);

-- ---------- 2. Vote — réponses ----------
create table if not exists public.landing_vote_responses (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.landing_vote_weeks(id) on delete cascade,
  option_id text not null,
  anon_id uuid not null,
  voted_at timestamptz not null default now(),
  unique (week_id, anon_id)
);

create index if not exists landing_vote_responses_week_idx
  on public.landing_vote_responses (week_id);

alter table public.landing_vote_responses enable row level security;
-- Aucune policy publique : insertions via Server Action service-role
-- uniquement. Les anon ne peuvent ni lire ni écrire directement.

-- Vue agrégée publique : pour afficher les compteurs sans exposer les lignes
-- individuelles (qui contiennent l'anon_id).
drop view if exists public.landing_vote_results;
create view public.landing_vote_results as
  select
    week_id,
    option_id,
    count(*)::int as votes
  from public.landing_vote_responses
  group by week_id, option_id;

grant select on public.landing_vote_results to anon, authenticated;

-- ---------- 3. Newsletter ----------
create table if not exists public.landing_newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  source text not null default 'landing',
  consent_at timestamptz not null default now()
);

alter table public.landing_newsletter_subscribers enable row level security;
-- Aucune policy publique : INSERT via Server Action service-role uniquement.
