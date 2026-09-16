-- ─────────────────────────────────────────────────────────────────────────
-- Plusieurs bentos par compte, étape 2 sur 2 : la bascule
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 16, lot 2. Cf. `docs/UX-16-PLUSIEURS-BENTOS.md`.
--
-- ⚠️  CELLE-CI A UN CALENDRIER. Contrairement à la migration A
--     (`20260916120000_bentos_slug_and_primary.sql`), qui n'ajoutait que des
--     colonnes et ne changeait rien pour personne, celle-ci **change la forme
--     des réponses de PostgREST**.
--
--     Mesuré : dès que `bentos_user_id_key` disparaît, PostgREST cesse de voir
--     `users -> bentos` comme un un-à-un et rend un TABLEAU, même pour un
--     compte qui n'a qu'un bento. Une app restée sur l'ancienne requête lit
--     `.published_at` sur un tableau, obtient `undefined`, et affiche « rien en
--     ligne » sur TOUTES les pages publiques.
--
--     À n'appliquer qu'une fois la build qui porte la lecture du lot 1
--     suffisamment adoptée. L'adoption se lit dans `public.users.app_version`,
--     renseigné par la télémétrie.
--
--         select app_version, count(*) from public.users
--          where last_seen_at > now() - interval '30 days'
--          group by 1 order by 2 desc;

-- ─── 1. La bascule de la contrainte ──────────────────────────────────────
--
-- `bentos_user_id_key` garantissait « un bento par compte ». Elle devient
-- « un bento PRINCIPAL par compte ». Un index partiel plutôt qu'une
-- contrainte : Postgres ne sait pas exprimer une contrainte unique
-- conditionnelle autrement, et c'est aussi ce qui fait basculer la forme des
-- réponses, PostgREST ne reconnaissant que les contraintes totales.
alter table public.bentos drop constraint bentos_user_id_key;

create unique index bentos_one_primary
  on public.bentos (user_id)
  where is_primary;

comment on index public.bentos_one_primary is
  'Un seul bento principal par compte. Remplace bentos_user_id_key, levée au chantier 16.';

