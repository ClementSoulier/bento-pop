import 'server-only';
import { cache } from 'react';
import { createAnonServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { asBlogDoc, type BlogDoc } from '@/lib/blog/document';
import { mapHosts, type DbTeamMember, type EpisodeHost } from '@/content/episodes';

/**
 * Chargeurs du blog (docs/BLOG.md). Lecture anonyme : la RLS ne renvoie que les
 * articles publiés, et le filtre de date masque les articles programmés jusqu'à leur
 * heure, comme les épisodes. Seul l'aperçu signé passe par la clé de service.
 */

export type BlogCategory = { slug: string; name: string; description: string };

export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  coverAlt: string;
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number;
  category: BlogCategory | null;
  authors: EpisodeHost[];
};

export type BlogRelatedEpisode = {
  kind: 'show' | 'podcast';
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  youtubeId?: string;
  durationSeconds: number | null;
  publishedAt: string | null;
  season: number;
  episodeNumber: number | null;
};

export type BlogPost = BlogPostSummary & {
  content: BlogDoc;
  seoTitle: string | null;
  seoDescription: string | null;
  wordCount: number;
  related: BlogRelatedEpisode[];
};

const AUTHORS_EMBED =
  'landing_blog_post_authors(display_order, landing_team(id, name, nick, initials, photo_kind, photo_from, photo_to, photo_url))';
const CATEGORY_EMBED = 'landing_blog_categories(slug, name, description)';

const SUMMARY_SELECT = `id, slug, title, excerpt, cover_url, cover_alt, published_at, updated_at, reading_minutes, ${CATEGORY_EMBED}, ${AUTHORS_EMBED}`;

const POST_SELECT = `${SUMMARY_SELECT}, content, seo_title, seo_description, word_count, landing_blog_post_episodes(display_order, landing_show_episodes(id, slug, title, youtube_id, thumbnail_url, duration_seconds, published_at, season, episode_number, status), landing_podcast_episodes(id, slug, title, thumbnail_url, duration_seconds, published_at, season, episode_number, status))`;

type DbCategory = { slug: string; name: string; description: string | null };

type DbSummaryRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  cover_alt: string | null;
  published_at: string | null;
  updated_at: string;
  reading_minutes: number | null;
  landing_blog_categories: DbCategory | DbCategory[] | null;
  landing_blog_post_authors: Array<{
    display_order: number;
    landing_team: DbTeamMember | DbTeamMember[] | null;
  }> | null;
};

type DbEpisode = {
  id: string;
  slug: string;
  title: string;
  youtube_id?: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  season: number;
  episode_number: number | null;
  status: 'draft' | 'published';
};

type DbPostRow = DbSummaryRow & {
  content: unknown;
  seo_title: string | null;
  seo_description: string | null;
  word_count: number | null;
  landing_blog_post_episodes: Array<{
    display_order: number;
    landing_show_episodes: DbEpisode | DbEpisode[] | null;
    landing_podcast_episodes: DbEpisode | DbEpisode[] | null;
  }> | null;
};

/** Visibilité publique : publié, et date absente ou passée (cf. content/episodes). */
function visibilityFilter(): string {
  return `published_at.is.null,published_at.lte.${new Date().toISOString()}`;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapSummary(r: DbSummaryRow): BlogPostSummary {
  const category = one(r.landing_blog_categories);
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? '',
    coverUrl: r.cover_url,
    coverAlt: r.cover_alt ?? '',
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    readingMinutes: Math.max(1, r.reading_minutes ?? 1),
    category: category
      ? { slug: category.slug, name: category.name, description: category.description ?? '' }
      : null,
    authors: mapHosts(r.landing_blog_post_authors ?? []),
  };
}

function isVisibleEpisode(e: DbEpisode, nowMs: number): boolean {
  if (e.status !== 'published') return false;
  return !e.published_at || Date.parse(e.published_at) <= nowMs;
}

