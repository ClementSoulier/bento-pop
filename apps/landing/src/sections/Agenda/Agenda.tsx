import { getAgenda } from '@/content/agenda';
import { SectionHead } from '@/components/SectionHead';
import { AgendaRow } from './AgendaRow';

export async function Agenda() {
  const { eyebrow, title, description, events } = await getAgenda();
  const sorted = [...events].sort((a, b) => a.order - b.order);
  return (
    <section
      id="agenda"
      className="border-y-[5px] border-bento-ink bg-bento-cream px-7 py-[90px]"
    >
      <div className="mx-auto max-w-[1320px]">
        <SectionHead eyebrow={eyebrow} title={title} description={description} />
        <div className="mx-auto flex max-w-[920px] flex-col gap-4">
          {sorted.map((event) => (
            <AgendaRow key={event.id} event={event} />
          ))}
        </div>
      </div>
    </section>
  );
}
