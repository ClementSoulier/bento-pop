-- ─────────────────────────────────────────────────────────────────────────
-- URGENT · Rétablit la création du premier bento par le client
-- ─────────────────────────────────────────────────────────────────────────
--
-- **À appliquer immédiatement.** Correctif d'un défaut introduit par
-- `20260916120000_bentos_slug_and_primary.sql`, appliquée en production le
-- 16 septembre 2026.
--
-- ─── Ce qui est cassé ────────────────────────────────────────────────────
--
-- Cette migration a posé `slug text NOT NULL` sans valeur par défaut. Or le
-- client n'a le droit d'écrire qu'une seule colonne à l'insertion :
--
--   grant insert (user_id) on public.bentos to authenticated;
--   -- 20260915000000_close_privilege_gaps.sql:226
--
-- `ensureBento`, appelé avant chaque première écriture de case
-- (`apps/mobile/src/lib/bento-actions.ts`), fait donc :
--
--   insert into public.bentos (user_id) values (auth.uid())
--
-- ce qui échoue depuis l'application de la migration A :
--
--   ERROR: null value in column "slug" of relation "bentos"
--          violates not-null constraint
--
-- **Conséquence : toute personne sans bento qui remplit sa première case
-- reçoit une erreur.** Les comptes qui ont déjà une ligne `bentos`, soit la
-- quasi-totalité des comptes existants, ne sont pas touchés : leur bento est
-- créé, `ensureBento` le trouve et n'insère rien. Ce sont les nouveaux venus
-- qui sont bloqués.
--
-- Vérifié sur le Supabase local, en simulant une session `authenticated` sur
-- un compte neuf. Le défaut n'avait été vu ni à la relecture de la migration
-- ni par les tests : aucun ne couvrait le chemin « premier bento d'un compte
-- neuf » au niveau SQL, et les tests applicatifs bouchonnent PostgREST.
--
-- ─── Le correctif ────────────────────────────────────────────────────────
--
-- Deux valeurs par défaut. Le client continue de n'écrire que `user_id`, et
-- la base remplit le reste.

-- Le bento créé par le client est le principal de son compte : c'est celui
-- que `/u/<pseudo>` met en avant, et c'est le seul que le client sait créer.
alter table public.bentos alter column is_primary set default true;

-- Son adresse, la même que celle donnée rétroactivement aux bentos existants.
-- L'unicité `(user_id, slug)` empêche d'en créer deux, et l'index partiel
-- `bentos_one_primary` prendra le relais après la migration B.
alter table public.bentos alter column slug set default 'mon-bento';

comment on column public.bentos.slug is
  'Adresse publique du bento, unique par compte : /u/<pseudo>/<slug>. '
  'Défaut « mon-bento » : le client ne peut insérer que user_id, la base '
  'remplit le reste. Un secondaire passe par create_bento(). Cf. chantier 16.';

comment on column public.bentos.is_primary is
  'Le bento mis en avant par /u/<pseudo>. Au plus un par compte. Vrai par '
  'défaut : le seul bento qu''un client sait créer est son principal. '
  'Cf. chantier 16.';

-- ─── Contrôles, à passer après application ───────────────────────────────
--
-- 1. Les deux défauts sont posés. Doit rendre `true` et `'mon-bento'::text`.
--
--   select column_name, column_default
--     from information_schema.columns
--    where table_name = 'bentos' and column_name in ('slug', 'is_primary');
--
-- 2. Le chemin du premier bento repasse. À jouer dans une transaction
--    annulée, avec une session simulée :
--
--   begin;
--   select set_config('request.jwt.claims',
--     json_build_object('sub', '<un uuid de users sans bento>',
--                       'role', 'authenticated')::text, true);
--   set local role authenticated;
--   insert into public.bentos (user_id) values ('<le même uuid>');
--   rollback;
--
-- 3. Et il ne permet toujours pas d'en créer deux : le second insert doit
--    échouer sur `bentos_user_slug`, puis sur `bentos_one_primary` une fois
--    la migration B appliquée.
