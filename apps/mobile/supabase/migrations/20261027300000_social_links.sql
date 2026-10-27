-- ─────────────────────────────────────────────────────────────────────────
-- Comptes Instagram et TikTok
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 25, lot 1. Cf. `docs/UX-25-COMPTES-INSTAGRAM-TIKTOK.md`, §4 et §10.
--
-- ─── Ce que cette migration pose ─────────────────────────────────────────
--
--   1. `account_links` : le pseudo Instagram et le pseudo TikTok d'un compte,
--      saisis, jamais vérifiés (D1, D4, D7) ;
--   2. le réglage `users.social_visible` (D3, D8) et l'interrupteur
--      `app_config.social_links_enabled` (D9) ;
--   3. les fonctions de l'app, seul chemin des clients : écrire, filtré par
--      la liste du 22 (D6), lire ce qui est montré (D7, D15), et l'export
--      (D13).
--
-- ─── Compatible avec les versions publiées ───────────────────────────────
--
-- La 1.1 de l'App Store et la 0.1.0 du Play Store ne lisent pas la table
-- neuve, qu'aucun client ne lit ni n'écrit directement. Elle n'est liée qu'à
-- `users`, en cascade : supprimer son profil, par leur règle
-- `users_delete_own` comme par `delete_own_account`, emporte ses liens. La
-- colonne neuve de `users` arrive dans leurs lectures, sans effet (D14).
-- Contrôles de `scripts/check-social-links.mjs`.
--
-- ─── Après le 24 ─────────────────────────────────────────────────────────
--
-- L'export de §3 reprend celui du 24 : cette migration se joue après la
-- sienne, donc après celles du 22, du 12 et du 23.

-- ─── 1. Les liens ────────────────────────────────────────────────────────

-- Une ligne par compte qui a saisi au moins un pseudo ; deux vides effacent
-- la ligne. Les formats de §4.1, en minuscules, tenus par la base même si un
-- client contournait `set_social_links`.
create table if not exists public.account_links (
  user_id uuid primary key references public.users(id) on delete cascade,
  instagram text,
  tiktok text,
  updated_at timestamptz not null default now(),
  constraint account_links_instagram_format check (
    instagram is null
    or (instagram ~ '^[a-z0-9._]{1,30}$' and instagram !~ '(^\.|\.$|\.\.)')
  ),
  constraint account_links_tiktok_format check (
    tiktok is null
    or (tiktok ~ '^[a-z0-9._]{2,24}$' and tiktok !~ '\.$')
  ),
  constraint account_links_not_empty check (instagram is not null or tiktok is not null)
);

alter table public.account_links enable row level security;
revoke all on public.account_links from anon, authenticated;

comment on table public.account_links is
  'Chantier 25 : les pseudos Instagram et TikTok d''un compte, saisis, jamais '
  'vérifiés. Sans accès client direct : `set_social_links` et `social_links` '
  'en sont le seul chemin ; le back-office les efface à la clé de service.';

-- ─── 2. Le réglage et l'interrupteur ─────────────────────────────────────

alter table public.users
  add column if not exists social_visible boolean not null default true;

comment on column public.users.social_visible is
  'Chantier 25 (D3) : « Afficher mes réseaux ». Éteint, les liens restent '
  'enregistrés mais `social_links` ne les rend plus qu''à leur titulaire.';

-- Modifiable par son titulaire seul : la règle `users_update_own` borne les
-- lignes, ce droit borne la colonne, comme `follow_approval` au 23.
grant update (social_visible) on public.users to authenticated;

alter table public.app_config
  add column if not exists social_links_enabled boolean not null default true;

comment on column public.app_config.social_links_enabled is
  'Chantier 25 (D9) : éteint, plus rien ne s''écrit ni ne se lit des liens '
  'sociaux, sans nouvelle version ; ceux qui existent restent.';

create or replace function public.social_links_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.social_links_enabled from public.app_config c where c.id = 1), true);
$$;

-- ─── 3. Les fonctions de l'app ───────────────────────────────────────────

-- Un pseudo saisi, réduit à sa forme : minuscules, blancs et « @ » de tête
-- retirés ; vide, `null`. L'app réduit déjà une adresse collée ; la base ne
-- garde que le pseudo.
create or replace function public.normalize_social_handle(p_handle text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(lower(btrim(coalesce(p_handle, ''))), '^@+', ''), '');
$$;

