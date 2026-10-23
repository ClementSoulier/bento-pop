/**
 * Compte la visite d'une page de bento, sans JavaScript. Chantier 8.
 *
 * Une image d'un pixel, invisible, servie par `/api/bento-opened` : le
 * navigateur la demande en affichant la page, à l'ouverture d'un lien comme à
 * une navigation interne, et la route compte la visite. Composant serveur :
 * la page d'un bento n'expédie aucun JavaScript qui lui soit propre, cf.
 * `e2e/smoke.test.ts`. Les robots d'aperçu ne lisent que le HTML, et
 * `robots.txt` ferme `/api/` aux moteurs.
 */
export function VisitBeacon({ bentoId }: { bentoId: string }) {
  return (
    // Un pixel de comptage, pas une image à optimiser : `next/image` le
    // réécrirait vers son optimiseur, qui ne le transmettrait pas à la route.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/bento-opened?b=${encodeURIComponent(bentoId)}`}
      alt=""
      aria-hidden
      width={1}
      height={1}
      decoding="async"
      className="pointer-events-none absolute h-px w-px opacity-0"
    />
  );
}
