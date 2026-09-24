-- Flux RSS du podcast hébergé par le site (remplace RSS.com).
--
-- Jusqu'ici une fiche d'épisode ne portait que l'identifiant d'un lecteur externe
-- (Spotify, Deezer, Apple) : l'audio lui-même vivait chez RSS.com. Pour fabriquer
-- nous-mêmes le flux que lisent les plateformes, il faut le fichier et ses métadonnées.
--
-- Les colonnes sont ajoutées aux DEUX tables : le flux mélange podcasts et émissions,
-- comme le fait déjà celui de RSS.com (36 entrées = 18 podcasts + 18 émissions).
--
-- Trois colonnes méritent une explication :
--   * audio_published_at : la sortie audio (le mardi) n'est pas la sortie YouTube
--     (le jeudi). published_at reste la date de la page et de la vidéo. Tant qu'elle
--     est nulle, l'épisode n'apparaît pas dans le flux.
--   * feed_guid : l'identifiant que les applis d'écoute utilisent pour reconnaître un
--     épisode déjà téléchargé. Reprendre à l'identique celui de RSS.com est ce qui
--     évite les doublons chez les abonnés au moment de la bascule. Ne jamais le
--     changer une fois l'épisode publié.
--   * feed_season / feed_number : RSS.com numérote en une seule suite continue par
--     saison, toutes rubriques confondues (S1E1..S1E32 puis S2E1..S2E3), ce qui ne
--     correspond pas à la numérotation par table du site. On la fige à l'import.

-- ---------------------------------------------------------------- landing_show_episodes

alter table public.landing_show_episodes
  add column if not exists audio_url text not null default '',
  add column if not exists audio_bytes bigint not null default 0,
  add column if not exists audio_mime text not null default 'audio/mpeg',
  add column if not exists audio_published_at timestamptz,
  add column if not exists feed_guid text,
  add column if not exists feed_season int,
  add column if not exists feed_number int,
  add column if not exists explicit boolean not null default false,
  add column if not exists episode_type text not null default 'full';

-- Un même identifiant ne peut pas désigner deux épisodes : c'est la garantie
-- contre les doublons dans les applis d'écoute.
create unique index if not exists landing_show_episodes_feed_guid_idx
  on public.landing_show_episodes (feed_guid) where feed_guid is not null;

-- Le flux se trie par date de sortie audio.
create index if not exists landing_show_episodes_audio_published_idx
  on public.landing_show_episodes (audio_published_at desc) where audio_published_at is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.landing_show_episodes'::regclass
      and conname = 'landing_show_episodes_episode_type_check'
  ) then
    alter table public.landing_show_episodes
      add constraint landing_show_episodes_episode_type_check
      check (episode_type in ('full', 'trailer', 'bonus'));
  end if;

  -- Un épisode annoncé dans le flux doit être écoutable : pas de fichier, pas de date.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.landing_show_episodes'::regclass
      and conname = 'landing_show_episodes_audio_complet_check'
  ) then
    alter table public.landing_show_episodes
      add constraint landing_show_episodes_audio_complet_check
      check (audio_published_at is null
             or (audio_url <> '' and audio_bytes > 0 and feed_guid is not null));
  end if;
end $$;

comment on column public.landing_show_episodes.audio_published_at is
  'Sortie audio (mardi), distincte de published_at qui est la sortie YouTube (jeudi). '
  'Nulle tant que l''épisode ne doit pas apparaître dans le flux RSS.';
comment on column public.landing_show_episodes.feed_guid is
  'Identifiant de l''épisode dans le flux RSS, repris de RSS.com pour les épisodes '
  'migrés. Ne jamais le changer une fois publié : les applis le lisent pour '
  'reconnaître un épisode déjà téléchargé.';
comment on column public.landing_show_episodes.feed_number is
  'Numérotation propre au flux, continue sur la saison toutes rubriques confondues.';

-- ---------------------------------------------------------------- landing_podcast_episodes

alter table public.landing_podcast_episodes
  add column if not exists audio_url text not null default '',
  add column if not exists audio_bytes bigint not null default 0,
  add column if not exists audio_mime text not null default 'audio/mpeg',
  add column if not exists audio_published_at timestamptz,
  add column if not exists feed_guid text,
  add column if not exists feed_season int,
  add column if not exists feed_number int,
  add column if not exists explicit boolean not null default false,
  add column if not exists episode_type text not null default 'full';

-- Un même identifiant ne peut pas désigner deux épisodes : c'est la garantie
-- contre les doublons dans les applis d'écoute.
create unique index if not exists landing_podcast_episodes_feed_guid_idx
  on public.landing_podcast_episodes (feed_guid) where feed_guid is not null;

