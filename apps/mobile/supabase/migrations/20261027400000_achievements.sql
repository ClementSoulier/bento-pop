-- ─────────────────────────────────────────────────────────────────────────
-- Succès
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 27, lot 1. Cf. `docs/UX-27-SUCCES.md`, §4 et §9.
--
-- ─── Ce que cette migration pose ─────────────────────────────────────────
--
--   1. `account_achievements` : les succès gagnés, un par ligne, datés, et
--      acquis pour toujours (D3, D8, D9) ;
--   2. l'interrupteur `app_config.achievements_enabled` (D18) ;
--   3. les règles du catalogue, `achievement_candidates`, et
--      `award_achievements`, qui pose ce qui manque (D4, D5) ;
--   4. les déclencheurs au geste, qui ne bloquent jamais ce geste (D10,
--      D15) ;
--   5. la lecture publique (D2, D13), la zone du 24 et l'export du 25, une
--      part de plus chacun (D14, D17) ;
--   6. le rattrapage des comptes existants, aux dates de leurs données (D16).
--
-- ─── Compatible avec les versions publiées ───────────────────────────────
--
-- La 1.1 et la 0.1.0 ne lisent pas la table neuve, sans droit client. Leurs
-- publications déclenchent la pose d'un succès, qui consigne une erreur sans
-- jamais faire échouer la publication (D15, D19). Contrôles de
-- `scripts/check-achievements.mjs`.
--
-- ─── Après le 25 ─────────────────────────────────────────────────────────
--
-- La zone redéfinie est celle du 24, l'export celui du 25 : cette migration
-- se joue après la sienne, donc après celles du 22, du 12, du 23 et du 24.
--
-- ─── Une écriture de données ─────────────────────────────────────────────
--
-- Le rattrapage de §6 écrit dans la table neuve, et nulle part ailleurs :
-- aucune donnée existante n'est modifiée.

-- ─── 1. Les succès gagnés ────────────────────────────────────────────────

create table if not exists public.account_achievements (
  user_id uuid not null references public.users(id) on delete cascade,
  key text not null check (key in ('first_bento', 'three_bentos', 'same_item_ten', 'first_item', 'five_items', 'ten_items', 'first_follower', 'ten_followers')),
  unlocked_at timestamptz not null,
  constraint account_achievements_pkey primary key (user_id, key)
);

alter table public.account_achievements enable row level security;
revoke all on public.account_achievements from anon, authenticated;

comment on table public.account_achievements is
  'Chantier 27 : les succès gagnés, datés de l''évènement qui les a fait '
  'gagner, acquis pour toujours. Sans accès client : seuls les déclencheurs '
  'et le rattrapage y écrivent.';

-- ─── 2. L'interrupteur ───────────────────────────────────────────────────

alter table public.app_config
  add column if not exists achievements_enabled boolean not null default true;

comment on column public.app_config.achievements_enabled is
  'Chantier 27 (D18) : éteint, plus rien ne se lit des succès, sans nouvelle '
  'version ; ils continuent de se poser, et rien ne manque une fois rallumé.';

create or replace function public.achievements_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.achievements_enabled from public.app_config c where c.id = 1), true);
$$;

-- ─── 3. Les règles ───────────────────────────────────────────────────────

