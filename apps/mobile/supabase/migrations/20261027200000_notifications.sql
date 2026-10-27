-- ─────────────────────────────────────────────────────────────────────────
-- La zone de notifications
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 24, lot 1. Cf. `docs/UX-24-ZONE-DE-NOTIFICATIONS.md`, §6 et §11.
--
-- ─── Ce que cette migration pose ─────────────────────────────────────────
--
--   1. `notification_reads` : la date à laquelle chaque compte a lu sa zone
--      pour la dernière fois (D8) ;
--   2. `items.merged_at`, posée à la fusion comme `validated_at` et
--      `rejected_at` le sont déjà (D15), et l'interrupteur
--      `app_config.notifications_enabled` (D13) ;
--   3. `notification_events`, interne : les évènements des 90 derniers jours
--      d'un compte, lus à la volée dans les tables des 18, 22, 12 et 23. Rien
--      n'est recopié (D4) : retirer son like, masquer un commentaire, ne plus
--      suivre, bloquer ou supprimer son compte retire l'évènement de la zone
--      sans autre code ;
--   4. les fonctions de l'app : le nombre (D8), la liste regroupée (D6, D22),
--      la date de lecture (D8), et l'export (D17).
--
-- ─── Compatible avec les versions publiées ───────────────────────────────
--
-- La 1.1 de l'App Store et la 0.1.0 du Play Store ne lisent rien de neuf :
-- une table sans droit client, deux colonnes que leurs lectures reçoivent
-- sans effet, des fonctions neuves (D16). Aucun déclencheur ne s'ajoute à
-- leurs écritures ; celui des items gagne une branche, que seule la fusion
-- du back-office atteint. Contrôles de `scripts/check-notifications.mjs`.
--
-- ─── Après le 23 ─────────────────────────────────────────────────────────
--
-- La zone lit `account_follows`, du 23, et l'export de §4 reprend le sien :
-- cette migration se joue après la sienne, donc après celles du 22 et du 12.

-- ─── 1. La date de lecture ───────────────────────────────────────────────

-- Une ligne par compte qui a ouvert sa zone. Rien n'y est écrit avant : une
-- zone jamais lue tient tous ses évènements pour nouveaux.
create table if not exists public.notification_reads (
  user_id uuid primary key references public.users(id) on delete cascade,
  seen_at timestamptz not null
);

alter table public.notification_reads enable row level security;
revoke all on public.notification_reads from anon, authenticated;

comment on table public.notification_reads is
  'Chantier 24 (D8) : la date de la dernière lecture de sa zone de '
  'notifications, par compte. Sans accès client direct : '
  '`mark_notifications_seen` en est le seul chemin.';

-- ─── 2. La date d'une fusion et l'interrupteur ───────────────────────────

alter table public.items
  add column if not exists merged_at timestamptz;

comment on column public.items.merged_at is
  'Chantier 24 (D15) : la date à laquelle l''item a été fusionné dans un '
  'autre, posée par `items_touch_lifecycle_on_update`. Vide pour les fusions '
  'd''avant le 27 octobre 2026.';

-- La fonction du 28 mai, une branche de plus pour la fusion. Seul le
-- back-office change le statut d'un item.
create or replace function public.items_touch_lifecycle_on_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'validated' and old.status != 'validated' then
      new.validated_at := coalesce(new.validated_at, now());
    elsif new.status = 'rejected' and old.status != 'rejected' then
      new.rejected_at := coalesce(new.rejected_at, now());
    elsif new.status = 'merged' and old.status != 'merged' then
      new.merged_at := coalesce(new.merged_at, now());
    end if;
  end if;
  return new;
end;
$$;

-- Les items proposés par un compte, que sa zone relit à chaque lecture.
create index if not exists items_submitted_by
  on public.items (submitted_by)
  where submitted_by is not null;

alter table public.app_config
  add column if not exists notifications_enabled boolean not null default true;

comment on column public.app_config.notifications_enabled is
  'Chantier 24 (D13) : éteint, la zone ne rend plus rien et l''app retire '
  'son onglet, sans nouvelle version.';

create or replace function public.notifications_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.notifications_enabled from public.app_config c where c.id = 1), true);
$$;

-- ─── 3. Les évènements ───────────────────────────────────────────────────

