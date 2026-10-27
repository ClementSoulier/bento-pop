-- Contrôles en lecture seule de la migration
-- 20261027400000_achievements.sql, chantier 27, à jouer dans l'éditeur SQL
-- de « My Bento Pop » juste après l'avoir appliquée. Rien n'y écrit.
--
-- Attendu :
--   1. `account_achievements_of` exécutable par `anon` et `authenticated`,
--      pour le web et l'app ; `my_social_export` par `authenticated`
--      seulement ; les règles, la pose, l'interrupteur, les déclencheurs et
--      `notification_events` par personne ; toutes en `security definer`,
--      avec `search_path=""` ;
--   2. aucun droit des clients sur `account_achievements`, RLS active ;
--   3. une clé étrangère de `account_achievements` vers `users`, en
--      cascade, la liste des huit clés, la clé primaire (compte, succès) ;
--   4. les quatre déclencheurs actifs (`O`), l'interrupteur allumé ;
--   5. le rattrapage : pour chaque succès, autant de lignes posées que de
--      comptes qui le méritent, aux dates de leurs données ; aucun profil
--      éditorial, rien dans le futur ;
--   6. les mêmes comptes de comptes, profils, bentos, items et abonnements
--      qu'avant l'application : la migration n'écrit que dans sa table neuve.

select p.proname                                                          as fonction,
       p.prosecdef                                                        as definer,
       array_to_string(p.proconfig, ', ')                                 as chemin,
       has_function_privilege('anon', p.oid, 'execute')                   as anon,
       has_function_privilege('authenticated', p.oid, 'execute')          as authenticated,
       has_function_privilege('public', p.oid, 'execute')                 as public
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('account_achievements_of', 'my_social_export', 'notification_events',
                    'achievements_open', 'achievement_candidates', 'award_achievements',
                    'award_achievements_safely', 'achievements_on_bento',
                    'achievements_on_bento_item', 'achievements_on_item', 'achievements_on_follow')
order by p.proname;

select 'account_achievements'                                                           as table_neuve,
       (select relrowsecurity from pg_class where oid = 'public.account_achievements'::regclass) as rls,
       has_table_privilege('anon', 'public.account_achievements', 'select')
         or has_table_privilege('anon', 'public.account_achievements', 'insert')        as anon,
       has_table_privilege('authenticated', 'public.account_achievements', 'select')
         or has_table_privilege('authenticated', 'public.account_achievements', 'insert')
         or has_table_privilege('authenticated', 'public.account_achievements', 'update')
         or has_table_privilege('authenticated', 'public.account_achievements', 'delete') as authenticated;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.account_achievements'::regclass
order by conname;

select t.tgname as declencheur, c.relname as sur, t.tgenabled as actif
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where t.tgname in ('bentos_achievements', 'bento_items_achievements',
                   'items_achievements', 'account_follows_achievements')
order by t.tgname;

select (select achievements_enabled from public.app_config where id = 1) as interrupteur;

-- Le rattrapage, succès par succès : « merites » et « poses » égaux.
with eligible as (
  select c.key, count(*) as n
  from public.users u
  cross join lateral public.achievement_candidates(u.id) c
  where u.kind = 'member'
  group by c.key
),
stored as (
  select a.key, count(*) as n
  from public.account_achievements a
  group by a.key
)
select k.key                                  as succes,
       coalesce(e.n, 0)                       as merites,
       coalesce(s.n, 0)                       as poses,
       coalesce(e.n, 0) = coalesce(s.n, 0)    as egal
from unnest(array['first_bento', 'three_bentos', 'same_item_ten', 'first_item',
                  'five_items', 'ten_items', 'first_follower', 'ten_followers'])
     with ordinality as k(key, ord)
left join eligible e on e.key = k.key
left join stored s on s.key = k.key
order by k.ord;

select (select count(*)
        from public.account_achievements a
        join lateral public.achievement_candidates(a.user_id) c on c.key = a.key
        where c.unlocked_at is distinct from a.unlocked_at)                     as dates_differentes,
       (select count(*)
        from public.account_achievements a
        join public.users u on u.id = a.user_id
        where u.kind <> 'member')                                               as editoriaux,
       (select count(*) from public.account_achievements where unlocked_at > now()) as dans_le_futur;

select (select count(*) from auth.users)                 as comptes,
       (select count(*) from public.users)               as profils,
       (select count(*) from public.bentos)              as bentos,
       (select count(*) from public.items)               as items,
       (select count(*) from public.account_follows)     as abonnements,
       (select count(*) from public.account_achievements) as succes;
