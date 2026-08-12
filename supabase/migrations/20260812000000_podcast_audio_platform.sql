-- Plateforme d'écoute des épisodes podcast.
-- Jusqu'ici l'embed était forcé sur Spotify. Certains épisodes ne sont pas
-- référencés côté Spotify : on autorise Deezer et Apple Podcasts en repli.
--
-- `spotify_episode_id` reste la colonne qui porte l'identifiant d'épisode,
-- quelle que soit la plateforme (renommer casserait admin + landing en même
-- temps). `audio_show_id` n'est utile qu'à Apple, dont l'embed a besoin de
-- l'id de l'émission ET de l'id d'épisode : /podcast/id<show>?i=<episode>.

alter table public.landing_podcast_episodes
  add column if not exists audio_platform text not null default 'spotify',
  add column if not exists audio_show_id text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.landing_podcast_episodes'::regclass
      and conname = 'landing_podcast_episodes_audio_platform_check'
  ) then
    alter table public.landing_podcast_episodes
      add constraint landing_podcast_episodes_audio_platform_check
      check (audio_platform in ('spotify', 'deezer', 'apple'));
  end if;
end $$;

comment on column public.landing_podcast_episodes.spotify_episode_id is
  'Identifiant de l''épisode sur la plateforme indiquée par audio_platform.';
comment on column public.landing_podcast_episodes.audio_platform is
  'spotify | deezer | apple — détermine l''embed et le lien « Écouter ».';
comment on column public.landing_podcast_episodes.audio_show_id is
  'Id de l''émission. Requis uniquement pour Apple Podcasts, ignoré ailleurs.';
