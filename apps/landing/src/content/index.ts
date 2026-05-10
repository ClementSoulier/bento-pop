import type { LandingContent } from '@/lib/content/schemas';
import { getNav, getNavCta } from './nav';
import { getHero } from './hero';
import { getAgenda } from './agenda';
import { getThermometreContent } from './thermometre';
import { getUnivers } from './univers';
import { getDebriefs } from './debriefs';
import { getTeam } from './team';
import { getFooter } from './footer';

export {
  getNav,
  getNavCta,
  getHero,
  getAgenda,
  getThermometreContent,
  getUnivers,
  getDebriefs,
  getTeam,
  getFooter,
};

/**
 * Charge tout le contenu de la landing en parallèle.
 * Utile pour des routes qui en ont besoin d'un seul coup (ex: opengraph-image).
 */
export async function getLandingContent(): Promise<LandingContent> {
  const [nav, navCta, hero, agenda, thermometre, univers, debriefs, team, footer] = await Promise.all([
    getNav(),
    getNavCta(),
    getHero(),
    getAgenda(),
    getThermometreContent(),
    getUnivers(),
    getDebriefs(),
    getTeam(),
    getFooter(),
  ]);
  return { nav, navCta, hero, agenda, thermometre, univers, debriefs, team, footer };
}
