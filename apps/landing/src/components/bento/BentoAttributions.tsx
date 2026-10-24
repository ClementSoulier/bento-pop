import { creditLabel } from '@/lib/bento/others';
import { cleanTitle } from '@/lib/bento/text';
import type { PublicCase } from './cases';

/**
 * Attributions des illustrations, rendues en clair sous la boîte.
 *
 * **Pourquoi pas sur le compartiment, comme dans l'app.** Relevé sur les
 * 199 items illustrés du catalogue : un crédit fait 46 caractères en
 * médiane et jusqu'à 167 (« Photo : Images by Eddie, Thomas Steffan… (CC
 * BY-SA 4.0), via Wikimedia Commons »). Un compartiment de la troisième
 * rangée fait environ 101 points de large. Y loger le crédit revient à
 * afficher « Affi… », ce qui ne remplit ni l'obligation d'attribution
 * CC-BY-SA, ni les conditions TMDb, ni aucun besoin réel du lecteur. La
 * première version le vérifiait à l'écran : la pastille recouvrait le
 * titre sur les petits compartiments.
 *
 * En le sortant de la boîte, l'attribution devient réellement lisible, le
 * contraste est respecté sans artifice, et le compartiment retrouve la
 * place de son titre. C'est un écart assumé avec l'app, justifié par le
 * fait qu'une page web a de la place sous la ligne de flottaison, pas un
 * écran de téléphone.
 *
 * **Les cases du bento, et non les six catégories** (chantier 21) : une case
 * d'édition n'a pas de catégorie, et ses images restaient sans crédit. Pour
 * un bento principal, le rendu ne change pas. Sous chaque bento de la liste
 * d'un compte, les mêmes crédits, sous leur propre titre.
 */
export function BentoAttributions({
  cases,
  headingId = 'bento-attributions',
  headingLevel: Heading = 'h2',
  className = 'mx-auto mt-8 w-full max-w-[420px] lg:max-w-[940px]',
}: {
  cases: readonly PublicCase[];
  /** Unique dans la page : la liste en rend un par bento. */
  headingId?: string;
  /** Sous le titre d'un bento de la liste, un niveau de plus que lui. */
  headingLevel?: 'h2' | 'h4';
  className?: string;
}) {
  const credits = cases
    .map((meta) => {
      const tile = meta.tile;
      if (!tile?.imageCredit) return null;
      return { key: meta.key, label: creditLabel(meta), title: cleanTitle(tile.title), credit: tile.imageCredit };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (credits.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={className}>
      <Heading
        id={headingId}
        className="font-display-sm text-[10px] tracking-[0.18em] text-bento-ink/70"
      >
        Crédits images
      </Heading>
      <ul className="mt-2 space-y-1">
        {credits.map(({ key, label, title, credit }) => (
          <li key={key} className="text-[11px] leading-[1.45] text-bento-ink/70">
            <span className="font-semibold text-bento-ink/85">
              {label} · {title}
            </span>{' '}
            {credit}
          </li>
        ))}
      </ul>
    </section>
  );
}
