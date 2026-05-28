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
      updatedAt="28/05/2026"
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
            Va dans l’onglet <strong>Profil</strong> (icône en bas à droite).
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
          écris-nous depuis l’adresse email associée à ton compte — ou en
          précisant ton pseudo <code>@…</code> — à&nbsp;:
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
          <li>Ton compte d’authentification (identifiant anonyme).</li>
          <li>Ton pseudo (<code>@…</code>) et ton nom affiché.</li>
          <li>
            Ton bento publié ainsi que toutes les cases que tu y as
            sélectionnées (films, séries, artistes, etc.).
          </li>
          <li>
            L’URL publique <code>bento-pop.com/u/&lt;pseudo&gt;</code> renvoie
            une page « introuvable » immédiatement après suppression.
          </li>
        </ul>
        <p>
          Les <strong>signalements</strong> que tu aurais envoyés sur d’autres
          bentos sont conservés à des fins de modération, mais le lien vers ton
          identité est rompu (anonymisation immédiate).
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
            <strong>Sauvegardes chiffrées</strong> de la base de données : 30
            jours glissants, après quoi les données supprimées sortent
            définitivement du système.
          </li>
        </ul>
        <p>
          Aucune donnée commerciale (email, téléphone, moyen de paiement)
          n’est jamais collectée par Mon Bento Pop, l’app est intégralement
          gratuite et utilise un identifiant anonyme.
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