-- Les évènements des 90 derniers jours d'un compte (D3), un par ligne, avec
-- sa sorte, sa clé de regroupement (D6), sa date, son auteur et sa cible.
-- Jamais rien de soi-même, ni d'un compte bloqué dans un sens ou dans
-- l'autre (D11) ; un like ne porte pas son auteur (D7). Les bentos visés sont
-- publiés : dépublié, un bento sort de la zone avec tout ce qui le vise.
-- Interne : ni l'app ni le web ne l'appellent, les fonctions de §4 lui
-- passent `auth.uid()`.
create or replace function public.notification_events(p_viewer uuid)
returns table (
  kind text,
  group_key text,
  at timestamptz,
  actor_id uuid,
  bento_id uuid,
  item_id uuid,
  kept_item_id uuid,
  item_status text,
  detail text
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  mine as (
    select b.id
    from public.bentos b
    where b.user_id = p_viewer and b.published_at is not null
  ),
  blocked as (
    select k.blocked_id as id from public.account_blocks k where k.blocker_id = p_viewer
    union
    select k.blocker_id from public.account_blocks k where k.blocked_id = p_viewer
  ),
  events as (
    select 'like'::text as kind, 'like:' || l.bento_id::text as group_key,
           l.created_at as at, null::uuid as actor_id, l.bento_id,
           null::uuid as item_id, null::uuid as kept_item_id,
           null::text as item_status, null::text as detail
    from public.bento_likes l
    where l.bento_id in (select m.id from mine m)
      and l.user_id <> p_viewer
      and l.user_id not in (select x.id from blocked x)

    union all
    select 'comment', 'comment:' || c.bento_id::text, c.created_at, c.author_id,
           c.bento_id, null, null, null, c.body
    from public.bento_comments c
    where c.bento_id in (select m.id from mine m)
      and c.status = 'visible'
      and c.author_id <> p_viewer
      and c.author_id not in (select x.id from blocked x)

    -- Un compte ouvert accepte en suivant : sa date est celle de
    -- l'abonnement, ou de l'accord pour un compte qui valide.
    union all
    select 'follow', 'follow', coalesce(f.accepted_at, f.created_at), f.follower_id,
           null, null, null, null, null
    from public.account_follows f
    where f.followed_id = p_viewer
      and f.status = 'accepted'
      and f.follower_id not in (select x.id from blocked x)

    union all
    select 'follow_request', 'follow_request', f.created_at, f.follower_id,
           null, null, null, null, null
    from public.account_follows f
    where f.followed_id = p_viewer
      and f.status = 'pending'
      and f.follower_id not in (select x.id from blocked x)

    -- D14 : publié après le début de l'abonnement, profils éditoriaux
    -- compris (D6 du 23).
    union all
    select 'followed_bento', 'followed_bento:' || b.id::text, b.published_at, b.user_id,
           b.id, null, null, null, null
    from public.account_follows f
    join public.bentos b on b.user_id = f.followed_id
    where f.follower_id = p_viewer
      and f.status = 'accepted'
      and b.published_at is not null
      and b.published_at > coalesce(f.accepted_at, f.created_at)
      and b.user_id not in (select x.id from blocked x)

    -- Validés et fusionnés partagent une ligne (D6) ; une fusion se suit
    -- vers l'item conservé, comme le tap du push du 17 (D10).
    union all
    select 'item_validated', 'item_validated', i.validated_at, null,
           null, i.id, null, 'validated', null
    from public.items i
    where i.submitted_by = p_viewer
      and i.status = 'validated'
      and i.validated_at is not null

    union all
    select 'item_validated', 'item_validated', i.merged_at, null,
           null, i.id, i.merged_into_id, 'merged', null
    from public.items i
    where i.submitted_by = p_viewer
      and i.status = 'merged'
      and i.merged_at is not null

    union all
    select 'item_rejected', 'item_rejected:' || i.id::text, i.rejected_at, null,
           null, i.id, null, 'rejected', i.rejected_reason
    from public.items i
    where i.submitted_by = p_viewer
      and i.status = 'rejected'
      and i.rejected_at is not null

    union all
    select 'bento_published', 'bento_published:' || b.id::text, b.auto_published_at, null,
           b.id, null, null, null, null
    from public.bentos b
    where b.user_id = p_viewer
      and b.published_at is not null
      and b.auto_published_at is not null

    -- Le commentaire masqué d'un compte, sur le bento d'un autre comme sur
    -- le sien ; le motif est rendu, comme dans `list_bento_comments`.
    union all
    select 'comment_hidden', 'comment_hidden:' || c.id::text, c.hidden_at, null,
           c.bento_id, null, null, null, c.hidden_reason
    from public.bento_comments c
    join public.bentos b on b.id = c.bento_id
    where c.author_id = p_viewer
      and c.status = 'hidden'
      and c.hidden_at is not null
      and b.published_at is not null

    union all
    select 'why_hidden', 'why_hidden:' || w.id::text, w.hidden_at, null,
           w.bento_id, bi.item_id, null, null, w.hidden_reason
    from public.bento_whys w
    join public.bentos b on b.id = w.bento_id
    left join public.bento_items bi
      on bi.bento_id = w.bento_id and bi.category_id = w.category_id
    where b.user_id = p_viewer
      and b.published_at is not null
      and w.status = 'hidden'
      and w.hidden_at is not null
  )
  select e.kind, e.group_key, e.at, e.actor_id, e.bento_id, e.item_id,
         e.kept_item_id, e.item_status, e.detail
  from events e
  where p_viewer is not null
    and public.notifications_open()
    and e.at > now() - interval '90 days'
    and e.at <= now();
$$;

-- ─── 4. Les fonctions de l'app ───────────────────────────────────────────

-- La date de lecture de qui appelle, ou le début des temps : une zone jamais
-- lue n'a que du neuf.
create or replace function public.notifications_seen_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.seen_at from public.notification_reads r where r.user_id = auth.uid()),
    '-infinity'::timestamptz
  );
