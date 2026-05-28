-- Migration : fonctions SQL de recherche dans le catalogue maison.
--
-- Deux fonctions exposées via PostgREST :
--   - search_items(q, category_key, lim)        → résultats triés par score
--   - find_similar_items(q, category_key, ...)  → candidats anti-doublon
--
-- Les deux respectent la RLS sur `items` (SECURITY INVOKER par défaut) :
-- l'appelant ne voit que les items qu'il a le droit de voir, c'est-à-dire
-- `status='validated' OR submitted_by = auth.uid()`. Les items rejected /
-- pending d'autres users sont invisibles.
--
-- À appliquer sur le projet Supabase mobile via SQL editor du dashboard.

-- ─── 1. search_items ──────────────────────────────────────────────────
-- Score = max(similarity(title, q), max(similarity(alias, q))).
-- Retourne uniquement les items validated, filtre par catégorie.
-- Tri : score desc, puis title asc.
create or replace function public.search_items(
  q text,
  category_key text,
  lim int default 20
)
returns table (
  id uuid,
  title text,
  subtitle text,
  year int,
  image_url text,
  image_credit text,
  score real
)
language sql
stable
as $$
  with cat as (
    select id from public.bento_categories
    where key = category_key and is_active = true
    limit 1
  ),
  scored as (
    select
      i.id,
      i.title,
      i.subtitle,
      i.year,
      i.image_url,
      i.image_credit,
      greatest(
        similarity(i.title, q),
        coalesce(
          (select max(similarity(a.alias, q))
             from public.item_aliases a
             where a.item_id = i.id),
          0
        )
      ) as score
    from public.items i
    where i.category_id = (select id from cat)
      and i.status = 'validated'
      -- Borne basse pour éviter le bruit : pg_trgm renvoie souvent du
      -- 0.05-0.1 pour des chaînes sans rapport. 0.15 = noise floor empirique.
      and (
        similarity(i.title, q) > 0.15
        or exists (
          select 1 from public.item_aliases a
          where a.item_id = i.id and similarity(a.alias, q) > 0.15
        )
      )
  )
  select id, title, subtitle, year, image_url, image_credit, score
  from scored
  order by score desc, title asc
  limit lim;
$$;

comment on function public.search_items(text, text, int) is
  'Recherche fuzzy dans le catalogue validé pour une catégorie donnée. '
  'Score = max similarity sur titre + aliases. Filtré par RLS (invisible '
  'pour les items non-validated dont on n''est pas l''auteur).';

-- ─── 2. find_similar_items ────────────────────────────────────────────
-- Utilisé par le popup anti-doublon AVANT de créer un item user.
-- Seuil par défaut plus haut (0.4) pour ne déclencher que sur les vrais
-- proches (« Inception » → « Inception (2010) »). Si rien ne dépasse,
-- l'utilisateur peut soumettre sans friction.
create or replace function public.find_similar_items(
  q text,
  category_key text,
  threshold real default 0.4,
  lim int default 3
)
returns table (
  id uuid,
  title text,
  subtitle text,
  year int,
  image_url text,
  score real
)
language sql
stable
as $$
  with cat as (
    select id from public.bento_categories
    where key = category_key and is_active = true
    limit 1
  )
  select
    i.id,
    i.title,
    i.subtitle,
    i.year,
    i.image_url,
    greatest(
      similarity(i.title, q),
      coalesce(
        (select max(similarity(a.alias, q))
           from public.item_aliases a
           where a.item_id = i.id),
        0
      )
    ) as score
  from public.items i
  where i.category_id = (select id from cat)
    and i.status = 'validated'
    and (
      similarity(i.title, q) > threshold
      or exists (
        select 1 from public.item_aliases a
        where a.item_id = i.id and similarity(a.alias, q) > threshold
      )
    )
  order by score desc
  limit lim;
$$;

comment on function public.find_similar_items(text, text, real, int) is
  'Cherche des items validés proches d''une chaîne. Sert au popup '
  'anti-doublon avant soumission user. Threshold 0.4 par défaut '
  '(empirique : déclenche sur vrais proches sans bruit).';

-- ─── 3. Grants ────────────────────────────────────────────────────────
-- PostgREST n'expose une fonction qu'à un rôle qui a explicitement
-- EXECUTE dessus. On donne à anon + authenticated pour que l'app mobile
-- (anonymous sign-in) puisse les appeler.
grant execute on function public.search_items(text, text, int) to anon, authenticated;
grant execute on function public.find_similar_items(text, text, real, int) to anon, authenticated;