-- ─── 2. Créer un bento secondaire ────────────────────────────────────────
--
-- Pourquoi une fonction et pas un `insert` client. Les droits colonne
-- n'accordent au client que `insert (user_id)`
-- (`20260915000000_close_privilege_gaps.sql:225-226`) : il ne peut donc pas
-- poser de `slug`. Un `grant insert (slug)` le laisserait choisir n'importe
-- quelle adresse, y compris une qui collisionne avec une route du site, et
-- sans plafond. La création passe donc par ici, en `security definer`.
--
-- `is_primary` n'est jamais posé par cette fonction : un secondaire naît
-- secondaire. Déplacer la mise en avant reste une opération `service_role`,
-- donc du back-office.
create or replace function public.create_bento(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_count int;
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'Il faut être connecté pour créer un bento.' using errcode = '42501';
  end if;

  -- Le profil doit exister : `bentos.user_id` le référence, et l'erreur de
  -- clé étrangère serait illisible pour l'appelant.
  if not exists (select 1 from public.users u where u.id = v_uid) then
    raise exception 'Choisis d''abord un pseudo.' using errcode = '42501';
  end if;

  -- Forme : la même que la contrainte `bentos_slug_format`, vérifiée ici pour
  -- rendre un message lisible plutôt qu'une violation de contrainte.
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'Adresse invalide : 3 à 40 caractères, minuscules, chiffres et tirets.'
      using errcode = '22023';
  end if;

  -- Slugs réservés. Les deux premiers ne sont pas théoriques : Next expose
  -- l'aperçu d'un bento à `/u/<pseudo>/opengraph-image/...` et
  -- `/u/<pseudo>/twitter-image/...` par convention de fichier, et une route
  -- de convention l'emporte sur un segment dynamique. Un bento portant ces
  -- slugs serait donc définitivement inatteignable. Les suivants sont gardés
  -- pour les chantiers 13 et 21.
  if p_slug in (
    'opengraph-image', 'twitter-image', 'icon', 'apple-icon', 'sitemap', 'robots',
    'tous', 'edit', 'new', 'api', 'admin', 'settings'
  ) then
    raise exception 'Cette adresse est réservée.' using errcode = '22023';
  end if;

  -- Plafond. Aucune policy ne limitait le nombre de bentos qu'un membre peut
  -- insérer : c'était la contrainte unique qui le faisait, et elle vient de
  -- sauter. 20 est large pour l'usage prévu, une édition par semaine, et
  -- ferme la porte à une insertion en boucle.
  select count(*) into v_count from public.bentos b where b.user_id = v_uid;
  if v_count >= 20 then
    raise exception 'Tu as atteint la limite de bentos pour ce compte.' using errcode = '22023';
  end if;

  insert into public.bentos (user_id, slug, is_primary)
  values (v_uid, p_slug, false)
  returning id into v_id;

  return v_id;

exception when unique_violation then
  raise exception 'Tu as déjà un bento à cette adresse.' using errcode = '23505';
end;
$$;

revoke execute on function public.create_bento(text) from public, anon;
grant execute on function public.create_bento(text) to authenticated;

comment on function public.create_bento(text) is
  'Crée un bento secondaire pour auth.uid(), toujours non principal. '
  'Seule voie d''écriture du slug côté client : les droits colonne ne '
  'l''accordent pas. Cf. chantier 16.';

-- ─── 3. Les compteurs comptent des personnes ─────────────────────────────
--
-- `shared_items` promettait « les items présents dans au moins deux bentos
-- publiés », et l'intention produit était « au moins deux PERSONNES ». Tant
-- qu'un compte n'avait qu'un bento, les deux formulations coïncidaient. Elles
-- divergent à partir d'aujourd'hui.
--
-- Mesuré sur le Supabase local, en dupliquant les six cases d'un bento dans
-- un second bento du MÊME compte : Squeezie passait de 5 à 6, Arcane de 4 à
-- 5, et « Bohemian Rhapsody » de 1 à 2, entrant dans le top 5 en éjectant
-- « One More Time ». Une seule personne suffisait donc à faire entrer un item
-- dans la liste des choix partagés.
--
-- `count(distinct b.user_id)` corrige aussi un défaut ANTÉRIEUR au chantier :
-- les cases `artist` et `creator` partagent le type `person`, donc un même
-- item pouvait déjà occuper les deux cases d'un seul bento et satisfaire
-- `having count(*) >= 2` à lui tout seul. C'était le suivi ouvert au §12 du
-- chantier 11.
create or replace function public.shared_items(lim int default 12)
returns table (id uuid, title text, category_id int, picks int)
language sql
stable
as $$
  select i.id, i.title, i.category_id, count(distinct b.user_id)::int as picks
  from public.bento_items bi
  join public.bentos b on b.id = bi.bento_id and b.published_at is not null
  join public.items i on i.id = bi.item_id
  group by i.id, i.title, i.category_id
  having count(distinct b.user_id) >= 2
  order by count(distinct b.user_id) desc, i.title asc
  limit lim;
$$;

comment on function public.shared_items(int) is
  'Items choisis par au moins deux PERSONNES distinctes, avec leur nombre. '
  'Compte les comptes et non les bentos depuis le chantier 16 : sans cela une '
  'seule personne à plusieurs bentos suffisait à peupler la liste. '
  'Bloc d''accueil de l''onglet « Trouver ».';

-- Même raison, même correction. Le reste de la fonction est repris tel quel.
create or replace function public.popular_items(
  category_key text,
  lim int default 12,
  exclude_item uuid default null
)
returns table (
  id uuid,
  title text,
  subtitle text,
  year int,
  image_url text,
  image_credit text,
  picks int
)
language sql
stable
as $$
  with cat as (
    select c.type_id
    from public.bento_categories c
    join public.item_types t on t.id = c.type_id and t.is_active = true
    where c.key = category_key and c.is_active = true
    limit 1
  ),
  tally as (
    select bi.item_id, count(distinct b.user_id)::int as n
    from public.bento_items bi
    join public.bentos b on b.id = bi.bento_id
    where b.published_at is not null
    group by bi.item_id
  )
  select
    i.id,
    i.title,
    i.subtitle,
    i.year,
    i.image_url,
    i.image_credit,
    coalesce(t.n, 0) as picks
  from public.items i
  left join tally t on t.item_id = i.id
  where i.type_id = (select type_id from cat)
    and i.status = 'validated'
    and (exclude_item is null or i.id <> exclude_item)
  order by
    coalesce(t.n, 0) desc,
    (i.image_url is not null) desc,
    i.created_at desc,
    i.id
  limit lim;
$$;

comment on function public.popular_items(text, int, uuid) is
  'Propositions par défaut de la recherche d''item : catalogue validé du type '
  'd''une case, les plus choisis d''abord, items avec image en priorité. '
  'Compte les PERSONNES distinctes ayant publié l''item, chantier 16. '
  'Cf. docs/UX-03-RECHERCHE-ITEM.md §6.1 et docs/UX-15-NOUVELLES-CATEGORIES.md.';

-- ─── 4. La recherche sait dire QUEL bento ────────────────────────────────
--
-- `search_bentos` rendait déjà `bento_id`, seule signature du dépôt à porter
-- l'identifiant et le pseudo sur la même ligne. Il lui manquait le `slug`,
-- sans lequel l'écran ne peut pas construire l'adresse et retombe sur
-- `/u/<pseudo>` : deux bentos d'un même compte donnaient deux résultats
-- visuellement identiques menant au même endroit.
--
-- `drop` puis `create` et non `create or replace` : la liste des colonnes de
-- sortie change, et Postgres refuse un remplacement qui modifie le type de
-- retour.
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
    -- aucune branche en aval ne peut produire un cul-de-sac.
    select b.id as bento_id, b.slug, b.is_primary, b.is_featured, u.pseudo, u.display_name
    from public.bentos b
    join public.users u on u.id = b.user_id
    where b.published_at is not null
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
  'Ne renvoie que des bentos publiés. Rend le slug depuis le chantier 16, '
  'sans lequel l''écran ne peut pas construire l''adresse du bento trouvé. '
  'Un bento apparaît au plus une fois, le principal en premier. '
  'Cf. docs/UX-06-TROUVER.md.';

grant execute on function public.search_bentos(text, int) to anon, authenticated;

notify pgrst, 'reload schema';

-- ─── Contrôles, à passer après application ───────────────────────────────
--
-- 1. La contrainte est levée, l'index partiel la remplace.
--    Doit rendre `bentos_user_slug` seulement, puis `bentos_one_primary`.
--
--   select conname from pg_constraint
--    where conrelid = 'public.bentos'::regclass and contype = 'u';
--   select indexname from pg_indexes
--    where tablename = 'bentos' and indexname = 'bentos_one_primary';
--
-- 2. Chaque compte a exactement un principal. Doit rendre 0.
--
--   select count(*) from (
--     select user_id from public.bentos where is_primary
--     group by user_id having count(*) <> 1
--   ) x;
--
-- 3. Aucun compte sans principal. Doit rendre 0.
--
--   select count(distinct user_id) from public.bentos b
--    where not exists (
--      select 1 from public.bentos p where p.user_id = b.user_id and p.is_primary
--    );
--
-- 4. La création reste fermée au client en direct. Doit rendre `authenticated`
--    avec `user_id` seul, et rien d'autre.
--
--   select grantee, column_name from information_schema.column_privileges
--    where table_name = 'bentos' and privilege_type = 'INSERT'
--      and grantee in ('anon', 'authenticated');
