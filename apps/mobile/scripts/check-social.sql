-- Contrôles en lecture seule de la migration
-- 20261026200000_likes_comments_moderation.sql, chantier 22, à jouer dans
-- l'éditeur SQL de « My Bento Pop » juste après l'avoir appliquée. Rien n'y
-- écrit.
--
-- Attendu :
--   1. neuf fonctions de l'app en `security definer`, `search_path=""`,
--      exécutables par `authenticated` seulement ; les deux du filtre par
--      personne ;
--   2. aucun droit des clients sur les quatre tables neuves ;
--   3. tous les profils acceptent commentaires et likes, l'interrupteur est
--      allumé, 53 mots au filtre ;
--   4. `reports` : la clé étrangère vers `auth.users`, quatre cibles, les
--      signalements d'avant intacts ;
--   5. les mêmes comptes de comptes, profils et bentos qu'avant
--      l'application : la migration n'écrit aucune donnée existante.

select p.proname                                                          as fonction,
       p.prosecdef                                                        as definer,
       array_to_string(p.proconfig, ', ')                                 as chemin,
       has_function_privilege('anon', p.oid, 'execute')                   as anon,
       has_function_privilege('authenticated', p.oid, 'execute')          as authenticated,
       has_function_privilege('public', p.oid, 'execute')                 as public
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_like', 'post_comment', 'delete_comment', 'list_bento_comments',
                    'bento_social', 'submit_report', 'set_block', 'sync_blocks',
                    'my_social_export', 'normalize_for_filter', 'comment_filter_hit')
order by p.proname;

select t.table_name                                                         as table_neuve,
       has_table_privilege('anon', 'public.' || t.table_name, 'select')
         or has_table_privilege('anon', 'public.' || t.table_name, 'insert')  as anon,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'select')
         or has_table_privilege('authenticated', 'public.' || t.table_name, 'insert')
         or has_table_privilege('authenticated', 'public.' || t.table_name, 'update')
         or has_table_privilege('authenticated', 'public.' || t.table_name, 'delete') as authenticated
from (values ('bento_likes'), ('bento_comments'), ('account_blocks'), ('blocked_terms')) as t(table_name)
order by 1;

select (select count(*) from public.users)                                as profils,
       (select count(*) from public.users where accept_comments and accept_likes) as acceptent,
       (select comments_enabled from public.app_config where id = 1)       as interrupteur,
       (select count(*) from public.blocked_terms where is_active)          as mots;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.reports'::regclass
  and conname in ('reports_reporter_id_fkey', 'reports_target_kind_check')
order by conname;

select (select count(*) from auth.users)      as comptes,
       (select count(*) from public.users)    as profils,
       (select count(*) from public.bentos)   as bentos,
       (select count(*) from public.reports)  as signalements,
       (select count(*) from public.bento_likes) + (select count(*) from public.bento_comments)
         + (select count(*) from public.account_blocks) as lignes_neuves;
