-- Migration : « Ils ont les mêmes goûts », et le réglage qui en retire un
-- compte. Chantier 20, lot 1.
--
-- Quatre choses :
--   1. `users.searchable`, « Apparaître dans la recherche », allumé par
--      défaut, écrit par son seul propriétaire (D5) ;
--   2. `bento_matches(p_bento, lim)`, les bentos qui partagent des items avec
--      un bento publié, rangés par rareté (D1 à D3) ;
--   3. `search_bentos` et `shared_items` ne voient plus que les comptes
--      `searchable` (D6), à signature inchangée ;
--   4. le déclencheur du chantier 8 qui rafraîchit la landing quand un
--      réglage change suit aussi celui-ci : un bento mis en avant d'un compte
--      retiré passe en `noindex` et sort du sitemap (D7).
--
-- Compatible avec les versions publiées, la 1.1 et la 0.1.0 : elles lisent
-- `users` en `select('*')` et reçoivent `searchable`, qu'elles ignorent ;
-- `search_bentos` et `shared_items` gardent leur signature et leurs colonnes.
-- Elles n'appellent jamais `bento_matches`.
--
-- À appliquer par Clément dans le SQL editor du projet mobile, à la fusion,
-- puis contrôler par `apps/mobile/scripts/check-matches.sql` sur le Supabase
-- local avant, et par les contrôles en fin de fichier après.
--
-- Cf. `docs/UX-20-MATCH-PAR-BENTO.md`.

-- ─── 1. Apparaître dans la recherche (D5) ────────────────────────────────
--
-- Un réglage par compte, allumé par défaut : c'est le comportement
-- d'aujourd'hui, et l'éteindre par défaut viderait « Trouver ». Écrit par son
-- propriétaire seulement, comme `show_visits` : la politique
-- `users_update_own` ne laisse modifier que sa propre ligne, et le droit est
-- donné colonne par colonne. Lu par tous, comme le reste de `users` : la
-- landing en a besoin pour le `noindex` (D7), et il ne dit rien de plus que
-- l'absence du compte dans la recherche.

alter table public.users
  add column if not exists searchable boolean not null default true;

comment on column public.users.searchable is
  'Chantier 20 : vrai si le compte apparaît dans « Trouver » et dans les '
  'matchs des autres. Éteint, sa page reste ouverte par son lien.';

grant update (searchable) on public.users to authenticated;

-- ─── 2. Les mêmes goûts (D1 à D3) ────────────────────────────────────────
--
-- Un match, c'est un même item dans deux bentos publiés de deux comptes, où
-- qu'il soit posé (D1), et un seul suffit (D3). Mesuré le 23 octobre 2026 :
-- 23 bentos sur 28 en ont au moins un, 38 paires partagent un item, 3 en
-- partagent deux. Exiger deux items n'aurait laissé que 3 paires.
--
-- Chaque item commun pèse `1 / n`, `n` le nombre de comptes visibles qui
-- l'ont choisi : un item de deux personnes pèse deux fois plus qu'un item de
-- quatre. 118 des 138 items en ligne n'ont été choisis que par une personne,
-- et « Joyca » ou « Angers » par quatre : sans ce poids, ce sont eux qui
-- feraient tous les matchs. À score égal, le plus d'items communs, puis le
-- bento le plus récent.
--
-- `security invoker`, comme `search_bentos` : la RLS s'applique, et les
-- bentos et les items lus sont ceux que tout le monde peut lire. Le bento de
-- départ doit être publié ; son compte peut s'être retiré de la recherche :
-- il voit quand même qui partage ses goûts, il n'apparaît seulement pas chez
-- les autres (D6).

create or replace function public.bento_matches(p_bento uuid, lim int default 20)
returns table (
  bento_id uuid,
  slug text,
  is_primary boolean,
  pseudo text,
  display_name text,
  edition_title text,
  shared int,
  score real,
  items jsonb
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
           u.pseudo, u.display_name
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
         ) as items
  from scored sc
  join visible v on v.id = sc.bento_id
  left join public.editions e on e.id = v.edition_id
  order by sc.score desc, sc.shared desc, v.published_at desc, v.id
  limit least(greatest(coalesce(lim, 20), 1), 50);
$$;