-- Le flux se trie par date de sortie audio.
create index if not exists landing_podcast_episodes_audio_published_idx
  on public.landing_podcast_episodes (audio_published_at desc) where audio_published_at is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.landing_podcast_episodes'::regclass
      and conname = 'landing_podcast_episodes_episode_type_check'
  ) then
    alter table public.landing_podcast_episodes
      add constraint landing_podcast_episodes_episode_type_check
      check (episode_type in ('full', 'trailer', 'bonus'));
  end if;

  -- Un épisode annoncé dans le flux doit être écoutable : pas de fichier, pas de date.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.landing_podcast_episodes'::regclass
      and conname = 'landing_podcast_episodes_audio_complet_check'
  ) then
    alter table public.landing_podcast_episodes
      add constraint landing_podcast_episodes_audio_complet_check
      check (audio_published_at is null
             or (audio_url <> '' and audio_bytes > 0 and feed_guid is not null));
  end if;
end $$;

comment on column public.landing_podcast_episodes.audio_published_at is
  'Sortie audio (mardi), distincte de published_at qui est la sortie YouTube (jeudi). '
  'Nulle tant que l''épisode ne doit pas apparaître dans le flux RSS.';
comment on column public.landing_podcast_episodes.feed_guid is
  'Identifiant de l''épisode dans le flux RSS, repris de RSS.com pour les épisodes '
  'migrés. Ne jamais le changer une fois publié : les applis le lisent pour '
  'reconnaître un épisode déjà téléchargé.';
comment on column public.landing_podcast_episodes.feed_number is
  'Numérotation propre au flux, continue sur la saison toutes rubriques confondues.';

-- ---------------------------------------------- réglages du podcast (une ligne)
--
-- Ce que les plateformes lisent en tête du flux. Édité depuis l'admin.

create table if not exists public.landing_podcast_settings (
  id boolean primary key default true check (id),
  title text not null default 'Bento Pop!',
  description text not null default '',
  author text not null default 'Liventure SAS & Dark Hifus Production',
  owner_name text not null default 'Bento Pop',
  -- Visible dans le flux : c'est elle qui prouve la propriété du podcast auprès
  -- d'Apple et de Spotify.
  owner_email text not null default '',
  language text not null default 'fr',
  category text not null default 'Leisure',
  subcategory text not null default '',
  image_url text not null default '',
  -- Identifiant du podcast lui-même, à reprendre de RSS.com pour que la redirection
  -- soit comprise comme un déménagement et non comme un nouveau podcast.
  podcast_guid text not null default '',
  copyright text not null default 'Liventure SAS & Dark Hifus Production',
  explicit boolean not null default false,
  podcast_type text not null default 'episodic'
    check (podcast_type in ('episodic', 'serial')),
  link text not null default 'https://bento-pop.com',
  -- Empêche un autre hébergeur d'importer le flux sans notre accord.
  locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.landing_podcast_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists landing_podcast_settings_updated_at on public.landing_podcast_settings;
create trigger landing_podcast_settings_updated_at
  before update on public.landing_podcast_settings
  for each row execute function public.set_updated_at();

alter table public.landing_podcast_settings enable row level security;

drop policy if exists "read podcast settings" on public.landing_podcast_settings;
create policy "read podcast settings" on public.landing_podcast_settings
  for select to anon, authenticated using (true);

drop policy if exists "admins write podcast settings" on public.landing_podcast_settings;
create policy "admins write podcast settings" on public.landing_podcast_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------- stockage des fichiers
--
-- Séparé de episode-media, qui ne contient que des images : les tailles, les types
-- et la durée de conservation n'ont rien à voir. Le bucket a déjà été créé par
-- l'API ; cette instruction le rend reproductible et fixe ses limites.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('episode-audio', 'episode-audio', true, 209715200,
        array['audio/mpeg', 'audio/mp4', 'audio/aac'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon read episode audio" on storage.objects;
create policy "anon read episode audio"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'episode-audio');

drop policy if exists "admins insert episode audio" on storage.objects;
create policy "admins insert episode audio"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'episode-audio' and public.is_admin());

drop policy if exists "admins update episode audio" on storage.objects;
create policy "admins update episode audio"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'episode-audio' and public.is_admin())
  with check (bucket_id = 'episode-audio' and public.is_admin());

drop policy if exists "admins delete episode audio" on storage.objects;
create policy "admins delete episode audio"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'episode-audio' and public.is_admin());
