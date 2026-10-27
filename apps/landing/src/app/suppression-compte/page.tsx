import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Supprimer mon compte Bento Pop',
  description:
    'Comment supprimer définitivement ton compte Bento Pop et toutes tes données depuis l’app mobile ou par email.',
  alternates: { canonical: '/suppression-compte' },
  robots: { index: true, follow: true },
};

export default function SuppressionComptePage() {
  return (
    <LegalPage
      eyebrow="Compte utilisateur"
      title={'Supprimer\nmon compte.'}
      updatedAt="27/10/2026"
    >
      <section>
        <h2>1. Depuis l’app mobile (recommandé)</h2>
        <p>
          La suppression de compte est intégrée à l’app, accessible en quelques
          tapes :
        </p>
        <ol>
          <li>
            Ouvre <strong>Mon Bento Pop</strong> sur ton téléphone.
          </li>
          <li>
            Va dans l’onglet <strong>Profil</strong> (icône en bas à droite),
            puis touche <strong>Réglages</strong> s’il apparaît en haut de
            l’écran.
          </li>
          <li>
            Fais défiler jusqu’à la section <strong>Compte</strong>.
          </li>
          <li>
            Touche <strong>Supprimer mon compte</strong>.
          </li>
          <li>
            Confirme dans la fenêtre qui apparaît. La suppression est{' '}
            <strong>immédiate et irréversible</strong>.
          </li>
        </ol>
      </section>

      <section>
        <h2>2. Par email (si l’app ne marche pas)</h2>
        <p>
          Si tu n’as plus accès à l’app (téléphone perdu, désinstallée, bug),
          écris-nous depuis l’adresse email qui garde ton compte, si tu
          l’as gardé, ou en précisant ton pseudo <code>@…</code>, à&nbsp;:
        </p>
        <p>
          <strong>
            <a href="mailto:contact@bento-pop.com?subject=Suppression%20de%20compte">
              contact@bento-pop.com
            </a>
          </strong>
        </p>
        <p>
          Nous traitons les demandes sous <strong>30 jours</strong> (délai
          maximum RGPD), en pratique en moins de 7 jours.
        </p>
      </section>

      <section>
        <h2>3. Ce qui est supprimé</h2>
        <p>
          La suppression efface définitivement, sans possibilité de
          récupération&nbsp;:
        </p>
        <ul>
          <li>
            Ton compte d’authentification : ton identifiant, et ton adresse
            email si tu as gardé ton compte.
          </li>
          <li>Ton pseudo (<code>@…</code>) et ton nom affiché.</li>
          <li>
            Tes bentos ainsi que toutes les cases que tu y as sélectionnées
            (films, séries, artistes, etc.).
          </li>
          <li>
            Tout ce que tu as écrit ou fait dans l’app : tes pourquoi, tes
            commentaires, tes j’aime, tes abonnements et tes abonnés, tes
            réseaux, tes succès, tes blocages, tes anciens pseudos, tes
            appareils de notification et les données techniques de tes
            lancements.
          </li>
          <li>
            L’URL publique <code>bento-pop.com/u/&lt;pseudo&gt;</code> renvoie
            une page « introuvable » immédiatement après suppression.
          </li>
        </ul>
        <p>
          Les <strong>signalements</strong> que tu aurais envoyés sur d’autres
          bentos sont conservés à des fins de modération, mais le lien vers ton
          identité est rompu (anonymisation immédiate). Ceux qui visent ton
          compte gardent ton pseudo et une copie du texte signalé jusqu’à un
          an après leur traitement. Les items que tu as proposés restent au
          catalogue, sans auteur.
        </p>
      </section>

      <section>
        <h2>4. Données conservées (et durée)</h2>
        <p>
          Pour des raisons légales ou de sécurité, certaines traces techniques
          peuvent être conservées de manière strictement limitée&nbsp;:
        </p>
        <ul>
          <li>
            <strong>Logs serveur</strong> (adresses IP, requêtes API) : 30 jours
            maximum, anonymisés au-delà.
          </li>
          <li>
            <strong>Journaux de la base de l’app</strong> : 1 jour. Elle
            n’a pas de sauvegarde automatique : rien d’autre n’y survit à la
            suppression que ce que dit cette page.
          </li>
          <li>
            <strong>Registre des suppressions</strong> : l’identifiant de ton
            compte supprimé, la date et le motif, sans pseudo ni nom, 12 mois.
          </li>
          <li>
            <strong>Journaux d’envoi des codes</strong> chez Resend, si tu
            as gardé ton compte : 30 jours.
          </li>
        </ul>
        <p>
          Mon Bento Pop ne collecte aucune donnée commerciale (téléphone,
          moyen de paiement) : l’app est intégralement gratuite. Une adresse
          email n’est collectée que si tu choisis de garder ton compte, pour
          t’envoyer les codes qui le retrouvent et, si l’équipe le supprimait,
          son motif ; elle part avec lui.
        </p>
      </section>

      <section>
        <h2>5. Une question ?</h2>
        <p>
          Pour toute question relative à tes données ou à l’exercice de tes
          droits RGPD (accès, rectification, opposition, portabilité), tu
          peux nous écrire à{' '}
          <a href="mailto:contact@bento-pop.com">contact@bento-pop.com</a>.
        </p>
        <p>
          Voir aussi notre{' '}
          <a href="/confidentialite">politique de confidentialité</a> complète.
        </p>
      </section>
    </LegalPage>
  );
}
