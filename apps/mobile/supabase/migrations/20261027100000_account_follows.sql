-- ─────────────────────────────────────────────────────────────────────────
-- Suivre un compte
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 23, lot 1. Cf. `docs/UX-23-SUIVRE-UN-COMPTE.md`, §6 et §11.
--
-- ─── Ce que cette migration pose ─────────────────────────────────────────
--
--   1. `account_follows` : qui suit qui, accepté ou en attente (D3, D4,
--      D13), et le journal du rythme (D12) ;
--   2. le réglage `users.follow_approval` (D3, D11) et l'interrupteur
--      `app_config.follows_enabled` (D22) ;
--   3. le blocage qui retire l'abonnement (D10), et le réglage éteint qui
--      accepte les demandes (D11) ;
--   4. les fonctions de l'app, seul chemin d'écriture des clients (D5, D8,
--      D12), les nombres (D2, D16), le fil des abonnements (D1, D7) et
--      l'export (D15).
--
-- ─── Compatible avec les versions publiées ───────────────────────────────
--
-- La 1.1 de l'App Store et la 0.1.0 du Play Store ne lisent pas la table
-- neuve, qu'aucun client ne lit ni n'écrit directement. Elle n'est liée qu'à
-- `users`, en cascade : supprimer son profil, par leur règle
-- `users_delete_own` comme par `delete_own_account`, emporte ses abonnements
-- et ses abonnés. La colonne neuve de `users` arrive dans leurs lectures,
-- sans effet. Contrôles de `scripts/check-follows.mjs`.
--
-- ─── Après le 22 et le 12 ────────────────────────────────────────────────
--
-- Le déclencheur de §3 porte sur `account_blocks`, du 22, et l'export de §4
-- reprend celui du 12, pourquoi compris : cette migration se joue après les
-- leurs.

-- ─── 1. Les abonnements ──────────────────────────────────────────────────

-- Un profil suit un profil (D4, D6) : un profil éditorial, sans compte, se
-- suit et ne suit personne, faute de session pour le faire. `accepted_at`
-- date l'accord, celui d'un compte ouvert compris.
create table if not exists public.account_follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  followed_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted', 'pending')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint account_follows_pkey primary key (follower_id, followed_id),
  constraint account_follows_not_self check (follower_id <> followed_id)
);

create index if not exists account_follows_followed
  on public.account_follows (followed_id, status);

alter table public.account_follows enable row level security;
revoke all on public.account_follows from anon, authenticated;

comment on table public.account_follows is
  'Chantier 23 : qui suit qui, accepté ou en attente de l''accord du compte '
  'suivi. Sans accès client direct : les fonctions de la migration '
  '20261027100000 en sont le seul chemin.';

-- Le rythme de `set_follow` (D12) : les abonnements de la dernière journée.
create table if not exists public.account_follow_writes (
  user_id uuid not null references auth.users(id) on delete cascade,
  written_at timestamptz not null default now()
);

create index if not exists account_follow_writes_user
  on public.account_follow_writes (user_id, written_at);

alter table public.account_follow_writes enable row level security;
revoke all on public.account_follow_writes from anon, authenticated;

comment on table public.account_follow_writes is
  'Chantier 23 (D12) : les abonnements de la dernière journée, pour le rythme '
  'de `set_follow`. Sans accès client.';

-- ─── 2. Le réglage et l'interrupteur ─────────────────────────────────────

alter table public.users
  add column if not exists follow_approval boolean not null default false;

comment on column public.users.follow_approval is
  'Chantier 23 (D3) : « Valider mes abonnés ». Allumé, chaque nouvel '
  'abonnement est une demande ; éteint, les demandes en attente sont '
  'acceptées (D11).';

-- Modifiable par son titulaire seul : la règle `users_update_own` borne les
-- lignes, ce droit borne la colonne, comme `searchable` au 20.
grant update (follow_approval) on public.users to authenticated;

alter table public.app_config
  add column if not exists follows_enabled boolean not null default true;

comment on column public.app_config.follows_enabled is
  'Chantier 23 (D22) : éteint, plus rien ne se suit ni ne se lit des '
  'abonnements, sans nouvelle version ; ceux qui existent restent.';

create or replace function public.follows_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.follows_enabled from public.app_config c where c.id = 1), true);
$$;

-- ─── 3. Le blocage et le réglage ─────────────────────────────────────────

