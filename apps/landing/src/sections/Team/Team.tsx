import { getTeam } from '@/content/team';
import { SectionHead } from '@/components/SectionHead';
import { Polaroid } from './Polaroid';

export async function Team() {
  const { eyebrow, title, members, quote } = await getTeam();
  const sorted = [...members].sort((a, b) => a.order - b.order);
  return (
    <section id="team" className="bg-bento-yellow px-7 py-[90px]">
      <div className="mx-auto max-w-[1320px]">
        <SectionHead eyebrow={eyebrow} title={title} />
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-7 lg:grid-cols-4">
          {sorted.map((member) => (
            <Polaroid key={member.id} member={member} />
          ))}
        </div>
        <p className="team-quote mx-auto mt-14 max-w-[780px] text-center text-[19px] italic leading-[1.5] text-bento-ink/80 text-pretty">
          {quote}
        </p>
      </div>
    </section>
  );
}
