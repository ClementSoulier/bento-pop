import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Politique de confidentialité de bento-pop.com — données collectées, finalités, droits des utilisateurs.',
  alternates: { canonical: '/confidentialite' },
  robots: { index: true, follow: true },
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      eyebrow="Données personnelles"
      title="Politique de confidentialité"
      updatedAt="10/05/2026"
    >
      <section>
        <h2>1. Responsable du traitement</h2>
        <p>
          Le responsable du traitement des données personnelles collectées sur{' '}
          <strong>bento-pop.com</strong> est&nbsp;:
        </p>
        <ul>
          <li>Liventure SAS</li>
          <li>9 rue des Chênes, 72 300 Souvigné-sur-Sarthe</li>
          <li>
            Contact :{' '}
            <a href="mailto:contact@bento-pop.com">contact@bento-pop.com</a>
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Données collectées</h2>
        <p>
          Le site collecte les données suivantes&nbsp;:
        </p>
        <ul>
          <li>
            <strong>Vote hebdomadaire</strong> : un identifiant anonyme aléatoire
            (UUID) stocké dans un cookie technique <code>bp_anon_id</code>{' '}
            (durée 1 an, httpOnly), pour empêcher qu&apos;un même navigateur vote
            plusieurs fois sur la même semaine. Aucune donnée personnelle (nom,
            email, IP) n&apos;est associée à ce vote.
          </li>
          <li>
            <strong>Cookies techniques d&apos;authentification</strong>{' '}
            (uniquement sur le backoffice <code>admin.bento-pop.com</code>) : pour
            maintenir la session des administrateurs connectés.
          </li>
          <li>
            <strong>Logs serveur</strong> : adresse IP, user-agent et URL
            consultée, conservés temporairement par OVH à des fins de sécurité
            et de diagnostic technique.
          </li>
        </ul>
        <p>
          Le site <strong>n&apos;utilise pas</strong> d&apos;outil de tracking
          publicitaire ni d&apos;analytics tiers (Google Analytics, Meta
          Pixel…).
        </p>
      </section>

      <section>
        <h2>3. Finalités &amp; bases légales</h2>
        <ul>
          <li>
            <strong>Cookie anonyme de vote</strong> : empêcher la fraude au vote
            (intérêt légitime).
          </li>
          <li>
            <strong>Cookies de session admin</strong> : exécution du contrat de
            mise à disposition du backoffice (intérêt légitime).
          </li>
          <li>
            <strong>Logs serveur</strong> : sécurité du site et diagnostic
            (intérêt légitime).
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Durée de conservation</h2>
        <ul>
          <li>Cookie <code>bp_anon_id</code> : 1 an (puis renouvellement).</li>
          <li>Votes anonymes en base : durée de la saison en cours, puis
            anonymisés à la clôture de la semaine concernée.</li>
          <li>Logs serveur : 30J.</li>
        </ul>
      </section>

      <section>
        <h2>5. Destinataires des données</h2>
        <p>
          Les données techniques sont uniquement traitées par&nbsp;:
        </p>
        <ul>
          <li>
            <strong>OVH SAS</strong> (Roubaix, France) — hébergement front-end,
            traitement intégralement réalisé en Union européenne.
          </li>
          <li>
            <strong>Supabase Inc.</strong> (Singapour, instance UE) — base de
            données PostgreSQL.
          </li>
        </ul>
        <p>
          Aucune donnée n&apos;est transmise à des tiers à des fins commerciales
          ou publicitaires.
        </p>
      </section>

      <section>
        <h2>6. Vos droits</h2>
        <p>
          Conformément au Règlement Général sur la Protection des Données
          (RGPD) et à la loi Informatique et Libertés, vous disposez des droits
          suivants&nbsp;:
        </p>
        <ul>
          <li>droit d&apos;accès à vos données ;</li>
          <li>droit de rectification ;</li>
          <li>droit à l&apos;effacement (« droit à l&apos;oubli ») ;</li>
          <li>droit à la limitation du traitement ;</li>
          <li>droit d&apos;opposition ;</li>
          <li>droit à la portabilité.</li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous à{' '}
          <a href="mailto:contact@bento-pop.com">contact@bento-pop.com</a>. Une
          réponse vous sera apportée dans un délai maximal d&apos;un mois.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la CNIL —{' '}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
            cnil.fr
          </a>
          .
        </p>
      </section>

      <section>
        <h2>7. Cookies tiers (lecteurs YouTube, Spotify, TikTok)</h2>
        <p>
          La page d&apos;accueil intègre des lecteurs YouTube, Spotify et TikTok.
          Ces lecteurs déposent leurs propres cookies (préférences de lecture,
          mesure d&apos;audience YouTube/Spotify/TikTok). Pour le lecteur
          YouTube, nous utilisons le domaine{' '}
          <code>youtube-nocookie.com</code> qui ne dépose pas de cookie tant que
          la vidéo n&apos;est pas lancée.
        </p>
        <p>
          Vous pouvez gérer ces cookies tiers via les paramètres de votre
          navigateur, ou refuser le chargement de ces lecteurs en activant un
          bloqueur (par ex. uBlock Origin).
        </p>
      </section>
    </LegalPage>
  );
}
