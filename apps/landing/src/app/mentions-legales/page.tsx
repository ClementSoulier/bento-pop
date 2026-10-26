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
      updatedAt="26/10/2026"
    >
      <section>
        <h2>1. Éditeur du site et de l&apos;application</h2>
        <p>
          Le site <strong>bento-pop.com</strong> et l&apos;application mobile{' '}
          <strong>Mon Bento Pop</strong> (iOS / Android) sont édités par&nbsp;:
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
          Le site et l&apos;application peuvent contenir des liens vers des
          sites tiers (YouTube, Spotify, TikTok, Instagram…). Liventure SAS
          n&apos;exerce aucun contrôle sur ces sites et décline toute
          responsabilité quant à leur contenu, leur disponibilité ou leur
          politique de confidentialité.
        </p>
      </section>

      <section>
        <h2>6. Application mobile « Mon Bento Pop »</h2>
        <p>
          L&apos;application est distribuée sur l&apos;App Store (Apple) et le
          Play Store (Google). Elle est gratuite, sans achat in-app, sans
          publicité, et conçue à des fins de divertissement culturel.
        </p>
        <p>
          <strong>Règles de la communauté</strong> : l&apos;application
          accueille des pseudonymes, des bentos, le pourquoi de leurs cases et
          des commentaires. Tolérance
          zéro pour les contenus haineux, racistes, sexistes, homophobes,
          transphobes, validistes ou discriminatoires ; le harcèlement, les
          insultes et les menaces ; les contenus illégaux, sexuels non
          consentis ou promouvant la violence ; l&apos;usurpation
          d&apos;identité, le spam, les arnaques et la divulgation
          d&apos;informations personnelles.
        </p>
        <p>
          <strong>Modération</strong> : un filtre refuse avant publication les
          injures d&apos;une liste et les liens. Tout bento, pourquoi,
          commentaire ou compte contraire à ces règles, aux droits
          d&apos;autrui ou à l&apos;ordre public peut être signalé via le
          bouton <em>« Signaler »</em> de l&apos;application, ou par le lien{' '}
          <em>« Signaler ce bento »</em> de sa page sur ce site ; notre équipe
          examine les signalements sous 24 heures. Elle peut masquer un
          pourquoi ou un commentaire, dont l&apos;auteur voit alors le motif,
          et supprimer un compte qui enfreint ces règles ; s&apos;il a gardé
          son compte, le motif lui est envoyé à son adresse. Toute décision se conteste en écrivant à{' '}
          <a href="mailto:contact@bento-pop.com">contact@bento-pop.com</a>.
        </p>
        <p>
          <strong>Se protéger</strong> : chaque utilisateur peut bloquer un
          compte, qui ne peut alors plus commenter ni aimer ses bentos,
          refuser les commentaires sur ses bentos, ou y masquer les
          j&apos;aime.
        </p>
        <p>
          <strong>Sources de données</strong> : films/séries via{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
            The Movie Database (TMDb)
          </a>{' '}
          (non endossé par TMDb) ; musique via{' '}
          <a href="https://musicbrainz.org/" target="_blank" rel="noopener noreferrer">
            MusicBrainz
          </a>{' '}
          (CC-BY-NC-SA) ; lieux via{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            © OpenStreetMap contributors
          </a>{' '}
          ; créateurs via{' '}
          <a href="https://www.wikidata.org/" target="_blank" rel="noopener noreferrer">
            Wikidata
          </a>{' '}
          (CC0).
        </p>
      </section>

      <section>
        <h2>7. Contact</h2>
        <p>
          Pour toute question relative au site, à l&apos;application ou à
          leurs contenus, vous pouvez contacter l&apos;éditeur à
          l&apos;adresse{' '}
          <a href="mailto:contact@bento-pop.com">contact@bento-pop.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
