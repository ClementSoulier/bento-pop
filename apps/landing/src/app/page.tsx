import { Nav } from '@/sections/Nav/Nav';
import { Hero } from '@/sections/Hero/Hero';
import { Agenda } from '@/sections/Agenda/Agenda';
import { Thermometre } from '@/sections/Thermometre/Thermometre';
import { Univers } from '@/sections/Univers/Univers';
import { Debriefs } from '@/sections/Debriefs/Debriefs';
import { Team } from '@/sections/Team/Team';
import { Footer } from '@/sections/Footer/Footer';
import { JsonLd } from '@/components/JsonLd';
import {
  tvSeriesSchema,
  podcastSeriesSchema,
  faqSchema,
} from '@/lib/seo/structured-data';

// Le contenu (équipe, hero TikTok, agenda, etc.) vient de Supabase et est édité
// via l'admin. On force un rendu dynamique pour éviter qu'un build sans accès
// Supabase ne fige le fallback statique pendant 1 an dans le cache Next.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <>
      <JsonLd data={[tvSeriesSchema(), podcastSeriesSchema(), faqSchema()]} />
      <Nav />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Agenda />
        <Thermometre />
        <Univers />
        <Debriefs />
        <Team />
      </main>
      <Footer />
    </>
  );
}
