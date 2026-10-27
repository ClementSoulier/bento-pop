-- Contrôles en lecture seule de la migration
-- 20261027200000_notifications.sql, chantier 24, à jouer dans l'éditeur SQL
-- de « My Bento Pop » juste après l'avoir appliquée. Rien n'y écrit.
--
-- Attendu :
--   1. `notification_badge`, `list_notifications`, `mark_notifications_seen`
--      et `my_social_export` exécutables par `authenticated` seulement ;
--      `notification_events`, `notifications_seen_at` et `notifications_open`
--      par personne ; toutes en `security definer`, avec `search_path=""` ;
--      le déclencheur des items avec `search_path=""`, ses droits inchangés ;
--   2. aucun droit des clients sur `notification_reads`, RLS active ;
--   3. une clé étrangère de `notification_reads` vers `users`, en cascade ;
--   4. `items.merged_at` et l'index `items_submitted_by` posés,
--      l'interrupteur allumé ;
--   5. les mêmes comptes de comptes, profils, bentos et items qu'avant
--      l'application, aucune date de lecture, aucune fusion datée : la
--      migration n'écrit aucune donnée existante.

select p.proname                                                          as fonction,
       p.prosecdef                                                        as definer,
       array_to_string(p.proconfig, ', ')                                 as chemin,
       has_function_privilege('anon', p.oid, 'execute')                   as anon,
       has_function_privilege('authenticated', p.oid, 'execute')          as authenticated,
       has_function_privilege('public', p.oid, 'execute')                 as public
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('notification_badge', 'list_notifications', 'mark_notifications_seen',
                    'my_social_export', 'notification_events', 'notifications_seen_at',
                    'notifications_open', 'items_touch_lifecycle_on_update')
order by p.proname;

select 'notification_reads'                                                      as table_neuve,
       (select relrowsecurity from pg_class where oid = 'public.notification_reads'::regclass) as rls,
       has_table_privilege('anon', 'public.notification_reads', 'select')
         or has_table_privilege('anon', 'public.notification_reads', 'insert')        as anon,
       has_table_privilege('authenticated', 'public.notification_reads', 'select')
         or has_table_privilege('authenticated', 'public.notification_reads', 'insert')
         or has_table_privilege('authenticated', 'public.notification_reads', 'update')
         or has_table_privilege('authenticated', 'public.notification_reads', 'delete') as authenticated;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.notification_reads'::regclass
order by conname;

select (select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'items' and column_name = 'merged_at') as merged_at,
       (select count(*) from pg_indexes
        where schemaname = 'public' and indexname = 'items_submitted_by')                     as index_propositions,
       (select notifications_enabled from public.app_config where id = 1)                    as interrupteur;

select (select count(*) from auth.users)                                as comptes,
       (select count(*) from public.users)                              as profils,
       (select count(*) from public.bentos)                             as bentos,
       (select count(*) from public.items)                              as items,
       (select count(*) from public.items where merged_at is not null)  as fusions_datees,
       (select count(*) from public.notification_reads)                 as dates_de_lecture;
