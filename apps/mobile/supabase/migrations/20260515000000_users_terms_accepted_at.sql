-- Migration : EULA / Terms acceptance pour conformité App Store Guideline 1.2
-- (User-Generated Content : exiger l'acceptation explicite des CGU avant
--  registration/publish, avec tolérance zéro pour le contenu offensant).
--
-- À appliquer sur le projet Supabase mobile (ggjgktbcqumfxrixcdyx) via le
-- SQL editor du dashboard (convention du projet).

alter table public.users
  add column if not exists terms_accepted_at timestamptz;

comment on column public.users.terms_accepted_at is
  'Timestamp d''acceptation explicite des CGU (App Store Guideline 1.2). '
  'NULL = doit être présenté à l''utilisateur au prochain lancement.';

-- Pas de backfill : les comptes existants se verront présenter l''écran
-- Terms à la prochaine ouverture de l''app (gate route via index.tsx).
