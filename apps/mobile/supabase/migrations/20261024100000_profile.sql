-- Migration : le profil d'un compte, et son identité modifiable. Chantier 21,
-- lot 1, qui absorbe le chantier 10.
--
-- Six choses :
--   1. `users.avatar`, le Popy choisi, et `users.pseudo_changed_at`, la date
--      du dernier changement de pseudo (D5, D7) ;
--   2. `pseudo_history`, les anciens pseudos, réservés à leur titulaire et
--      redirigés pour toujours (D6, D12) ;
--   3. les seules écritures du nom, du Popy et du pseudo : `set_display_name`,
--      `set_avatar` et `change_pseudo` (D4, D5, D7, D13) ;
--   4. les lectures d'un pseudo : `pseudo_status`, `resolve_pseudo`,
--      `resolve_accounts` et `my_pseudo_history` (D6, D8, D16) ;
--   5. `search_bentos` et `bento_matches` rendent aussi le compte et son Popy
--      (D14) ;
--   6. le déclencheur des pages web suit aussi le pseudo, le nom et le Popy
--      (D15).
--
-- Compatible avec les versions publiées, la 1.1 et la 0.1.0 : elles lisent
-- `users` en `select('*')` et ignorent les deux colonnes ; `search_bentos` et
-- `bento_matches` gardent leurs arguments, et leurs colonnes en plus sont
-- ignorées. Aucune ne sait changer de pseudo ni de Popy.
--
-- À appliquer par Clément dans l'éditeur SQL du projet Supabase « My Bento
-- Pop », ref `ggjgktbcqumfxrixcdyx`, avant la fusion, une fois
-- `apps/mobile/scripts/check-profile.sql` passé sur le Supabase local ; puis
-- les contrôles en fin de fichier.
--
-- Cf. `docs/UX-21-PROFIL.md`.

-- ─── 1. Le Popy choisi et la date du dernier pseudo (D5, D7) ─────────────
--
-- `avatar` vide, c'est le Popy du pseudo, tiré par `popyKeyForPseudo` dans
-- `packages/supabase-mobile/src/bento.ts` : la valeur de tous les comptes
-- aujourd'hui. Les six clés sont celles de `POPY_KEYS`.
--
-- Aucune des deux colonnes ne s'écrit par un droit : seulement par les
-- fonctions de la section 3. Toutes deux se lisent comme le reste de `users`.

alter table public.users
  add column if not exists avatar text
    constraint users_avatar_check
    check (avatar in ('content', 'intello', 'fille', 'gene', 'nani', 'diable')),
  add column if not exists pseudo_changed_at timestamptz;

comment on column public.users.avatar is
  'Chantier 21 : le Popy choisi parmi les six de POPY_KEYS. Vide, celui que '
  'popyKeyForPseudo tire du pseudo. Écrit par set_avatar et change_pseudo.';

comment on column public.users.pseudo_changed_at is
  'Chantier 21 : la date du dernier changement de pseudo, qui en espace deux '
  'de 30 jours au moins (D5). Vide tant que le pseudo est celui de la '
  'publication.';

-- ─── 2. Les anciens pseudos (D6, D12) ────────────────────────────────────
--
-- Un ancien pseudo mène pour toujours au compte qui l'a porté, et personne
-- d'autre ne peut le prendre : sinon il récupérerait les liens déjà partagés.
-- Son titulaire peut le reprendre, et il redevient alors son pseudo actuel.
--
-- Aucun accès client : la redirection passe par `resolve_pseudo`, qui répond
-- pour un pseudo à la fois, sans jamais lister l'historique d'un compte.
-- Supprimé avec le compte : ses pseudos se libèrent, comme aujourd'hui le sien.

create table if not exists public.pseudo_history (
  id bigint generated always as identity primary key,
  pseudo text not null,
  user_id uuid not null references public.users (id) on delete cascade,
  changed_at timestamptz not null default now()
);

create unique index if not exists pseudo_history_pseudo_lower_idx
  on public.pseudo_history (lower(pseudo));
create index if not exists pseudo_history_user_idx
  on public.pseudo_history (user_id);

alter table public.pseudo_history enable row level security;
revoke all on public.pseudo_history from public, anon, authenticated;

comment on table public.pseudo_history is
  'Chantier 21 : les anciens pseudos de chaque compte, réservés à leur '
  'titulaire et redirigés vers son pseudo actuel (D6). Sans accès client.';

