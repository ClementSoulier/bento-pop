import 'server-only';
import type { createServerClient } from '@/lib/supabase/server';
import { revalidateLanding } from '@/lib/revalidate-landing';
import { countWords, docPlainText, readingMinutes } from '@/lib/blog/document';
import {
  THERMOMETRE_CATEGORY,
  buildPollSnapshot,
  firstFreeSlug,
  resultsDocument,
  resultsExcerpt,
  resultsSlugBase,
  resultsTitle,
  type PollResultRow,
  type PollWeek,
} from '@/lib/blog/poll';

type Supabase = Awaited<ReturnType<typeof createServerClient>>;

export type PollResultsOutcome =
  | { status: 'published'; slug: string }
  | { status: 'skipped'; reason: 'no_votes' | 'already_published' | 'unknown_poll' }
  | { status: 'error'; error: string };

/**
 * Publie l'article « Résultats du Thermomètre » d'un sondage qui vient de se clore
 * (docs/BLOG.md D15 à D19) : instantané des votes, catégorie Le Thermomètre créée au
 * besoin, article publié tout de suite et signé Bento Pop (aucun auteur).
 *
 * Rien n'est publié pour un sondage sans vote, ni deux fois pour le même sondage.
 * Appelé après la clôture : un échec ici ne la défait pas, l'appelant le signale.
 */
export async function publishPollResults(
  supabase: Supabase,
  weekId: string,
  now: Date = new Date(),
): Promise<PollResultsOutcome> {
  const [weekRes, resultsRes] = await Promise.all([
    supabase.from('landing_vote_weeks').select('id, week_tag, question, options').eq('id', weekId).maybeSingle(),
    supabase.from('landing_vote_results').select('option_id, votes').eq('week_id', weekId),
  ]);
  if (weekRes.error || resultsRes.error) {
    return { status: 'error', error: (weekRes.error ?? resultsRes.error)?.message ?? 'Lecture du sondage impossible' };
  }
  const week = weekRes.data as unknown as PollWeek | null;
  if (!week) return { status: 'skipped', reason: 'unknown_poll' };

  const snapshot = buildPollSnapshot(week, (resultsRes.data ?? []) as unknown as PollResultRow[], now.toISOString());
  if (snapshot.total === 0) return { status: 'skipped', reason: 'no_votes' };

  // Déjà publié ? On cherche un article de résultats qui porte ce sondage : le bloc
  // garde l'identifiant de la semaine dans ses attributs.
  const { data: existing, error: existingErr } = await supabase
    .from('landing_blog_posts')
    .select('id')
    .like('slug', 'thermometre-%')
    .contains('content', { content: [{ type: 'poll', attrs: { weekId } }] })
    .limit(1);
  if (existingErr) return { status: 'error', error: existingErr.message };
  if ((existing ?? []).length > 0) return { status: 'skipped', reason: 'already_published' };

  const categoryId = await ensureThermometreCategory(supabase);
  if (typeof categoryId !== 'string') return categoryId;

  const base = resultsSlugBase(snapshot);
  const { data: taken, error: takenErr } = await supabase
    .from('landing_blog_posts')
    .select('slug')
    .like('slug', `${base}%`);
  if (takenErr) return { status: 'error', error: takenErr.message };
  const slug = firstFreeSlug(base, ((taken ?? []) as Array<{ slug: string }>).map((p) => p.slug));

  const content = resultsDocument(snapshot);
  const words = countWords(docPlainText(content));
  const { error: insertErr } = await supabase.from('landing_blog_posts').insert({
    slug,
    title: resultsTitle(snapshot),
    excerpt: resultsExcerpt(snapshot),
    content,
    category_id: categoryId,
    status: 'published',
    published_at: now.toISOString(),
    word_count: words,
    reading_minutes: readingMinutes(words),
  } as never);
  if (insertErr) return { status: 'error', error: insertErr.message };

  await revalidateLanding([`/blog/${slug}`, '/sitemap.xml', '/blog/feed.xml']);
  return { status: 'published', slug };
}

async function ensureThermometreCategory(supabase: Supabase): Promise<string | PollResultsOutcome> {
  const { data, error } = await supabase
    .from('landing_blog_categories')
    .select('id')
    .eq('slug', THERMOMETRE_CATEGORY.slug)
    .maybeSingle();
  if (error) return { status: 'error', error: error.message };
  const found = data as { id: string } | null;
  if (found) return found.id;

  const { data: created, error: createErr } = await supabase
    .from('landing_blog_categories')
    .insert({ ...THERMOMETRE_CATEGORY, display_order: 100 } as never)
    .select('id')
    .single();
  if (createErr || !created) return { status: 'error', error: createErr?.message ?? 'Catégorie non créée' };
  return (created as unknown as { id: string }).id;
}

/** Message pour le BO quand la clôture a marché mais pas l'article. */
export function resultsFailureMessage(outcome: PollResultsOutcome): string | null {
  return outcome.status === 'error'
    ? `Sondage clos, mais l’article de résultats n’a pas pu être publié : ${outcome.error}`
    : null;
}
