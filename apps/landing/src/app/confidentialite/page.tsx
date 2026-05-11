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
      updatedAt="11/05/2026"
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

        <h3>2.1 Site web bento-pop.com</h3>
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

        <h3>2.2 Application mobile « Mon Bento Pop »</h3>
        <p>
          L&apos;application iOS / Android collecte les données suivantes&nbsp;:
        </p>
        <ul>
          <li>
            <strong>Identifiant anonyme</strong> : un UUID généré automatiquement
            au premier lancement, persisté dans le stockage sécurisé de
            l&apos;appareil. Sert de clé pour relier l&apos;utilisateur à son
            bento. Aucune information personnelle (nom réel, email, téléphone)
            n&apos;y est associée.
          </li>
          <li>
            <strong>Pseudonyme</strong> : choisi par l&apos;utilisateur à
            l&apos;onboarding (3 à 20 caractères alphanumériques). Visible
            publiquement sur le bento partagé.
          </li>
          <li>
            <strong>Nom d&apos;affichage</strong> (facultatif) : si renseigné par
            l&apos;utilisateur.
          </li>
          <li>
            <strong>Composition du bento</strong> : les films, séries, artistes,
            chansons, créateurs et lieux que l&apos;utilisateur a choisis dans
            son bento, ainsi que la date de publication. Visible publiquement.
          </li>
          <li>
            <strong>Signalements</strong> (table <code>reports</code>) : si
            l&apos;utilisateur signale un bento ou un pseudo, le motif éventuel
            est conservé pour la modération. Le signalement est lié à
            l&apos;identifiant anonyme du signaleur (jamais visible
            publiquement).
          </li>
          <li>
            <strong>Logs Supabase</strong> : adresses IP et user-agent des
            requêtes API, conservés ~7 jours par Supabase à des fins de sécurité
            et diagnostic.
          </li>
        </ul>
        <p>
          L&apos;application <strong>ne collecte ni email, ni téléphone, ni
          adresse réelle, ni identifiant publicitaire (IDFA / GAID).</strong>
          Aucun SDK de tracking tiers (Google Analytics, Meta SDK, Firebase
          Analytics…) n&apos;est intégré.
        </p>

        <h3>2.3 Sources de données externes</h3>
        <p>
          Lorsque l&apos;utilisateur recherche un film, une série, un artiste,
          un lieu ou un créateur de contenu, l&apos;app interroge en temps réel
          les APIs publiques de&nbsp;:
        </p>
        <ul>
          <li><strong>The Movie Database (TMDb)</strong> pour les films et séries</li>
          <li><strong>MusicBrainz</strong> pour les artistes et chansons</li>
          <li><strong>OpenStreetMap (Nominatim)</strong> pour les lieux de voyage</li>
          <li><strong>Wikidata</strong> pour les créateurs de contenu</li>
        </ul>
        <p>
          Ces APIs reçoivent uniquement le terme recherché et l&apos;adresse IP
          publique de l&apos;utilisateur (logs standards), conformément à leurs
          propres politiques.
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
            <strong>Identifiant anonyme app</strong> : authentification
            technique permettant la persistance du bento (intérêt légitime).
          </li>
          <li>
            <strong>Pseudonyme + composition de bento</strong> : exécution du
            service de partage culturel (consentement, recueilli à
            l&apos;onboarding et révocable à tout moment via la suppression de
            compte).
          </li>
          <li>
            <strong>Signalements</strong> : modération des contenus
            utilisateurs (intérêt légitime — obligation Apple App Store
            guideline 1.2).
          </li>
          <li>
            <strong>Logs serveur</strong> : sécurité et diagnostic (intérêt
            légitime).
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Durée de conservation</h2>
        <ul>
          <li>Cookie <code>bp_anon_id</code> : 1 an (puis renouvellement).</li>
          <li>Votes anonymes en base : durée de la saison en cours, puis
            anonymisés à la clôture de la semaine concernée.</li>
          <li>
            <strong>Données utilisateur app mobile</strong> (pseudo, bento,
            composition) : conservées tant que l&apos;utilisateur n&apos;a pas
            supprimé son compte depuis l&apos;app. Suppression définitive
            immédiate (cascade sur l&apos;ensemble des données liées) sur
            demande via le bouton <em>« Supprimer mon compte »</em> de la tab
            Profil.
          </li>
          <li>
            <strong>Signalements</strong> : 1 an après traitement par
            l&apos;équipe modération, puis anonymisation du
            <code>reporter_id</code>.
          </li>
          <li>Logs serveur : 30 jours.</li>
          <li>Logs Supabase API : 7 jours.</li>
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
            <strong>Supabase Inc.</strong> (Singapour, instance UE) — bases de
            données PostgreSQL (deux projets distincts : un pour la landing /
            BO, un dédié à l&apos;app mobile).
          </li>
          <li>
            <strong>Apple Inc.</strong> et <strong>Google LLC</strong> — pour
            les utilisateurs ayant téléchargé l&apos;app via App Store ou
            Play Store, ces plateformes reçoivent les données techniques liées
            à l&apos;installation (identifiants techniques de leurs propres
            services, gérés selon leurs CGU respectives).
          </li>
        </ul>
        <p>
          Aucune donnée n&apos;est transmise à des tiers à des fins commerciales
          ou publicitaires. Aucun SDK de tracking ni régie publicitaire
          n&apos;est intégré dans l&apos;app ou le site.
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
          <strong>Pour les utilisateurs de l&apos;app mobile</strong> : le droit
          à l&apos;effacement est directement accessible depuis la tab Profil
          → <em>« Supprimer mon compte »</em>. La suppression est immédiate et
          définitive (cascade automatique sur toutes les données liées :
          pseudo, bento, composition).
        </p>
        <p>
          Pour exercer les autres droits, contactez-nous à{' '}
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
