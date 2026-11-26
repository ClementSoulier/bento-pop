-- Newsletter de la landing (cf. docs/NEWSLETTER.md).
--
-- Base : Supabase de la landing et du back-office (supabase.bento-pop.com),
-- pas le projet mobile « My Bento Pop ».
--
-- La table `landing_newsletter_subscribers` existe depuis la première
-- migration (20260509000000_landing_initial.sql), sans aucun droit de lecture
-- pour le back-office : la tuile « Newsletter » du dashboard affichait 0 en
-- permanence. Cette migration la complète, sans rien perdre de ce qu'elle
-- contient.
--
-- Écritures publiques (inscription, désinscription) : toujours par les
-- actions serveur de la landing, en service-role. Aucune policy pour anon.
-- Back-office : lecture et suppression pour les admins.

-- ============================================================
-- 1. Provenance de l'inscription
-- ============================================================
-- 'home' : la section de l'accueil ; 'footer' : le champ du pied de page ;
-- 'landing' : la valeur par défaut d'origine, gardée pour d'éventuelles
-- lignes anciennes.
alter table public.landing_newsletter_subscribers
  drop constraint if exists landing_newsletter_subscribers_source_check;
alter table public.landing_newsletter_subscribers
  add constraint landing_newsletter_subscribers_source_check
  check (source in ('home', 'footer', 'landing'));

-- Une adresse email ne dépasse pas 254 caractères (RFC 5321).
alter table public.landing_newsletter_subscribers
  drop constraint if exists landing_newsletter_subscribers_email_length;
alter table public.landing_newsletter_subscribers
  add constraint landing_newsletter_subscribers_email_length
  check (char_length(email) between 3 and 254);

-- La liste du back-office se lit de la plus récente à la plus ancienne.
create index if not exists landing_newsletter_subscribers_consent_idx
  on public.landing_newsletter_subscribers (consent_at desc);

-- ============================================================
-- 2. Droits du back-office
-- ============================================================
alter table public.landing_newsletter_subscribers enable row level security;

drop policy if exists "admins read newsletter" on public.landing_newsletter_subscribers;
create policy "admins read newsletter" on public.landing_newsletter_subscribers
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "admins delete newsletter" on public.landing_newsletter_subscribers;
create policy "admins delete newsletter" on public.landing_newsletter_subscribers
  for delete to authenticated
  using ((select public.is_admin()));