function mapPost(r: DbPostRow): BlogPost {
  const now = Date.now();
  const related = (r.landing_blog_post_episodes ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .flatMap((link): BlogRelatedEpisode[] => {
      const show = one(link.landing_show_episodes);
      const podcast = one(link.landing_podcast_episodes);
      const ep = show ?? podcast;
      // Un épisode en brouillon ou programmé n'est pas montré, même dans l'aperçu.
      if (!ep || !isVisibleEpisode(ep, now)) return [];
      return [
        {
          kind: show ? 'show' : 'podcast',
          id: ep.id,
          slug: ep.slug,
          title: ep.title,
          thumbnailUrl: ep.thumbnail_url,
          youtubeId: show?.youtube_id,
          durationSeconds: ep.duration_seconds,
          publishedAt: ep.published_at,
          season: ep.season,
          episodeNumber: ep.episode_number,
        },
      ];
    });
  return {
    ...mapSummary(r),
    content: asBlogDoc(r.content),
    seoTitle: r.seo_title,
    seoDescription: r.seo_description,
    wordCount: r.word_count ?? 0,
    related,
  };
}

/**
 * Articles visibles, du plus récent au plus ancien. Arguments simples plutôt qu'un
 * objet : `cache` de React compare les arguments par identité.
 */
export const getBlogPosts = cache(
  async (categorySlug: string | null = null, limit: number | null = null): Promise<BlogPostSummary[]> => {
    const supabase = createAnonServerClient();
    if (!supabase) return [];

    let categoryId: string | null = null;
    if (categorySlug) {
      const { data } = await supabase
        .from('landing_blog_categories')
        .select('id')
        .eq('slug', categorySlug)
        .maybeSingle();
      categoryId = (data as { id: string } | null)?.id ?? null;
      if (!categoryId) return [];
    }

    let filtered = supabase
      .from('landing_blog_posts')
      .select(SUMMARY_SELECT)
      .eq('status', 'published')
      .or(visibilityFilter());
    if (categoryId) filtered = filtered.eq('category_id', categoryId);
    const ordered = filtered
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    const { data, error } = await (limit ? ordered.limit(limit) : ordered);
    if (error || !data) return [];
    return (data as unknown as DbSummaryRow[]).map(mapSummary);
  },
);

export const getBlogPostBySlug = cache(async (slug: string): Promise<BlogPost | null> => {
  const supabase = createAnonServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('landing_blog_posts')
    .select(POST_SELECT)
    .eq('status', 'published')
    .or(visibilityFilter())
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return mapPost(data as unknown as DbPostRow);
});

/** Aperçu signé : l'article quel que soit son statut, par la clé de service. */
export async function getBlogPostForPreview(id: string): Promise<BlogPost | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('landing_blog_posts')
    .select(POST_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapPost(data as unknown as DbPostRow);
}

export const getBlogCategory = cache(async (slug: string): Promise<BlogCategory | null> => {
  const supabase = createAnonServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('landing_blog_categories')
    .select('slug, name, description')
    .eq('slug', slug)
    .maybeSingle();
  const row = data as DbCategory | null;
  return row ? { slug: row.slug, name: row.name, description: row.description ?? '' } : null;
});

/**
 * Catégories qui ont au moins un article visible, dans l'ordre du BO (docs/BLOG.md D4).
 */
export const getBlogCategoriesInUse = cache(async (): Promise<Array<BlogCategory & { count: number }>> => {
  const supabase = createAnonServerClient();
  if (!supabase) return [];
  const [categoriesRes, postsRes] = await Promise.all([
    supabase
      .from('landing_blog_categories')
      .select('id, slug, name, description')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('landing_blog_posts')
      .select('category_id')
      .eq('status', 'published')
      .or(visibilityFilter())
      .not('category_id', 'is', null),
  ]);
  if (categoriesRes.error || postsRes.error) return [];
  const counts = new Map<string, number>();
  for (const p of (postsRes.data ?? []) as Array<{ category_id: string | null }>) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }
  return ((categoriesRes.data ?? []) as Array<DbCategory & { id: string }>)
    .filter((c) => (counts.get(c.id) ?? 0) > 0)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description ?? '',
      count: counts.get(c.id) ?? 0,
    }));
});

/**
 * « À lire aussi » : d'abord la même catégorie, puis les plus récents, sans l'article
 * courant.
 */
export async function getRelatedPosts(post: BlogPostSummary, limit = 3): Promise<BlogPostSummary[]> {
  const all = await getBlogPosts();
  const others = all.filter((p) => p.id !== post.id);
  const sameCategory = post.category
    ? others.filter((p) => p.category?.slug === post.category?.slug)
    : [];
  const rest = others.filter((p) => !sameCategory.includes(p));
  return [...sameCategory, ...rest].slice(0, limit);
}
