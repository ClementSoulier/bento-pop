-- Migration : recherche de l'onglet « Trouver ».
--
-- Deux fonctions exposées via PostgREST :
--   - search_bentos(q, lim)  → pseudos ET items, en un seul appel
--   - shared_items(lim)      → items présents dans au moins deux bentos
--
-- Appliquée en production le 13 septembre 2026 via le SQL editor, et
-- vérifiée par `apps/mobile/scripts/check-search-bentos.mjs`.
--
-- Ce que cette migration corrige. Au 13 septembre 2026, `search.tsx`
-- cherchait par préfixe de pseudo sans filtrer les comptes sans bento
-- publié : **46 des 72 comptes, soit 64 %, étaient proposés et menaient
-- tous à « Bento introuvable »**. La règle « on ne propose que ce qui mène
-- quelque part » vit désormais ici, en SQL, et non côté écran, où elle se
-- contournerait en oubliant de l'appeler.
--
-- Cf. `docs/UX-06-TROUVER.md` §6.

-- ─── 1. search_bentos ─────────────────────────────────────────────────
create or replace function public.search_bentos(q text, lim int default 20)
returns table (
  bento_id uuid,
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
      -- Les jokers `ilike` sont échappés ici, à la source. 14 pseudos de la
      -- production contiennent un `_` et 2 titres aussi : sans échappement,
      -- taper « _ » renverrait la totalité du corpus. Le `\` d'abord, sans
      -- quoi il échapperait les échappements suivants.
      '%' || replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  ),
  live as (
    -- Le coeur de la règle : seuls les bentos publiés existent ici, donc
    -- aucune branche en aval ne peut produire un cul-de-sac.
    --
    -- Le filtre est écrit explicitement alors que la RLS le couvre presque.
    -- Presque, parce que la policy dit `published_at is not null or
    -- user_id = auth.uid()` : sans lui, un utilisateur retrouverait son
    -- propre brouillon dans ses résultats et taperait « Voir » pour arriver
    -- sur « Bento introuvable ».
    select b.id as bento_id, b.is_featured, u.pseudo, u.display_name
    from public.bentos b
    join public.users u on u.id = b.user_id
    where b.published_at is not null
  ),
  by_pseudo as (
    select
      l.bento_id, l.pseudo, l.display_name, l.is_featured,
      'pseudo'::text as match_kind,
      null::uuid as item_id, null::text as item_title, null::int as category_id,
      -- Trois paliers : exact, préfixe, sous-chaîne. Le passage du préfixe
      -- à la sous-chaîne est un correctif, pas un confort : « hifus » ne
      -- trouvait pas « dark_hifus », et 19 % des pseudos portent un `_`
      -- dont la partie signifiante est après.
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
      l.bento_id, l.pseudo, l.display_name, l.is_featured,
      'item'::text as match_kind,
      i.id as item_id, i.title as item_title, i.category_id,
      -- L'union de la sous-chaîne et de la similarité, mesurée : aucune ne
      -- domine. La similarité rate les titres longs (0,23 sur « Le Seigneur
      -- des anneaux : La Communauté de l'anneau » pour « seigneur », le
      -- trigramme se diluant sur 51 caractères) ; la sous-chaîne rate les
      -- fautes de frappe. Le seuil est relevé de 0,15, celui de
      -- `search_items`, à 0,3 : à 0,15 « angers » ramenait « Los Angeles »
      -- et « Angoulême ».
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
    -- Un bento apparaît une fois. Sans ça, taper « an » afficherait la même
    -- personne trois fois, et quelqu'un dont le pseudo et un item
    -- correspondent sortirait dans les deux sections.
    select *,
      row_number() over (
        partition by bento_id
        order by (match_kind = 'pseudo') desc, score desc, item_title asc
      ) as rn
    from (select * from by_pseudo union all select * from by_item) u
  )
  select bento_id, pseudo, display_name, is_featured,
         match_kind, item_id, item_title, category_id, score
  from ranked
  where rn = 1
  order by (match_kind = 'pseudo') desc, score desc, pseudo asc
  limit lim;
$$;

comment on function public.search_bentos(text, int) is
  'Recherche de l''onglet « Trouver » : pseudos et items d''un seul appel. '
  'Ne renvoie que des bentos publiés, ce qui supprime les 64 % de résultats '
  'qui menaient à « Bento introuvable ». Jokers ilike échappés. Un bento '
  'apparaît au plus une fois. Cf. docs/UX-06-TROUVER.md.';

-- ─── 2. shared_items ──────────────────────────────────────────────────
-- Le bloc de suggestions affiché avant la frappe. Ce sont exactement les
-- recherches qui ramènent plus d'une personne : au 13 septembre 2026, 11
-- items sur les 137 posés dans un bento publié.
--
-- Pas d'`image_url` dans la signature : le bloc n'affiche pas d'images, et
-- l'exposer inviterait à en afficher sans repasser par la décision.
create or replace function public.shared_items(lim int default 12)
returns table (id uuid, title text, category_id int, picks int)
language sql
stable
as $$
  select i.id, i.title, i.category_id, count(*)::int as picks
  from public.bento_items bi
  join public.bentos b on b.id = bi.bento_id and b.published_at is not null
  join public.items i on i.id = bi.item_id
  group by i.id, i.title, i.category_id
  having count(*) >= 2
  order by count(*) desc, i.title asc
  limit lim;
$$;

comment on function public.shared_items(int) is
  'Items présents dans au moins deux bentos publiés, avec leur nombre. '
  'Bloc d''accueil de l''onglet « Trouver ».';

-- ─── 3. Grants ────────────────────────────────────────────────────────
-- PostgREST n'expose une fonction qu'à un rôle qui a explicitement EXECUTE
-- dessus. Les deux restent en `security invoker`, la valeur par défaut :
-- la RLS s'applique, et la règle de visibilité reste écrite à un seul
-- endroit.
--
-- Pas d'index trigramme. `ilike '%q%'` et `similarity()` ne peuvent pas
-- se servir d'un btree, mais avec 72 lignes dans `users`, 277 dans `items`
-- et 283 dans `bento_items`, le parcours séquentiel coûte 87 ms mesurés.
-- Seuil de réexamen : 5 000 items au catalogue, où l'on ajoutera
--   create index items_title_trgm on public.items using gin (title gin_trgm_ops);
--   create index users_pseudo_trgm on public.users using gin (pseudo gin_trgm_ops);
-- sans avoir à changer la signature des fonctions.
grant execute on function public.search_bentos(text, int) to anon, authenticated;
grant execute on function public.shared_items(int) to anon, authenticated;