-- D10 : bloquer retire l'abonnement dans les deux sens, demandes comprises.
-- `set_follow` refuse ensuite d'en refaire un, tant que dure le blocage.
create or replace function public.account_blocks_drop_follows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.account_follows f
  where (f.follower_id = new.blocker_id and f.followed_id = new.blocked_id)
     or (f.follower_id = new.blocked_id and f.followed_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists account_blocks_drop_follows on public.account_blocks;
create trigger account_blocks_drop_follows
  after insert on public.account_blocks
  for each row execute function public.account_blocks_drop_follows();

-- D11 : éteindre « Valider mes abonnés » ouvre le compte à tous, ceux qui
-- attendaient compris. L'allumer ne retire personne.
create or replace function public.users_follow_approval_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_follows f
  set status = 'accepted', accepted_at = now()
  where f.followed_id = new.id and f.status = 'pending';
  return new;
end;
$$;

drop trigger if exists users_follow_approval_open on public.users;
create trigger users_follow_approval_open
  after update of follow_approval on public.users
  for each row
  when (old.follow_approval and not new.follow_approval)
  execute function public.users_follow_approval_open();

-- ─── 4. Les fonctions de l'app ───────────────────────────────────────────

-- Suivre, ou ne plus suivre, demande comprise (D3, D4, D5, D12). Rend
-- `accepted`, `pending`, ou rien quand on ne suit plus. Suivre un compte déjà
-- suivi, ou déjà demandé, ne fait rien et ne compte pas dans le rythme.
create or replace function public.set_follow(p_user uuid, p_on boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_approval boolean;
  v_status text;
begin
  if v_uid is null then
    raise exception 'follow_needs_session' using errcode = '42501';
  end if;
  if not public.follows_open() then
    raise exception 'follows_closed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.users u where u.id = v_uid) then
    raise exception 'follow_needs_profile' using errcode = '42501';
  end if;
  if p_user is null or p_user = v_uid then
    raise exception 'follow_invalid' using errcode = '22023';
  end if;

  if not coalesce(p_on, false) then
    delete from public.account_follows f
    where f.follower_id = v_uid and f.followed_id = p_user;
    return null;
  end if;

  select u.follow_approval into v_approval
  from public.users u
  where u.id = p_user;
  if not found then
    raise exception 'follow_invalid' using errcode = '22023';
  end if;

  select f.status into v_status
  from public.account_follows f
  where f.follower_id = v_uid and f.followed_id = p_user;
  if found then
    return v_status;
  end if;

  if exists (
    select 1
    from public.account_blocks k
    where (k.blocker_id = v_uid and k.blocked_id = p_user)
       or (k.blocker_id = p_user and k.blocked_id = v_uid)
  ) then
    raise exception 'follow_blocked' using errcode = '42501';
  end if;

  -- D12 : 60 abonnements nouveaux par heure, demandes comprises, comptés sur
  -- la dernière journée.
  delete from public.account_follow_writes j
  where j.user_id = v_uid and j.written_at < now() - interval '1 day';
  if (select count(*) from public.account_follow_writes j
      where j.user_id = v_uid and j.written_at > now() - interval '1 hour') >= 60 then
    raise exception 'follow_too_fast' using errcode = '54000';
  end if;
  insert into public.account_follow_writes (user_id) values (v_uid);

  v_status := case when v_approval then 'pending' else 'accepted' end;
  insert into public.account_follows (follower_id, followed_id, status, accepted_at)
  values (v_uid, p_user, v_status, case when v_status = 'accepted' then now() end)
  on conflict (follower_id, followed_id) do nothing;
  return v_status;
end;
$$;

-- Accepter ou refuser une demande reçue (D3). Vrai quand une demande a été
-- traitée.
create or replace function public.answer_follow(p_follower uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'follow_needs_session' using errcode = '42501';
  end if;
  if not public.follows_open() then
    raise exception 'follows_closed' using errcode = '42501';
  end if;

  if coalesce(p_accept, false) then
    update public.account_follows f
    set status = 'accepted', accepted_at = now()
    where f.follower_id = p_follower and f.followed_id = v_uid and f.status = 'pending';
  else
    delete from public.account_follows f
    where f.follower_id = p_follower and f.followed_id = v_uid and f.status = 'pending';
  end if;
  return found;
end;
$$;

-- Retirer un abonné, ou sa demande (D8), sans qu'il en soit prévenu.
create or replace function public.remove_follower(p_follower uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'follow_needs_session' using errcode = '42501';
  end if;
  if not public.follows_open() then
    raise exception 'follows_closed' using errcode = '42501';
  end if;

  delete from public.account_follows f
  where f.follower_id = p_follower and f.followed_id = v_uid;
  return found;
end;
$$;

-- Les nombres d'un compte (D2, D9, D13, D16) : ses abonnés et ses
-- abonnements acceptés, les demandes à son seul titulaire, le lien de qui
-- lit vers ce compte, et son réglage. Aucune ligne quand l'interrupteur est
-- éteint ou le compte inconnu. Ouverte à `anon`, pour le web.
create or replace function public.follow_summary(p_user uuid)
returns table (
  followers integer,
  following integer,
  requests integer,
  my_status text,
  approval boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.account_follows f
     where f.followed_id = u.id and f.status = 'accepted'),
    (select count(*)::integer from public.account_follows f
     where f.follower_id = u.id and f.status = 'accepted'),
    case when u.id = auth.uid() then
      (select count(*)::integer from public.account_follows f
       where f.followed_id = u.id and f.status = 'pending')
    end,
    (select f.status from public.account_follows f
     where f.follower_id = auth.uid() and f.followed_id = u.id),
    u.follow_approval
  from public.users u
  where u.id = p_user
    and public.follows_open();
$$;

-- Les listes (D8) : les abonnés, les abonnements, ou les demandes au seul
-- titulaire ; 50 par page, de la plus récente à la plus ancienne, le curseur
-- étant la date et l'identifiant de la dernière ligne lue ; sans les comptes
-- que qui lit a bloqués.
create or replace function public.follow_list(
  p_user uuid,
  p_kind text,
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns table (
  user_id uuid,
  pseudo text,
  display_name text,
  avatar text,
  kind text,
  status text,
  since timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with links as (
    select f.follower_id as other_id, f.status, coalesce(f.accepted_at, f.created_at) as since
    from public.account_follows f
    where p_kind = 'followers' and f.followed_id = p_user and f.status = 'accepted'
    union all
    select f.followed_id, f.status, coalesce(f.accepted_at, f.created_at)
    from public.account_follows f
    where p_kind = 'following' and f.follower_id = p_user and f.status = 'accepted'
    union all
    select f.follower_id, f.status, f.created_at
    from public.account_follows f
    where p_kind = 'requests' and f.followed_id = p_user and f.status = 'pending'
      and p_user = auth.uid()
  )
  select u.id, u.pseudo, u.display_name, u.avatar, u.kind, l.status, l.since
  from links l
  join public.users u on u.id = l.other_id
  where public.follows_open()
    and (p_before is null or (l.since, u.id) < (p_before, coalesce(p_before_id, u.id)))
    and not exists (
      select 1
      from public.account_blocks k
      where k.blocker_id = auth.uid() and k.blocked_id = u.id
    )
  order by l.since desc, u.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 50);
$$;

-- Les comptes que l'on suit, acceptés : la seule lecture de la table que
-- `following_bentos` fait, sous les droits de son appelant.
create or replace function public.my_followed_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.followed_id
  from public.account_follows f
  where f.follower_id = auth.uid()
    and f.status = 'accepted'
    and public.follows_open();
$$;

-- Le fil des abonnements (D1, D7) : en `security invoker`, donc sous la règle
-- `bentos_read_published`, comme « La table ». PostgREST trie, pagine et
-- complète le résultat avec la sélection du fil, `users` et les cases
-- comprises, puisque la fonction rend des lignes de `bentos`.
create or replace function public.following_bentos()
returns setof public.bentos
language sql
stable
security invoker
set search_path = ''
as $$
  select b.*
  from public.bentos b
  where b.published_at is not null
    and b.user_id in (select public.my_followed_ids());
$$;

-- L'export de ses données (D15) : celui du 12, ses abonnements et ses
-- abonnés en plus, demandes envoyées et reçues comprises.
create or replace function public.my_social_export()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'bento_id', c.bento_id, 'body', c.body,
               'status', c.status, 'created_at', c.created_at)
             order by c.created_at)
      from public.bento_comments c
      where c.author_id = auth.uid()), '[]'::jsonb),
    'likes', coalesce((
      select jsonb_agg(jsonb_build_object('bento_id', l.bento_id, 'created_at', l.created_at)
             order by l.created_at)
      from public.bento_likes l
      where l.user_id = auth.uid()), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('blocked_id', k.blocked_id, 'created_at', k.created_at)
             order by k.created_at)
      from public.account_blocks k
      where k.blocker_id = auth.uid()), '[]'::jsonb),
    'whys', coalesce((
      select jsonb_agg(jsonb_build_object(
               'bento_id', w.bento_id, 'case', g.key, 'body', w.body,
               'status', w.status, 'hidden_reason', w.hidden_reason,
               'updated_at', w.updated_at)
             order by w.bento_id, g.display_order)
      from public.bento_whys w
      join public.bentos b on b.id = w.bento_id
      join public.bento_categories g on g.id = w.category_id
      where b.user_id = auth.uid()), '[]'::jsonb),
    'follows', jsonb_build_object(
      'following', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'user_id', f.followed_id, 'pseudo', u.pseudo, 'status', f.status,
                 'created_at', f.created_at, 'accepted_at', f.accepted_at)
               order by f.created_at)
        from public.account_follows f
        left join public.users u on u.id = f.followed_id
        where f.follower_id = auth.uid()), '[]'::jsonb),
      'followers', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'user_id', f.follower_id, 'pseudo', u.pseudo, 'status', f.status,
                 'created_at', f.created_at, 'accepted_at', f.accepted_at)
               order by f.created_at)
        from public.account_follows f
        left join public.users u on u.id = f.follower_id
        where f.followed_id = auth.uid()), '[]'::jsonb)
    )
  );
