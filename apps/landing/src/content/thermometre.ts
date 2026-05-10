import type { ThermometreContent } from '@/lib/content/schemas';

/**
 * Contenu *statique* du Thermomètre.
 *
 * Le `fallback` est utilisé si la table `landing_vote_weeks` est inaccessible
 * ou vide (env Supabase manquante en dev, etc.). En prod, c'est la ligne avec
 * `is_current = true` qui pilote l'affichage.
 *
 * `fallbackBaseCounts` reproduit les compteurs de la maquette (~880 votes
 * cumulés) pour ne pas afficher 0% quand le seed Supabase n'a pas tourné.
 */
export async function getThermometreContent(): Promise<ThermometreContent> {
  return {
    eyebrow: 'Le Thermomètre Pop Culture',
    title: 'Vote de la semaine',
    description: "On débriefe vos votes en plateau. Plus c'est chaud, plus on en parle.",
    closingNote: 'clôture jeudi 18h',
    fallback: {
      id: 'week-19-fallback',
      weekTag: 'Vote · Semaine 19',
      question: 'Quel jeu mérite le titre de GOTY 2026 ?',
      options: [
        { id: 'gta', label: 'GTA VI' },
        { id: 'sc', label: 'Star Citizen 1.0' },
        { id: 'ds', label: 'Death Stranding 2' },
        { id: 'mh', label: 'Monster Hunter Wilds' },
      ],
      closesAt: '2026-05-14T18:00:00+02:00',
    },
    fallbackBaseCounts: {
      gta: 312,
      sc: 188,
      ds: 246,
      mh: 134,
    },
  };
}
