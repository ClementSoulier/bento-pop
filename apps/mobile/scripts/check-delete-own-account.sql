-- Contrôles en lecture seule de la migration 20261026100000_delete_own_account.sql,
-- chantier 28, à jouer dans l'éditeur SQL de « My Bento Pop » juste après
-- l'avoir appliquée. Rien n'y écrit.
--
-- Attendu : une ligne, `definer` vrai, `proprietaire` postgres, `chemin`
-- search_path="", `anon` faux, `authenticated` vrai, `public` faux. Puis les
-- mêmes comptes de comptes, profils et bentos qu'avant l'application : la
-- migration n'ajoute qu'une fonction.

select p.proname                                                         as fonction,
       p.prosecdef                                                       as definer,
       pg_get_userbyid(p.proowner)                                       as proprietaire,
       array_to_string(p.proconfig, ', ')                                as chemin,
       has_function_privilege('anon', 'public.delete_own_account()', 'execute')          as anon,
       has_function_privilege('authenticated', 'public.delete_own_account()', 'execute') as authenticated,
       has_function_privilege('public', 'public.delete_own_account()', 'execute')        as public
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'delete_own_account';

select (select count(*) from auth.users)    as comptes,
       (select count(*) from public.users)  as profils,
       (select count(*) from public.bentos) as bentos;