-- Écrit ses deux liens (D4, D6) : chacun normalisé, au format de son réseau,
-- et passé au filtre du 22, ses points et soulignés lus comme des espaces.
-- Deux vides effacent la ligne. Rend ce qui est enregistré.
create or replace function public.set_social_links(p_instagram text, p_tiktok text)
returns table (instagram text, tiktok text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_instagram text := public.normalize_social_handle(p_instagram);
  v_tiktok text := public.normalize_social_handle(p_tiktok);
begin
  if v_uid is null then
    raise exception 'social_needs_session' using errcode = '42501';
  end if;
  if not public.social_links_open() then
    raise exception 'social_closed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.users u where u.id = v_uid) then
    raise exception 'social_needs_profile' using errcode = '42501';
  end if;

  if v_instagram is not null
     and (v_instagram !~ '^[a-z0-9._]{1,30}$' or v_instagram ~ '(^\.|\.$|\.\.)') then
    raise exception 'social_invalid_instagram' using errcode = '22023';
  end if;
  if v_tiktok is not null
     and (v_tiktok !~ '^[a-z0-9._]{2,24}$' or v_tiktok ~ '\.$') then
    raise exception 'social_invalid_tiktok' using errcode = '22023';
  end if;

  if v_instagram is not null
     and public.comment_filter_hit(translate(v_instagram, '._', '  ')) is not null then
    raise exception 'social_filtered_instagram' using errcode = '22023';
  end if;
  if v_tiktok is not null
     and public.comment_filter_hit(translate(v_tiktok, '._', '  ')) is not null then
    raise exception 'social_filtered_tiktok' using errcode = '22023';
  end if;

  if v_instagram is null and v_tiktok is null then
    delete from public.account_links l where l.user_id = v_uid;
    return;
  end if;

  insert into public.account_links as l (user_id, instagram, tiktok, updated_at)
  values (v_uid, v_instagram, v_tiktok, now())
  on conflict (user_id) do update
    set instagram = excluded.instagram, tiktok = excluded.tiktok, updated_at = now();

  return query select v_instagram, v_tiktok;
end;
$$;

-- Les liens d'un compte (D3, D7, D15) : à tous s'il les montre, à son
-- titulaire toujours, avec son réglage ; aucune ligne sinon, ni quand
-- l'interrupteur est éteint. Ouverte à `anon`, pour le web.
create or replace function public.social_links(p_user uuid)
returns table (instagram text, tiktok text, visible boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select l.instagram, l.tiktok, u.social_visible
  from public.account_links l
  join public.users u on u.id = l.user_id
  where l.user_id = p_user
    and public.social_links_open()
    and (u.social_visible or u.id = auth.uid());
$$;

-- L'export de ses données (D13) : celui du 24, ses liens et son réglage en
-- plus.
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
    )
  );
$$;

-- ─── 4. Les droits ───────────────────────────────────────────────────────
--
-- `revoke ... from public` ne suffit pas : Supabase accorde `execute` à
-- `anon` et `authenticated` par des privilèges par défaut. Seule
-- `social_links` reste ouverte à `anon`, pour le web (D15).

revoke all on function public.social_links_open() from public, anon, authenticated;
revoke all on function public.normalize_social_handle(text) from public, anon, authenticated;
revoke all on function public.set_social_links(text, text) from public, anon, authenticated;
revoke all on function public.social_links(uuid) from public, anon, authenticated;
revoke all on function public.my_social_export() from public, anon, authenticated;

grant execute on function public.set_social_links(text, text) to authenticated;
grant execute on function public.social_links(uuid) to anon, authenticated;
grant execute on function public.my_social_export() to authenticated;

comment on function public.social_links_open() is
  'Chantier 25 (D9) : l''interrupteur `app_config.social_links_enabled`, '
  'allumé par défaut.';
comment on function public.normalize_social_handle(text) is
  'Chantier 25 (D4) : un pseudo saisi en minuscules, sans blanc ni « @ » de '
  'tête ; vide, `null`.';
comment on function public.set_social_links(text, text) is
  'Chantier 25 (D4, D6) : écrit ses deux liens, normalisés, au format de leur '
  'réseau, filtrés par la liste du 22 ; deux vides effacent la ligne.';
comment on function public.social_links(uuid) is
  'Chantier 25 (D3, D7, D15) : les liens d''un compte s''il les montre, ou à '
  'son titulaire avec son réglage ; aucune ligne sinon.';

notify pgrst, 'reload schema';
