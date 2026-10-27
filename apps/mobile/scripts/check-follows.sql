-- Contrôles en lecture seule de la migration
-- 20261027100000_account_follows.sql, chantier 23, à jouer dans l'éditeur
-- SQL de « My Bento Pop » juste après l'avoir appliquée. Rien n'y écrit.
--
-- Attendu :
--   1. `set_follow`, `answer_follow`, `remove_follower`, `follow_list`,
--      `my_followed_ids` et `following_bentos` exécutables par
--      `authenticated` seulement ; `follow_summary` aussi par `anon`, pour le
--      web ; `follows_open` et les deux déclencheurs par personne ; toutes en
--      `security definer` et `search_path=""`, sauf `following_bentos`, en
--      `security invoker` ;
--   2. aucun droit des clients sur les deux tables neuves ;
--   3. deux clés étrangères sur `account_follows`, vers `users`, en cascade ;
--   4. les deux déclencheurs posés, l'interrupteur allumé, et « Valider mes
--      abonnés » éteint pour tous ;
--   5. les mêmes comptes de comptes, profils, bentos et blocages qu'avant
--      l'application, aucun abonnement : la migration n'écrit aucune donnée
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
  and p.proname in ('set_follow', 'answer_follow', 'remove_follower', 'follow_summary',
                    'follow_list', 'my_followed_ids', 'following_bentos', 'follows_open',
                    'account_blocks_drop_follows', 'users_follow_approval_open',
                    'my_social_export')
order by p.proname;

select t.table_name                                                         as table_neuve,
       has_table_privilege('anon', 'public.' || t.table_name, 'select')
         or has_table_privilege('anon', 'public.' || t.table_name, 'insert')        as anon,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'select')
         or has_table_privilege('authenticated', 'public.' || t.table_name, 'insert')
         or has_table_privilege('authenticated', 'public.' || t.table_name, 'update')
         or has_table_privilege('authenticated', 'public.' || t.table_name, 'delete') as authenticated
from (values ('account_follows'), ('account_follow_writes')) as t(table_name)
order by 1;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.account_follows'::regclass
order by conname;

select tgname as declencheur, tgrelid::regclass as table_
from pg_trigger
where tgname in ('account_blocks_drop_follows', 'users_follow_approval_open')
order by tgname;

select (select follows_enabled from public.app_config where id = 1)        as interrupteur,
       (select count(*) from public.users where follow_approval)           as valident,
       col_description('public.users'::regclass,
         (select attnum from pg_attribute
          where attrelid = 'public.users'::regclass and attname = 'follow_approval')) as commentaire;

select (select count(*) from auth.users)              as comptes,
       (select count(*) from public.users)            as profils,
       (select count(*) from public.bentos)           as bentos,
       (select count(*) from public.account_blocks)   as blocages,
       (select count(*) from public.account_follows)  as abonnements;
