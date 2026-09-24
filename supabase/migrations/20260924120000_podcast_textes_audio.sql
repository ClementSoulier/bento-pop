-- Titre, description et image propres aux plateformes audio (Spotify, Apple Podcasts, Deezer).
--
-- La charte des descriptions prévoit pour chaque épisode des textes destinés aux
-- plateformes audio, distincts de ceux de la page et de YouTube : préfixe de rubrique
-- (« Débats #1 - … »), « | Bento Pop » en fin de titre d'émission, description mise en
-- forme. Les 36 épisodes publiés chez RSS.com ont les leurs : les reprendre tels quels
-- évite que les auditeurs voient tous les titres changer au moment de la bascule.
--
-- Vides, ils laissent la place à ceux de la fiche : le flux prend alors le titre et la
-- description du site.
--
-- audio_image_url : l'image de l'épisode dans les applis, qui attendent un carré
-- (1400 à 3000 px). Les miniatures du site sont en 16:9, d'où un champ à part. Vide,
-- les applis montrent la pochette du podcast.

alter table public.landing_show_episodes
  add column if not exists audio_title text not null default '',
  add column if not exists audio_description text not null default '',
  add column if not exists audio_image_url text not null default '';

alter table public.landing_podcast_episodes
  add column if not exists audio_title text not null default '',
  add column if not exists audio_description text not null default '',
  add column if not exists audio_image_url text not null default '';

comment on column public.landing_show_episodes.audio_title is
  'Titre sur les plateformes audio. Vide : le flux RSS prend title.';
comment on column public.landing_show_episodes.audio_description is
  'Description sur les plateformes audio, en HTML simple ou en texte. Vide : le flux RSS prend description.';
comment on column public.landing_show_episodes.audio_image_url is
  'Image carrée de l''épisode dans les applis d''écoute. Vide : la pochette du podcast.';

comment on column public.landing_podcast_episodes.audio_title is
  'Titre sur les plateformes audio. Vide : le flux RSS prend title.';
comment on column public.landing_podcast_episodes.audio_description is
  'Description sur les plateformes audio, en HTML simple ou en texte. Vide : le flux RSS prend description.';
comment on column public.landing_podcast_episodes.audio_image_url is
  'Image carrée de l''épisode dans les applis d''écoute. Vide : la pochette du podcast.';

-- PostgREST relit la structure tout de suite, sans attendre un redémarrage.
notify pgrst, 'reload schema';
