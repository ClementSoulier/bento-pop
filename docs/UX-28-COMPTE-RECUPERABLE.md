# Chantier 28 · Compte récupérable

> Spécification écrite le 26 octobre 2026, à partir du code de `main`
> (`3ae12a8`) et de lectures sur la production, en lecture seule : la base
> mobile, projet « My Bento Pop ». Aucune écriture en production.
>
> **Arbitrages rendus le 26 octobre 2026 par Clément**, en QCM, D1 à D4
> (§11) ; D5 à D15 sont pris par la spécification. Une contrainte d'abord,
> posée par Clément en réponse libre : **zéro solution payante**. En résumé :
> on garde son compte en y rattachant son adresse email, vérifiée par un code
> à 6 chiffres, envoyé par le plan gratuit de Resend ; un téléphone neuf
> retrouve l'ancien compte par le même code, et abandonne le compte vide qu'il
> venait de créer ; l'app propose de garder son compte juste après la première
> publication, puis dans Réglages ; le rattachement se propose ici et
> s'exigera pour commenter, au chantier 22. Le lancement ne remplace plus
> jamais une session par un compte neuf, et supprimer son compte efface enfin
> son compte d'authentification.
>
> **Fait et recetté le 26 octobre 2026**, en cinq lots enchaînés à la demande
> de Clément, sur la branche `feat/ux-28-compte-recuperable` : 24 contrôles
> contre l'authentification locale, sept défauts introduits exprès et tous
> attrapés, le défaut du lancement reproduit puis corrigé, la recette au
> simulateur iPhone 17 Pro et iPhone SE et à l'émulateur Pixel 8, cinq défauts
> trouvés et corrigés en chemin (§9). **Mis en service le même jour par
> Clément** : Resend et son domaine `auth.bento-pop.com`, l'authentification
> de « My Bento Pop », et la migration, appliquée puis contrôlée en lecture
> (§9.6). **Fusionné le soir même** (PR #98) : la landing sert ses pages
> depuis, et le back-office son badge « Gardé » depuis le 28 octobre, une
> fois jouées les migrations du 22 et du 12, dont il porte aussi le code.
>
> Première des quatre fondations de la roadmap produit du 15 septembre, placée
> avant le chantier 22. Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md)
> chantier 28, [le chantier 9](./UX-16-PLUSIEURS-BENTOS.md) pour le pseudo
> demandé à la publication, [le chantier 14](./UX-14-BACK-OFFICE-UTILISATEURS.md)
> pour la suppression et [le chantier 17](./UX-17-NOTIFICATIONS-PUSH.md) pour
> les appareils. Même sortie store unique que tous les chantiers.

---

## 1. Intention

### 1.1 Ce que la roadmap demande

Un écran « Garder mon compte », proposé au moment où il y a quelque chose à
perdre, qui rattache une connexion au compte anonyme sans changer
d'identifiant ; et, sur un téléphone neuf, « J'ai déjà un compte », qui
retrouve l'ancien.

**Fait quand** : quelqu'un qui réinstalle l'app ou change de téléphone
retrouve, en se reconnectant, son pseudo, ses bentos et son identifiant, et
supprimer son compte efface aussi l'identité rattachée.

### 1.2 Mesuré le 26 octobre 2026, en production

En lecture seule, par SQL sur « My Bento Pop » (`ggjgktbcqumfxrixcdyx`).

- **113 comptes d'authentification, tous anonymes.** Aucun n'a d'email, aucune
  identité n'est rattachée (`auth.identities` est vide). Le premier date du
  11 mai, le dernier du 23 octobre.
- **64 profils**, tous de membres, chacun avec son compte. **28 ont un bento
  publié** ; 53 bentos en tout, aucun secondaire.
- **49 comptes sans profil**, dont **9 sans aucune session** : très
  probablement la trace des suppressions faites depuis l'app, seul chemin de
  l'app qui se déconnecte, après avoir effacé le profil et en laissant le
  compte d'authentification (§4.2). Les 40 autres sont des lancements qui
  n'ont jamais publié.
- **Le registre des suppressions** (`user_deletions`) compte 20 lignes, toutes
  du back-office : 18 membres, 2 profils éditoriaux. Celles de l'app n'y
  entrent pas.
- **16 comptes actifs en 30 jours**, mesurés au dernier renouvellement de leur
  session : 7 avec un bento publié, 6 avec un profil sans bento publié, 3 sans
  profil. 5 en 7 jours. Aucun compte n'a plus d'une session : un compte, un
  téléphone.
- **La télémétrie ne dit rien des versions publiées** : un seul profil la
  remplit, en 1.2.0 sur iOS ; la 1.1 et la 0.1.0 ne l'écrivent pas.

### 1.3 Ce que permettent Supabase, Apple et Resend

Relu le 26 octobre 2026.

- **Supabase garde l'identifiant.** Un compte anonyme devient permanent en
  rattachant une identité : `updateUser({ email })` envoie un code à 6
  chiffres, ou un lien, à l'adresse, et l'identifiant ne change pas
  ([Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)).
  Se connecter à un compte existant depuis un autre appareil passe par
  `signInWithOtp`, puis `verifyOtp`. Apple et Google s'ajouteraient plus tard
  au même compte, par `linkIdentity`, jeton natif compris
  ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)).
