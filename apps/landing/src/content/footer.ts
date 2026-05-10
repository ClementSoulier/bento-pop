import { cache } from 'react';
import type { FooterContent, SocialLink } from '@/lib/content/schemas';
import { loadEnabledLinks, pickBySurface, pickByKind, type LinkRecord } from '@/lib/content/links';

const STATIC_FALLBACK: FooterContent = {
  socialsHeading: 'Suis-nous',
  socials: [
    { id: 'youtube',   platform: 'youtube',   href: 'https://www.youtube.com/@BentoPop.Officiel' },
    { id: 'instagram', platform: 'instagram', href: 'https://www.instagram.com/bento.pop.officiel/' },
    { id: 'x',         platform: 'x',         href: '#' },
    { id: 'tiktok',    platform: 'tiktok',    href: '#' },
  ],
  contactLine: 'Contact pro',
  contactEmail: 'contact@bento-pop.com',
  legalLinks: [
    { id: 'mentions', label: 'Mentions légales', href: '/mentions-legales' },
    { id: 'privacy',  label: 'Confidentialité',  href: '/confidentialite' },
  ],
  copyright: '© 2026 Bento Pop · Tous droits réservés',
};

const SOCIAL_KINDS = new Set<SocialLink['platform']>(['youtube', 'instagram', 'x', 'tiktok']);

function toSocialLink(record: LinkRecord): SocialLink | null {
  if (!SOCIAL_KINDS.has(record.kind as SocialLink['platform'])) return null;
  return {
    id: record.id,
    platform: record.kind as SocialLink['platform'],
    href: record.url || '#',
  };
}

export const getFooter = cache(async (): Promise<FooterContent> => {
  const links = await loadEnabledLinks();
  if (!links) return STATIC_FALLBACK;

  const socials = pickBySurface(links, 'social')
    .map(toSocialLink)
    .filter((s): s is SocialLink => s !== null);

  const contact = pickByKind(links, 'mail');

  return {
    ...STATIC_FALLBACK,
    socials: socials.length > 0 ? socials : STATIC_FALLBACK.socials,
    contactEmail: contact?.url || STATIC_FALLBACK.contactEmail,
  };
});
