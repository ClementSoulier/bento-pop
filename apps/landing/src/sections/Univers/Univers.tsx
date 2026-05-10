import { getUnivers } from '@/content/univers';
import { SectionHead } from '@/components/SectionHead';
import { BentoFrame } from '@/components/BentoFrame';
import { UniversCard } from './UniversCard';
import plateau05 from '@bento-pop/brand/assets/plateau/plateau-05.jpg';
import plateau02 from '@bento-pop/brand/assets/plateau/plateau-02.jpg';
import plateau03 from '@bento-pop/brand/assets/plateau/plateau-03.jpg';
import plateau01 from '@bento-pop/brand/assets/plateau/plateau-01.jpg';

/**
 * Photos plateau en backgrounds décoratifs des cartes Univers.
 * On en utilise 4 différentes pour varier visuellement, en évitant les mêmes
 * couples qu'en haut dans le hero (plateau-01..04 → tag cells).
 */
const UNIVERS_BACKGROUNDS = [plateau05.src, plateau02.src, plateau03.src, plateau01.src];

export async function Univers() {
  const { eyebrow, title, description, items } = await getUnivers();
  const sorted = [...items].sort((a, b) => a.order - b.order);
  return (
    <section id="univers" className="bg-bento-yellow px-7 py-[90px]">
      <div className="mx-auto max-w-[1320px]">
        <SectionHead eyebrow={eyebrow} title={title} description={description} />
        <BentoFrame className="mx-auto aspect-auto max-w-[1100px] lg:aspect-[1.4/1]">
          <div className="univers-grid grid h-full w-full gap-3">
            {sorted.map((item, i) => (
              <UniversCard
                key={item.id}
                item={item}
                featured={i === 0}
                photoPath={UNIVERS_BACKGROUNDS[i % UNIVERS_BACKGROUNDS.length]}
              />
            ))}
          </div>
        </BentoFrame>
      </div>
    </section>
  );
}
