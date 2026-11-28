import { SectionHead } from '@/components/SectionHead';
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup';

/**
 * Section « La newsletter » de l'accueil (docs/NEWSLETTER.md), juste avant le
 * pied de page. Fond crème entre la Team (jaune) et le footer (noir), pour
 * garder l'alternance des sections. Sur l'accueil, le footer n'affiche pas son
 * propre champ : deux formulaires à la suite feraient doublon.
 */
export function Newsletter() {
  return (
    <section
      id="newsletter"
      aria-labelledby="newsletter-titre"
      className="border-t-[5px] border-bento-ink bg-bento-cream px-7 py-[90px]"
    >
      <div className="mx-auto max-w-[1180px]">
        <SectionHead
          eyebrow="La newsletter"
          title={<span id="newsletter-titre">{'Rien ne\nt’échappe.'}</span>}
          description="Les nouveaux épisodes, les prochaines dates en convention et les coulisses de l’émission, directement dans ta boîte mail."
          className="!mb-10"
        />
        <NewsletterSignup source="home" variant="section" />
      </div>
    </section>
  );
}
