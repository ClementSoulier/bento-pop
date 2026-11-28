import type { BlogPost, BlogPostSummary } from '@/content/blog';

/**
 * JSON-LD du blog (docs/BLOG.md D11). L'éditeur renvoie à l'organisation déclarée sur
 * toutes les pages (`organizationSchema`, `@id` = `<site>/#organization`).
 */

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com').replace(/\/$/, '');
}

export function blogPostingSchema(post: BlogPost) {
  const base = siteUrl();
  const url = `${base}/blog/${post.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: url,
    url,
    headline: post.title.slice(0, 110),
    description: post.seoDescription || post.excerpt || undefined,
    image: post.coverUrl ? [post.coverUrl] : [`${base}/opengraph-image`],
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt,
    inLanguage: 'fr-FR',
    articleSection: post.category?.name,
    wordCount: post.wordCount || undefined,
    timeRequired: `PT${post.readingMinutes}M`,
    author:
      post.authors.length > 0
        ? post.authors.map((a) => ({ '@type': 'Person', name: a.name }))
        : { '@id': `${base}/#organization` },
    publisher: { '@id': `${base}/#organization` },
    isPartOf: { '@type': 'Blog', '@id': `${base}/blog#blog`, name: 'Le blog Bento Pop' },
  } as const;
}

export function blogBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${base}${item.path}`,
    })),
  } as const;
}

export function blogSchema(posts: BlogPostSummary[], name = 'Le blog Bento Pop', path = '/blog') {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${base}/blog#blog`,
    name,
    url: `${base}${path}`,
    inLanguage: 'fr-FR',
    publisher: { '@id': `${base}/#organization` },
    blogPost: posts.slice(0, 20).map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title.slice(0, 110),
      url: `${base}/blog/${p.slug}`,
      datePublished: p.publishedAt ?? undefined,
    })),
  } as const;
}
