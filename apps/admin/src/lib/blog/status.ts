/**
 * État affiché d'un article dans le BO. « Programmé » n'est pas un statut en base :
 * c'est un article publié dont la date n'est pas encore passée (docs/BLOG.md D6).
 */
export type PostState = 'published' | 'scheduled' | 'draft';

export function postState(
  status: 'draft' | 'published',
  publishedAt: string | null,
  nowMs: number = Date.now(),
): PostState {
  if (status === 'draft') return 'draft';
  if (publishedAt && Date.parse(publishedAt) > nowMs) return 'scheduled';
  return 'published';
}

export const POST_STATE_LABELS: Record<PostState, string> = {
  published: 'Publié',
  scheduled: 'Programmé',
  draft: 'Brouillon',
};
