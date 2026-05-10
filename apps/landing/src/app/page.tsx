import { Nav } from '@/sections/Nav/Nav';
import { Hero } from '@/sections/Hero/Hero';
import { Agenda } from '@/sections/Agenda/Agenda';
import { Thermometre } from '@/sections/Thermometre/Thermometre';
import { Univers } from '@/sections/Univers/Univers';
import { Debriefs } from '@/sections/Debriefs/Debriefs';
import { Team } from '@/sections/Team/Team';
import { Footer } from '@/sections/Footer/Footer';

export default function Page() {
  return (
    <>
      <Nav />
      <main>
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