$$;

-- Le nombre de la pastille (D8) : les lignes nouvelles, comptées comme la
-- liste les regroupe. 0 sans session, sans profil, interrupteur éteint.
create or replace function public.notification_badge()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct e.group_key)::integer
  from public.notification_events(auth.uid()) e
  where e.at > public.notifications_seen_at();
$$;

-- La liste (D6, D22) : une ligne par sujet et par moitié, nouvelle ou plus
-- tôt, la plus récente d'abord. Les nouvelles viennent en tête par
-- construction : leur date dépasse `seen_at`, celle des autres non. Le
-- curseur est la date et la clé de la dernière ligne lue, une clé n'ayant
-- qu'une ligne à une date donnée.
create or replace function public.list_notifications(
  p_before timestamptz default null,
  p_before_key text default null,
  p_limit integer default 30
)
returns table (
  kind text,
  group_key text,
  is_new boolean,
  latest_at timestamptz,
  events integer,
  actors integer,
  actor_pseudos text[],
  actor_avatar text,
  bento_id uuid,
  bento_slug text,
  bento_primary boolean,
  edition_title text,
  owner_pseudo text,
  item_id uuid,
  kept_item_id uuid,
  item_status text,
  item_titles text[],
  detail text
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  ev as (
    select e.*, e.at > public.notifications_seen_at() as fresh
    from public.notification_events(auth.uid()) e
  ),
  grouped as (
    select
      ev.kind,
      ev.group_key,
      ev.fresh,
      max(ev.at) as latest_at,
      count(*)::integer as events,
      count(distinct ev.actor_id)::integer as actors,
      array_agg(ev.actor_id order by ev.at desc) filter (where ev.actor_id is not null) as actor_ids,
      array_agg(ev.item_id order by ev.at desc) filter (where ev.item_id is not null) as item_ids,
      (array_agg(ev.bento_id order by ev.at desc))[1] as bento_id,
      (array_agg(ev.item_id order by ev.at desc))[1] as item_id,
      (array_agg(ev.kept_item_id order by ev.at desc))[1] as kept_item_id,
      (array_agg(ev.item_status order by ev.at desc))[1] as item_status,
      (array_agg(ev.detail order by ev.at desc))[1] as detail
    from ev
    group by ev.kind, ev.group_key, ev.fresh
  ),
  page as (
    select g.*
    from grouped g
    where p_before is null
       or (g.latest_at, g.group_key) < (p_before, coalesce(p_before_key, g.group_key))
    order by g.latest_at desc, g.group_key desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50)
  )
  select
    p.kind,
    p.group_key,
    p.fresh,
    p.latest_at,
    p.events,
    p.actors,
    -- Les deux auteurs les plus récents, chacun une fois.
    array(
      select u.pseudo
      from unnest(p.actor_ids) with ordinality as a(id, n)
      join public.users u on u.id = a.id
      group by u.pseudo
      order by min(a.n)
      limit 2
    ),
    (select u.avatar from public.users u where u.id = p.actor_ids[1]),
    p.bento_id,
    b.slug,
    b.is_primary,
    ed.title,
    o.pseudo,
    p.item_id,
    p.kept_item_id,
    p.item_status,
    -- Un item fusionné s'annonce sous le titre de l'item gardé, celui que sa
    -- case montre désormais, et non sous la proposition, « Inseption » pour
    -- « Inception » (recette du lot 5).
    array(
      select coalesce(k.title, i.title)
      from unnest(p.item_ids) with ordinality as a(id, n)
      join public.items i on i.id = a.id
      left join public.items k on k.id = i.merged_into_id and i.status = 'merged'
      order by a.n
      limit 2
    ),
    p.detail
  from page p
  left join public.bentos b on b.id = p.bento_id
  left join public.editions ed on ed.id = b.edition_id
  left join public.users o on o.id = b.user_id
  order by p.latest_at desc, p.group_key desc;
