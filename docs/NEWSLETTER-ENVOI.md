# Envoi de la newsletter depuis le back-office

Demandé par Florian le 28/11/2026, arbitré le 28/11/2026. Suite de [NEWSLETTER.md](./NEWSLETTER.md), qui couvre la collecte des adresses.

> **Statut au 28/11/2026 : les quatre lots sont faits et recettés en local** (§10), sur la branche `feat/newsletter-envoi`. Reste la mise en service par Clément (§8).

## 1. Le besoin

Dans l'onglet Newsletter du back-office : déposer le numéro de la semaine (un mail complet en HTML, préparé par Florian), se l'envoyer en test, puis l'envoyer à tous les inscrits en un clic.

Pas demandé : éditeur de mise en page, modèles, segmentation, statistiques d'ouverture et de clics.

## 2. Contraintes vérifiées le 28/11/2026

- **Resend, mails classiques, plan gratuit** : 3 000 par mois et **100 par jour pour tout le compte**, refusés au-delà (erreur 429 `daily_quota_exceeded`), jamais facturés. Ce quota sert déjà aux codes de connexion de l'app (`auth.bento-pop.com`) et aux mails de modération (`moderation.bento-pop.com`). 3 domaines, dont 2 pris. 1 webhook. Journaux gardés 30 jours.
- **Resend Marketing (Broadcasts), plan gratuit** : 1 000 contacts, **envois illimités, hors du quota des mails classiques**. Un Broadcast se crée, s'envoie et se programme par l'API. Au-delà de 1 000 contacts : 40 $ par mois pour 5 000.
- **API Resend** : 10 requêtes par seconde pour toute l'équipe, toutes clés confondues. Contacts créés un par un, listés par 100. Deux niveaux de clé seulement, « full access » et « sending access » : les contacts et les Broadcasts demandent le premier.
- **Suivi des ouvertures et des clics** : désactivé par défaut, donc aucun lien réécrit ni pixel ajouté.
- **DNS de bento-pop.com**, chez OVH : SPF de Google Workspace à la racine (`include:_spf.google.com -all`), que Resend ne touche pas puisqu'il signe par son sous-domaine `send.` ; DMARC `p=none` à la racine, qui couvre les sous-domaines ; `auth.` et `moderation.` déjà vérifiés (DKIM et `send.`).

