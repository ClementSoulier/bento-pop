import { getThermometreContent } from '@/content/thermometre';
import { SectionHead } from '@/components/SectionHead';
import { loadCurrentVoteWeek, loadVoteCounts } from '@/lib/votes/loaders';
import { ThermometreClient } from './ThermometreClient';

export async function Thermometre() {
  const content = await getThermometreContent();
  const week = (await loadCurrentVoteWeek()) ?? content.fallback;
  const counts =
    (await loadVoteCounts(week.id)) ??
    Object.fromEntries(week.options.map((o) => [o.id, content.fallbackBaseCounts[o.id] ?? 0]));

  return (
    <section
      id="thermometre"
      className="bg-bento-ink px-7 py-[90px] text-bento-cream"
    >
      <div className="mx-auto max-w-[1320px]">
        <SectionHead
          eyebrow={content.eyebrow}
          title={content.title}
          description={content.description}
          tone="dark"
        />
        <ThermometreClient week={week} initialCounts={counts} closingNote={content.closingNote} />
      </div>
    </section>
  );
}
