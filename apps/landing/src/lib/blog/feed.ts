/**
 * Flux RSS 2.0 du blog, à `/blog/feed.xml` (docs/BLOG.md D9). Distinct du flux du
 * podcast (`/feed.xml`), que lisent les plateformes audio et qu'il ne faut pas toucher.
 *
 * Chapô seul et lien vers l'article : le contenu complet resterait à convertir en HTML,
 * et les lecteurs RSS viennent lire l'article sur le site.
 */

export type BlogFeedItem = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string | null;
  updatedAt: string;
  category: string | null;
  authors: string[];
};

export function escapeXml(value: string): string {
  return (
    value
      // Caractères interdits en XML 1.0 (contrôles hors tabulation et retours).
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  );
}

export function buildBlogFeed(siteUrl: string, items: BlogFeedItem[], nowMs: number = Date.now()): string {
  const base = siteUrl.replace(/\/$/, '');
  const latest = items.reduce<number>((max, item) => {
    const t = Date.parse(item.publishedAt ?? item.updatedAt);
    return Number.isFinite(t) && t > max ? t : max;
  }, 0);
  const lastBuild = new Date(latest || nowMs).toUTCString();

  const entries = items
    .map((item) => {
      const url = `${base}/blog/${item.slug}`;
      const date = item.publishedAt ?? item.updatedAt;
      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${new Date(date).toUTCString()}</pubDate>`,
        item.excerpt ? `      <description>${escapeXml(item.excerpt)}</description>` : null,
        item.category ? `      <category>${escapeXml(item.category)}</category>` : null,
        item.authors.length > 0 ? `      <dc:creator>${escapeXml(item.authors.join(', '))}</dc:creator>` : null,
        '    </item>',
      ]
        .filter((line): line is string => line !== null)
        .join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    '    <title>Le blog Bento Pop</title>',
    `    <link>${escapeXml(`${base}/blog`)}</link>`,
    `    <atom:link href="${escapeXml(`${base}/blog/feed.xml`)}" rel="self" type="application/rss+xml"/>`,
    '    <description>Dossiers, critiques, actus et coulisses pop culture, écrits par la team Bento Pop.</description>',
    '    <language>fr-FR</language>',
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    entries,
    '  </channel>',
    '</rss>',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n')
    .concat('\n');
}
