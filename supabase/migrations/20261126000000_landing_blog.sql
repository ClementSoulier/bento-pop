-- Blog de la landing (cf. docs/BLOG.md). Mêmes patterns que les épisodes :
-- l'admin écrit via le BO, la landing lit en anonyme les articles publiés.
--
-- Base : Supabase de la landing et du back-office (supabase.bento-pop.com),
-- pas le projet mobile « My Bento Pop ».
--
-- Le contenu d'un article est un document Tiptap (JSON ProseMirror), validé
-- par le serveur de l'admin avant écriture et rendu par la landing avec ses
-- propres composants. Jamais de HTML en base.

-- ============================================================
-- 1. landing_blog_categories
-- ============================================================
create table if not exists public.landing_blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_blog_categories_order_idx
  on public.landing_blog_categories (display_order, name);

drop trigger if exists landing_blog_categories_updated_at on public.landing_blog_categories;
create trigger landing_blog_categories_updated_at
  before update on public.landing_blog_categories
  for each row execute function public.set_updated_at();

alter table public.landing_blog_categories enable row level security;

drop policy if exists "anon read blog categories" on public.landing_blog_categories;
create policy "anon read blog categories" on public.landing_blog_categories
  for select to anon, authenticated using (true);

drop policy if exists "admins write blog categories" on public.landing_blog_categories;
create policy "admins write blog categories" on public.landing_blog_categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 2. landing_blog_posts
-- ============================================================
create table if not exists public.landing_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  /* Chapô : affiché sous le titre, dans les cartes et dans le flux RSS. */
  excerpt text not null default '',
  /* Document Tiptap : {"type":"doc","content":[...]} */
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  cover_url text,
  cover_alt text not null default '',
  category_id uuid references public.landing_blog_categories(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published')),
  /* Date affichée et date de mise en ligne : future = programmé. */
  published_at timestamptz,
  seo_title text,
  seo_description text,
  /* Calculés par l'admin à l'enregistrement, pour que les listes n'aient pas
     à charger le contenu. */
  reading_minutes int not null default 1 check (reading_minutes >= 1),
  word_count int not null default 0 check (word_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint landing_blog_posts_content_is_doc
    check (jsonb_typeof(content) = 'object' and content->>'type' = 'doc')
);

create index if not exists landing_blog_posts_status_idx on public.landing_blog_posts (status);
create index if not exists landing_blog_posts_published_at_idx
  on public.landing_blog_posts (published_at desc);
create index if not exists landing_blog_posts_category_idx on public.landing_blog_posts (category_id);

drop trigger if exists landing_blog_posts_updated_at on public.landing_blog_posts;
create trigger landing_blog_posts_updated_at
  before update on public.landing_blog_posts
  for each row execute function public.set_updated_at();

alter table public.landing_blog_posts enable row level security;

drop policy if exists "read published or admin blog posts" on public.landing_blog_posts;
create policy "read published or admin blog posts" on public.landing_blog_posts
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());

drop policy if exists "admins write blog posts" on public.landing_blog_posts;
create policy "admins write blog posts" on public.landing_blog_posts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 3. landing_blog_post_authors : N:N article <-> Team
-- ============================================================
create table if not exists public.landing_blog_post_authors (
  post_id uuid not null references public.landing_blog_posts(id) on delete cascade,
  team_member_id uuid not null references public.landing_team(id) on delete cascade,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (post_id, team_member_id)
);

create index if not exists landing_blog_post_authors_team_idx
  on public.landing_blog_post_authors (team_member_id);

alter table public.landing_blog_post_authors enable row level security;

drop policy if exists "anon read blog authors" on public.landing_blog_post_authors;
create policy "anon read blog authors" on public.landing_blog_post_authors
  for select to anon, authenticated using (true);

drop policy if exists "admins write blog authors" on public.landing_blog_post_authors;
create policy "admins write blog authors" on public.landing_blog_post_authors
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 4. landing_blog_post_episodes : épisodes cités par un article
-- ============================================================
/* Une émission OU un podcast par ligne. Les épisodes restent soumis à leurs
   propres règles de lecture : un brouillon lié n'est jamais renvoyé au public. */
create table if not exists public.landing_blog_post_episodes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.landing_blog_posts(id) on delete cascade,
  show_episode_id uuid references public.landing_show_episodes(id) on delete cascade,
  podcast_episode_id uuid references public.landing_podcast_episodes(id) on delete cascade,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint landing_blog_post_episodes_one_target
    check (num_nonnulls(show_episode_id, podcast_episode_id) = 1),
  constraint landing_blog_post_episodes_show_unique unique (post_id, show_episode_id),
  constraint landing_blog_post_episodes_podcast_unique unique (post_id, podcast_episode_id)
);

create index if not exists landing_blog_post_episodes_post_idx
  on public.landing_blog_post_episodes (post_id, display_order);
create index if not exists landing_blog_post_episodes_show_idx
  on public.landing_blog_post_episodes (show_episode_id);
create index if not exists landing_blog_post_episodes_podcast_idx
  on public.landing_blog_post_episodes (podcast_episode_id);

alter table public.landing_blog_post_episodes enable row level security;

drop policy if exists "anon read blog episodes" on public.landing_blog_post_episodes;
create policy "anon read blog episodes" on public.landing_blog_post_episodes
  for select to anon, authenticated using (true);

drop policy if exists "admins write blog episodes" on public.landing_blog_post_episodes;
create policy "admins write blog episodes" on public.landing_blog_post_episodes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 5. Bucket blog-media : couvertures (covers/) et images d'article (images/)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do nothing;

drop policy if exists "anon read blog media" on storage.objects;
create policy "anon read blog media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'blog-media');

drop policy if exists "admins insert blog media" on storage.objects;
create policy "admins insert blog media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'blog-media' and public.is_admin());

drop policy if exists "admins update blog media" on storage.objects;
create policy "admins update blog media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'blog-media' and public.is_admin())
  with check (bucket_id = 'blog-media' and public.is_admin());

drop policy if exists "admins delete blog media" on storage.objects;
create policy "admins delete blog media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'blog-media' and public.is_admin());

comment on table public.landing_blog_posts is
  'Articles du blog de bento-pop.com, édités dans le back-office (docs/BLOG.md).';
