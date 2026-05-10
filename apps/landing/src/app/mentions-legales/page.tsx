import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales du site bento-pop.com — éditeur, hébergeur, contact.',
  alternates: { canonical: '/mentions-legales' },
  robots: { index: true, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      eyebrow="Information légale"
      title="Mentions légales"
      updatedAt="10/05/2026"
    >
      <section>
        <h2>1. Éditeur du site</h2>
        <p>
          Le site <strong>bento-pop.com</strong> est édité par&nbsp;:
        </p>
        <ul>
          <li>
            <strong>Raison sociale</strong> : Liventure
          </li>
          <li>
            <strong>Forme juridique</strong> : SAS
          </li>
          <li>
            <strong>Capital social</strong> : 4 000€
          </li>
          <li>
            <strong>Siège social</strong> : 9 rue des Chênes, 72 300 Souvigné-sur-Sarthe
          </li>
          <li>
            <strong>RCS / SIREN</strong> : 992 458 091
          </li>
          <li>
            <strong>N° TVA intracommunautaire</strong> : FR25992458091
          </li>
          <li>
            <strong>Email</strong> :{' '}
            <a href="mailto:contact@bento-pop.com">contact@bento-pop.com</a>
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Directeur de la publication</h2>
        <p>
          Directeur / directrice de la publication : Clément SOULIER
          {' '}— joignable par email à{' '}
          <a href="mailto:contact@bento-pop.com">contact@bento-pop.com</a>.
        </p>
      </section>

      <section>
        <h2>3. Hébergeur</h2>
        <p>
          Le site est hébergé par&nbsp;:
        </p>
        <ul>
          <li>
            <strong>Front-end</strong> : OVH 2 rue Kellermann 59 100 Roubaix
          </li>
          <li>
            <strong>Base de données &amp; stockage</strong> : Supabase Inc., 970
            Toa Payoh North #07-04, Singapore 318992 —{' '}
            <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a>
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble des contenus présents sur ce site (textes, illustrations,
          logo Bento Pop, mascottes Popy, photos de plateau, vidéos, code source)
          est la propriété exclusive de Liventure SAS ou de ses
          ayants droit, et est protégé par le droit français et international de
          la propriété intellectuelle.
        </p>
        <p>
          Toute reproduction, représentation ou diffusion, totale ou partielle,
          sans autorisation écrite préalable est interdite et constituerait une
          contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de
          la propriété intellectuelle.
        </p>
      </section>

      <section>
        <h2>5. Liens externes</h2>
        <p>
          Le site peut contenir des liens vers des sites tiers (YouTube, Spotify,
          TikTok, Instagram…). Liventure SAS n&apos;exerce aucun
          contrôle sur ces sites et décline toute responsabilité quant à leur
          contenu, leur disponibilité ou leur politique de confidentialité.
        </p>
      </section>

      <section>
        <h2>6. Contact</h2>
        <p>
          Pour toute question relative au site ou à ses contenus, vous pouvez
          contacter l&apos;éditeur à l&apos;adresse{' '}
          <a href="mailto:contact@bento-pop.com">contact@bento-pop.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
