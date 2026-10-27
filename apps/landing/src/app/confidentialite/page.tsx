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
      updatedAt="27/10/2026"
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
          <li>
            <strong>Compteur de visites des bentos</strong> : quand la page
            d&apos;un bento publié s&apos;affiche dans un navigateur, le
            serveur forme une empreinte à partir de l&apos;adresse IP et du
            user-agent, et la base la hache (SHA-256) avec un sel aléatoire
            tiré chaque jour. Seule l&apos;empreinte hachée est gardée, le jour
            même, pour ne compter qu&apos;une visite par jour et par bento ;
            elle est effacée avec le sel la nuit suivante. Ne reste qu&apos;un
            nombre de visites par bento et par jour, qu&apos;aucune donnée ne
            relie à un visiteur. Le nombre de visites d&apos;un bento est
            affiché publiquement sur sa page. Aucun cookie ni traceur
            n&apos;est déposé dans le navigateur.
          </li>
        </ul>

        <h3>2.2 Application mobile « Mon Bento Pop »</h3>
        <p>
          L&apos;application iOS / Android collecte les données suivantes&nbsp;:
        </p>
        <ul>
          <li>
            <strong>Identifiant anonyme</strong> : un UUID généré automatiquement
            au premier lancement, gardé avec la session dans le stockage de
            l&apos;app, sur l&apos;appareil. Sert de clé pour relier
            l&apos;utilisateur à son bento. Aucune information personnelle (nom réel, téléphone)
            n&apos;y est associée, ni d&apos;adresse email, sauf si
            l&apos;utilisateur choisit de garder son compte (ci-dessous).
          </li>
          <li>
            <strong>Adresse email</strong> (facultative) : si
            l&apos;utilisateur choisit de <em>« garder son compte »</em>,
            l&apos;adresse qu&apos;il saisit, rattachée à son identifiant
            après la saisie d&apos;un code reçu à cette adresse. Elle sert à
            retrouver son compte sur un autre appareil ou après une
            réinstallation, par un nouveau code, et, si l&apos;équipe supprime
            le compte pour non-respect des règles, à lui en donner le motif.
            Elle n&apos;est jamais affichée publiquement, ni utilisée pour lui
            écrire autre chose. Resend, qui envoie ces mails, la reçoit (§5).
          </li>
          <li>
            <strong>Pseudonyme</strong> : choisi par l&apos;utilisateur à la
            publication de son premier bento (3 à 20 caractères). Visible
            publiquement sur sa page et ses bentos. Il peut en changer une
            fois tous les 30 jours : ses anciens pseudos restent réservés à
            son compte, et leurs liens mènent au nouveau, jusqu&apos;à la
            suppression du compte.
          </li>
          <li>
            <strong>Nom d&apos;affichage</strong> (facultatif) : si renseigné par
            l&apos;utilisateur.
          </li>
          <li>
            <strong>Popy</strong> : l&apos;illustration de son profil, choisie
            parmi six, jamais une photo. Visible publiquement.
          </li>
          <li>
            <strong>Composition du bento</strong> : les films, séries, artistes,
            chansons, créateurs et lieux que l&apos;utilisateur a choisis dans
            son bento, ainsi que la date de publication. Visible publiquement.
          </li>
          <li>
            <strong>Items proposés</strong> : le titre qu&apos;un utilisateur
            propose d&apos;ajouter au catalogue, avec sa date, la décision de
            l&apos;équipe et, en cas de refus, son motif. Visible de lui seul
            jusqu&apos;à sa validation ; validé, l&apos;item entre au catalogue
            de tous.
          </li>
          <li>
            <strong>Compteur de visites</strong> : quand la page du bento
            d&apos;un autre compte s&apos;ouvre dans l&apos;app, l&apos;identifiant
            anonyme est haché (SHA-256) avec le sel du jour, comme sur le site,
            pour ne compter qu&apos;une visite par jour et par bento ; jamais
            pour le propriétaire du bento. Le réglage{' '}
            <em>« Afficher mes visites »</em> du profil masque le compteur aux
            autres, sans arrêter le comptage.
          </li>
          <li>
            <strong>Épisodes dans « La table »</strong> : l&apos;app affiche
            les épisodes de l&apos;émission et du podcast Bento Pop, lus sur
            bento-pop.com. Les vignettes des émissions se chargent depuis les
            serveurs de YouTube (<code>i.ytimg.com</code>), qui voient alors
            l&apos;adresse IP de l&apos;appareil, comme pour les lecteurs du
            site (§7). Toucher un épisode quitte l&apos;app pour YouTube,
            Spotify, Deezer ou Apple Podcasts, dont les règles
            s&apos;appliquent alors.
          </li>
          <li>
            <strong>Pourquoi</strong> : la phrase facultative qu&apos;un
            utilisateur écrit pour une case de son bento, avec sa date,
            publique sous la boîte, dans l&apos;app et sur bento-pop.com. Elle
            s&apos;efface quand la case change d&apos;item ou se vide.
            L&apos;équipe peut en masquer une, avec un motif que seul son
            auteur voit.
          </li>
          <li>
            <strong>Commentaires</strong> : les commentaires qu&apos;un
            utilisateur écrit sous les bentos, avec leur date et son
            pseudonyme, visibles dans l&apos;app. Il peut supprimer les siens,
            et le propriétaire d&apos;un bento ceux de son bento. L&apos;équipe
            peut en masquer un, avec un motif que seul son auteur voit.
          </li>
          <li>
            <strong>J&apos;aime</strong> : les bentos qu&apos;un utilisateur
            aime. Le nombre est visible des autres, la liste des personnes
            non.
          </li>
          <li>
            <strong>Abonnements</strong> : les comptes qu&apos;un utilisateur
            suit et ceux qui le suivent, avec leur date, et les demandes en
            attente quand il valide ses abonnés. Les listes et leurs nombres
            sont publics dans l&apos;app, et le nombre d&apos;abonnés se lit
            aussi sur bento-pop.com. Seul le compte qui reçoit une demande la
            voit.
          </li>
          <li>
            <strong>Réseaux sociaux</strong> : le pseudo Instagram et le
            pseudo TikTok qu&apos;un utilisateur choisit d&apos;indiquer, tapés
            par lui et jamais vérifiés. Aucune connexion à ces réseaux, aucune
            photo ni aucun jeton n&apos;en est importé. Ils s&apos;affichent sur
            sa page, dans l&apos;app et sur bento-pop.com, tant qu&apos;il ne
            les masque pas.
          </li>
          <li>
            <strong>Succès</strong> : les médailles qu&apos;un compte gagne
            par ce qu&apos;il fait dans l&apos;app (publier ses bentos, voir
            ses propositions d&apos;items validées par l&apos;équipe, avoir des
            abonnés), avec leur date, déduites par la base de ces données. Elles
            s&apos;affichent sur sa page, dans l&apos;app et sur bento-pop.com.
          </li>
          <li>
            <strong>Notifications</strong> : l&apos;onglet « Notifs » de
            l&apos;app montre à chacun les j&apos;aime, commentaires et abonnés
            de ses bentos, les bentos des comptes qu&apos;il suit, les
            décisions de l&apos;équipe sur ses contenus et ses succès, des 90
            derniers jours.
            Rien n&apos;y est recopié : l&apos;onglet relit ces données à chaque
            ouverture. Seule la date de sa dernière lecture est gardée, pour
            savoir ce qui est nouveau. Un j&apos;aime n&apos;y dit jamais qui
            l&apos;a donné.
          </li>
          <li>
            <strong>Comptes bloqués</strong> : les comptes qu&apos;un
            utilisateur bloque, rangés avec son compte pour le suivre
            d&apos;un appareil à l&apos;autre. Ni les autres ni le compte
            bloqué ne le voient.
          </li>
          <li>
            <strong>Notifications push</strong> (facultatives) : si
            l&apos;utilisateur les autorise, le jeton de notification de son
            appareil, sa plateforme, ses deux réglages, « Mes items » et « Les
            éditions », et la date de sa dernière ouverture, pour le prévenir
            quand l&apos;équipe décide de ses items, quand son bento est
            publié et, s&apos;il l&apos;a accepté, quand une édition sort. Le
            jeton passe par Expo, puis par Apple ou Google, qui livrent la
            notification (§5).
          </li>
          <li>
            <strong>Rappel de publication</strong> : une notification
            qu&apos;un utilisateur accepte pour un bento prêt, programmée sur
            son appareil, qu&apos;elle ne quitte pas.
          </li>
          <li>
            <strong>Données techniques de l&apos;app</strong> : à chaque
            lancement d&apos;un compte qui a un pseudo, la date, la plateforme
            (iOS ou Android) et la version de l&apos;app, que seule
            l&apos;équipe lit, au back-office. Pour ses mises à jour,
            l&apos;app transmet aussi à Expo un identifiant d&apos;installation
            aléatoire, sa plateforme et sa version, sans lien avec le compte.
          </li>
          <li>
            <strong>Sur l&apos;appareil</strong> : la session, le brouillon
            d&apos;un bento avant sa publication, la liste des comptes bloqués
            et les réponses aux questions de l&apos;app restent dans le
            stockage de l&apos;app, jusqu&apos;à la déconnexion, la suppression
            du compte ou la désinstallation.
          </li>
          <li>
            <strong>Signalements</strong> (table <code>reports</code>) : si
            l&apos;utilisateur signale un bento, un pourquoi, un commentaire ou
            un compte, le motif choisi, le détail éventuel et, pour un pourquoi
            ou un commentaire, une copie de son texte, conservés pour la
            modération. Le signalement
            est lié à l&apos;identifiant du signaleur (jamais visible
            publiquement).
          </li>
          <li>
            <strong>Logs Supabase</strong> : adresses IP et user-agent des
            requêtes API, conservés 1 jour par Supabase à des fins de sécurité
            et diagnostic.
          </li>
        </ul>
        <p>
          L&apos;application <strong>ne collecte ni téléphone, ni adresse
          réelle, ni identifiant publicitaire (IDFA / GAID)</strong>, et ne
          collecte une adresse email que si l&apos;utilisateur choisit de
          garder son compte.
          Aucun SDK de tracking tiers (Google Analytics, Meta SDK, Firebase
          Analytics…) n&apos;est intégré. Sur Android, les notifications push
          sont livrées par Firebase Cloud Messaging, de Google, sans aucune
          mesure d&apos;audience.
        </p>

        <h3>2.3 Catalogue et images</h3>
        <p>
          L&apos;app cherche les films, séries, artistes, chansons, créateurs
          et lieux dans le catalogue de Bento Pop, tenu par l&apos;équipe et
          complété par les propositions des utilisateurs : aucune recherche ne
          part vers un service tiers, et les termes recherchés ne sont pas
          conservés. Les images du catalogue se chargent depuis le stockage de
          Bento Pop ou depuis leurs hébergeurs, dont The Movie Database (TMDb)
          pour les affiches, qui voient alors l&apos;adresse IP de
          l&apos;appareil.
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
            <strong>Adresse email</strong> : retrouver son compte sur un autre
            appareil (consentement, donné en choisissant de garder son compte
            et retiré en supprimant son compte).
          </li>
          <li>
            <strong>Pseudonyme + composition de bento</strong> : exécution du
            service de partage culturel (consentement, recueilli à
            l&apos;acceptation des règles, avant la première publication, et
            révocable à tout moment via la suppression de compte).
          </li>
          <li>
            <strong>Pourquoi, commentaires, j&apos;aime et abonnements</strong> :
            exécution du service de partage culturel (consentement, donné en
            écrivant, en aimant ou en suivant, et retiré en effaçant le
            pourquoi, en supprimant le commentaire, le j&apos;aime ou son
            compte, ou en ne suivant plus).
          </li>
          <li>
            <strong>Comptes bloqués</strong> : protéger l&apos;utilisateur de
            ceux qu&apos;il ne veut plus voir ni lire (intérêt légitime).
          </li>
          <li>
            <strong>Notifications push</strong> : prévenir l&apos;utilisateur
            de ce qui le concerne (consentement, donné en autorisant les
            notifications, et retiré dans les réglages de l&apos;app ou du
            téléphone).
          </li>
          <li>
            <strong>Items proposés</strong> : compléter le catalogue
            (exécution du service).
          </li>
          <li>
            <strong>Anciens pseudos</strong> : garder les liens déjà partagés
            et empêcher un autre compte de prendre un ancien pseudo (intérêt
            légitime).
          </li>
          <li>
            <strong>Données techniques de l&apos;app</strong> : suivre les
            versions en usage et répondre aux demandes d&apos;aide (intérêt
            légitime).
          </li>
          <li>
            <strong>Registre des suppressions</strong> : pouvoir prouver
            qu&apos;une suppression a eu lieu (intérêt légitime).
          </li>
          <li>
            <strong>Date de lecture des notifications</strong> : distinguer ce
            qui est nouveau dans l&apos;onglet « Notifs » (exécution du service).
          </li>
          <li>
            <strong>Réseaux sociaux</strong> : les montrer sur sa page
            (consentement, donné en les indiquant, et retiré en les effaçant ou
            en les masquant).
          </li>
          <li>
            <strong>Succès</strong> : saluer sur sa page ce qu&apos;un compte
            fait dans l&apos;app (exécution du service).
          </li>
          <li>
            <strong>Signalements et modération</strong> : modération des
            contenus utilisateurs (intérêt légitime, et obligations de la règle
            1.2 de l&apos;App Store et du règlement européen sur les services
            numériques).
          </li>
          <li>
            <strong>Logs serveur</strong> : sécurité et diagnostic (intérêt
            légitime).
          </li>
          <li>
            <strong>Compteur de visites</strong> : dire à l&apos;auteur
            d&apos;un bento, et à ses visiteurs, combien de fois il a été
            ouvert (intérêt légitime).
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
            composition, adresse email d&apos;un compte gardé) : conservées
            tant que l&apos;utilisateur n&apos;a pas supprimé son compte depuis
            l&apos;app. Sur demande par <em>« Supprimer mon compte »</em>, dans
            les réglages de l&apos;onglet Profil, le compte et toutes ses
            données sont supprimés immédiatement, sauf ce que les lignes
            suivantes gardent plus longtemps.
          </li>
          <li>
            <strong>Pourquoi, commentaires, j&apos;aime, abonnements et comptes
            bloqués</strong> : tant que l&apos;utilisateur ne les retire pas ou
            ne supprime pas son compte ; un pourquoi, tant que sa case garde
            son item ; un abonnement, tant que l&apos;un des deux comptes ne
            bloque pas l&apos;autre.
          </li>
          <li>
            <strong>Date de lecture des notifications</strong> : tant que
            l&apos;utilisateur ne supprime pas son compte. L&apos;onglet ne
            remonte pas au-delà de 90 jours.
          </li>
          <li>
            <strong>Réseaux sociaux</strong> : tant que l&apos;utilisateur ne
            les efface pas ou ne supprime pas son compte, ou que l&apos;équipe
            ne les retire pas à la suite d&apos;un signalement.
          </li>
          <li>
            <strong>Succès</strong> : tant que l&apos;utilisateur ne supprime
            pas son compte. Un succès gagné le reste, même quand ce qui l&apos;a
            fait gagner disparaît.
          </li>
          <li>
            <strong>Jeton de notification</strong> : tant que l&apos;appareil
            s&apos;en sert ; muet depuis 60 jours, il ne reçoit plus rien.
            Accusés d&apos;envoi des notifications : 30 jours.
          </li>
          <li>
            <strong>Données techniques de l&apos;app</strong> et{' '}
            <strong>anciens pseudos</strong> : tant que le compte existe.
          </li>
          <li>
            <strong>Items proposés</strong> : tant qu&apos;ils sont au
            catalogue. Quand un compte est supprimé, ses propositions y
            restent, sans auteur.
          </li>
          <li>
            <strong>Registre des suppressions</strong> : l&apos;identifiant
            d&apos;un compte supprimé, la date et le motif, sans pseudo ni nom,
            12 mois.
          </li>
          <li>
            <strong>Signalements</strong>, et pourquoi ou commentaires masqués
            par l&apos;équipe : 1 an après leur traitement, puis effacés.
            Ceux qui visent un compte gardent son pseudo et une copie du texte
            signalé jusque-là, même s&apos;il est supprimé entre-temps.
          </li>
          <li>Logs serveur : 30 jours.</li>
          <li>
            Journaux d&apos;envoi chez Resend, codes de connexion et mails de
            modération : 30 jours.
          </li>
          <li>
            Logs Supabase de l&apos;app : 1 jour. Sa base n&apos;a pas de
            sauvegarde automatique.
          </li>
          <li>
            Empreintes hachées des visiteurs d&apos;un bento, et leur sel :
            effacés la nuit suivant la visite. Nombres de visites : tant que
            le bento existe.
          </li>
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
            <strong>Plus Five Five, Inc.</strong> (Resend, San Francisco,
            États-Unis) : envoi des codes de connexion par email, pour les
            utilisateurs qui gardent leur compte, et des mails de modération :
            à l&apos;équipe, et à l&apos;adresse d&apos;un compte gardé que
            l&apos;équipe supprime, pour lui en donner le motif. Resend reçoit
            l&apos;adresse et le message. Le transfert hors de l&apos;Union européenne est
            encadré par les clauses contractuelles types de la Commission
            européenne, prévues par son accord de traitement des données.
          </li>
          <li>
            <strong>650 Industries, Inc.</strong> (Expo, Palo Alto,
            États-Unis) : relais des notifications push, qui reçoit le jeton de
            l&apos;appareil, le titre et le texte de la notification, et
            service des mises à jour de l&apos;app, qui reçoit un identifiant
            d&apos;installation, la plateforme et la version. Le transfert hors
            de l&apos;Union européenne est encadré par son accord de traitement
            des données.
          </li>
          <li>
            <strong>Apple Inc.</strong> et <strong>Google LLC</strong> — pour
            les utilisateurs ayant téléchargé l&apos;app via App Store ou
            Play Store, ces plateformes reçoivent les données techniques liées
            à l&apos;installation (identifiants techniques de leurs propres
            services, gérés selon leurs CGU respectives). Pour les
            notifications push, Apple (APNs) et Google (Firebase Cloud
            Messaging) reçoivent le jeton de l&apos;appareil et le contenu de
            la notification, qu&apos;ils livrent.
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
          à l&apos;effacement s&apos;exerce depuis les réglages de l&apos;onglet
          Profil, <em>« Supprimer mon compte »</em>, ou par la page{' '}
          <a href="/suppression-compte">Supprimer mon compte</a> de ce site. La
          suppression est immédiate et définitive, hors ce que garde le §4. Le
          droit à la portabilité aussi : <em>« Exporter mes données »</em>, dans
          les mêmes réglages, remet un fichier de ses données.
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

      <section>
        <h2>8. Âge minimum</h2>
        <p>
          L&apos;application est réservée aux personnes de 15 ans et plus,
          l&apos;âge auquel la loi Informatique et Libertés permet de consentir
          seul au traitement de ses données. Si vous apprenez qu&apos;un compte
          appartient à une personne plus jeune, écrivez à{' '}
          <a href="mailto:contact@bento-pop.com">contact@bento-pop.com</a> : il
          sera supprimé.
        </p>
      </section>
    </LegalPage>
  );
}
