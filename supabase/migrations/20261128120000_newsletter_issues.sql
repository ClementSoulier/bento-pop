-- Envoi de la newsletter depuis le back-office (cf. docs/NEWSLETTER-ENVOI.md).
--
-- Base : Supabase de la landing et du back-office (supabase.bento-pop.com),
-- pas le projet mobile « My Bento Pop ».
--
-- Un numéro se prépare en brouillon au BO, puis part par un Broadcast de
-- Resend. Les admins lisent et écrivent les numéros sous la RLS ; les
-- compteurs (mails partis, rebonds, plaintes) sont tenus par le webhook de
-- la landing, en service-role, par `newsletter_record_event`.
--
-- Rejouable : chaque objet est créé « if not exists » ou remplacé.

-- ============================================================
-- 1. Les numéros
-- ============================================================
create table if not exists public.newsletter_issues (
  id                  uuid primary key default gen_random_uuid(),
  subject             text not null default '' check (char_length(subject) <= 150),
  preheader           text not null default '' check (char_length(preheader) <= 200),
  html                text not null default '' check (octet_length(html) <= 512000),
  text                text not null default '' check (octet_length(text) <= 200000),
  -- draft : modifiable ; sending : confié à Resend, pas encore parti ;
  -- scheduled : programmé chez Resend ; sent : au moins un mail est parti.
  status              text not null default 'draft'
                        check (status in ('draft', 'sending', 'scheduled', 'sent')),
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  recipients          integer check (recipients >= 0),
  delivered           integer not null default 0 check (delivered >= 0),
  bounces             integer not null default 0 check (bounces >= 0),
  complaints          integer not null default 0 check (complaints >= 0),
  resend_broadcast_id text unique,
  last_error          text,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint newsletter_issues_scheduled_has_date
    check (status <> 'scheduled' or scheduled_at is not null)
);

comment on table public.newsletter_issues is
  'Numéros de la newsletter, préparés au BO et envoyés par Resend Broadcasts (docs/NEWSLETTER-ENVOI.md).';

create index if not exists newsletter_issues_created_idx
  on public.newsletter_issues (created_at desc);

drop trigger if exists newsletter_issues_updated_at on public.newsletter_issues;
create trigger newsletter_issues_updated_at
  before update on public.newsletter_issues
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. Garde des statuts
-- ============================================================
-- Seul un brouillon change de contenu, et un numéro parti ne redevient
-- jamais autre chose : un numéro envoyé ne peut pas repartir par erreur,
-- même par une requête écrite à la main.
create or replace function public.newsletter_issues_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (
       new.subject is distinct from old.subject
    or new.preheader is distinct from old.preheader
    or new.html is distinct from old.html
    or new.text is distinct from old.text
  ) then
    raise exception 'newsletter_issues : seul un brouillon se modifie (statut %)', old.status
      using errcode = 'check_violation';
  end if;
  if old.status = 'sent' and new.status <> 'sent' then
    raise exception 'newsletter_issues : un numéro envoyé le reste'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists newsletter_issues_guard on public.newsletter_issues;
create trigger newsletter_issues_guard
  before update on public.newsletter_issues
  for each row execute function public.newsletter_issues_guard();

-- ============================================================
-- 3. Droits du back-office
-- ============================================================
alter table public.newsletter_issues enable row level security;

drop policy if exists "admins read issues" on public.newsletter_issues;
create policy "admins read issues" on public.newsletter_issues
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "admins create issues" on public.newsletter_issues;
create policy "admins create issues" on public.newsletter_issues
  for insert to authenticated
  with check ((select public.is_admin()) and status = 'draft');

drop policy if exists "admins update issues" on public.newsletter_issues;
create policy "admins update issues" on public.newsletter_issues
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admins delete draft issues" on public.newsletter_issues;
create policy "admins delete draft issues" on public.newsletter_issues
  for delete to authenticated
  using ((select public.is_admin()) and status = 'draft');

-- ============================================================
-- 4. Événements du webhook de Resend
-- ============================================================
-- Resend peut livrer deux fois le même événement : son identifiant (en-tête
-- `svix-id`) est gardé 30 jours pour ne le compter qu'une fois. Aucune
-- policy : seul le service-role y touche.
create table if not exists public.newsletter_webhook_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

alter table public.newsletter_webhook_events enable row level security;

create index if not exists newsletter_webhook_events_received_idx
  on public.newsletter_webhook_events (received_at);

-- Enregistre un événement, et rend false s'il était déjà connu. Un mail parti
-- (`email.sent`), un rebond ou une plainte d'un Broadcast incrémente son
-- numéro ; le premier mail parti le passe à « envoyé ».
create or replace function public.newsletter_record_event(
  p_event_id     text,
  p_type         text,
  p_broadcast_id text default null,
  p_at           timestamptz default now()
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.newsletter_webhook_events (id, type)
  values (p_event_id, p_type)
  on conflict (id) do nothing;
  if not found then
    return false;
  end if;

  delete from public.newsletter_webhook_events
  where received_at < now() - interval '30 days';

  if p_broadcast_id is not null then
    update public.newsletter_issues
    set delivered  = delivered  + (p_type = 'email.sent')::int,
        bounces    = bounces    + (p_type = 'email.bounced')::int,
        complaints = complaints + (p_type = 'email.complained')::int,
        status     = case when p_type = 'email.sent' then 'sent' else status end,
        sent_at    = case when p_type = 'email.sent' then coalesce(sent_at, p_at) else sent_at end
    where resend_broadcast_id = p_broadcast_id;
  end if;
  return true;
end;
$$;

revoke all on function public.newsletter_record_event(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.newsletter_record_event(text, text, text, timestamptz) to service_role;
