-- Liens sociaux par membre de la team Bento Pop.
-- Tous nullables : côté landing, on n'affiche l'icône que si la valeur
-- est non vide (string non vide après trim). Pas de CHECK contrainte
-- "doit commencer par https://" — Zod valide côté admin et c'est plus
-- pratique pour de futurs ajustements (mailto:, custom schemes…).

alter table public.landing_team
  add column if not exists instagram_url text,
  add column if not exists youtube_url   text,
  add column if not exists twitch_url    text,
  add column if not exists x_url         text,
  add column if not exists website_url   text;