$$;

-- La date de lecture (D8) : la plus récente que l'écran montre, jamais plus
-- tard que maintenant, et jamais en arrière. Rend la date posée, ou rien
-- sans profil ou interrupteur éteint.
create or replace function public.mark_notifications_seen(p_until timestamptz)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_seen timestamptz;
begin
  if auth.uid() is null or p_until is null or not public.notifications_open() then
    return null;
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid()) then
    return null;
  end if;

  insert into public.notification_reads as r (user_id, seen_at)
  values (auth.uid(), least(p_until, now()))
  on conflict (user_id) do update
    set seen_at = greatest(r.seen_at, excluded.seen_at)
  returning r.seen_at into v_seen;

  return v_seen;
end;
$$;

-- L'export de ses données (D17) : celui du 23, la date de lecture en plus.
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
    ),
    'notifications', jsonb_build_object(
      'seen_at', (select r.seen_at from public.notification_reads r where r.user_id = auth.uid())
    )
  );
$$;

-- ─── 5. Les droits ───────────────────────────────────────────────────────
--
-- `revoke ... from public` ne suffit pas : Supabase accorde `execute` à
-- `anon` et `authenticated` par des privilèges par défaut. Rien n'est ouvert
-- à `anon` : la zone n'existe que pour un compte.

revoke all on function public.notifications_open() from public, anon, authenticated;
revoke all on function public.notification_events(uuid) from public, anon, authenticated;
revoke all on function public.notifications_seen_at() from public, anon, authenticated;
revoke all on function public.notification_badge() from public, anon, authenticated;
revoke all on function public.list_notifications(timestamptz, text, integer) from public, anon, authenticated;
revoke all on function public.mark_notifications_seen(timestamptz) from public, anon, authenticated;
revoke all on function public.my_social_export() from public, anon, authenticated;

grant execute on function public.notification_badge() to authenticated;
grant execute on function public.list_notifications(timestamptz, text, integer) to authenticated;
grant execute on function public.mark_notifications_seen(timestamptz) to authenticated;
grant execute on function public.my_social_export() to authenticated;

comment on function public.notifications_open() is
  'Chantier 24 (D13) : l''interrupteur `app_config.notifications_enabled`, '
  'allumé par défaut.';
comment on function public.notification_events(uuid) is
  'Chantier 24 (D4) : les évènements des 90 derniers jours d''un compte, lus '
  'à la volée, sans rien recopier. Interne.';
comment on function public.notifications_seen_at() is
  'Chantier 24 (D8) : la date de lecture de qui appelle, ou le début des '
  'temps. Interne.';
comment on function public.notification_badge() is
  'Chantier 24 (D8) : le nombre de lignes nouvelles de sa zone.';
comment on function public.list_notifications(timestamptz, text, integer) is
  'Chantier 24 (D6, D22) : sa zone, regroupée, la plus récente d''abord, '
  '30 lignes par page.';
comment on function public.mark_notifications_seen(timestamptz) is
  'Chantier 24 (D8) : pose la date de lecture, sans jamais reculer ni '
  'dépasser maintenant.';

notify pgrst, 'reload schema';