comment on function public.bento_matches(uuid, int) is
  'Chantier 20 : les bentos publiés d''autres comptes qui partagent des items '
  'avec un bento publié, chaque item pesant 1 / n, n les comptes qui l''ont '
  'choisi. Ne montre que les comptes `searchable`. Cf. docs/UX-20-MATCH-PAR-BENTO.md.';

revoke all on function public.bento_matches(uuid, int) from public, anon, authenticated;
grant execute on function public.bento_matches(uuid, int) to anon, authenticated;

-- ─── 3. La recherche respecte le réglage (D6) ────────────────────────────
--
-- Repris tels quels de `20260916140000_bentos_lift_unique.sql`, à une
-- condition près, `u.searchable`. Même signature : `create or replace`
-- suffit, et les versions publiées les appellent sans rien changer.

create or replace function public.search_bentos(q text, lim int default 20)
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
  score real
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
    select b.id as bento_id, b.slug, b.is_primary, b.is_featured, u.pseudo, u.display_name
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
       end)::real as score
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
      )::real as score
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
         match_kind, item_id, item_title, category_id, score
  from ranked
  where rn = 1
  order by (match_kind = 'pseudo') desc, is_primary desc, score desc, pseudo asc
  limit lim;
$$;

comment on function public.search_bentos(text, int) is
  'Recherche de l''onglet « Trouver » : pseudos et items d''un seul appel. '
  'Ne renvoie que des bentos publiés de comptes `searchable` (chantier 20). '
  'Rend le slug depuis le chantier 16. Un bento apparaît au plus une fois, '
  'le principal en premier. Cf. docs/UX-06-TROUVER.md.';

-- Les suggestions « on retrouve souvent » mènent à `search_bentos` : elles
-- ne comptent que les mêmes comptes, sans quoi un item pourrait y figurer
-- pour deux personnes et n'en ramener qu'une.
create or replace function public.shared_items(lim int default 12)
returns table (id uuid, title text, category_id int, picks int)
language sql
stable
as $$
  select i.id, i.title, i.category_id, count(distinct b.user_id)::int as picks
  from public.bento_items bi
  join public.bentos b on b.id = bi.bento_id and b.published_at is not null
  join public.users u on u.id = b.user_id and u.searchable
  join public.items i on i.id = bi.item_id
  group by i.id, i.title, i.category_id
  having count(distinct b.user_id) >= 2
  order by count(distinct b.user_id) desc, i.title asc
  limit lim;
$$;

comment on function public.shared_items(int) is
  'Items choisis par au moins deux PERSONNES distinctes, parmi les comptes '
  '`searchable` depuis le chantier 20, avec leur nombre. Bloc d''accueil de '
  'l''onglet « Trouver ».';

-- ─── 4. La landing suit le réglage (D7) ──────────────────────────────────
--
-- Le déclencheur du chantier 8 rafraîchit les pages web d'un compte quand
-- « Afficher mes visites » change. Il suit désormais aussi « Apparaître dans
-- la recherche », et rafraîchit alors le sitemap : un bento mis en avant d'un
-- compte retiré en sort, et passe en `noindex`. Le reste est repris tel quel
-- de `20261023100000_bento_visits.sql`.

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
     and new.searchable is not distinct from old.searchable then
    return new;
  end if;

  select jsonb_agg(distinct p.path) into v_paths
  from public.bentos b
  cross join lateral (
    values ('/u/' || lower(new.pseudo)), ('/u/' || lower(new.pseudo) || '/' || b.slug)
  ) as p(path)
  where b.user_id = new.id
    and b.published_at is not null;

  if v_paths is null then
    return new;
  end if;

  if new.searchable is distinct from old.searchable then
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
  after update of show_visits, searchable on public.users
  for each row execute function public.revalidate_landing_visits();

notify pgrst, 'reload schema';

-- ─── Contrôles, à passer après application ───────────────────────────────
--
-- 1. La colonne existe, allumée pour tous :
--      select count(*) filter (where searchable), count(*) from public.users;
--    Doit rendre deux nombres égaux.
--
-- 2. Le match répond pour un bento publié, à la clé anonyme :
--      set local role anon;
--      select pseudo, shared, score from public.bento_matches(
--        (select id from public.bentos where published_at is not null
--         order by published_at desc limit 1), 5);
--
-- 3. La recherche rend les mêmes bentos qu'avant : tous les comptes sont
--    encore `searchable`.
