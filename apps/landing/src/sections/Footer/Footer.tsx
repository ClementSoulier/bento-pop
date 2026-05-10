import Image from 'next/image';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { getFooter } from '@/content/footer';
import { SocialLinks } from './SocialLinks';
import { LegalLinks } from './LegalLinks';

export async function Footer() {
  const footer = await getFooter();
  return (
    <footer className="border-t-[5px] border-bento-ink bg-bento-ink px-7 pb-8 pt-20 text-bento-cream">
      <div className="mx-auto mb-12 grid max-w-[1180px] items-start gap-14 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <Image src={logo} alt="Bento Pop" className="mb-5 h-auto w-[140px]" />
          <p className="mb-2 max-w-[460px] text-[16px] leading-[1.55] text-bento-cream/85">
            Le talk-show pop culture qui parcourt la France. Cinéma, gaming,
            mangas et débats de société, en live depuis les plus grandes
            conventions.
          </p>
          <p className="text-[13px] leading-[1.55] text-bento-cream/55">
            Une production indépendante.
          </p>
        </div>
        <div>
          <h3 className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.25em] text-bento-yellow">
            {footer.socialsHeading}
          </h3>
          <SocialLinks socials={footer.socials} />
          <div className="text-[13px] leading-[1.6] text-bento-cream/75">
            {footer.contactLine} ·{' '}
            <a
              href={`mailto:${footer.contactEmail}`}
              className="underline underline-offset-[3px]"
            >
              {footer.contactEmail}
            </a>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3.5 border-t border-dashed border-bento-cream/25 pt-6 text-[12px] text-bento-cream/60">
        <div>{footer.copyright}</div>
        <LegalLinks links={footer.legalLinks} />
      </div>
    </footer>
  );
}
