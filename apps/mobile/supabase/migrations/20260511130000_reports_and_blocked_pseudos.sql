-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  Mon Bento Pop — modération UGC (Apple guideline 1.2)                ║
-- ║  Tables : reports, blocked_pseudo_patterns                            ║
-- ║  Trigger : check pseudo contre blocked patterns à l'insert/update    ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─── 1. Reports — utilisateurs signalent un bento ou un pseudo ───────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  -- Cible : on supporte deux types pour rester simple au MVP
  target_kind text not null check (target_kind in ('bento', 'pseudo')),
  target_pseudo text not null,        -- copié pour la trace même si user supprimé
  target_bento_id uuid,                -- null si target_kind = 'pseudo'
  reason text,                         -- texte libre, max ~500 chars en pratique
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text                     -- email admin
);

create index reports_status_idx on public.reports (status) where status = 'pending';
create index reports_target_pseudo_idx on public.reports (target_pseudo);

alter table public.reports enable row level security;

-- Insert public : tout utilisateur authentifié (anonymous inclus) peut
-- signaler. Pas de lecture côté client (modération via le BO admin avec
-- service-role).
create policy "reports_insert_authenticated"
  on public.reports
  for insert
  to authenticated
  with check (reporter_id is null or reporter_id = (select auth.uid()));

comment on table public.reports is
  'Signalements UGC (bento ou pseudo). Modération via le BO admin (service-role). Réponse < 24h pour conformité Apple 1.2.';

-- ─── 2. Patterns interdits sur les pseudos ───────────────────────────
-- Liste de regex case-insensitive matchée à l'insert de public.users.
-- Le BO admin peut éditer / étendre cette liste sans redéploiement.
create table public.blocked_pseudo_patterns (
  id smallint primary key generated always as identity,
  pattern text not null unique,         -- regex POSIX (sans flags, on lowercase)
  label text not null,                  -- description pour le BO
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.blocked_pseudo_patterns enable row level security;

-- Pas d'accès client. Lu uniquement par la function trigger en SECURITY DEFINER.
-- (Aucune policy → tout est refusé en RLS.)

comment on table public.blocked_pseudo_patterns is
  'Patterns regex bloquant la création de pseudo (slurs, marques, etc.). Édité depuis le BO admin via service-role.';

-- ─── 3. Trigger : check pseudo contre les patterns ──────────────────
create or replace function public.check_pseudo_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hit text;
begin
  select pattern into hit
  from public.blocked_pseudo_patterns
  where is_active = true
    and lower(new.pseudo) ~ pattern
  limit 1;

  if hit is not null then
    raise exception 'Pseudo non autorisé.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger users_pseudo_block_check
  before insert or update of pseudo on public.users
  for each row execute function public.check_pseudo_blocked();

-- ─── 4. Seed : liste de base FR + EN (patterns lowercase) ────────────
-- Liste volontairement courte et basique. À étendre via le BO au fil de
-- l'usage. Les regex ciblent les variantes (espaces, chiffres-pour-lettres).
insert into public.blocked_pseudo_patterns (pattern, label) values
  -- Slurs racistes / homophobes (FR + EN)
  ('n[il1]gg(er|a)', 'slur RN-EN'),
  ('f[a@]gg?[o0]t', 'slur LGBT-EN'),
  ('p[ée][dd][ée]', 'slur LGBT-FR'),
  ('ret(ard|ar?d)', 'slur capacitiste-EN'),
  -- Termes vulgaires explicites
  ('p[uv]t[ae]', 'vulgarité-FR'),
  ('encul[ée]+', 'vulgarité-FR'),
  ('c[o0]nn?ard', 'vulgarité-FR'),
  ('b[1i]tch', 'vulgarité-EN'),
  -- Variantes courantes Hitler / Nazi
  ('h[il1]tl[ée]r', 'nazi'),
  ('n[a@]z[il1]', 'nazi'),
  ('ss[0o]+', 'nazi-1488 etc.'),
  -- Mots-clés admin pour éviter les fakes
  ('admin', 'usurpation-admin'),
  ('officiel', 'usurpation-officiel'),
  ('moderateur', 'usurpation-mod'),
  ('bento.?pop.?team', 'usurpation-team');
