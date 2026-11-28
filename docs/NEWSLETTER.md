# Newsletter de bento-pop.com

Inscription à la newsletter sur la landing, liste des inscrits au back-office, message Discord à chaque inscription et désinscription. Arbitrée le 26/11/2026.

## 1. Objectif

Récolter les adresses email des personnes qui veulent recevoir la newsletter de Bento Pop. Rien n'est envoyé par le site : la liste s'exporte du back-office vers l'outil d'envoi choisi le jour venu.

## 2. Décisions

| N° | Décision |
| --- | --- |
| D1 | **Une adresse email, rien d'autre.** Pas de double validation par mail : l'inscription est enregistrée dès l'envoi du formulaire. |
| D2 | **Deux formulaires** : une section « La newsletter » sur l'accueil, entre la Team et le pied de page (fond crème entre une section jaune et le footer noir), et un champ compact dans le pied de page des autres pages. Le footer de l'accueil n'a pas de champ, pour ne pas doubler la section juste au-dessus. |
| D3 | La provenance est gardée (`home` ou `footer`) et lisible au BO. |
| D4 | **Discord : le compteur seul.** « 📬 Nouvelle inscription à la newsletter (142 inscrits) », « 👋 Une désinscription de la newsletter (141 inscrits) ». Jamais d'adresse : Discord ne reçoit aucune donnée personnelle et n'a pas à figurer dans la politique de confidentialité. Une adresse déjà inscrite ne déclenche pas de message. |
| D5 | **Désinscription** par un formulaire sur `/confidentialite#newsletter` : l'adresse est effacée de la base, définitivement. La réponse est la même qu'elle soit inscrite ou non, pour que personne ne puisse tester qui est dans la liste. L'inscription répond de même. |
| D6 | **Back-office** `/newsletter` : la liste (adresse, date, provenance), une recherche, un export CSV de toute la liste (`email,inscrit_le,provenance`) et un bouton pour retirer une adresse, par exemple sur une demande reçue par mail. Retirer depuis le BO ne prévient pas Discord. |
| D7 | **Anti-abus** sans service tiers : un champ piège invisible (un robot qui le remplit reçoit un faux succès) et 5 envois par adresse IP et par quart d'heure pour chaque formulaire, en mémoire du conteneur de la landing. |
| D8 | Les écritures publiques passent par les actions serveur de la landing, en service-role : la table n'a aucune policy pour les visiteurs. Le BO lit et efface sous la RLS (`is_admin()`). |

## 3. Données

Table `landing_newsletter_subscribers` du Supabase de la landing, créée par la première migration et complétée par `20261126120000_landing_newsletter.sql` :

| Colonne | Type | Rôle |
| --- | --- | --- |
| `id` | uuid | Clé |
| `email` | citext, unique, 3 à 254 caractères | L'adresse, en minuscules à l'écriture ; l'unicité ignore la casse |
| `source` | text, `home`, `footer` ou `landing` | Le formulaire d'origine (`landing` : valeur par défaut d'origine) |
| `consent_at` | timestamptz | Date de l'inscription, donc du consentement |

Policies : `admins read newsletter` (select) et `admins delete newsletter` (delete), pour les admins. La migration répare au passage la tuile « Newsletter » du dashboard, qui lisait la table sans droit et affichait toujours 0.

## 4. Code

- Landing : `src/lib/newsletter/` (actions serveur, message Discord, limite d'envois, lecture du formulaire), `src/components/newsletter/` (formulaires d'inscription et de désinscription), `src/sections/Newsletter/`.
- Back-office : `src/app/(protected)/newsletter/`, `src/lib/newsletter.ts` (CSV, recherche).

## 5. Mise en service

1. Jouer la migration `supabase/migrations/20261126120000_landing_newsletter.sql` dans le Studio de `supabase.bento-pop.com` (base de la landing et du BO, pas « My Bento Pop »).
2. Créer un webhook dans le salon Discord choisi (Paramètres du salon, Intégrations, Webhooks) et copier son URL.
3. Dans Coolify, sur l'**app landing**, ajouter `NEWSLETTER_DISCORD_WEBHOOK_URL` en variable **runtime** (sans « Build Variable ») : elle est lue à chaque envoi, côté serveur. Sans elle, les formulaires marchent et rien ne part sur Discord.
4. Fusionner : la landing se redéploie seule, le back-office se redéploie à la main dans Coolify.

## 6. Le jour du premier envoi

- Exporter le CSV au BO et l'importer dans l'outil d'envoi.
- Ajouter cet outil aux destinataires de la politique de confidentialité (§5), puisqu'il recevra les adresses.
- Mettre dans chaque newsletter un lien de désinscription : celui de l'outil, ou `https://bento-pop.com/confidentialite#newsletter`. Une adresse désinscrite dans l'outil doit aussi être retirée au BO, et inversement, tant que les deux listes vivent séparément.

## 7. Hors V1

Double validation par mail, envoi de la newsletter depuis le BO, synchronisation automatique avec un outil d'envoi, lien de désinscription en un clic propre à chaque adresse, préférences de contenu.