Sources : [tarifs Resend](https://resend.com/pricing), [limites de l'API](https://resend.com/docs/api-reference/rate-limit), [Broadcasts par l'API](https://resend.com/docs/dashboard/broadcasts/send-broadcast-with-api.md), [contacts](https://resend.com/docs/api-reference/contacts/create-contact), [suivi](https://resend.com/docs/dashboard/domains/tracking.md), [événements des webhooks](https://resend.com/docs/webhooks/event-types.md), [signature](https://resend.com/docs/webhooks/verify-webhooks-requests.md), [page de désinscription](https://resend.com/docs/dashboard/settings/unsubscribe-page.md).

## 3. Décisions

| N° | Décision |
| --- | --- |
| D1 | **Resend Broadcasts, piloté depuis le BO.** Gratuit jusqu'à 1 000 inscrits, envois illimités, et les codes de connexion de l'app ne sont jamais privés de quota. Écartés : Resend mail par mail (bloqué vers 80 inscrits, et un envoi pourrait épuiser les 100 mails du jour des codes) ; Brevo (rien dans le BO, liste à recopier par CSV dans les deux sens). |
| D2 | **Expéditeur `Bento Pop <newsletter@news.bento-pop.com>`**, réponses vers `contact@bento-pop.com`. Un sous-domaine à part, comme `auth.` et `moderation.` : une plainte pour spam ne touche ni les codes de l'app ni les mails de `contact@`. C'est le 3e et dernier domaine du plan gratuit. |
| D3 | **Un numéro** : objet (150 caractères au plus), texte d'aperçu (200), contenu HTML brut, version texte brut. **Le HTML part tel quel.** Deux retouches seulement : le repère `{{desinscription}}` remplacé par le lien de désinscription, et le texte d'aperçu glissé en tête du `<body>` dans un bloc invisible, s'il est rempli. |
| D4 | **Statuts** : brouillon, programmé, en cours d'envoi, envoyé. Seul un brouillon se modifie et s'envoie. Le passage de brouillon à envoi est une seule écriture conditionnelle en base : deux clics, deux onglets ou deux admins à la fois n'envoient qu'une fois. Un numéro envoyé ne repart jamais. |
| D5 | **Envoi de test** : un vrai mail par l'API classique, vers l'adresse saisie (celle de l'admin connecté par défaut), objet précédé de « [Test] », lien de désinscription remplacé par la page Confidentialité. Il compte pour 1 dans les 100 mails du jour. |
| D6 | **Envoyer aux inscrits** : le BO aligne d'abord la liste de Resend sur la nôtre, puis demande confirmation avec le nombre exact de destinataires, puis crée et envoie le Broadcast. Un mail par destinataire, jamais de liste en copie. |
| D7 | **Programmation** : date et heure de Paris, au moins 10 minutes plus tard. Annulable tant que rien n'est parti : le numéro redevient brouillon. |
| D8 | **Désinscription** : `{{desinscription}}` devient le lien personnel de Resend (`{{{RESEND_UNSUBSCRIBE_URL}}}`), qui ouvre la page de Resend aux couleurs de Bento Pop (la mention « Powered by Resend » reste au plan gratuit). Le webhook efface aussitôt l'adresse chez nous et chez Resend. Le formulaire de la page Confidentialité reste, et efface lui aussi le contact chez Resend. Les en-têtes `List-Unsubscribe` et `List-Unsubscribe-Post` : la doc de Resend ne dit pas qu'il les pose sur les Broadcasts, c'est **contrôlé au premier envoi réel** ; s'ils manquaient, le lien passerait sur une page à nous (cf. §9). |
| D9 | **Rebonds définitifs et plaintes** : l'adresse est effacée chez nous et chez Resend, comptée dans l'historique du numéro, et Discord reçoit un message sans adresse (« 📭 Une adresse retirée de la newsletter : rebond (141 inscrits) »). |
| D10 | **Garde-fous** : l'envoi aux inscrits est refusé si le HTML ne contient pas `{{desinscription}}`. Avertissements, sans blocage : images chargées depuis `/_next/static/` (leur adresse change à chaque mise en ligne), poids au-delà de 100 Ko (Gmail coupe le message, lien de désinscription compris), version texte vide. |
| D11 | **Historique** des numéros : date d'envoi ou de programmation, objet, destinataires, mails partis, rebonds, plaintes. Les mails partis sont comptés par le webhook. |
| D12 | **Jauge du plan gratuit** au BO : « 142 / 1 000 contacts », en alerte à partir de 800. |
| D13 | **Images à adresse fixe** dans `apps/landing/public/newsletter/`, servies sous `https://bento-pop.com/newsletter/` : logo en PNG de 640 px de large, les cinq Popy (content, nani, gêné, intello, diable), `icones/` pour les six logos réseaux. **Jamais renommées ni supprimées** : les mails déjà reçus les chargent encore. |
| D14 | **Deux clés Resend « full access »**, une par app, révocables chacune. Variables runtime sur Coolify, jamais en Build Variable. |
| D15 | **Zéro dépendance** : `fetch` vers l'API de Resend et signature des webhooks vérifiée à la main (HMAC-SHA256 au format Svix), comme le mailer de modération. |

## 4. Données

Migration sur le Supabase de la landing.

**`newsletter_issues`**, un numéro :

| Colonne | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Clé |
| `subject` | text, 1 à 150 | Objet |
| `preheader` | text, 0 à 200 | Texte d'aperçu |
| `html` | text | Contenu HTML, tel que déposé |
| `text` | text | Version texte brut |
| `status` | text | `draft`, `scheduled`, `sending` ou `sent` |
| `scheduled_at` | timestamptz | Heure programmée, sinon vide |
| `sent_at` | timestamptz | Premier mail parti |
| `recipients` | int | Destinataires au moment de l'envoi |
| `delivered` | int | Mails partis (`email.sent`) |
| `bounces`, `complaints` | int | Rebonds et plaintes |
| `resend_broadcast_id` | text, unique | Le Broadcast chez Resend |
| `last_error` | text | Dernière erreur d'envoi |
| `created_by`, `created_at`, `updated_at` | | Traces |

**`newsletter_webhook_events`** : l'identifiant de chaque événement reçu, pour ne compter qu'une fois un événement que Resend renvoie. Purgé après 30 jours.

RLS : les admins lisent et écrivent les numéros (`is_admin()`), un numéro ne se modifie ou ne s'efface qu'en brouillon. Les compteurs passent par une fonction réservée au service-role, appelée par le webhook.

## 5. Écrans du BO

- `/newsletter` prend deux onglets : **Inscrits** (l'écran actuel, plus la jauge de D12) et **Numéros**.
- `/newsletter/numeros` : l'historique (D11) et le bouton « Nouveau numéro ».
- `/newsletter/numeros/[id]` : le formulaire de D3, l'aperçu du rendu (cadre sans script, en 600 et 375 px de large), les avertissements de D10, « Envoi de test », « Envoyer aux inscrits » avec ou sans programmation, « Annuler la programmation ».

## 6. Les flux

**Envoyer aux inscrits.**

1. « Envoyer aux inscrits » : le serveur aligne les contacts du segment Resend sur la table des inscrits (crée les manquants, efface ceux qui n'y sont plus), à 4 requêtes par seconde pour laisser de la marge aux codes de l'app, puis rend le nombre de destinataires.
2. Confirmation : « Envoyer « objet » à 142 inscrits ? » (ou « … le samedi 6 décembre à 9 h ? »).
3. Écriture conditionnelle brouillon → envoi (D4), création du Broadcast (segment, expéditeur, réponse, objet, HTML et texte retouchés), puis envoi ou programmation. Le nombre de destinataires est gardé.
4. Si Resend refuse avant d'avoir rien accepté, le numéro redevient brouillon avec l'erreur. Si la réponse se perd en route, le numéro reste « en cours d'envoi » avec « Réessayer », qui relance le même Broadcast : Resend n'envoie jamais deux fois un même Broadcast.

**Webhook** `POST https://bento-pop.com/api/newsletter/resend`, sur la landing (qui a déjà le service-role) :

- signature vérifiée, événement déjà vu ignoré ;
- `contact.updated` désinscrit : adresse effacée chez nous et chez Resend, message Discord de désinscription ;
- `email.bounced` ou `email.complained` : pareil, compté sur le numéro, message Discord de D9 ;
- `email.sent` : compté sur le numéro, qui passe à « envoyé » au premier.

**Inscription et désinscription par la landing** : le contact est créé ou effacé chez Resend juste après la réponse (`after()`), comme le message Discord. L'alignement de l'étape 1 rattrape un appel perdu.

## 7. Lots

Chaque lot est recetté en local contre un faux Resend (contacts, segments, Broadcasts, webhooks signés) et Mailpit pour l'envoi de test.

1. **Les images fixes** (landing) : `public/newsletter/`, copie de `public` dans l'image Docker (la ligne est déjà prête, commentée), test e2e qui les charge. Attend le zip des logos réseaux.
2. **Les numéros, l'aperçu et le test** (BO et migration).
3. **L'envoi, la programmation et l'historique** (BO).
4. **La désinscription, les rebonds et la confidentialité** (landing) : webhook, contacts à l'inscription et à la désinscription, Discord, §2.1, §4 et §5 de la page Confidentialité.

## 8. Mise en service, par Clément, guidé pas à pas

1. Resend, Domains : ajouter `news.bento-pop.com`, poser chez OVH les trois enregistrements qu'il donne (DKIM et `send.`), attendre « Verified ».
2. Resend, page de désinscription : logo, couleurs et textes en français.
3. Resend, segment « Newsletter bento-pop.com » : le créer, copier son identifiant.
4. Resend, deux clés « full access » : `newsletter-bo` et `newsletter-landing`.
5. Resend, webhook vers `https://bento-pop.com/api/newsletter/resend` avec `contact.updated`, `email.sent`, `email.bounced`, `email.complained` ; copier son secret.
6. Coolify, en **runtime** :
   - app **back-office** : `RESEND_NEWSLETTER_API_KEY` (clé `newsletter-bo`), `RESEND_NEWSLETTER_SEGMENT_ID` ;
   - app **landing** : `RESEND_NEWSLETTER_API_KEY` (clé `newsletter-landing`), `RESEND_NEWSLETTER_SEGMENT_ID`, `RESEND_WEBHOOK_SECRET`.
7. Jouer la migration dans le Studio de `supabase.bento-pop.com` (base de la landing et du BO, pas « My Bento Pop »).
8. Fusionner : la landing se redéploie seule, le BO à la main.
9. Premier envoi réel quand la liste ne contient que l'équipe : dans Gmail, « Afficher l'original » doit montrer SPF, DKIM et DMARC à PASS et les en-têtes `List-Unsubscribe` ; puis une désinscription de bout en bout.

## 9. Les images à adresse fixe

À utiliser telles quelles dans le HTML des numéros, à la place des adresses en `/_next/` :

- `https://bento-pop.com/newsletter/logo-bento-pop.png` (640 × 147)
- `https://bento-pop.com/newsletter/popy-content.png`, `popy-nani.png`, `popy-gene.png`, `popy-intello.png`, `popy-diable.png` (400 × 400)
- `https://bento-pop.com/newsletter/icones/youtube.png`, `instagram.png`, `tiktok.png`, `twitch.png`, `x.png`, `site.png` (96 × 96)

La liste fait foi dans `apps/landing/src/lib/newsletter/public-images.ts`, vérifiée par un test unitaire et par l'e2e.

## 10. Recette locale du 28/11/2026

Contre une pile Supabase dédiée, un faux Resend (contacts, segments, Broadcasts, webhooks signés au format Svix) et un faux Discord. Le banc se rejoue depuis `~/.cache/bento-recette/newsletter/`.

- **Base** : un non-admin ne voit ni ne crée rien ; un brouillon ne naît qu'en brouillon ; le verrou ne passe qu'une fois ; le contenu est figé hors brouillon ; un numéro envoyé le reste ; la fonction des compteurs est réservée au service-role et compte un événement une seule fois ; la migration se rejoue.
- **Landing** : les douze images servies en PNG ; l'inscription crée le contact dans le segment ; la désinscription par la page Confidentialité l'efface aussi chez Resend ; un webhook non signé, au corps modifié ou à la signature fausse répond 401 ; un événement rejoué n'est compté qu'une fois.
- **Webhook** : désinscription par le lien de Resend, rebond définitif et plainte effacent l'adresse chez nous et chez Resend, sont comptés sur le numéro et annoncés sur Discord sans adresse ; un rebond passager et une plainte sur un mail des codes de connexion sont ignorés.
- **BO** : création, enregistrement, contrôles (lien manquant bloquant, images `/_next/` et bloc d'aperçu en double signalés sur le vrai n°01) ; aperçu en 600 et 375 px ; envoi de test (expéditeur, réponse, « [Test] », HTML intact) ; envoi aux inscrits avec alignement de la liste et nombre exact dans la confirmation ; livraison comptée, numéro passé à « envoyé » et figé ; programmation (09:00 de Paris reçue à 08:00 UTC) puis annulation ; panne de Resend à l'envoi, « Réessayer » sans second Broadcast, « Annuler » qui ramène au brouillon ; « Retirer » efface aussi le contact chez Resend ; jauge du plan gratuit.
- **Sortie autonome** : sans la copie de `public/` ajoutée au Dockerfile, les images répondraient 404 en production ; avec, 200.

À contrôler au premier envoi réel seulement (§8, étape 9) : les en-têtes `List-Unsubscribe`, la page de désinscription de Resend en français, la réception dans Gmail, Outlook et Apple Mail.

**À dire à Florian** : le fichier d'exemple du n°01 n'est pas enregistré en UTF-8 (il est en ISO-8859-1 alors qu'il annonce UTF-8), et ses apostrophes typographiques y sont devenues des « ? » (« l?émission », « C?est »). Le réexporter en UTF-8 depuis son outil avant de le coller. Le BO signale les caractères illisibles (�), pas ces « ? », qui sont de vrais caractères.

## 11. Hors V1

Statistiques d'ouverture et de clics, page de désinscription à nous (lien porté par une propriété du contact chez Resend), double validation par mail, segmentation, modèles, duplication d'un numéro. Au-delà de 1 000 inscrits : passer au plan Marketing payant ou changer d'outil, décision à prendre à 800.