-- La réserve tient à chaque écriture du pseudo, première publication comprise
-- (`publish_first_bento`) : pas seulement dans `change_pseudo`. Même message et
-- même code qu'un pseudo actuel déjà pris.
create or replace function public.check_pseudo_reserved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.pseudo_history h
    where lower(h.pseudo) = lower(new.pseudo)
      and h.user_id <> new.id
  ) then
    raise exception 'Ce pseudo est déjà pris.' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function public.check_pseudo_reserved() from public, anon, authenticated;

drop trigger if exists users_pseudo_reserved_check on public.users;
create trigger users_pseudo_reserved_check
  before insert or update of pseudo on public.users
  for each row execute function public.check_pseudo_reserved();

-- ─── 3. Les écritures du nom, du Popy et du pseudo (D4, D5, D7, D13) ─────
--
-- Chaque champ a son écriture, comme l'écran les enregistre un par un. La
-- logique vit dans une fonction `apply_*`, qui prend le compte en argument et
-- que seul le rôle de service appelle : le back-office, le jour où il éditera
-- les profils éditoriaux, suivra les mêmes règles (D10). L'app appelle la
-- fonction publique, qui passe `auth.uid()`.

-- Le nom affiché : facultatif, une ligne, 30 caractères au plus, passé aux
-- motifs interdits des pseudos. C'est du texte d'utilisateur, filtré avant
-- publication (règle 1.2 d'Apple). Vide, il disparaît.
create or replace function public.apply_display_name(p_user uuid, p_display_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(p_display_name), '');
begin
  if v_name is not null then
    if char_length(v_name) > 30 then
      raise exception 'Nom trop long : 30 caractères au plus.' using errcode = '22001';
    end if;
    if v_name ~ '[[:cntrl:]]' then
      raise exception 'Nom invalide : une seule ligne.' using errcode = '22023';
    end if;
    if exists (
      select 1
      from public.blocked_pseudo_patterns p
      where p.is_active and lower(v_name) ~ p.pattern
    ) then
      raise exception 'Nom non autorisé.' using errcode = '23514';
    end if;
  end if;

  update public.users set display_name = v_name where id = p_user;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'P0002';
  end if;
  return v_name;
end;
$$;

-- Le Popy : une des six clés, ou rien pour revenir à celui du pseudo.
create or replace function public.apply_avatar(p_user uuid, p_avatar text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_avatar is not null
     and p_avatar not in ('content', 'intello', 'fille', 'gene', 'nani', 'diable') then
    raise exception 'Popy inconnu.' using errcode = '22023';
  end if;

  update public.users set avatar = p_avatar where id = p_user;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'P0002';
  end if;
  return p_avatar;
end;
$$;

-- Le pseudo : les règles de la création, au plus une fois tous les 30 jours
-- (D5). Le format ici ; les motifs interdits, ceux de la marque compris, par
-- `users_pseudo_block_check`, et la réserve par `users_pseudo_reserved_check`,
-- qui partent tous deux à l'écriture, comme à la première publication.
--
-- `p_keep_avatar`, le Popy que l'app affiche : figé dans `avatar` s'il est
-- encore vide, pour que changer de pseudo ne change pas de visage (D7). L'app
-- le connaît déjà, et un compte peut de toute façon choisir n'importe lequel
-- des six : le prendre de lui ne donne rien de plus.
--
-- Rendre son pseudo actuel ne change rien et ne compte pas. Changer seulement
-- sa casse compte comme un changement, sans rien verser à l'historique : les
-- adresses sont les mêmes, en minuscules.
create or replace function public.apply_pseudo_change(
  p_user uuid,
  p_pseudo text,
  p_keep_avatar text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new     text := btrim(p_pseudo);
  v_old     text;
  v_changed timestamptz;
begin
  select u.pseudo, u.pseudo_changed_at into v_old, v_changed
  from public.users u
  where u.id = p_user
  for update;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'P0002';
  end if;

  if v_new is null or v_new !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'Pseudo invalide : 3 à 20 caractères, lettres, chiffres, points et underscores.'
      using errcode = '22023';
  end if;

  if v_new = v_old then
    return v_new;
  end if;

  if v_changed is not null and v_changed > now() - interval '30 days' then
    raise exception 'Un changement de pseudo tous les 30 jours au plus.'
      using errcode = 'P0001',
            hint = to_char((v_changed + interval '30 days') at time zone 'UTC',
                           'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  if exists (
    select 1 from public.users u
    where lower(u.pseudo) = lower(v_new) and u.id <> p_user
  ) then
    raise exception 'Ce pseudo est déjà pris.' using errcode = '23505';
  end if;

  if lower(v_new) <> lower(v_old) then
    -- Reprendre un ancien pseudo à soi : il redevient l'actuel.
    delete from public.pseudo_history h
    where lower(h.pseudo) = lower(v_new) and h.user_id = p_user;

    insert into public.pseudo_history (pseudo, user_id)
    values (v_old, p_user)
    on conflict ((lower(pseudo))) do update
      set pseudo = excluded.pseudo, changed_at = now()
      where public.pseudo_history.user_id = excluded.user_id;
  end if;

  update public.users u
  set pseudo = v_new,
      pseudo_changed_at = now(),
      avatar = coalesce(
        u.avatar,
        case
          when p_keep_avatar in ('content', 'intello', 'fille', 'gene', 'nani', 'diable')
            then p_keep_avatar
        end
      )
  where u.id = p_user;

  return v_new;
end;
$$;

revoke all on function public.apply_display_name(uuid, text) from public, anon, authenticated;
revoke all on function public.apply_avatar(uuid, text) from public, anon, authenticated;
revoke all on function public.apply_pseudo_change(uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_display_name(uuid, text) to service_role;
grant execute on function public.apply_avatar(uuid, text) to service_role;
grant execute on function public.apply_pseudo_change(uuid, text, text) to service_role;

-- Les trois écritures de l'app, pour son propre compte.
create or replace function public.set_display_name(p_display_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Il faut être connecté pour modifier son profil.' using errcode = '42501';
  end if;
  return public.apply_display_name(v_uid, p_display_name);
end;
$$;

create or replace function public.set_avatar(p_avatar text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Il faut être connecté pour modifier son profil.' using errcode = '42501';
  end if;
  return public.apply_avatar(v_uid, p_avatar);
end;
$$;

create or replace function public.change_pseudo(p_pseudo text, p_keep_avatar text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Il faut être connecté pour modifier son profil.' using errcode = '42501';
  end if;
  return public.apply_pseudo_change(v_uid, p_pseudo, p_keep_avatar);
end;
$$;

revoke all on function public.set_display_name(text) from public, anon, authenticated;
revoke all on function public.set_avatar(text) from public, anon, authenticated;
revoke all on function public.change_pseudo(text, text) from public, anon, authenticated;
grant execute on function public.set_display_name(text) to authenticated;
grant execute on function public.set_avatar(text) to authenticated;
grant execute on function public.change_pseudo(text, text) to authenticated;

-- ─── 4. Les lectures d'un pseudo (D6, D8, D16) ───────────────────────────

-- Ce que l'écran peut dire d'un pseudo pendant la saisie, à la publication
-- comme au changement : `invalid`, `reserved` (la marque), `forbidden` (les
-- motifs interdits), `taken` (un pseudo actuel ou un ancien d'un autre
-- compte), `current` (le sien) ou `available`, ancien pseudo à soi compris.
-- Les motifs restent illisibles : on ne sait que si un pseudo en touche un.
-- La marque passe avant eux, bien que deux d'entre eux la couvrent déjà :
-- l'écran dit alors « réservé », comme `RESERVED_PSEUDO_PATTERNS` de
-- `src/lib/pseudo-match.ts`, plutôt que « non autorisé ».
create or replace function public.pseudo_status(p_pseudo text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with candidate as (select btrim(p_pseudo) as p, (select auth.uid()) as uid)
  select case
    when c.p is null or c.p !~ '^[A-Za-z0-9_.]{3,20}$' then 'invalid'
    when lower(c.p) ~ 'bent[o0].?pop$' or lower(c.p) ~ 'bento.?pop.?team' then 'reserved'
    when exists (
      select 1 from public.users u where u.id = c.uid and u.pseudo = c.p
    ) then 'current'
    when exists (
      select 1 from public.blocked_pseudo_patterns b
      where b.is_active and lower(c.p) ~ b.pattern
    ) then 'forbidden'
    when exists (
      select 1 from public.users u
      where lower(u.pseudo) = lower(c.p) and u.id is distinct from c.uid
    ) or exists (
      select 1 from public.pseudo_history h
      where lower(h.pseudo) = lower(c.p) and h.user_id is distinct from c.uid
    ) then 'taken'
    else 'available'
  end
  from candidate c;
$$;

-- Le pseudo actuel du compte qui a porté celui-ci, ou rien : la redirection
-- d'un ancien lien, dans l'app comme sur le web. Une réponse à la fois.
create or replace function public.resolve_pseudo(p_pseudo text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.pseudo
  from public.pseudo_history h
  join public.users u on u.id = h.user_id
  where lower(h.pseudo) = lower(btrim(p_pseudo))
  limit 1;
$$;

-- Le compte derrière chaque pseudo, actuel ou ancien : la reprise des
-- blocages d'aujourd'hui, rangés par pseudo sur le téléphone (D8). Un pseudo
-- qui ne mène à personne n'a pas de ligne. Deux cents au plus par appel.
create or replace function public.resolve_accounts(p_pseudos text[])
returns table (pseudo text, user_id uuid, current_pseudo text)
language sql
stable
security definer
set search_path = ''
as $$
  select x.p, coalesce(cu.id, hu.id), coalesce(cu.pseudo, hu.pseudo)
  from unnest((coalesce(p_pseudos, '{}'::text[]))[1:200]) as x(p)
  left join public.users cu on lower(cu.pseudo) = lower(btrim(x.p))
  left join public.pseudo_history h
    on cu.id is null and lower(h.pseudo) = lower(btrim(x.p))
  left join public.users hu on hu.id = h.user_id
  where coalesce(cu.id, hu.id) is not null;
$$;

-- Ses propres anciens pseudos, pour l'export de ses données (D16).
create or replace function public.my_pseudo_history()
returns table (pseudo text, changed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select h.pseudo, h.changed_at
  from public.pseudo_history h
  where h.user_id = (select auth.uid())
  order by h.changed_at;
$$;

revoke all on function public.pseudo_status(text) from public, anon, authenticated;
revoke all on function public.resolve_pseudo(text) from public, anon, authenticated;
revoke all on function public.resolve_accounts(text[]) from public, anon, authenticated;
revoke all on function public.my_pseudo_history() from public, anon, authenticated;
grant execute on function public.pseudo_status(text) to anon, authenticated;
grant execute on function public.resolve_pseudo(text) to anon, authenticated;
grant execute on function public.resolve_accounts(text[]) to anon, authenticated;
grant execute on function public.my_pseudo_history() to authenticated;

-- ─── 5. Le compte et son Popy dans la recherche et les matchs (D14) ──────
--
-- Repris tels quels de `20261023200000_bento_matches.sql`, avec deux colonnes
-- en plus, à la fin : `user_id`, pour filtrer les comptes bloqués par leur
-- identifiant (D8), et `avatar`, pour le Popy choisi (D7). Un `returns table`
-- qui gagne des colonnes change de type : `create or replace` ne suffit pas,
-- d'où `drop`, dans la même transaction que la création. Les arguments ne
-- changent pas : les versions publiées les appellent sans rien changer, et
-- ignorent les colonnes en plus.

drop function if exists public.bento_matches(uuid, int);

create function public.bento_matches(p_bento uuid, lim int default 20)
returns table (
  bento_id uuid,
  slug text,
  is_primary boolean,
  pseudo text,
  display_name text,
  edition_title text,
  shared int,
  score real,
  items jsonb,
  user_id uuid,
  avatar text
)
language sql
stable
as $$
  with source as (
    select b.id, b.user_id
    from public.bentos b
    where b.id = p_bento
      and b.published_at is not null
  ),
  visible as (
    -- Ce que la recherche montre : un bento publié d'un compte qui ne s'en
    -- est pas retiré.
    select b.id, b.user_id, b.slug, b.is_primary, b.published_at, b.edition_id,
           u.pseudo, u.display_name, u.avatar
    from public.bentos b
    join public.users u on u.id = b.user_id
    where b.published_at is not null
      and u.searchable
  ),
  rarity as (
    -- Combien de comptes visibles ont choisi chaque item. Des comptes et non
    -- des bentos, comme `shared_items` depuis le chantier 16 : deux bentos
    -- d'une même personne ne rendent pas un item plus commun.
    select bi.item_id, count(distinct v.user_id) as n
    from public.bento_items bi
    join visible v on v.id = bi.bento_id
    group by bi.item_id
  ),
  common as (
    -- `distinct` : un même item peut occuper deux cases d'un bento, les cases
    -- `artist` et `creator` partageant un type. Il ne compte qu'une fois.
    select distinct v.id as bento_id, bi.item_id, r.n
    from visible v
    join public.bento_items bi on bi.bento_id = v.id
    join rarity r on r.item_id = bi.item_id
    where v.user_id <> (select s.user_id from source s)
      and bi.item_id in (
        select sbi.item_id
        from public.bento_items sbi
        join source s on s.id = sbi.bento_id
      )
  ),
  scored as (
    select c.bento_id, count(*)::int as shared, sum(1.0 / c.n)::real as score
    from common c
    group by c.bento_id
  )
  select v.id, v.slug, v.is_primary, v.pseudo, v.display_name,
         e.title as edition_title,
         sc.shared, sc.score,
         (
           select jsonb_agg(
                    jsonb_build_object('id', i.id, 'title', i.title, 'category_id', i.category_id)
                    order by c.n, i.title
                  )
           from common c
           join public.items i on i.id = c.item_id
           where c.bento_id = v.id
         ) as items,
         v.user_id, v.avatar
  from scored sc
  join visible v on v.id = sc.bento_id
  left join public.editions e on e.id = v.edition_id
  order by sc.score desc, sc.shared desc, v.published_at desc, v.id
  limit least(greatest(coalesce(lim, 20), 1), 50);
$$;

comment on function public.bento_matches(uuid, int) is
  'Chantier 20 : les bentos publiés d''autres comptes qui partagent des items '
  'avec un bento publié, chaque item pesant 1 / n, n les comptes qui l''ont '
  'choisi. Ne montre que les comptes `searchable`. Rend le compte et son Popy '
  'depuis le chantier 21. Cf. docs/UX-20-MATCH-PAR-BENTO.md.';

revoke all on function public.bento_matches(uuid, int) from public, anon, authenticated;
grant execute on function public.bento_matches(uuid, int) to anon, authenticated;

drop function if exists public.search_bentos(text, int);

create function public.search_bentos(q text, lim int default 20)
returns table (
  bento_id uuid,
  slug text,
  is_primary boolean,
  pseudo text,
  display_name text,
  is_featured boolean,
  match_kind text,
  item_id uuid,
  item_title text,
  category_id int,
  score real,
  user_id uuid,
  avatar text
)
language sql
stable
as $$
  with needle as (
    select
      btrim(q) as raw,
      -- Jokers échappés : sans ça, taper « % » renverrait tout le corpus, et
      -- taper « _ » renverrait la totalité du corpus. Le `\` d'abord, sans
      -- quoi il échapperait les échappements suivants.
      '%' || replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  ),
  live as (
    -- Le coeur de la règle : seuls les bentos publiés existent ici, donc
    -- aucune branche en aval ne peut produire un cul-de-sac. Et, depuis le
    -- chantier 20, seuls ceux des comptes qui ne se sont pas retirés de la
    -- recherche.
    select b.id as bento_id, b.slug, b.is_primary, b.is_featured, u.pseudo, u.display_name,
           b.user_id, u.avatar
    from public.bentos b
    join public.users u on u.id = b.user_id
    where b.published_at is not null
      and u.searchable
  ),
  by_pseudo as (
    select
      l.bento_id, l.slug, l.is_primary, l.pseudo, l.display_name, l.is_featured,
      'pseudo'::text as match_kind,
      null::uuid as item_id, null::text as item_title, null::int as category_id,
      (case
         when lower(l.pseudo) = lower((select raw from needle)) then 3.0
         when lower(l.pseudo) like lower(replace((select pat from needle), '%', '')) || '%' escape '\' then 2.5
         else 2.0
       end)::real as score,
      l.user_id, l.avatar
    from live l
    where l.pseudo ilike (select pat from needle) escape '\'
  ),
  by_item as (
    select
      l.bento_id, l.slug, l.is_primary, l.pseudo, l.display_name, l.is_featured,
      'item'::text as match_kind,
      i.id as item_id, i.title as item_title, i.category_id,
      greatest(
        case when i.title ilike (select pat from needle) escape '\' then 1.0 else 0 end,
        similarity(i.title, (select raw from needle))
      )::real as score,
      l.user_id, l.avatar
    from live l
    join public.bento_items bi on bi.bento_id = l.bento_id
    join public.items i on i.id = bi.item_id
    where i.title ilike (select pat from needle) escape '\'
       or similarity(i.title, (select raw from needle)) > 0.3
  ),
  ranked as (
    -- Un bento apparaît une fois, et c'est bien le BENTO qui est dédoublonné,
    -- pas la personne : deux bentos d'un même compte sont deux résultats
    -- légitimes, à deux adresses différentes. Le principal passe devant, pour
    -- que chercher quelqu'un mène d'abord à ce qu'il met en avant.
    select *,
      row_number() over (
        partition by bento_id
        order by (match_kind = 'pseudo') desc, score desc, item_title asc
      ) as rn
    from (select * from by_pseudo union all select * from by_item) u
  )
  select bento_id, slug, is_primary, pseudo, display_name, is_featured,
         match_kind, item_id, item_title, category_id, score, user_id, avatar
  from ranked
  where rn = 1
  order by (match_kind = 'pseudo') desc, is_primary desc, score desc, pseudo asc
  limit lim;
$$;

comment on function public.search_bentos(text, int) is
  'Recherche de l''onglet « Trouver » : pseudos et items d''un seul appel. '
  'Ne renvoie que des bentos publiés de comptes `searchable` (chantier 20). '
  'Rend le slug depuis le chantier 16, le compte et son Popy depuis le 21. Un '
  'bento apparaît au plus une fois, le principal en premier. Cf. '
  'docs/UX-06-TROUVER.md.';

revoke all on function public.search_bentos(text, int) from public, anon, authenticated;
grant execute on function public.search_bentos(text, int) to anon, authenticated;

-- ─── 6. Les pages web suivent le pseudo, le nom et le Popy (D15) ─────────
--
-- Le déclencheur des chantiers 8 et 20 rafraîchit les pages d'un compte quand
-- un réglage change. Il suit désormais aussi le pseudo, le nom affiché et le
-- Popy, qui s'affichent sur la page et sur son aperçu. À un changement de
-- pseudo, l'ancienne adresse aussi, qui devient une redirection, et le
-- sitemap, qui liste les pseudos. Le reste est repris tel quel de
-- `20261023200000_bento_matches.sql`.

create or replace function public.revalidate_landing_visits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paths jsonb;
  v_base  text;
  v_token text;
begin
  if new.show_visits is not distinct from old.show_visits
     and new.searchable is not distinct from old.searchable
     and new.pseudo is not distinct from old.pseudo
     and new.display_name is not distinct from old.display_name
     and new.avatar is not distinct from old.avatar then
    return new;
  end if;

  select jsonb_agg(distinct p.path) into v_paths
  from public.bentos b
  cross join lateral (
    values ('/u/' || lower(new.pseudo)), ('/u/' || lower(new.pseudo) || '/' || b.slug),
           ('/u/' || lower(old.pseudo)), ('/u/' || lower(old.pseudo) || '/' || b.slug)
  ) as p(path)
  where b.user_id = new.id
    and b.published_at is not null;

  if v_paths is null then
    return new;
  end if;

  if new.searchable is distinct from old.searchable
     or lower(new.pseudo) is distinct from lower(old.pseudo) then
    v_paths := v_paths || '["/sitemap.xml"]'::jsonb;
  end if;

  select decrypted_secret into v_base
  from vault.decrypted_secrets where name = 'landing_base_url';
  select decrypted_secret into v_token
  from vault.decrypted_secrets where name = 'landing_revalidate_token';

  if v_base is null or v_token is null then
    return new;
  end if;

  perform net.http_post(
    url     := v_base || '/api/revalidate',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := jsonb_build_object('paths', v_paths),
    timeout_milliseconds := 3000
  );

  return new;

exception when others then
  -- Jamais au détriment du réglage : la landing rattrapera au plus tard à la
  -- régénération suivante, 5 minutes après.
  return new;
end;
$$;

revoke all on function public.revalidate_landing_visits() from public, anon, authenticated;

drop trigger if exists users_revalidate_landing_visits on public.users;
create trigger users_revalidate_landing_visits
  after update of show_visits, searchable, pseudo, display_name, avatar on public.users
  for each row execute function public.revalidate_landing_visits();

notify pgrst, 'reload schema';

-- ─── Contrôles, à passer après application ───────────────────────────────
--
-- 1. Les colonnes existent, vides pour tous :
--      select count(*) filter (where avatar is null and pseudo_changed_at is null),
--             count(*) from public.users;
--    Doit rendre deux nombres égaux.
--
-- 2. La table des anciens pseudos est vide et fermée aux clients :
--      select count(*) from public.pseudo_history;
--    Doit rendre 0.
--
-- 3. La recherche rend le compte et son Popy, à la clé anonyme :
--      set local role anon;
--      select pseudo, user_id is not null, avatar from public.search_bentos('a', 3);
--    Trois lignes, `true` et un Popy vide.
