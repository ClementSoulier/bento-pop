-- Contrôles en lecture seule de la migration
-- 20261027300000_social_links.sql, chantier 25, à jouer dans l'éditeur SQL
-- de « My Bento Pop » juste après l'avoir appliquée. Rien n'y écrit.
--
-- Attendu :
--   1. `set_social_links` exécutable par `authenticated` seulement,
--      `social_links` aussi par `anon`, pour le web ; `social_links_open` et
--      `normalize_social_handle` par personne ; toutes avec
--      `search_path=""`, en `security definer` sauf `normalize_social_handle` ;
--   2. aucun droit des clients sur `account_links`, RLS active ;
--   3. une clé étrangère de `account_links` vers `users`, en cascade, et les
--      contraintes de format des deux réseaux ;
--   4. `users.social_visible` allumé pour tous, modifiable par
--      `authenticated` ; l'interrupteur allumé ;
--   5. les mêmes comptes de comptes, profils et bentos qu'avant
--      l'application, aucun lien : la migration n'écrit aucune donnée
--      existante.

select p.proname                                                          as fonction,
       p.prosecdef                                                        as definer,
       array_to_string(p.proconfig, ', ')                                 as chemin,
       has_function_privilege('anon', p.oid, 'execute')                   as anon,
       has_function_privilege('authenticated', p.oid, 'execute')          as authenticated,
       has_function_privilege('public', p.oid, 'execute')                 as public
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_social_links', 'social_links', 'social_links_open',
                    'normalize_social_handle', 'my_social_export')
order by p.proname;

select 'account_links'                                                           as table_neuve,
       (select relrowsecurity from pg_class where oid = 'public.account_links'::regclass) as rls,
       has_table_privilege('anon', 'public.account_links', 'select')
         or has_table_privilege('anon', 'public.account_links', 'insert')        as anon,
       has_table_privilege('authenticated', 'public.account_links', 'select')
         or has_table_privilege('authenticated', 'public.account_links', 'insert')
         or has_table_privilege('authenticated', 'public.account_links', 'update')
         or has_table_privilege('authenticated', 'public.account_links', 'delete') as authenticated;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.account_links'::regclass
order by conname;

select (select count(*) from public.users where not social_visible)                         as masques,
       has_column_privilege('authenticated', 'public.users', 'social_visible', 'update')   as modifiable,
       (select social_links_enabled from public.app_config where id = 1)                  as interrupteur;

select (select count(*) from auth.users)             as comptes,
       (select count(*) from public.users)           as profils,
       (select count(*) from public.bentos)          as bentos,
       (select count(*) from public.account_links)   as liens;