- **L'envoi de Supabase ne sert qu'à l'équipe.** Sans serveur SMTP à soi,
  Supabase refuse toute adresse hors de l'organisation du projet et plafonne
  les envois ; avec le sien, 30 messages par heure par défaut, réglables
  ([Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)). En local,
  Mailpit reçoit tous les mails : le parcours se recette de bout en bout sans
  rien envoyer.
- **Resend, plan gratuit** : 100 mails par jour, 3 000 par mois, 3 domaines, et
  aucun dépassement facturé, le plan gratuit n'en prévoit pas
  ([tarifs](https://resend.com/docs/knowledge-base/what-is-resend-pricing.md)).
  Au plafond, les envois s'arrêtent jusqu'au lendemain.
- **Apple, règle 4.8** : elle vise les connexions tierces ou sociales et
  exempte un système de compte maison. **Règle 5.1.1(v)** : une app qui crée
  des comptes doit permettre de les supprimer, ce que l'app fait déjà.
  Sign in with Apple ajouterait la révocation de ses jetons à la suppression
  ([TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)),
  hors du chantier (D15).

---

## 2. Objectif et critères de succès

Que perdre son téléphone ne coûte plus son bento, et que rien ne le coûte
sans qu'on l'ait su.

- **Retrouver** : une réinstallation, ou un téléphone neuf, rend le même
  identifiant, donc le pseudo, les bentos, les propositions et les réglages.
- **Garder** : rattacher une adresse ne change ni l'identifiant ni rien de ce
  qu'il porte, et une adresse n'est rattachée qu'une fois vérifiée.
- **Ne pas perdre au lancement** : une session présente sur l'appareil n'est
  jamais remplacée par un compte neuf (D5).
- **Supprimer** efface aussi le compte d'authentification et l'adresse (D8).
- **0 €** : aucun service payant, aucun dépassement facturable.

---

## 3. Périmètre

**Dans le chantier.**

- « Garder mon compte » : une adresse, un code, le compte gardé (D1).
- « J'ai déjà un compte » : sur l'accueil, à l'écran du pseudo et dans
  Réglages ; le compte vide du téléphone abandonné et effacé (D2, D9).
- La feuille juste après la première publication, une fois ; une fois aussi
  pour les comptes déjà publiés, au premier lancement de la nouvelle version ;
  la section Compte de Réglages (D4, D11).
- Le lancement corrigé (D5), et « Reconnecte-toi » pour un compte gardé dont
  la session est perdue (D6).
- « Se déconnecter », pour un compte gardé (D10).
- `delete_own_account()`, qui efface profil et compte d'authentification en
  une transaction, inscrite au registre (D8).
- La configuration de l'authentification : adresse vérifiée, code, modèles de
  mails en français, Mailpit en local (D7, D12).
- La landing : la politique de confidentialité et la page de suppression,
  qui disent aujourd'hui qu'aucun email n'est collecté.
- Le back-office : un compte gardé et son adresse dans « Utilisateurs » (D13).
- L'export de ses données, adresse comprise (D14).
- La mise en service : Resend, son domaine d'envoi, le SMTP du projet.

**Hors du chantier** (D15, §12) : changer d'adresse ; Apple et Google ; un mot
de passe ; le téléphone et ses SMS, payants ; exiger un compte gardé, ce que
fera le 22 pour commenter (D3) ; fusionner deux comptes (D2) ; un CAPTCHA ; la
purge des comptes abandonnés.

---

## 4. Ce que disent le code et la base

### 4.1 Le lancement

`useSession.init` (`apps/mobile/src/state/session.ts:50-109`) lit la session
rangée dans le stockage de l'app (`supabase/client.ts:27-34`), avec un délai
de 8 secondes (`session.ts:58-62`) ; sans session, il en crée une anonyme
(`session.ts:65-76`).

**Le défaut**, lu dans le code de `@supabase/auth-js` 2.105.4, installé, et à
reproduire au lot 2 avant d'être corrigé :

1. Le jeton d'accès vit une heure. Rouvrir l'app plus d'une heure après s'en
   être servi, c'est presque toujours le trouver expiré : `getSession` le
   renouvelle avant de répondre (`GoTrueClient.ts:2885`), après avoir attendu
   l'initialisation du client et son verrou (`GoTrueClient.ts:2662-2664`).
2. Sur une erreur réseau, ce renouvellement réessaie jusqu'à 30 secondes
   (`GoTrueClient.ts:4460-4483`). S'il échoue, `getSession` rend une session
   vide ; le délai de 8 secondes rend la même chose s'il traîne.
3. L'app conclut alors à un premier lancement et appelle
   `signInAnonymously`, qui ne prend pas le verrou et, s'il aboutit, **range
   la nouvelle session à la place de l'ancienne**
   (`GoTrueClient.ts:689-720`). Le compte d'avant n'est plus joignable.
4. Un jeton de rafraîchissement refusé pour de bon efface la session
   (`GoTrueClient.ts:4695-4696`) et mène au même compte neuf : c'est la perte
   constatée en recette au chantier 3.

Hors ligne, rien n'est perdu : la connexion anonyme échoue aussi, et la
session reste rangée. **Le risque est le réseau faible** : un renouvellement
qui traîne, puis une connexion anonyme qui passe.

### 4.2 La suppression depuis l'app

`deleteOwnAccount` (`src/lib/bento-actions.ts:173-179`) supprime la ligne de
`public.users`, ce qui emporte bentos et cases ; puis Réglages
(`app/settings.tsx:150-178`) appelle `resetAndReinit`
(`session.ts:150-157`), qui se déconnecte et crée un compte anonyme neuf. **Le
compte d'authentification reste**, sans profil ni session : les 9 de §1.2.
Rien n'entre au registre.

### 4.3 La suppression depuis le back-office

`deleteMobileAccount` (`apps/admin/src/lib/mobile-users.ts:41-73`) inscrit au
registre et supprime le profil en une transaction (`admin_delete_user`), puis
le compte d'authentification par l'API d'administration. Rien à changer, sinon
montrer l'adresse d'un compte gardé (D13).

### 4.4 Ce qu'un compte possède avant son profil

Depuis le chantier 9, le profil ne naît qu'à la première publication, mais le
compte anonyme existe dès le premier lancement. Il porte déjà :

- **ses propositions d'items**, `items.submitted_by`, qui pointe sur
  `auth.users`, effacé à la suppression (`on delete set null`) ;
- **ses appareils**, `push_tokens.user_id`, supprimés avec le compte
  (`20260917150000_author_is_account.sql`). `register_push_token` donne le
  jeton d'un appareil au dernier compte qui l'enregistre
  (`on conflict (token) do update set user_id`) : changer de compte sur un
  téléphone y déplace ses notifications ;
- **son brouillon et son accord des règles**, sur l'appareil seulement
  (`src/state/draft.ts`).

Le déclencheur `users_forget_author` efface déjà propositions et appareils à
la suppression d'un profil.

### 4.5 La configuration

`apps/mobile/supabase/config.toml:28-40` : connexion anonyme allumée,
**confirmation des adresses éteinte** (« MVP : pas d'email à valider »), et
aucun serveur de mails déclaré. Éteinte, la confirmation rattacherait une
adresse sans preuve : quelqu'un pourrait prendre l'adresse d'un autre, qui, se
connectant ensuite par code, entrerait dans son compte. Elle s'allume (D7). En
local, Mailpit écoute par défaut sur 54324, la série du projet « lokkal » ; il
prend 54334, à la suite des ports du projet mobile.

### 4.6 La landing

- `apps/landing/src/app/confidentialite/page.tsx:131-132` : « L'application
  ne collecte ni email, ni téléphone… ». À réécrire : l'adresse d'un compte
  gardé, à quoi elle sert, combien de temps, et Resend parmi les
  sous-traitants.
- `apps/landing/src/app/suppression-compte/page.tsx:72` : ce qui est supprimé,
  « Ton compte d'authentification (identifiant anonyme) », l'adresse en plus ;
  et `:46-50`, « écris-nous depuis l'adresse email associée à ton compte »,
  qui n'existait jusqu'ici pour personne et devient vrai.

---

## 5. Design

### 5.1 Garder mon compte (D1, D4)

Deux écrans, dans l'identité de l'app, fond jaune et contours noirs.

1. **L'adresse.** « Garde ton compte » ; une phrase : « Ajoute ton adresse
   email. Si tu changes de téléphone ou réinstalles l'app, un code suffira
   pour retrouver ton pseudo et tes bentos. » ; le champ, clavier email,
   remplissage automatique de l'adresse ; « Recevoir un code ». Dessous :
   « Ton adresse ne sert qu'à ça. Elle n'est jamais affichée ni partagée. »
2. **Le code.** « Code envoyé à c•••@gmail.com » ; un champ de 6 chiffres,
   remplissage automatique des codes à usage unique ; « Renvoyer le code »,
   actif après 60 secondes ; « Changer d'adresse ». Le compte est gardé au
   sixième chiffre juste, et l'app le dit : « Compte gardé ».

**Les refus**, chacun avec sa phrase : adresse mal formée ; code faux ; code
expiré (une heure) ; trop de demandes, au plafond de Supabase ou de Resend
(« Trop de demandes pour l'instant. Réessaie dans une heure. ») ; **adresse
déjà gardée par un autre compte** : « Cette adresse garde déjà un compte. Pour
le retrouver, touche J'ai déjà un compte. », qui ouvre 5.2.

**Un compte déjà gardé** qui ouvrirait l'écran par un lien profond lit
« Compte gardé » et l'adresse masquée : une autre adresse serait un
changement d'adresse, hors du chantier (D15).

**Quand il se propose** (D4) : une feuille, juste après la première
publication, que l'on peut passer (« Plus tard ») ; puis toujours une ligne
dans Réglages. Les comptes qui ont publié avant la nouvelle version, 28
aujourd'hui, voient la feuille une fois, à son premier lancement. La feuille
passe avant l'accord des éditions du chantier 17 (D20 du 17), qui suit à sa
fermeture (D11).

### 5.2 J'ai déjà un compte (D2, D9)

**Trois entrées** : un lien sous « Commencer » à l'accueil, premier écran
d'un téléphone neuf ; un lien à l'écran du pseudo, au moment de publier ; une
ligne dans Réglages, pour un compte pas encore gardé.

**Ce qu'on perd, dit avant** :

- compte du téléphone vide, brouillon compris : rien à dire, sinon pour le
  brouillon : « Le brouillon de ce téléphone sera remplacé par ton compte. » ;
- **compte du téléphone qui a publié** (D9), donc qui a un profil, bento en
  attente de validation compris : « Le compte de ce téléphone, @pseudo, a
  déjà publié. Si tu retrouves ton autre compte, celui-ci sera perdu. » et
  deux choix : « Le garder d'abord » (5.1, avec une autre adresse) ou « Le
  supprimer et continuer », confirmé ; la pastille retour annule. Jamais
  d'abandon silencieux : un bento publié sans plus personne pour le retirer
  resterait public pour toujours ;
- **compte du téléphone déjà gardé**, par un lien profond : rien n'est perdu,
  il se retrouvera de son code ; ni avertissement ni effacement.

Puis l'adresse et le code, comme en 5.1. Au code juste, l'app bascule : le
compte vide du téléphone est effacé (D2), ses propositions perdent leur
auteur et ses appareils passent au compte retrouvé ; le brouillon est vidé ;
le profil et les bentos du compte retrouvé arrivent. Une adresse inconnue :
« Aucun compte n'est gardé avec cette adresse. », sans en créer.

### 5.3 Réglages, section Compte (D4, D10, D13)

- **Compte pas encore gardé** : « Garder mon compte », avec « Pour le
  retrouver sur un autre téléphone » ; puis « J'ai déjà un compte ».
- **Compte gardé** : « Compte gardé avec c•••@gmail.com », masqué (D13) ; puis
  « Se déconnecter ».
- Puis, comme aujourd'hui, « Retirer mon bento du fil » et « Supprimer mon
  compte », dont le texte nomme l'adresse parmi ce qui est effacé.

### 5.4 Reconnecte-toi (D6)

Quand la session d'un **compte gardé** est refusée pour de bon, l'app ne crée
pas de compte : « Reconnecte-toi. Ta session a expiré sur ce téléphone. » ;
« Recevoir un code à c•••@gmail.com » ; ou « Continuer sans compte », qui crée
un compte anonyme neuf. Un **compte anonyme** dans le même cas est perdu,
comme aujourd'hui : rien ne permet de le retrouver, c'est ce que le chantier
existe pour éviter.

### 5.5 Se déconnecter (D10)

« Se déconnecter ? Ton compte reste gardé : un code à c•••@gmail.com suffira
pour le retrouver. » L'app revient à son premier lancement, accueil compris,
comme après une suppression.

---

## 6. Contrat technique

### 6.1 La base

Une migration, `20261026100000_delete_own_account.sql` :

- **`delete_own_account()`**, `security definer`, sans argument, pour le
  compte appelant (`auth.uid()`), en une transaction : s'il a un profil,
  l'entrée au registre (`kind` du profil, motif « Supprimé depuis l'app »,
  `deleted_by` « app ») puis le profil, ce qui emporte bentos, cases et
  anciens pseudos, et déclenche `users_forget_author` ; puis la ligne
  d'`auth.users`, ce qui emporte identités, sessions et appareils. Sans
  profil, le compte seul : c'est le compte vide de D2.
- `execute` accordé à `authenticated` seulement.

**La configuration**, mêmes réglages en local et dans le tableau de bord de
« My Bento Pop » :

| Réglage | Valeur | Pourquoi |
| --- | --- | --- |
| Confirmation des adresses | allumée | D7, §4.5 |
| Code | 6 chiffres, une heure | D7 |
| Renvoi | 60 secondes au plus tôt | D7 |
| Modèle « Change Email Address » | « Ton code pour garder ton compte » | D12 |
| Modèle « Magic Link » | « Ton code pour te reconnecter » | D12 |
| Serveur SMTP | Resend, plan gratuit | D1 |
| Expéditeur | `Mon Bento Pop <code@auth.bento-pop.com>` | D12 |
| Envois de mails | 30 par heure, le réglage par défaut | sous les 100 par jour de Resend |
| Rattachement manuel (`linkIdentity`) | éteint, sauf si le lot 1 montre que l'email l'exige | rien à rattacher sans Apple ni Google |

En local : `config.toml`, les deux modèles dans `supabase/templates/`, et
Mailpit sur 54334.

### 6.2 L'app

- **`src/lib/account.ts`**, pur et testé sous `node:test` : normaliser et
  valider une adresse, la masquer, dire si un compte est gardé, traduire les
  erreurs de l'authentification en phrases (§5.1).
- **`src/lib/account-actions.ts`** : demander et vérifier le code pour garder
  (`updateUser`, `verifyOtp` de type `email_change`) ; pour se reconnecter
  (`signInWithOtp` sans création de compte, `verifyOtp` de type `email`),
  **sur un client à part, sans stockage**, pour garder la session anonyme le
  temps d'effacer le compte vide ; basculer ; se déconnecter ; supprimer par
  `delete_own_account()`. Les types exacts de `verifyOtp` se vérifient au
  lot 1.
- **`src/state/session.ts`** (D5, D6) : une marque du compte de l'appareil,
  identifiant et « gardé » ; une session rangée ne mène jamais à
  `signInAnonymously` au lancement, l'app s'ouvre comme hors ligne pendant
  que la session se renouvelle ; une session refusée pour de bon mène à
  « Reconnecte-toi » pour un compte gardé, à un compte neuf sinon.
- **Écrans** : `app/account/keep.tsx`, `app/account/sign-in.tsx`,
  `app/account/reconnect.tsx`, une étape de code partagée, et la feuille
  « Garde ton compte » ; les liens de l'accueil (`app/onboarding/splash.tsx`),
  du pseudo (`app/onboarding/pseudo.tsx`) et la section Compte de
  `app/settings.tsx`.
- **L'export** (`src/lib/data-export.ts`) ajoute l'adresse (D14).

### 6.3 La landing

Les deux pages de §4.6, en texte seulement.

### 6.4 Le back-office

« Utilisateurs » montre si un compte est gardé, et son adresse en entier,
réservée aux administrateurs (D13). L'écran lit déjà `auth.users` par l'API
d'administration ; la suppression ne change pas.

### 6.5 Compatibilité avec les versions publiées

- La migration **ajoute une fonction** et ne change rien de ce que lisent ou
  écrivent la 1.1 et la 0.1.0 : elles suppriment toujours un compte par la
  règle `users_delete_own`, sans toucher `auth.users`, comme aujourd'hui.
- **La configuration ne touche que l'email**, dont les versions publiées ne
  se servent pas : la connexion anonyme ne demande ni confirmation ni mail.
- Prouvé comme pour les chantiers précédents : les requêtes des versions
  publiées relues dans l'historique git, rejouées sur un Supabase local remis
  dans l'état de la production, puis contrôlées en lecture après application.

---

## 7. Stratégie de test et de recette

### 7.1 Tests

- **Purs**, sous `node:test` : `account.ts`, les adresses, le masque, les
  erreurs.
- **D'intégration**, contre le Supabase local et l'API de Mailpit, qui rend le
  code reçu : garder (même identifiant avant et après) ; une adresse jamais
  rattachée sans son code ; une adresse déjà gardée refusée ; se reconnecter
  depuis un client neuf (même identifiant) ; une adresse inconnue sans compte
  créé ; `delete_own_account()` avec et sans profil, registre compris ; le
  chemin de suppression de la 1.1, inchangé.
- **Le défaut du lancement** (D5), reproduit d'abord sur le code d'aujourd'hui,
  le renouvellement retardé au-delà de 8 secondes par un `fetch` enveloppé,
  puis corrigé : même identifiant après.
- **Des défauts introduits exprès** dans la migration et les actions, chacun
  attrapé par un test, comme aux chantiers 20 et 21.

### 7.2 Recette

Au simulateur iPhone 17 Pro et iPhone SE, à l'émulateur Pixel 8, sur le
Supabase local et son Mailpit, en vérifiant la base à chaque étape.

1. Premier lancement, publier : la feuille ; garder avec une adresse de test,
   code lu dans Mailpit ; Réglages montre l'adresse masquée ; même identifiant
   en base.
2. Désinstaller, réinstaller : « J'ai déjà un compte » à l'accueil ; pseudo,
   bentos et identifiant retrouvés ; le compte vide de la réinstallation
   effacé en base.
3. Un brouillon en cours, puis « J'ai déjà un compte » : l'avertissement du
   brouillon.
4. Un compte anonyme avec un bento publié, puis « J'ai déjà un compte » : les
   trois choix ; « Le garder d'abord » ; « Le supprimer et continuer ».
5. Les refus : adresse prise, code faux, code expiré, renvoi avant 60 secondes,
   adresse inconnue, plafond d'envoi.
6. Le lancement sur un réseau lent (renouvellement retardé) : aucun compte
   créé.
7. Une session refusée pour de bon : « Reconnecte-toi » pour un compte gardé,
   un compte neuf pour un anonyme.
8. Se déconnecter, puis se reconnecter.
9. Supprimer : profil, compte d'authentification et identité absents, une
   entrée au registre ; l'adresse ne retrouve plus rien.
10. Un compte déjà publié avant la nouvelle version : la feuille, une fois.
11. Tailles de texte, plus petite et plus grande, écran ouvert ; les rôles de
    VoiceOver relus avec un compagnon `idb` neuf, ceux de TalkBack par son
    journal.

Un vrai téléphone, et la réception d'un vrai mail par Resend, vont au
chantier 29.

---

## 8. Plan de développement

Cinq lots, chacun validé par Clément avant le suivant.

### Lot 1 · La base et l'authentification locale

- La migration de §6.1 et ses contrôles (`scripts/check-account.sql`).
- `config.toml` : confirmation des adresses, code, modèles en français,
  Mailpit sur 54334 ; le rattachement manuel seulement si l'email l'exige.
- Les tests d'intégration de §7.1, sauf le lancement, et les défauts
  introduits exprès.

### Lot 2 · L'app : les données et le lancement

- `account.ts` et `account-actions.ts`.
- Le défaut du lancement reproduit, puis corrigé (D5, D6), dans
  `session.ts`.
- L'export (D14).

### Lot 3 · L'app : les écrans

- Garder, J'ai déjà un compte, Reconnecte-toi, la feuille et son ordre avec
  l'accord des éditions (D11), la section Compte, les liens de l'accueil et du
  pseudo.
- Recetté au simulateur iPhone 17 Pro, sur Mailpit.

### Lot 4 · La landing, le back-office et la mise en service

- Les deux pages de la landing ; « Utilisateurs » au back-office.
- **Par Clément**, chacun guidé pas à pas : un compte Resend sur le plan
  gratuit ; le domaine `auth.bento-pop.com` et ses enregistrements DNS ; la
  clé de Resend posée comme mot de passe SMTP dans « My Bento Pop », que
  l'agent ne voit pas ; les modèles et les réglages de §6.1 ; la migration,
  prouvée compatible avant, appliquée dans l'éditeur SQL et contrôlée après ;
  la landing et le back-office redéployés sur Coolify.
- Les fiches de confidentialité de l'App Store et de Google Play, à mettre à
  jour à la sortie : versées à la liste du chantier 29.

### Lot 5 · Recette et documents

- La recette de §7.2 aux trois appareils, la DoD point par point.
- `RECETTE-MOBILE.md` : lire un code dans Mailpit, ses pièges.
- La roadmap et cette spécification.

---

## 9. Livraison

Fait le 26 octobre 2026, en cinq lots enchaînés à la demande de Clément, sur
`feat/ux-28-compte-recuperable`, PR #98, fusionnée le soir même. Mis en
service le même jour par Clément, migration comprise (§9.6) ; la landing sert
ses pages depuis la fusion, et le back-office depuis le 28 octobre, une fois
jouées les migrations du 22 et du 12.

### 9.1 Lot 1 · La base et l'authentification locale

- `20261026100000_delete_own_account.sql`, et `config.toml` : confirmation des
  adresses, code de 6 chiffres valable une heure, renvoi après 60 secondes,
  les deux modèles en français, Mailpit sur 54334, 300 comptes anonymes par
  heure et par IP en local.
- `scripts/check-account.mjs` : **24 contrôles** contre une pile locale à part
  et son Mailpit, zéro échec, la base laissée comme trouvée.
- **Sept défauts introduits exprès, tous attrapés** : la fonction sans la
  suppression du compte d'authentification (3 contrôles en échec), sans le
  registre (1), sans `security definer` (5), ouverte à la clé anonyme (1),
  gardant le profil (1) ; la confirmation des adresses éteinte (2), le renvoi
  sans délai (1). Un contrôle passait d'abord pour une mauvaise raison,
  l'adresse supprimée refusée par le délai de 60 secondes et non faute de
  compte : il exige désormais le bon refus, `otp_disabled`.
- **Mesuré** : la confirmation éteinte, `updateUser({ email })` rattache
  l'adresse sur-le-champ, sans code, et le compte cesse d'être anonyme ; le
  risque de §4.5 est réel. Le rattachement manuel n'est pas nécessaire à
  l'email : il reste éteint. Les types de `verifyOtp` sont `email_change` pour
  garder et `email` pour se reconnecter.

### 9.2 Lot 2 · Les données et le lancement

- `account.ts` (24 tests), `account-actions.ts` (8, contre un bouchon de
  GoTrue), `boot-session.ts` (12) et `session-events.ts` (5) ; `session.ts`
  suit D5 et D6 ; la suppression passe par `delete_own_account()` ; l'export
  porte l'adresse (D14).
- **Le défaut du lancement, reproduit** par
  `boot-session.integration.test.ts`, sur les lignes du lancement d'avant
  recopiées et avec le vrai `supabase-js` : un renouvellement plus lent que le
  délai fait créer un compte, ouvre l'app dessus et range sa session à la
  place de l'ancienne. **Corrigé**, le même scénario ne crée rien, et le compte
  arrive par `onAuthStateChange`.
- La clé de la session, donnée explicitement au client, est vérifiée égale à
  celle que `supabase-js` calcule seul, pour l'adresse de production comme en
  local : aucun téléphone ne perd sa session en passant à cette version.

### 9.3 Lot 3 · Les écrans

- « Garde ton compte », « J'ai déjà un compte », « Reconnecte-toi », la
  feuille « Garde ton bento », la section Compte de Réglages, les liens de
  l'accueil et de l'écran du pseudo.
- **Recetté au simulateur iPhone 17 Pro**, sur une pile à part
  (`bento-pop-compte`, API 54371, Mailpit 54374) : garder par la feuille et
  par Réglages, même identifiant en base ; se déconnecter ; se reconnecter
  depuis l'accueil, le compte vide effacé ; réinstaller, puis retrouver ; une
  adresse déjà prise, une adresse mal formée, un renvoi trop tôt ; D9,
  l'avertissement puis la suppression, avec son entrée au registre ; D6, une
  session révoquée mène à « Reconnecte-toi » sans compte neuf ; D5,
  l'authentification en pause au lancement, l'app s'ouvre sans compte neuf et
  retrouve le sien à la reprise.
- **Un défaut trouvé** : l'espacement du champ du code survivait dans
  l'exemple du champ d'adresse affiché après lui, par le recyclage des vues de
  Fabric. Corrigé, et gardé par un test sur tous les champs de l'app, cf.
  `RECETTE-MOBILE.md`, « Un champ de saisie recyclé garde l'espacement de sa
  vie précédente ». Et un titre en Extenda réserve la place de ses accents,
  « J'AI DÉJÀ UN COMPTE », règle déjà tenue par un test de l'app.

### 9.4 Lot 4 · La landing et le back-office

- La politique de confidentialité : l'adresse d'un compte gardé, sa base
  légale, sa durée, et Resend parmi les destinataires, Plus Five Five, Inc., à
  San Francisco, le transfert encadré par les clauses contractuelles types de
  son accord de traitement, relu le 26 octobre ; ses journaux, 30 jours sur le
  plan gratuit.
- La page de suppression : l'adresse parmi ce qui est effacé, la demande par
  mail depuis l'adresse qui garde le compte, et le chemin par Réglages, que la
  page ne disait pas depuis le chantier 21.
- Le back-office : « Gardé » et l'adresse sur la ligne d'un compte, et la
  recherche par adresse (27 tests).

### 9.5 Lot 5 · La recette aux trois appareils

- **iPhone SE** : le parcours entier d'un téléphone neuf, accueil, règles, six
  cases, publication, la feuille juste après, puis l'accord des éditions à sa
  fermeture (D11) ; garder ; la plus grande taille de texte, écran ouvert,
  puis la taille par défaut ; supprimer son compte par l'écran ; l'adresse
  supprimée ne retrouve plus rien.
- **Pixel 8** : le compte gardé sur l'iPhone, retrouvé sur Android, même
  identifiant ; la feuille ; Réglages ; se déconnecter puis se reconnecter.
- **Trois défauts trouvés et corrigés** : Bungee rognait le haut du champ du
  code sur Android, passé en police système grasse ; ce champ ne prenait pas le
  focus sur Android, redemandé une fois monté ; la feuille avait des angles
  droits sur Android, arrondis. **Deux gardes ajoutées** : un compte déjà
  gardé, arrivé par un lien profond, ne relance pas un changement d'adresse
  depuis « Garde ton compte », et « J'ai déjà un compte » ne le dit pas perdu.
- Les rôles relus, boutons, titres et champs, par `idb` sur iOS et
  `uiautomator` sur Android. La voix de VoiceOver et de TalkBack, un vrai mail
  reçu par Resend et un vrai téléphone vont au chantier 29.

### 9.6 La mise en service, par Clément

Dans cet ordre, chaque étape guidée pas à pas ; l'agent ne voit ni ne saisit
aucune clé, aucun mot de passe. **Les trois premières faites par Clément le
26 octobre 2026, la quatrième le 28 octobre.**

1. ✅ **Resend** : un compte sur le plan gratuit ; le domaine d'envoi
   `auth.bento-pop.com` ; ses enregistrements DNS posés chez l'hébergeur de
   `bento-pop.com`, jusqu'à « Verified » ; une clé d'envoi limitée à ce
   domaine. Les DNS publics le confirment, relus le 26 octobre : la clé DKIM
   de Resend sur `resend._domainkey.auth.bento-pop.com`, le MX de retour et
   le SPF sur `send.auth.bento-pop.com`, et la règle DMARC de
   `bento-pop.com`, `p=none`, qui suffit à un sous-domaine d'envoi.
2. ✅ **« My Bento Pop »** (`ggjgktbcqumfxrixcdyx`), Authentication : SMTP
   personnalisé, `smtp.resend.com`, port 465, utilisateur `resend`, la clé
   comme mot de passe, expéditeur `code@auth.bento-pop.com`, nom
   « Mon Bento Pop » ; « Confirm email » allumé ; code de 6 chiffres valable
   3 600 secondes ; les modèles « Change Email Address » et « Magic Link »,
   sujets et corps de `supabase/templates/` ; 30 envois par heure. Ces
   réglages ne se lisent que dans le tableau de bord, et aucun envoi d'essai
   ne se fait sans écrire en production : le premier vrai mail partira à la
   recette du chantier 29.
3. ✅ **La migration**, `20261026100000_delete_own_account.sql`, dans l'éditeur
   SQL, puis les contrôles en lecture de
   `scripts/check-delete-own-account.sql`, tous passés : une fonction,
   commentée, en `security definer`, propriétaire `postgres`,
   `search_path=""` ; son exécution refusée à `anon` et à `public`, permise à
   `authenticated` ; 113 comptes, tous anonymes, 64 profils, 53 bentos dont
   28 publiés et 20 entrées au registre des suppressions, inchangés ; la
   règle `users_delete_own`, par laquelle la 1.1 et la 0.1.0 suppriment, en
   place. Aucune donnée touchée.
4. ✅ **Le back-office** redéployé sur Coolify, en service le 28 octobre, une
   fois jouées les migrations du 22 et du 12, dont il porte aussi le code :
   relevé sans session, il sert une build du 27 octobre à 19:53 UTC, après la
   dernière fusion, dont la feuille de style porte les classes de leurs
   écrans. La landing l'a été d'elle-même à la fusion, servie le 26 octobre à
   19:50 UTC : le point 10 de la DoD.
5. ⬜ **Les fiches de confidentialité** de l'App Store et de Google Play, à la
   sortie store unique : l'adresse email, liée à l'identité, pour le
   fonctionnement de l'app. Versées à la liste du chantier 29.

---

## 10. Definition of Done

État au 26 octobre 2026 : 12 sur 12, le point 10 rempli par la fusion, le
soir même.

1. ✅ Garder son compte ne change pas son identifiant, vérifié en base :
   contrôles 1 de `check-account.mjs`, recette aux trois appareils.
2. ✅ Réinstaller puis « J'ai déjà un compte » rend pseudo, bentos et
   identifiant : iPhone 17 Pro, et le compte gardé sur l'iPhone retrouvé sur
   le Pixel 8.
3. ✅ Une adresse n'est jamais rattachée sans son code, et une adresse déjà
   gardée n'est jamais prise par un autre compte : contrôles 2 et 3, recette.
4. ✅ Le compte vide d'un téléphone neuf est effacé à la bascule ; un compte
   qui a publié n'est jamais abandonné sans que l'on ait choisi : recette, D9.
5. ✅ Le lancement ne remplace jamais une session rangée par un compte neuf :
   reproduit avant, corrigé après, §9.2, et au simulateur, §9.3.
6. ✅ Une session perdue d'un compte gardé mène à « Reconnecte-toi » : §9.3.
7. ✅ Supprimer son compte efface profil, compte d'authentification et
   identité, avec son entrée au registre ; la 1.1 et la 0.1.0 suppriment
   toujours comme avant : contrôles 7 à 9, et par l'écran sur l'iPhone SE.
8. ✅ La feuille après la première publication, une fois ; une fois pour un
   compte déjà publié ; la ligne dans Réglages : iPhone SE et 17 Pro, Pixel 8.
9. ✅ Aucun service payant, aucun dépassement facturable : le plan gratuit de
   Resend n'en prévoit pas.
10. ✅ La politique de confidentialité et la page de suppression à jour, **en
    production** : servies par bento-pop.com depuis le 26 octobre à 19:50 UTC,
    après la fusion de la PR #98, chaque phrase ajoutée relevée en ligne.
11. ✅ La recette de §7.2 aux trois appareils, §9.3 et §9.5.
12. ✅ La migration prouvée compatible, **appliquée et contrôlée** ; la CI
    rejouée en local : appliquée par Clément le 26 octobre, contrôlée en
    lecture, §9.6.

---

## 11. Décisions

D1 à D4 rendues par Clément le 26 octobre 2026, en QCM, sous la contrainte
« zéro solution payante » ; D5 à D15 prises par la spécification.

| # | Décision | Raison |
| --- | --- | --- |
| **D1** | On garde son compte par son adresse email, vérifiée par un code à 6 chiffres, envoyé par le plan gratuit de Resend | Marche sur iPhone et Android, d'un système à l'autre, sans SDK natif ; 0 €, sans dépassement facturé ; le seul parcours recettable de bout en bout au simulateur ; le 22 enverra ses mails par le même compte |
| **D2** | Sur un téléphone neuf, retrouver son compte abandonne celui que l'app venait de créer, effacé s'il est vide ; l'app prévient pour le brouillon | Avant de publier, ce compte ne porte qu'un brouillon et d'éventuelles propositions ; une fusion coûterait une fonction de transfert pour un cas qu'aucune mesure ne montre |
| **D3** | Le rattachement se propose au 28 ; il s'exigera pour commenter, au 22 ; liker et suivre restent ouverts à tous | Un bannissement ne tient que sur un compte qu'on ne recrée pas en réinstallant l'app |
| **D4** | « Garder mon compte » se propose dans une feuille juste après la première publication, puis dans Réglages ; une fois pour les comptes déjà publiés | Au moment où il y a quelque chose à perdre, sans rappel permanent |
| **D5** | Le lancement ne crée un compte que sur un appareil qui n'en a jamais eu : une session rangée se renouvelle pendant que l'app s'ouvre comme hors ligne | Le défaut de §4.1 : un réseau faible suffit à perdre son compte |
| **D6** | Une session refusée pour de bon : « Reconnecte-toi » pour un compte gardé, un compte neuf pour un anonyme | Le compte gardé se retrouve d'un code ; l'anonyme ne peut pas l'être |
| **D7** | Une adresse n'est rattachée qu'une fois vérifiée : confirmation allumée, code valable une heure, renvoi après 60 secondes | Éteinte, la confirmation laisserait prendre l'adresse d'un autre (§4.5) |
| **D8** | `delete_own_account()` efface profil et compte d'authentification en une transaction, inscrite au registre ; les versions publiées gardent leur chemin | Le « Fait quand » de la roadmap, et les 9 comptes orphelins de §1.2 |
| **D9** | Un compte anonyme qui a déjà publié, bento en attente de validation compris, ne s'abandonne pas en silence : le garder d'abord, ou le supprimer et continuer | Abandonné, un bento resterait public sans plus personne pour le retirer |
| **D10** | « Se déconnecter », pour un compte gardé seulement, ramène l'app à son premier lancement | Un compte qu'on retrouve peut enfin se quitter ; un anonyme se perdrait |
| **D11** | La feuille passe avant l'accord des éditions du 17, qui suit à sa fermeture ; chacune une fois | Deux questions d'un coup ; garder son compte compte davantage |
| **D12** | Les mails partent de `auth.bento-pop.com`, en français, le code seul, sans lien ni promotion ; deux modèles, garder et se reconnecter | Les règles d'envoi de Supabase, et un domaine dont la réputation ne dépend que de ces mails |
| **D13** | L'adresse masquée dans l'app ; en entier au back-office, pour les administrateurs | Traiter une demande de suppression écrite depuis cette adresse |
| **D14** | L'export de ses données inclut son adresse | C'est une donnée de son compte |
| **D15** | Hors du chantier : changer d'adresse, Apple et Google, un mot de passe, les SMS, la purge des comptes abandonnés | Apple et Google s'ajouteront au même compte par `linkIdentity` ; les SMS sont payants |

---

## 12. Suivis

- **Changer d'adresse**, quand on la perd ou qu'on en change : la double
  confirmation de Supabase, ancienne et nouvelle adresse.
- **Apple et Google**, s'ils sont demandés : le même compte, par
  `linkIdentity` ; Apple avec la révocation de TN3194.
- **La purge des comptes abandonnés** : 49 sans profil aujourd'hui, dont 9
  sans session, irrécupérables.
- **Un CAPTCHA** contre la création de comptes et de codes en rafale, si des
  abus apparaissent ; Turnstile de Cloudflare est gratuit.
- **Le plafond de Resend à la sortie** : au-delà de 100 comptes gardés le même
  jour, les suivants attendent le lendemain.
- **Exiger un compte gardé pour commenter**, au chantier 22 (D3).
