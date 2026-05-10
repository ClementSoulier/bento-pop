import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Le backoffice vit sur le sous-domaine `admin.bento-pop.com` (pas sur
        // cette landing), mais on bloque par précaution `/api/` et `/admin/`
        // au cas où un rewrite/proxy les exposerait un jour ici.
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
