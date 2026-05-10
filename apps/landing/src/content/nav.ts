import { cache } from 'react';
import type { NavCta, NavLink } from '@/lib/content/schemas';
import { loadCtas } from '@/lib/content/ctas';

const STATIC_NAV_CTA: NavCta = {
  label: "Voir l'émission",
  href: 'https://www.youtube.com/@BentoPop.Officiel',
  iconKey: 'youtube',
};

/**
 * Liens vers les sections de la home. On préfixe par `/` pour que les liens
 * fonctionnent depuis n'importe quelle page (mentions légales, confidentialité…)
 * en redirigeant vers la home avec l'ancre cible. Sur la home elle-même,
 * Next.js fait juste un scroll vers l'ancre, sans full reload.
 */
export async function getNav(): Promise<NavLink[]> {
  return [
    { id: 'agenda',       label: 'Agenda',         href: '/#agenda' },
    { id: 'thermometre',  label: 'Le Thermomètre', href: '/#thermometre' },
    { id: 'univers',      label: 'Les Univers',    href: '/#univers' },
    { id: 'debriefs',     label: 'Podcast',        href: '/#debriefs' },
    { id: 'team',         label: 'La Team',        href: '/#team' },
  ];
}

/**
 * Le CTA principal de la nav (en haut à droite) suit le CTA primary du hero —
 * c'est le même bouton « Regarder l'émission ». Si le BO ne renvoie rien,
 * fallback statique.
 */
export const getNavCta = cache(async (): Promise<NavCta> => {
  const ctas = await loadCtas();
  const primary = ctas?.primary;
  if (!primary) return STATIC_NAV_CTA;
  return {
    label: 'Voir l\'émission',
    href: primary.url,
    iconKey: 'youtube',
  };
});