-- Les succès que les données d'un compte méritent (§2 de la spécification),
-- chacun daté de l'évènement qui l'a fait gagner (D9) : la publication du
-- troisième bento, la validation du cinquième item, l'accord du dixième
-- abonné. Une fusion d'avant le 24 n'a pas de date : la proposition la
-- remplace.
create or replace function public.achievement_candidates(p_user uuid)
returns table (key text, unlocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with
  published as (
    select b.published_at,
           row_number() over (order by b.published_at, b.id) as n
    from public.bentos b
    where b.user_id = p_user and b.published_at is not null
  ),
  same_item as (
    select b.published_at,
           row_number() over (partition by bi.item_id order by b.published_at, b.id) as n
    from public.bento_items bi
    join public.bentos b on b.id = bi.bento_id
    where b.user_id = p_user and b.published_at is not null
  ),
  validated as (
    select coalesce(i.validated_at, i.merged_at, i.submitted_at, i.created_at) as at,
           row_number() over (
             order by coalesce(i.validated_at, i.merged_at, i.submitted_at, i.created_at), i.id
           ) as n
    from public.items i
    where i.submitted_by = p_user and i.status in ('validated', 'merged')
  ),
  followers as (
    select coalesce(f.accepted_at, f.created_at) as at,
           row_number() over (order by coalesce(f.accepted_at, f.created_at), f.follower_id) as n
    from public.account_follows f
    where f.followed_id = p_user and f.status = 'accepted'
  )
  select 'first_bento'::text, p.published_at from published p where p.n = 1
  union all
  select 'three_bentos', p.published_at from published p where p.n = 3
  union all
  select 'same_item_ten', min(s.published_at) from same_item s where s.n = 10 having count(*) > 0
  union all
  select 'first_item', v.at from validated v where v.n = 1
  union all
  select 'five_items', v.at from validated v where v.n = 5
  union all
  select 'ten_items', v.at from validated v where v.n = 10
  union all
  select 'first_follower', f.at from followers f where f.n = 1
  union all
  select 'ten_followers', f.at from followers f where f.n = 10;
$$;

-- Pose les succès qui manquent à un compte, sans jamais en retirer (D3).
-- Jamais dans le futur : une date d'évènement en avance n'est pas une
-- promesse. Un profil éditorial (14), composé par l'équipe pour un invité,
-- n'en gagne pas (D21).
create or replace function public.award_achievements(p_user uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.account_achievements (user_id, key, unlocked_at)
  select p_user, c.key, least(c.unlocked_at, now())
  from public.achievement_candidates(p_user) c
  where exists (select 1 from public.users u where u.id = p_user and u.kind = 'member')
  on conflict (user_id, key) do nothing;
$$;

-- ─── 4. Les déclencheurs au geste (D10, D15) ─────────────────────────────

-- Une erreur s'y consigne et le geste passe : un succès ne bloque jamais une
-- publication, de la 1.1 et de la 0.1.0 comme de la nouvelle app.
create or replace function public.award_achievements_safely(p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_user is null then
    return;
  end if;
  perform public.award_achievements(p_user);
exception when others then
  raise warning 'award_achievements(%) : %', p_user, sqlerrm;
end;
$$;

create or replace function public.achievements_on_bento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_achievements_safely(new.user_id);
  return null;
end;
$$;

create or replace function public.achievements_on_bento_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_achievements_safely(
    (select b.user_id from public.bentos b where b.id = new.bento_id and b.published_at is not null)
  );
  return null;
end;
$$;

create or replace function public.achievements_on_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_achievements_safely(new.submitted_by);
  return null;
end;
$$;

create or replace function public.achievements_on_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_achievements_safely(new.followed_id);
  return null;
end;
$$;

drop trigger if exists bentos_achievements on public.bentos;
create trigger bentos_achievements
  after insert or update of published_at on public.bentos
  for each row
  when (new.published_at is not null)
  execute function public.achievements_on_bento();

drop trigger if exists bento_items_achievements on public.bento_items;
create trigger bento_items_achievements
  after insert or update of item_id on public.bento_items
  for each row
  execute function public.achievements_on_bento_item();

drop trigger if exists items_achievements on public.items;
create trigger items_achievements
  after update of status on public.items
  for each row
  when (new.submitted_by is not null and new.status in ('validated', 'merged')
        and new.status is distinct from old.status)
  execute function public.achievements_on_item();

drop trigger if exists account_follows_achievements on public.account_follows;
create trigger account_follows_achievements
  after insert or update of status on public.account_follows
  for each row
  when (new.status = 'accepted')
  execute function public.achievements_on_follow();

-- ─── 5. Les lectures ─────────────────────────────────────────────────────

-- Les succès d'un compte (D2, D13), du plus ancien au plus récent ; rien
-- quand l'interrupteur est éteint. Ouverte à `anon`, pour le web.
create or replace function public.account_achievements_of(p_user uuid)
returns table (key text, unlocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.key, a.unlocked_at
  from public.account_achievements a
  where a.user_id = p_user
    and public.achievements_open()
  order by a.unlocked_at, a.key;
$$;

-- La zone du 24, ses succès en plus (D14).
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

    -- Chantier 27 (D14) : ses succès, un par ligne, la clé en détail.
    union all
    select 'achievement', 'achievement:' || a.key, a.unlocked_at, null,
           null, null, null, null, a.key
    from public.account_achievements a
    where a.user_id = p_viewer
      and public.achievements_open()
  )
  select e.kind, e.group_key, e.at, e.actor_id, e.bento_id, e.item_id,
         e.kept_item_id, e.item_status, e.detail
  from events e
  where p_viewer is not null
    and public.notifications_open()
    and e.at > now() - interval '90 days'
    and e.at <= now();
$$;

-- L'export du 25, ses succès en plus (D17).
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
    ),
    'social_links', jsonb_build_object(
      'instagram', (select l.instagram from public.account_links l where l.user_id = auth.uid()),
      'tiktok', (select l.tiktok from public.account_links l where l.user_id = auth.uid()),
      'visible', (select u.social_visible from public.users u where u.id = auth.uid())
    ),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('key', a.key, 'unlocked_at', a.unlocked_at)
             order by a.unlocked_at, a.key)
      from public.account_achievements a
      where a.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- ─── 6. Les droits ───────────────────────────────────────────────────────
--
-- `revoke ... from public` ne suffit pas : Supabase accorde `execute` à
-- `anon` et `authenticated` par des privilèges par défaut. Seule
-- `account_achievements_of` reste ouverte à `anon`, pour le web (D13).

revoke all on function public.achievements_open() from public, anon, authenticated;
revoke all on function public.achievement_candidates(uuid) from public, anon, authenticated;
revoke all on function public.award_achievements(uuid) from public, anon, authenticated;
revoke all on function public.award_achievements_safely(uuid) from public, anon, authenticated;
revoke all on function public.achievements_on_bento() from public, anon, authenticated;
revoke all on function public.achievements_on_bento_item() from public, anon, authenticated;
revoke all on function public.achievements_on_item() from public, anon, authenticated;
revoke all on function public.achievements_on_follow() from public, anon, authenticated;
revoke all on function public.account_achievements_of(uuid) from public, anon, authenticated;
revoke all on function public.notification_events(uuid) from public, anon, authenticated;
revoke all on function public.my_social_export() from public, anon, authenticated;

grant execute on function public.account_achievements_of(uuid) to anon, authenticated;
grant execute on function public.my_social_export() to authenticated;

comment on function public.achievements_open() is
  'Chantier 27 (D18) : l''interrupteur `app_config.achievements_enabled`, '
  'allumé par défaut.';
comment on function public.achievement_candidates(uuid) is
  'Chantier 27 (D4, D9) : les succès que les données d''un compte méritent, '
  'datés. Interne.';
comment on function public.award_achievements(uuid) is
  'Chantier 27 (D3) : pose les succès qui manquent, sans jamais en retirer. '
  'Interne.';
comment on function public.award_achievements_safely(uuid) is
  'Chantier 27 (D15) : `award_achievements`, une erreur consignée sans '
  'bloquer le geste. Interne.';
comment on function public.account_achievements_of(uuid) is
  'Chantier 27 (D2, D13) : les succès d''un compte, rien interrupteur éteint.';

-- ─── 7. Le rattrapage (D16) ──────────────────────────────────────────────

select public.award_achievements(u.id) from public.users u;

notify pgrst, 'reload schema';
