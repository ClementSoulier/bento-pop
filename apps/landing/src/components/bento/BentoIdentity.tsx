import Image from 'next/image';
import { popyForPseudo } from '@/lib/bento/popy';

/**
 * En-tête d'identité : avatar Popy, pseudo, nom affiché, date de
 * publication, et le cas échéant la distinction « à la une ».
 *
 * Le pseudo porte le `<h1>` de la page. Un seul par document, et il dit
 * exactement ce que le visiteur est venu voir.
 */
export function BentoIdentity({
  pseudo,
  displayName,
  publishedAt,
  isFeatured = false,
  subtitle,
}: {
  pseudo: string;
  displayName?: string | null;
  publishedAt?: string;
  isFeatured?: boolean;
  /** Remplace la ligne de date, pour l'état « pas encore terminé ». */
  subtitle?: string;
}) {
  const popy = popyForPseudo(pseudo);

  return (
    <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
      <div className="relative">
        {/* Le Popy est inséré dans le cercle plutôt que collé au bord :
            les visuels remplissent tout leur cadre, et sans cette marge le
            masque rond leur coupe le haut de la tête. L'app applique le
            même retrait (image de 110 dans un cercle de 130). */}
        <span className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full border-[4px] border-bento-ink bg-white shadow-stamp">
          <Image src={popy} alt="" width={64} height={64} priority className="h-16 w-16 object-contain" />
        </span>
        {isFeatured ? (
          /* Le libellé est porté par du texte, pas seulement par l'étoile
             et sa couleur : une information ne doit jamais dépendre de la
             seule couleur, ni d'un pictogramme sans équivalent textuel. */
          <span className="absolute -bottom-1 -right-1 inline-flex items-center gap-1 rounded-full border-[2.5px] border-bento-ink bg-bento-red px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-bento-cream">
            <span aria-hidden>★</span> À la une
          </span>
        ) : null}
      </div>

      <h1 className="font-display mt-4 text-[clamp(30px,7vw,44px)] text-bento-ink">
        @{pseudo}
      </h1>

      <p className="mt-1 text-[14px] leading-[1.5] text-bento-ink/70">
        {displayName ? <span className="font-semibold">{displayName}</span> : null}
        {displayName && (subtitle || publishedAt) ? ' · ' : null}
        {subtitle ??
          (publishedAt ? (
            <>
              publié le{' '}
              <time dateTime={publishedAt}>{formatPublishedDate(publishedAt)}</time>
            </>
          ) : null)}
      </p>
    </div>
  );
}

/**
 * « 15 mai 2026 ». En UTC pour que le rendu du serveur et celui du client
 * soient identiques : sans fuseau explicite, une page pré-rendue à Paris et
 * réhydratée ailleurs peut afficher deux dates différentes et déclencher
 * une erreur d'hydratation.
 */
function formatPublishedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
