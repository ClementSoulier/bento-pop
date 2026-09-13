-- ─────────────────────────────────────────────────────────────────────────
-- `is_featured` n'est plus écrivable par son propriétaire
-- ─────────────────────────────────────────────────────────────────────────
--
-- La politique `bentos_update_own` de la migration initiale autorise le
-- propriétaire à modifier sa ligne :
--
--   using (user_id = (select auth.uid()))
--   with check (user_id = (select auth.uid()))
--
-- Elle ne dit rien des colonnes, et aucun `grant update (…)` n'a jamais été
-- posé. Or `bentos` porte `is_featured` et `featured_order`, qui sont le
-- signal ÉDITORIAL géré par le back-office : ils décident de la mise en avant
-- dans l'app et sur la landing. N'importe qui sachant appeler PostgREST avec
-- sa propre session pouvait donc se mettre en avant.
--
-- Ni fuite ni exploitation constatée au 13 septembre 2026. C'est une garantie
-- éditoriale qui n'en était pas une, sur un produit dont l'argument est que
-- des créateurs identifiés y composent leur bento.
--
-- Vérifié avant d'appliquer : l'app ne fait que deux `update` sur cette
-- table, `publishBento` et `unpublishBento`, tous deux sur `published_at`
-- seul (`src/lib/bento-actions.ts`). Le reste est en lecture, plus un
-- `insert (user_id)` dans `ensureBento` que ce fichier ne touche pas.
--
-- `updated_at` est posé par le trigger `bentos_touch_updated_at`, en `before
-- update`. Une affectation faite dans un trigger n'est pas soumise aux
-- privilèges de colonne de l'appelant : il n'a donc pas à figurer ici.

-- `anon` autant qu'`authenticated` : `revoke … from public` ne suffit pas,
-- Supabase accorde les privilèges à ces deux rôles par des default
-- privileges. La leçon vient du chantier 14, où une fonction d'administration
-- est restée appelable à la clé anonyme pour cette raison exacte.
revoke update on public.bentos from anon, authenticated;

-- Seule colonne que le client a le droit d'écrire. `service_role`, utilisé
-- par le back-office pour `is_featured`, n'est pas concerné par ce revoke et
-- garde tous ses privilèges.
grant update (published_at) on public.bentos to authenticated;

comment on column public.bentos.is_featured is
  'Mise en avant éditoriale, écrite par le back-office via service_role uniquement. Retirée des privilèges de `authenticated` le 13/09/2026, cf. 20260913200000.';

-- ─── Contrôle ────────────────────────────────────────────────────────────
-- Doit rendre exactement une ligne : authenticated / published_at / UPDATE.
--
--   select grantee, column_name, privilege_type
--     from information_schema.column_privileges
--    where table_name = 'bentos'
--      and privilege_type = 'UPDATE'
--      and grantee in ('anon', 'authenticated')
--    order by grantee, column_name;
