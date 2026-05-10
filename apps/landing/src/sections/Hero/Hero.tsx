import { getHero } from '@/content/hero';
import { Eyebrow } from '@/components/Eyebrow';
import { StampLink } from '@/components/StampButton';
import { iconRegistry, type IconKey } from '@/components/icons';
import { FloatingPopy } from './FloatingPopy';
import { HeroBento } from './HeroBento';

export async function Hero() {
  const hero = await getHero();
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-bento-yellow px-7 py-[90px]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.4), transparent 40%),' +
          'radial-gradient(circle at 80% 90%, rgba(217,119,6,0.25), transparent 50%)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(var(--bento-ink) 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px',
        }}
      />
      {hero.floatingPopys.map((popy) => (
        <FloatingPopy key={popy.id} config={popy} />
      ))}
      <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 pt-10 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <h1 className="font-display my-4 text-[clamp(48px,7vw,96px)]">
            {hero.headline.prefix}
            <span className="inline-block text-bento-red" style={{ transform: 'rotate(-2deg)' }}>
              {hero.headline.accent}
            </span>
            {hero.headline.suffix}
          </h1>
          <p
            className="mb-7 max-w-[540px] text-[19px] leading-[1.5] text-bento-ink/85 [&>strong]:inline-block [&>strong]:-translate-y-px [&>strong]:rounded-md [&>strong]:border-2 [&>strong]:border-bento-ink [&>strong]:bg-bento-cream [&>strong]:px-2 [&>strong]:py-px [&>strong]:shadow-[0_2px_0_var(--bento-ink)]"
            dangerouslySetInnerHTML={{ __html: hero.lead.html }}
          />
          <div className="flex flex-wrap gap-3.5">
            {hero.ctas.map((cta) => {
              const Icon = cta.iconKey ? iconRegistry[cta.iconKey as IconKey] : null;
              return (
                <StampLink
                  key={cta.label}
                  href={cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant={cta.variant}
                  size={cta.size ?? 'lg'}
                  iconLeft={Icon ? <Icon width={18} height={18} /> : null}
                >
                  {cta.label}
                </StampLink>
              );
            })}
          </div>
        </div>
        <HeroBento hero={hero} />
      </div>
    </section>
  );
}
