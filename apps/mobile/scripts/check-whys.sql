-- Contrôles en lecture seule de la migration 20261026210000_bento_whys.sql,
-- chantier 12, à jouer dans l'éditeur SQL de « My Bento Pop » juste après
-- l'avoir appliquée. Rien n'y écrit.
--
-- Attendu :
--   1. `set_bento_why` et `my_bento_whys` en `security definer`,
--      `search_path=""`, exécutables par `authenticated` seulement ;
--      `why_is_public` aussi par `anon`, que sa règle de lecture appelle ;
--      les deux déclencheurs par personne ;
--   2. `bento_whys` : la lecture de six colonnes pour `anon` et
--      `authenticated`, ni l'état ni le motif, aucune écriture ;
--      `bento_why_writes` : aucun droit ;
--   3. une seule clé étrangère sur `bento_whys`, vers `bento_items`, en
--      cascade ;
--   4. les déclencheurs posés, l'interrupteur allumé, `reports` à cinq
--      cibles ;
--   5. les mêmes comptes de comptes, profils, bentos, cases et signalements
--      qu'avant l'application, aucun pourquoi : la migration n'écrit aucune
--      donnée existante.

select p.proname                                                          as fonction,
       p.prosecdef                                                        as definer,
       array_to_string(p.proconfig, ', ')                                 as chemin,
       has_function_privilege('anon', p.oid, 'execute')                   as anon,
       has_function_privilege('authenticated', p.oid, 'execute')          as authenticated,
       has_function_privilege('public', p.oid, 'execute')                 as public
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_bento_why', 'my_bento_whys', 'why_is_public',
                    'bento_items_drop_why', 'revalidate_landing_why',
                    'submit_report', 'my_social_export')
order by p.proname;

select c.column_name                                                        as colonne,
       has_column_privilege('anon', 'public.bento_whys', c.column_name, 'select')          as anon,
       has_column_privilege('authenticated', 'public.bento_whys', c.column_name, 'select') as authenticated
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'bento_whys'
order by c.ordinal_position;

select t.table_name                                                         as table_neuve,
       has_table_privilege('anon', 'public.' || t.table_name, 'insert')
         or has_table_privilege('anon', 'public.' || t.table_name, 'update')
         or has_table_privilege('anon', 'public.' || t.table_name, 'delete')        as anon_ecrit,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'insert')
         or has_table_privilege('authenticated', 'public.' || t.table_name, 'update')
         or has_table_privilege('authenticated', 'public.' || t.table_name, 'delete') as authenticated_ecrit,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'select')    as authenticated_lit_tout
from (values ('bento_whys'), ('bento_why_writes')) as t(table_name)
order by 1;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.bento_whys'::regclass and contype = 'f';

select tgname as declencheur, tgrelid::regclass as table_
from pg_trigger
where tgname in ('bento_items_drop_why', 'bento_whys_revalidate_landing')
order by tgname;

select (select whys_enabled from public.app_config where id = 1)          as interrupteur,
       (select pg_get_constraintdef(oid) from pg_constraint
        where conname = 'reports_target_kind_check')                       as cibles;

select (select count(*) from auth.users)       as comptes,
       (select count(*) from public.users)     as profils,
       (select count(*) from public.bentos)    as bentos,
       (select count(*) from public.bento_items) as cases,
       (select count(*) from public.reports)   as signalements,
       (select count(*) from public.bento_whys) as pourquoi;
