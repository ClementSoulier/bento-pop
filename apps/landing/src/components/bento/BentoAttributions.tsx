import { CATEGORY_META, CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import type { BentoSlots } from '@/lib/bento/map';
import { cleanTitle } from '@/lib/bento/text';

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
 */
export function BentoAttributions({ slots }: { slots: BentoSlots }) {
  const credits = CATEGORY_ORDER.map((category) => {
    const tile = slots[category];
    if (!tile?.imageCredit) return null;
    return { category, title: cleanTitle(tile.title), credit: tile.imageCredit };
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (credits.length === 0) return null;

  return (
    <section
      aria-labelledby="bento-attributions"
      className="mx-auto mt-8 w-full max-w-[420px] lg:max-w-[940px]"
    >
      <h2
        id="bento-attributions"
        className="font-display-sm text-[10px] tracking-[0.18em] text-bento-ink/70"
      >
        Crédits images
      </h2>
      <ul className="mt-2 space-y-1">
        {credits.map(({ category, title, credit }) => (
          <li key={category} className="text-[11px] leading-[1.45] text-bento-ink/70">
            <span className="font-semibold text-bento-ink/85">
              {CATEGORY_META[category].label} · {title}
            </span>{' '}
            {credit}
          </li>
        ))}
      </ul>
    </section>
  );
}