$$;

-- ─── 5. Les droits ───────────────────────────────────────────────────────
--
-- `revoke ... from public` ne suffit pas : Supabase accorde `execute` à
-- `anon` et `authenticated` par des privilèges par défaut. Seule
-- `follow_summary` reste ouverte à `anon`, pour le web (D16).

revoke all on function public.follows_open() from public, anon, authenticated;
revoke all on function public.account_blocks_drop_follows() from public, anon, authenticated;
revoke all on function public.users_follow_approval_open() from public, anon, authenticated;
revoke all on function public.set_follow(uuid, boolean) from public, anon, authenticated;
revoke all on function public.answer_follow(uuid, boolean) from public, anon, authenticated;
revoke all on function public.remove_follower(uuid) from public, anon, authenticated;
revoke all on function public.follow_summary(uuid) from public, anon, authenticated;
revoke all on function public.follow_list(uuid, text, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function public.my_followed_ids() from public, anon, authenticated;
revoke all on function public.following_bentos() from public, anon, authenticated;
revoke all on function public.my_social_export() from public, anon, authenticated;

grant execute on function public.set_follow(uuid, boolean) to authenticated;
grant execute on function public.answer_follow(uuid, boolean) to authenticated;
grant execute on function public.remove_follower(uuid) to authenticated;
grant execute on function public.follow_summary(uuid) to anon, authenticated;
grant execute on function public.follow_list(uuid, text, timestamptz, uuid, integer) to authenticated;
grant execute on function public.my_followed_ids() to authenticated;
grant execute on function public.following_bentos() to authenticated;
grant execute on function public.my_social_export() to authenticated;

comment on function public.follows_open() is
  'Chantier 23 (D22) : l''interrupteur `app_config.follows_enabled`, allumé '
  'par défaut.';
comment on function public.account_blocks_drop_follows() is
  'Chantier 23 (D10) : un blocage retire l''abonnement entre les deux comptes, '
  'dans les deux sens, demandes comprises.';
comment on function public.users_follow_approval_open() is
  'Chantier 23 (D11) : « Valider mes abonnés » éteint, les demandes en '
  'attente sont acceptées.';
comment on function public.set_follow(uuid, boolean) is
  'Chantier 23 (D3, D4, D5, D12) : suivre ou ne plus suivre, demande '
  'comprise ; un profil requis, jamais soi-même ni à travers un blocage, '
  '60 par heure. Cf. docs/UX-23-SUIVRE-UN-COMPTE.md §6.2.';
comment on function public.answer_follow(uuid, boolean) is
  'Chantier 23 (D3) : accepter ou refuser une demande reçue.';
comment on function public.remove_follower(uuid) is
  'Chantier 23 (D8) : retirer un abonné, ou sa demande.';
comment on function public.follow_summary(uuid) is
  'Chantier 23 (D2, D9, D13, D16) : les abonnés et abonnements acceptés d''un '
  'compte, ses demandes à lui seul, le lien de qui lit et son réglage.';
comment on function public.follow_list(uuid, text, timestamptz, uuid, integer) is
  'Chantier 23 (D8) : les abonnés, les abonnements, ou les demandes à leur '
  'seul titulaire, 50 par page, sans les comptes que qui lit a bloqués.';
comment on function public.my_followed_ids() is
  'Chantier 23 (D7) : les comptes que l''on suit, acceptés, pour le fil des '
  'abonnements.';
comment on function public.following_bentos() is
  'Chantier 23 (D1, D7) : les bentos publiés des comptes suivis, sous la règle '
  'de lecture de `bentos`, triés et paginés par PostgREST.';
comment on function public.my_social_export() is
  'Chantiers 22 (D21), 12 (D13) et 23 (D15) : ses commentaires, ses likes, '
  'ses blocages, ses pourquoi, ses abonnements et ses abonnés, pour l''export '
  'de ses données.';

notify pgrst, 'reload schema';
