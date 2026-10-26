# Chantier 22 · Likes, commentaires et modération

> Spécification écrite le 26 octobre 2026, à partir du code de la branche du
> chantier 28 (`feat/ux-28-compte-recuperable`, `47c972a`), dont le 22 dépend
> et qui n'est pas encore fusionnée, et de lectures sur la production, en
> lecture seule : la base mobile, projet « My Bento Pop ». Aucune écriture en
> production.
>
> **Arbitrages rendus le 26 octobre 2026 par Clément**, en QCM, D1 à D4
> (§11), chaque fois l'option recommandée ; D5 à D21 sont pris par la
> spécification. En résumé : on aime le bento entier, d'un cœur sous la
> boîte, ouvert à tout compte ; un filtre refuse insultes et liens avant
> publication, et la modération se fait après, sur signalement, l'équipe
> prévenue par mail au plus une fois par heure et engagée à 24 heures ; on
> commente une fois son bento publié et son compte gardé ; les commentaires
> sont à plat, émojis compris. Le blocage passe en base, et le bannissement
> efface enfin le compte.
>
> **Fait et recetté le 26 octobre 2026**, en cinq lots enchaînés à la demande
> de Clément : 78 contrôles contre une pile Supabase locale à part, quatorze
> défauts introduits exprès et tous attrapés, le défaut du signalement
> reproduit puis corrigé ; la recette au simulateur iPhone 17 Pro et iPhone SE
> et à l'émulateur Pixel 8, sept défauts trouvés et corrigés en chemin, dont
> un déblocage qu'un autre téléphone défaisait (§9). **Rien n'est appliqué en
> production** : la mise en service attend Clément, §9.6.
>
> Deuxième des quatre fondations de la roadmap produit du 15 septembre, la
> modération côté serveur, placée après le chantier 28, qui exige un compte
> gardé pour commenter (D3 du 28). Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md)
> chantier 22 et fondation 2, [le chantier 28](./UX-28-COMPTE-RECUPERABLE.md)
> pour le compte gardé, [le chantier 17](./UX-17-NOTIFICATIONS-PUSH.md) pour
> le battement et l'appel au back-office, [le chantier 20](./UX-20-MATCH-PAR-BENTO.md)
> pour les réglages de confidentialité, [le chantier 21](./UX-21-PROFIL.md)
> pour Réglages et les comptes bloqués, [le chantier 14](./UX-14-BACK-OFFICE-UTILISATEURS.md)
> pour la suppression avec motif. Le 12 reprendra sa modération, le 24 ses
> notifications. Même sortie store unique que tous les chantiers.

---

## 1. Intention

### 1.1 Ce que la roadmap demande

Liker et commenter un bento ; signaler et modérer, avec un mail envoyé par
Resend pour une modération rapide depuis l'administration. La proposition de
la roadmap : une table des likes et un compteur, le cœur dans la barre que le
fil réserve depuis le chantier 2 ; des commentaires courts, filtrés avant
publication, supprimables par le propriétaire du bento, signalables,
invisibles pour qui a bloqué leur auteur ; le blocage et le signalement côté
serveur ; un mail à l'équipe par signalement ; un interrupteur dans
`app_config` ; le réglage de confidentialité du chantier 26 qui part avec
lui.

**Fait quand** : on peut aimer et commenter un bento, signaler un commentaire
ou son auteur, l'équipe reçoit un mail qui mène à l'écran où masquer le
commentaire prend un geste, et un compte qui refuse les commentaires n'en
reçoit aucun, vérifié à la clé anonyme.

Quatre questions laissées « à trancher quand on y arrive » : like du bento ou
par case (D1) ; modération avant ou après publication (D2) ; qui reçoit les
mails et en quel délai (D11) ; réponses, mentions, émojis (D4). Le chantier
28 en a ajouté une, qui peut commenter (D3).

### 1.2 Mesuré le 26 octobre 2026, en production

En lecture seule, sur « My Bento Pop ».

- **113 comptes, tous anonymes**, aucun gardé : le 28 sortira avec la
  prochaine version. **64 ont un profil**, donc un pseudo, tous membres ;
  **49 n'en ont pas**. **28 bentos publiés, par 28 comptes** : 36 profils
  n'ont aucun bento en ligne. 4 bentos publiés et 7 comptes créés ces 30
  derniers jours.
- **3 signalements en cinq mois**, du 12 mai au 7 septembre 2026, tous sur
  un bento, aucun avec un motif ni l'identifiant du bento (antérieurs au
  chantier 16), leurs auteurs effacés depuis. **Tous classés sans suite, 120
  jours après en médiane**, 123 au plus : personne n'est prévenu d'un
  signalement, l'écran se consulte au hasard.
- **Aucun bannissement** : les 20 entrées du registre des suppressions sont
  des comptes de test, effacés les 12 et 14 septembre.
- **Le filtre des pseudos refuserait 11 mots courants sur 20** essayés :
  « administration », « computer », « grosso modo », « je suis en retard »,
  « officiel », « Picasso », « réputation », « Spice Girls », « un
  espresso », « un fagot », « une dispute ». Ses 41 motifs actifs sont des
  expressions sans borne de mot, faites pour des pseudos (§4.4).
- **La base est en `en_US.UTF-8`** : les lettres accentuées comptent comme
  des lettres, et les bornes de mot `\m` et `\M` des expressions de Postgres
  y fonctionnent : « député » ne contient pas le mot visé, « sale … » le
  contient, mesuré.
- **La télémétrie ne dit rien des versions publiées**, cf. le 28 : aucune
  mesure d'audience de l'app n'est possible d'ici. Le web compte une visite
  depuis la mise en service du compteur, le 23 octobre.

### 1.3 Ce que demandent Apple, Google et le DSA

Relu le 26 octobre 2026.

- **Apple, règle 1.2** : une app à contenu d'utilisateurs doit filtrer ce
  qui se publie, permettre de signaler un contenu avec une réponse rapide,
  de bloquer un utilisateur abusif, et publier un contact
  ([règles](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)).
  Le refus type de l'App Review, encore cité en novembre 2025, ajoute des
  conditions d'utilisation acceptées avec une **tolérance zéro**, et **une
  action sous 24 heures** : retirer le contenu signalé et expulser son auteur
  ([forum Apple](https://developer.apple.com/forums/thread/807358)). L'app
  promet déjà « on examine sous 24 h » (`app/onboarding/terms.tsx`).
- **Apple, classification d'âge** : la presse spécialisée rapporte qu'une
  question sur le contenu d'utilisateurs mis en avant dans un fil impose 13+
  aux soumissions depuis septembre 2026. « La table » en relève déjà ; à
  vérifier dans App Store Connect à la sortie, versé au chantier 29.
- **Google Play, contenu généré par les utilisateurs** : des conditions
  acceptées avant de publier, qui définissent l'inacceptable ; un
  signalement dans l'app **des contenus et des utilisateurs** ; le blocage
  dans l'app pour un contenu public ; une modération continue ; aucun délai
  chiffré ([règle](https://support.google.com/googleplay/android-developer/answer/9876937)).
- **DSA** ([règlement 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)) :
  tout hébergeur doit recevoir les notifications de contenus illicites
  (article 16) et **motiver auprès de l'auteur** le retrait d'un contenu ou la
  suspension d'un compte (article 17) ; ses conditions doivent décrire sa
  modération (article 14). Les micro et petites entreprises sont exclues des
  obligations propres aux plateformes en ligne (article 19), pas de
  celles-là. Lecture d'ingénieur, pas avis juridique.
- **Resend, plan gratuit** : 100 mails par jour et 3 000 par mois **pour tout
  le compte**, donc partagés avec les codes du 28 ; 3 domaines ; aucun
  dépassement facturé ([tarifs](https://resend.com/pricing)).

---

## 2. Objectif et critères de succès

Qu'un bento publié reçoive des réponses, et que rien de ce qu'on y écrit ne
reste en ligne plus de 24 heures s'il enfreint les règles.

- **Aimer** en un geste, depuis « La table » comme depuis la page d'un bento,
  sans attendre le réseau.
- **Commenter** pour un compte qu'on ne perd pas, et que l'équipe peut
  expulser pour de bon (D3 du 28).
- **Modérer dans l'heure** : le filtre refuse avant publication ce qu'il sait
  reconnaître, et le reste signalé arrive à l'équipe par mail, au plus tard
  une heure après, sur un écran où masquer prend un geste.
- **Se protéger soi-même** : refuser les commentaires ou les likes, bloquer un
  compte, supprimer un commentaire sous son bento.
- **Ne rien casser** : la 1.1 et la 0.1.0 lisent et signalent comme avant.
- **0 €** : le plan gratuit de Resend, sous ses 100 mails par jour partagés.

---

## 3. Périmètre

**Dans le chantier.**

- Le cœur et son compteur, sous chaque bento de « La table », de la page d'un
  compte et des mêmes goûts, et sur la page d'un bento (D1, D5, D16).
- Les commentaires d'un bento : les lire, écrire, supprimer (D3, D4, D6 à
  D8).
- Le filtre avant publication et le rythme (D6, D7).
- Signaler un commentaire, un compte ou un bento, avec un motif (D10).
- Le blocage en base (D9).
- Les réglages « Accepter les commentaires » et « Afficher les j'aime »
  (D14), et l'interrupteur `app_config.comments_enabled` (D15).
- Le back-office : la modération des commentaires, masquer en un geste, le
  bannissement corrigé (D13), le mail à l'équipe (D11, D12).
- La landing : la politique de confidentialité et les règles des mentions
  légales (D19).
- L'export de ses données (D21).

**Hors du chantier** (§12) : aimer une case (D1) ; les réponses et les
mentions (D4) ; les notifications d'un like ou d'un commentaire, au 24
(D18) ; les commentaires et les cœurs sur le web (D17) ; modifier un
commentaire ; la liste des personnes qui aiment ; une liste de mots éditable
au back-office ; empêcher un banni de revenir avec une autre adresse.

---

## 4. Ce que disent le code et la base

### 4.1 La barre d'actions réservée

`ACTIONS_HEIGHT = 0` (`src/components/feed/layout.ts:79`) est exportée et lue
nulle part : le post de « La table » ne réserve en fait aucune place, et la
barre s'ajoute sous la grille de `FeedPost`. **Le post entier est un seul
élément accessible** (`FeedPost.tsx:69`), un bouton dont le libellé énumère
le bento et dont les descendants sont masqués : un cœur à l'intérieur serait
inatteignable au lecteur d'écran. La barre vit donc **à côté** du post, pas
dedans.

La page d'un bento (`app/u/[pseudo].tsx:874`) défile : en-tête, autres
bentos, grille, puis « Ses autres bentos » ; les boutons « Compose le tien »
et « Partager » flottent en bas (`CtaBar`, `:994`). Partout où l'échelle tient,
rien ne défile : la barre sous la grille entre dans le modèle de
`public-layout.ts`.

### 4.2 Le signalement

- **Un signalement d'un compte sans profil échoue**, lu dans le schéma, à
  reproduire au lot 1 : `reports.reporter_id` référence `public.users`
  (`20260511130000_reports_and_blocked_pseudos.sql:10`, contrainte
  `reports_reporter_id_fkey` relue en production), et l'app y met
  l'identifiant de session (`src/lib/report.ts:23`). Les 49 comptes sans
  profil peuvent ouvrir un bento depuis « La table », pas le signaler.
- **Ni motif ni cible fine** : le menu « Options » (`app/u/[pseudo].tsx:1194`)
  ne signale qu'un bento, sans motif ; `reason` existe et n'est jamais
  rempli. `target_kind` n'admet que `bento` et `pseudo`.
- **Les droits** : un client n'insère que cinq colonnes, et un signalement
  naît en attente (`20260915000000_close_privilege_gaps.sql:232`).
- **Personne n'est prévenu** : l'écran « Signalements » du back-office lit les
  200 derniers (`reports/page.tsx`), sans alerte, d'où les 120 jours de §1.2.

### 4.3 Le blocage

Local, par appareil, dans `AsyncStorage` (`src/state/blocked.ts`) ; depuis le
chantier 21, chaque entrée retient le compte et plus seulement le pseudo
(D8 du 21). Le fil, la recherche et les mêmes goûts filtrent par cet index ;
Réglages liste les comptes bloqués. La base n'en sait rien : un compte bloqué
peut toujours agir sur les bentos de celui qui l'a bloqué, et un compte gardé
retrouvé sur un autre téléphone y arrive sans sa liste.

### 4.4 Le filtre des pseudos

`blocked_pseudo_patterns` : 41 expressions actives, appliquées en minuscules
et sans borne de mot au pseudo (`check_pseudo_blocked`) et au nom
(`20261024100000_profile.sql:141`). Faites pour des pseudos de 3 à 20
caractères, elles refusent 11 mots courants sur 20 dans une phrase (§1.2).
Elles ne peuvent pas servir aux commentaires : il faut une liste de mots
entiers, normalisés, à part.

### 4.5 Le bannissement du back-office

`banUser` (`reports/actions.ts:52`) supprime la seule ligne `users` : ni
motif au registre, ni compte d'authentification supprimé, contrairement à la
suppression avec motif du chantier 14, `deleteMobileAccount`
(`src/lib/mobile-users.ts:41`), qui fait les deux. Un banni garde son compte,
et avec le 28, son adresse.

### 4.6 L'envoi depuis le back-office

Le chantier 17 a posé le chemin : `push_webhook_post`
(`20260917140000_push_notifications.sql:186`) poste au back-office avec un
jeton du coffre, inerte sans lui ; `pg_cron` appelle `push_tick()` toutes les
5 minutes (`20260923100000_push_schedule.sql:129`), qui poste
`/api/push/tick`, en service depuis le 26 septembre. La route répond 202
puis travaille après la réponse (`api/push/tick/route.ts`). Aucun envoi de
mail n'existe dans le dépôt ; l'adresse du back-office n'y est écrite nulle
part.

### 4.7 Les règles et les conditions

L'app fait accepter « Les règles du jeu » avant la première publication,
« tolérance zéro » comprise, et horodate l'accord (`terms_accepted_at`, 62
profils) ; elles ne parlent que de bentos. « Conditions d'utilisation » ouvre
`bento-pop.com/mentions-legales` (`settings.tsx:44`), dont la section 6
consacre un paragraphe aux pseudonymes et aux bentos.

### 4.8 La configuration et les réglages

`app_config` est un singleton lisible par tous (`20260528000000_app_config.sql`),
relu au lancement et au retour au premier plan (`src/lib/app-config.ts`).
Les réglages de confidentialité suivent le modèle du 20 : une colonne de
`users`, allumée par défaut, modifiable par son seul propriétaire, appliquée
par les fonctions SQL ; la section Confidentialité de Réglages les porte
(`settings.tsx`, `PrivacySettings`).

---

## 5. Design

### 5.1 La barre d'actions (D1, D5, D16)

Dans le fil, sous la grille et alignée sur sa gauche, une rangée de deux
pastilles au style de l'app, contour encre et ombre plate : **le cœur et son
nombre**, **la bulle et son nombre**. Le cœur se remplit en rouge Bento Pop
quand on aime, avec un retour haptique léger ; le nombre change tout de
suite, la base suit. La bulle ouvre les commentaires.

**Sur la page d'un bento, les deux pastilles flanquent le Popy de
l'en-tête**, le cœur à gauche, la bulle à droite, le nombre seul et rien
qu'une icône à zéro. Sous la boîte, la barre coûtait 44 pt que le budget de
la page n'a pas : mesuré au modèle (`public-layout.ts`), la boîte d'un 17 Pro
passait au plancher, 8 % sous celle du fil, et la page défilait encore de
1,5 pt ; celle d'un 17e défilait de 16,5 pt. La bande de l'avatar, vide
jusqu'ici, les accueille sans rien prendre : la règle du chantier 7, la boîte
à la taille du fil sans défilement, tient.

- Sur **son propre bento**, le cœur montre le nombre sans se toucher.
- **Sans like ni commentaire**, la pastille dit « J'aime », la bulle
  « Commenter », plutôt qu'un zéro.
- Un propriétaire qui **refuse les likes** n'a pas de cœur, qui **refuse les
  commentaires** pas de bulle, qui refuse les deux pas de barre (D14).
- **Lecteur d'écran** : deux boutons à part du post, « J'aime, 12 » avec
  l'état sélectionné, « Commentaires, 3 ».
- Les nombres arrivent **après** le fil ou la page, sans rien décaler : la
  barre a sa hauteur dès le premier rendu (D16).

### 5.2 Les commentaires (D3, D4, D6, D8)

Un écran modal, « Commentaires », ouvert par la bulle : la liste, dans
l'ordre où ils ont été écrits, puis le champ en bas, au-dessus du clavier.

- Chaque commentaire : le Popy et le pseudo de son auteur, qui mènent à sa
  page, la date relative, le texte.
- **Le sien, masqué par l'équipe**, reste visible pour lui seul, grisé :
  « Masqué par l'équipe · Harcèlement ou insultes » (D8, DSA article 17).
- Un appui long ou « … » : **Signaler** et **Bloquer @pseudo** sur celui d'un
  autre ; **Supprimer** sur le sien, et sur tous ceux de son bento.
- Le champ : « Ajoute un commentaire… », « Envoyer » actif dès un caractère ;
  le reste à écrire affiché sous 30 caractères de la limite. Un refus du
  filtre se dit sous le champ, sans effacer le texte : « Ce commentaire
  contient un mot ou un lien refusé. » Les erreurs se disent dans l'écran :
  un toast vit sous la pile, donc derrière cet écran modal sur iOS.
- Les actions d'un commentaire vivent dans une feuille à part : Android
  n'affiche que trois boutons dans une alerte système, et le propriétaire en
  a quatre devant le commentaire d'un autre, « Annuler » compris.
- Vide : « Aucun commentaire pour l'instant. Lance la conversation. »
- Hors ligne, en erreur, et la plus grande taille de texte : comme les
  autres écrans, le texte plafonné, rien de rogné.

### 5.3 Qui peut commenter (D3)

Arbitré : un compte qui a **publié son bento** et **gardé son compte**.
À la place du champ, un encart dit ce qui manque, une étape à la fois :

1. **Pas de bento en ligne** : « Publie ton bento pour commenter. Ton pseudo
   vient avec. » → « Composer mon bento ».
2. **Compte anonyme** : « Garde ton compte pour commenter. Un code par mail,
   et tes commentaires te suivent d'un téléphone à l'autre. » → « Garde ton
   compte » du 28, qui revient aux commentaires une fois fait.

Un propriétaire qui refuse les commentaires : pas de bulle, et l'écran, ouvert
par un lien, le dit : « @pseudo n'accepte pas les commentaires. »

### 5.4 Signaler (D10)

Un écran modal partagé par les trois cibles, « Signaler », ouvert depuis un
commentaire, depuis « Options » sur la page d'un bento (« Signaler ce
bento », et désormais « Signaler @pseudo »), et depuis un commentaire pour son
auteur. Six motifs, un choix : **Haine ou discrimination**, **Harcèlement ou
insultes**, **Contenu sexuel**, **Violence ou menaces**, **Spam ou arnaque**,
**Autre** ; un détail facultatif de 500 caractères ; « Envoyer ». Puis,
dans l'écran même : « Merci. L'équipe regarde ton signalement sous 24 h. »,
et « Fermer ». Une alerte système ne suffit pas : Android n'y affiche que
trois boutons.

### 5.5 Bloquer (D9)

Même geste, même texte qu'aujourd'hui, plus une phrase : « Il ne pourra plus
commenter ni aimer tes bentos, et ses commentaires y disparaissent. »
Réglages liste toujours les comptes bloqués, et la liste suit désormais le
compte d'un téléphone à l'autre.

### 5.6 Réglages, section Confidentialité (D14)

Deux interrupteurs de plus, après « Apparaître dans la recherche » :

- **Accepter les commentaires** : « Sur tous tes bentos. Éteint, ceux déjà
  écrits sont masqués, et reviennent si tu le rallumes. »
- **Afficher les j'aime** : « Le cœur et son nombre sur tes bentos. »

### 5.7 Le back-office : Modération (D8, D13)

« Signalements » devient **Modération**, deux onglets.

- **Signalements**, en attente d'abord : la cible (un commentaire, son texte
  tel qu'il était au signalement ; un compte ; un bento, son lien), le
  motif, le détail, le signaleur, la date. Trois actions : **Masquer le
  commentaire**, un clic, le motif repris du signalement et modifiable ;
  **Classer sans suite** ; **Bannir @pseudo**, avec confirmation et motif.
  Plusieurs signalements d'une même cible se traitent ensemble.
- **Commentaires** : les 100 derniers, tous bentos confondus, chacun
  **Masquer** ou **Rétablir**. La liste se parcourt en une minute, sans
  attendre qu'un signalement arrive.

### 5.8 Le mail à l'équipe (D11, D12)

« Bento Pop · 2 signalements à modérer » : pour chacun, la cible, le motif et
les 80 premiers caractères du texte signalé, puis **« Ouvrir la
modération »**, qui mène à l'onglet Signalements. Texte simple, sans image.
Un mail au premier signalement en attente, puis au plus un par heure tant
qu'il en arrive : 24 par jour au pire, sous les 100 de Resend, partagés avec
les codes du 28.

---

## 6. Contrat technique

### 6.1 La base

Une migration, `20261026200000_likes_comments_moderation.sql`.

**Tables**, sous RLS, sans écriture directe des clients :

| Table | Colonnes | Lecture |
| --- | --- | --- |
| `bento_likes` | `bento_id` → `bentos` (cascade), `user_id` → `auth.users` (cascade), `created_at` ; clé (`bento_id`, `user_id`) | par les fonctions seulement |
| `bento_comments` | `id`, `bento_id` → `bentos` (cascade), `author_id` → `users` (cascade), `body` (1 à 280), `status` (`visible`, `hidden`), `hidden_reason`, `hidden_at`, `hidden_by`, `created_at` | par les fonctions seulement |
| `account_blocks` | `blocker_id` et `blocked_id` → `auth.users` (cascade), `created_at` ; clé des deux | les siennes |
| `blocked_terms` | `term` normalisé, `kind` (`word`, `stem`), `label`, `is_active` | aucune |

**Colonnes**

- `users.accept_comments` et `users.accept_likes`, `boolean not null
  default true`, modifiables par leur propriétaire seul (D14).
- `app_config.comments_enabled`, `boolean not null default true` (D15).
- `reports` : `target_comment_id` → `bento_comments` (`on delete set null`),
  `target_user_id`, `reason_code` (les six motifs), `details` (500),
  `target_text`, copie du commentaire signalé, `alerted_at` ;
  `target_kind` admet en plus `comment` et `account`. **`reporter_id`
  référence désormais `auth.users`** (`on delete set null`) : la contrainte
  de §4.2 tombe.

**Fonctions**, `security definer`, `search_path` vide, exécutables par
`authenticated` seulement ; leurs erreurs portent une clé, que l'app traduit
en phrase :

- `set_like(p_bento, p_liked)` : bento publié, propriétaire qui affiche les
  likes, pas le sien, pas bloqué par le propriétaire ; idempotente ; rend le
  nombre et l'état.
- `post_comment(p_bento, p_body)` : `comments_enabled`, bento publié,
  propriétaire qui accepte ; les conditions de D3 lues en base, dans l'ordre
  de l'app (`comment_needs_bento`, `comment_needs_terms`,
  `comment_needs_kept_account`) ; pas bloqué par le propriétaire
  (`comment_not_allowed`) ; le texte réduit à une ligne **puis** rogné, 1 à
  280 caractères (`comment_invalid`), filtré (`comment_refused_filter`) ; 5
  par minute et 50 par jour (`comment_too_fast`).
- `delete_comment(p_comment)` : son auteur, ou le propriétaire du bento.
- `list_bento_comments(p_bento, p_before, p_limit)` : du plus récent au plus
  ancien, par pages de 50 ; les visibles, plus ceux du lecteur que l'équipe a
  masqués, avec leur motif ; sans ceux des comptes que le lecteur ou le
  propriétaire ont bloqués ; vide si le propriétaire refuse les commentaires
  ou si l'interrupteur est éteint ; pseudo et Popy de chaque auteur joints.
  Nommée ainsi pour ne pas porter le nom de sa table.
- `bento_social(p_bentos)` : pour 100 bentos au plus, le nombre de likes et
  de commentaires visibles du lecteur, et s'il aime ; `null` pour ce que le
  propriétaire refuse.
- `submit_report(p_target_kind, p_target, p_reason, p_details)` : remplit
  `target_pseudo`, `target_user_id`, `target_bento_id` et `target_text`
  depuis la cible, jamais depuis le client ; un seul signalement en attente
  par signaleur et par cible, 20 par jour ; pas soi-même.
- `set_block(p_blocked, p_on)` et `sync_blocks(p_blocked)` : un geste, et la
  liste locale versée une fois, la fonction rendant celle de la base avec les
  pseudos du moment (D9).
- `my_social_export()` : ses commentaires, likes et blocages (D21).
- `normalize_for_filter(text)` et `comment_filter_hit(text)`, internes :
  minuscules ; accents, ligatures et caractères invisibles retirés ; chiffres
  et symboles ramenés à leur lettre (0 → o, 1 → i, 3 → e, 4 → a, 5 → s, 7 → t,
  @ → a, $ → s) ; trois lettres répétées ou plus ramenées à une ; un `word`
  refusé en mot entier (`\m…\M`), un `stem` en début de mot ; tout lien
  refusé (`http`, `www.`, un nom de domaine, une adresse). La liste de départ,
  53 formes, reprend les injures des motifs de pseudos et trois
  abréviations ; ni « retard », ni « fagot », ni « nique », qui ont un autre
  sens en français.

**Le back-office lit tout** par la clé de service, comme aujourd'hui.

### 6.2 L'app

- **`src/lib/social.ts`**, pur et testé : le modèle d'une barre (nombres,
  libellés, refus, version compacte de l'en-tête), le texte d'un commentaire
  tel que la base le garde, ce qui manque pour commenter, les six motifs, la
  traduction des erreurs nommées.
- **`src/lib/social-actions.ts`** : les appels aux fonctions de §6.1, testés
  contre le bouchon PostgREST.
- **`src/state/social.ts`** : les nombres de tous les écrans, demandés en
  groupe par les barres montées, gardés une minute, le cœur mis à jour
  d'avance et défait si la base refuse ; relus en entier après un blocage, un
  déblocage ou un réglage, les barres gardant leur place.
- **`src/state/blocked.ts`** : chaque geste s'écrit aussi en base, ou attend
  le réseau ; **à chaque lancement, liste vide comprise**, les gestes en
  attente repartent, la liste du téléphone est versée une fois par compte,
  puis celle de la base fait foi. Recharger au changement de compte (28), et
  vider à la déconnexion.
- **Écrans** : `src/components/social/ActionBar.tsx`, la barre sous
  `FeedPost` et les pastilles de l'en-tête de la page (`HeaderActions`) ;
  `src/components/social/ActionSheet.tsx`, la feuille d'actions ;
  `app/comments/[bentoId].tsx` ; `app/report.tsx` ; les deux interrupteurs
  de Réglages ; « Signaler @pseudo » dans « Options », devenu une feuille.
  `src/lib/report.ts`, l'insertion directe d'avant, disparaît. Aucun
  `letterSpacing` sur un champ, la règle du 28.
- **`feed/layout.ts`** : `ACTION_BAR` et `actionBarHeight`, la barre plafonnée
  comme les contrôles ; `ACTIONS_HEIGHT` prend sa valeur. La page n'en réserve
  rien (§5.1).
- **Les règles** (`app/onboarding/terms.tsx`) disent « tout bento, commentaire
  ou compte » ; Réglages dit qu'un compte bloqué ne commente ni n'aime plus.
- **L'export** (`src/lib/data-export.ts`) ajoute ses commentaires, ses likes
  et ses blocages (D21).
- **`app-config.ts`** lit `comments_enabled`, au lancement et au retour au
  premier plan.

### 6.3 Le back-office

- **Modération** (`app/(protected)/reports/`) : les deux onglets de §5.7 ;
  masquer et rétablir par la clé de service, le motif du signalement repris
  en un clic ; `banUser` passe par `deleteMobileAccount`, motif au registre
  (« Banni : … »), compte d'authentification compris (D13) ; plusieurs
  signalements d'une même cible traités ensemble ; un bandeau quand le mail
  n'est pas en service.
- **Le mail** (`src/lib/moderation/`) : `digest.ts`, pur (quand envoyer, ce
  que dit le mail, le motif d'un bannissement) ; `mailer.ts`, deux
  transports sans dépendance, l'API de Resend en production et celle de
  Mailpit en local ; `run-digest.ts`, le passage, testé contre de faux
  appels ; `store.ts`, la base et la purge. Le passage tourne à chaque
  battement, dans `/api/push/tick`, après la réponse et à part du travail des
  push : s'il existe des signalements en attente sans `alerted_at`, et
  qu'aucun mail n'est parti depuis une heure, un mail les groupe, puis
  `alerted_at` est posé. Un envoi perdu ne marque rien.
- **Le motif d'un bannissement** part avant la suppression à l'adresse du
  compte, s'il est gardé (D13).
- **Variables runtime** sur Coolify, jamais `NEXT_PUBLIC_` :
  `RESEND_API_KEY`, `MODERATION_FROM`, `MODERATION_ALERT_TO`,
  `ADMIN_PUBLIC_URL` ; `MAIL_TRANSPORT=mailpit` et `MAILPIT_URL` en local.
  Sans elles, rien ne part et l'écran le dit.
- **La purge** (D20) s'ajoute à celle du registre, à l'ouverture de l'écran.

### 6.4 La landing

- **Politique de confidentialité** : les commentaires (texte, pseudo, date,
  publics dans l'app), les likes (le nombre public, la liste non), les
  blocages, les signalements (signaleur, motif, détail, copie du texte, 12
  mois), le mail d'un bannissement.
- **Mentions légales, section 6** : les règles des commentaires, le filtre,
  le signalement et ses 24 heures, le masquage et le bannissement, leur
  motif, et la contestation par `contact@bento-pop.com` (D19). L'adresse de la
  page ne change pas : la 1.1 et la 0.1.0 l'ouvrent.
- Les pages d'un bento ne changent pas (D17).

### 6.5 Compatibilité avec les versions publiées

- **Tables et fonctions neuves**, que la 1.1 et la 0.1.0 ne lisent pas.
- **`users` gagne deux colonnes** : les versions publiées lisent le profil en
  `select('*')` et les ignorent, comme `searchable` au 20.
- **`reports`** : le chemin des versions publiées, une insertion de cinq
  colonnes, reste accordé et valide ; la contrainte de `target_kind` ne fait
  qu'ajouter des valeurs ; la nouvelle clé étrangère accepte tout ce que
  l'ancienne acceptait, et en plus les comptes sans profil.
- **Le blocage local** des versions publiées ne change pas.
- Prouvé comme pour les chantiers précédents : les requêtes des versions
  publiées relues dans l'historique git, rejouées sur un Supabase local remis
  dans l'état de la production, puis contrôlées en lecture après application.

---

## 7. Stratégie de test et de recette

### 7.1 Tests

- **Purs**, sous `node:test` : `social.ts`, la barre, le texte, les erreurs.
- **D'intégration**, contre le Supabase local, dans
  `scripts/check-social.mjs`, chaque contrôle à la clé anonyme et avec deux
  comptes réels :
  - aimer, ne plus aimer, deux fois de suite, son propre bento, un bento non
    publié, un propriétaire qui refuse, un propriétaire qui a bloqué ;
  - commenter : un compte anonyme, sans bento, gardé avec bento ; un
    propriétaire qui refuse ; bloqué ; `comments_enabled` éteint ; 281
    caractères ; le rythme ;
  - le filtre : les mots refusés, en mot entier, avec accents, chiffres et
    lettres répétées ; un lien ; **et les 20 mots de §1.2, dont aucun refusé
    à tort** ;
  - supprimer : par l'auteur, par le propriétaire, refusé à un autre ;
  - lire : les masqués invisibles aux autres, visibles de leur auteur avec
    leur motif ; les bloqués ; aucune écriture directe dans les tables ;
  - signaler : un commentaire, un compte, un bento, **depuis un compte sans
    profil** ; la copie du texte ; un doublon refusé ; **l'insertion des
    versions publiées acceptée** ;
  - supprimer un compte ou le bannir emporte ses likes, commentaires et
    blocages.
- **Le défaut de §4.2** reproduit d'abord sur la base d'aujourd'hui, puis
  corrigé.
- **Des défauts introduits exprès** dans la migration, chacun attrapé, comme
  aux chantiers 20, 21 et 28.
- **Le mail** : le regroupement, l'heure entre deux mails, rien sans
  variables, contre Mailpit.

### 7.2 Recette

Au simulateur iPhone 17 Pro et iPhone SE, à l'émulateur Pixel 8, sur une pile
Supabase locale à part et son Mailpit, avec le back-office local, en
vérifiant la base à chaque étape. Deux comptes : le propriétaire sur un
appareil, le commentateur sur un autre.

1. Aimer depuis « La table », puis depuis la page : le nombre suit sur les
   deux appareils au retour ; son propre bento ; le lecteur d'écran.
2. Commenter avec un compte sans bento, puis anonyme avec bento : les deux
   étapes de §5.3 ; garder son compte, revenir, commenter.
3. Le filtre : un mot refusé, un lien, puis une phrase avec « en retard ».
4. Supprimer le sien ; le propriétaire supprime celui d'un autre.
5. Signaler un commentaire, un compte, un bento, dont un depuis un compte
   sans profil ; le mail dans Mailpit ; « Ouvrir la modération » ; masquer en
   un clic ; l'auteur voit son commentaire masqué et son motif.
6. Bloquer : ses commentaires disparaissent des bentos de celui qui bloque ;
   il ne peut plus ni commenter ni aimer ; la liste retrouvée après « J'ai
   déjà un compte » sur l'autre appareil.
7. Refuser les commentaires, puis les likes : la barre, et la base vérifiée à
   la clé anonyme ; rallumer.
8. Éteindre `comments_enabled` : tout disparaît au retour au premier plan.
9. Bannir depuis le back-office : profil, compte, commentaires et likes
   effacés, l'entrée au registre, le mail du motif dans Mailpit.
10. La plus grande taille de texte, écran ouvert, puis la taille par défaut ;
    les rôles relus avec un compagnon `idb` neuf, ceux de TalkBack par
    `uiautomator`.

Un vrai téléphone, la voix de VoiceOver et TalkBack, et un vrai mail reçu par
Resend vont au chantier 29.

---

## 8. Plan de développement

Cinq lots, chacun validé par Clément avant le suivant.

### Lot 1 · La base

- La migration de §6.1 et la liste de départ du filtre.
- `scripts/check-social.mjs`, le défaut de §4.2 reproduit puis corrigé, et
  les défauts introduits exprès.

### Lot 2 · L'app : les données

- `social.ts`, `social-actions.ts`, le blocage en base, l'export.

### Lot 3 · L'app : les écrans

- La barre, les commentaires, la feuille de §5.3, « Signaler », « Options »,
  Réglages, les règles.
- Recetté au simulateur iPhone 17 Pro.

### Lot 4 · Le back-office, la landing et la mise en service

- Modération, le mail par le battement, le bannissement corrigé, la purge.
- Les deux pages de la landing.
- **Par Clément**, chacun guidé pas à pas : le domaine
  `moderation.bento-pop.com` dans Resend et ses enregistrements DNS ; une clé
  d'envoi propre au back-office, que l'agent ne voit pas ; les adresses de
  l'équipe ; les quatre variables runtime du back-office sur Coolify ; la
  migration, prouvée compatible avant, appliquée dans l'éditeur SQL et
  contrôlée après ; la landing et le back-office redéployés après la fusion.

### Lot 5 · Recette et documents

- La recette de §7.2 aux trois appareils, la DoD point par point.
- `RECETTE-MOBILE.md`, la roadmap et cette spécification.

---

## 9. Livraison

Fait et recetté le 26 octobre 2026, en cinq lots enchaînés à la demande de
Clément, sur `feat/ux-22-likes-commentaires`, partie de la branche du 28
tant que la PR #98 n'est pas fusionnée. Rien n'est appliqué en production :
la mise en service attend Clément (§9.6).

### 9.1 Lot 1 · La base

- `20261026200000_likes_comments_moderation.sql` : quatre tables, deux
  réglages, l'interrupteur, `reports` élargi, onze fonctions.
- `scripts/check-social.mjs` : **78 contrôles** contre une pile Supabase
  locale à part, à la clé anonyme et avec de vrais comptes, aucun échec.
- **Le défaut de §4.2 reproduit** avec la clé étrangère d'avant : six
  contrôles en échec, dont l'insertion des versions publiées depuis un compte
  sans profil ; puis corrigé.
- **Quatorze défauts introduits exprès**, tous attrapés. Deux contrôles
  renforcés en chemin : un commentaire rétabli ne dit pas son ancien motif aux
  autres ; un compte gardé avec un pseudo mais sans bento en ligne ne commente
  pas.
- **Un défaut trouvé par les contrôles** : un commentaire fait de sauts de
  ligne devenait un commentaire d'un espace, `btrim` ne retirant que les
  espaces. Les blancs se réduisent désormais avant de rogner.
- `scripts/check-social.sql` : les contrôles en lecture de la mise en service.

### 9.2 Lot 2 · Les données de l'app

- `social.ts` (21 tests), `social-actions.ts` (9 tests contre le bouchon
  PostgREST), l'état des nombres, le blocage en base (6 tests de la fusion),
  l'export, l'interrupteur.

### 9.3 Lot 3 · Les écrans

- La barre du fil, les pastilles de l'en-tête de la page, les commentaires,
  « Signaler », la feuille d'actions, Réglages, les règles.
- **La page ne réserve rien** : sous la boîte, la barre faisait défiler la
  page d'un 17 Pro et rétrécissait sa boîte de 8 % (§5.1).
- Recetté au simulateur iPhone 17 Pro, sur la pile locale : aimer depuis un
  compte anonyme sans profil ; les deux étapes de D3 ; garder son compte par
  le 28, revenir, commenter ; le filtre, puis « en retard » accepté ;
  signaler un commentaire depuis un compte sans profil, vérifié en base ;
  supprimer le sien ; bloquer et débloquer ; les deux réglages.
- **Quatre défauts trouvés et corrigés** : la feuille d'actions ne montrait au
  lecteur d'écran qu'un bouton, « Fermer », le fond accessible masquant le
  panneau ; le merci d'un signalement, dans un toast, restait caché derrière
  l'écran modal des commentaires ; un refus attendu du filtre se journalisait
  comme une erreur, et le bandeau de développement couvrait le message ; la
  liste des comptes bloqués ne disait que les bentos.

### 9.4 Lot 4 · Le back-office et la landing

- Modération en deux onglets, le mail par le battement, le bannissement
  corrigé, la purge ; 21 tests. La politique de confidentialité et la
  section 6 des mentions légales.
- Recetté en local, session simulée, mails dans Mailpit : le battement envoie
  un mail qui groupe les deux signalements en attente et mène à l'écran ; un
  second battement n'envoie rien ; masquer prend un clic, le motif repris du
  signalement ; bannir efface profil, compte, bentos et commentaires, inscrit
  « Banni : Spam ou arnaque » au registre, et le motif part avant à l'adresse
  gardée ; l'onglet Commentaires masque puis rétablit.

### 9.5 Lot 5 · La recette aux trois appareils

- **iPhone SE** : le compte retrouvé par « J'ai déjà un compte », son like
  posé sur le 17 Pro compris ; le blocage posé sur le 17 Pro retrouvé ; la
  plus grande taille de texte, écran ouvert : la barre, les pastilles autour
  du Popy, les commentaires.
- **Pixel 8** : un autre compte retrouvé ; aimer ; commenter ; la feuille
  fermée par le bouton retour ; « Signaler » ; son commentaire masqué par
  l'équipe, lu avec son motif ; les likes refusés, puis l'interrupteur
  éteint ; le texte à 200 %.
- **iPhone 17 Pro** : le propriétaire supprime le commentaire d'un autre ; les
  rôles relus avec un compagnon `idb` neuf, tous justes.
- **Trois défauts trouvés et corrigés** :
  - **le blocage d'un téléphone défaisait le déblocage d'un autre** : le
    versement unique de la liste locale ne partait qu'au premier lancement où
    elle n'était pas vide, donc après coup, avec une liste périmée. Il part
    désormais au premier lancement, liste vide comprise ; le scénario rejoué
    entre le 17 Pro et le SE ne recrée plus rien ;
  - **le clavier d'Android couvrait le champ des commentaires** : l'affichage
    bord à bord du SDK 57 ne redimensionne plus la fenêtre, et
    `KeyboardAvoidingView` passe en `padding` sur les deux plateformes ;
  - les nombres en mémoire ignoraient un déblocage ou un réglage jusqu'à leur
    minute : ils sont relus aussitôt, les barres gardant leur place.
- Deux retouches : la ligne d'un commentaire masqué grisée à 65 % d'encre,
  au-dessus du seuil que l'app s'impose ; le mail du bannissement dit « écris
  à contact@ » et non « réponds à ».
- La voix de VoiceOver et de TalkBack, un vrai mail reçu par Resend et un
  vrai téléphone vont au chantier 29.
- **La CI, rejouée en local** sur l'arbre de travail, sans cache : lint et
  typage 8 sur 8 ; tests 250 pour l'admin, 199 pour la landing et 941 pour
  l'app ; build 3 sur 3 ; e2e de la landing 50 sur 50, joué à part. Aucun
  échec. Les 78 contrôles de la base repassés après la recette.

### 9.6 La mise en service, par Clément

Dans cet ordre, chaque étape guidée pas à pas ; l'agent ne voit ni ne saisit
aucune clé.

1. **Resend**, sur le plan gratuit : le domaine d'envoi
   `moderation.bento-pop.com`, ses enregistrements DNS chez l'hébergeur de
   `bento-pop.com` jusqu'à « Verified » ; une clé d'envoi limitée à ce
   domaine, propre au back-office (D12).
2. **Coolify, le back-office, variables runtime** : `RESEND_API_KEY`, la clé,
   posée par Clément ; `MODERATION_FROM`,
   `Bento Pop <moderation@moderation.bento-pop.com>` ; `MODERATION_ALERT_TO`,
   les adresses de l'équipe ; `ADMIN_PUBLIC_URL`, `https://admin.bento-pop.com`.
3. **La migration**, dans l'éditeur SQL de « My Bento Pop », puis les
   contrôles en lecture de `scripts/check-social.sql`.
4. **La landing et le back-office** redéployés sur Coolify, après la fusion.
5. **Les fiches des stores**, à la sortie store unique : le contenu des
   utilisateurs et la classification d'âge. Versées au chantier 29.

---

## 10. Definition of Done

État au 26 octobre 2026 : 12 sur 14, les deux derniers à la mise en service.

1. ✅ Aimer et ne plus aimer, depuis le fil et la page ; un cœur par compte
   et par bento ; jamais le sien ; vérifié en base : contrôles 1 de
   `check-social.mjs`, recette au 17 Pro et au Pixel 8.
2. ✅ Commenter selon D3, et aucun autre chemin d'écriture, vérifié à la clé
   anonyme : contrôles 2, et les deux étapes à l'écran.
3. ✅ Le filtre refuse les mots de sa liste et les liens, et aucun des 20 mots
   de §1.2 : contrôles 3, et « en retard » accepté à l'écran.
4. ✅ Signaler un commentaire, un compte ou un bento, avec un motif, depuis un
   compte sans profil compris : contrôles 8, recette aux trois appareils.
5. ✅ L'équipe reçoit un mail qui mène à l'écran où masquer le commentaire
   prend un geste ; au plus un par heure : recette du lot 4, sur Mailpit ;
   le vrai mail de Resend au chantier 29.
6. ✅ Un compte qui refuse les commentaires n'en reçoit aucun, et qui refuse
   les likes aucun cœur, vérifié à la clé anonyme : contrôles 1 et 7, et au
   Pixel 8.
7. ✅ Bloquer empêche de commenter et d'aimer, retire les commentaires du
   bloqué des bentos de qui bloque, et suit le compte d'un téléphone à
   l'autre : contrôles 5, recette du 17 Pro au SE, défaut corrigé (§9.5).
8. ✅ Bannir efface profil, compte d'authentification, commentaires et likes,
   inscrit au registre, et prévient l'adresse gardée : recette du lot 4.
9. ✅ `comments_enabled` coupe les commentaires sans nouvelle version :
   contrôles 7, et au Pixel 8.
10. ✅ La 1.1 et la 0.1.0 lisent et signalent comme avant : leur insertion de
    signalement, leurs lectures du profil et de la configuration, relues sur
    `6426779`, contrôles 8.
11. ⬜ La politique de confidentialité et les mentions légales à jour, **en
    production** : écrites, la landing à redéployer après la fusion.
12. ✅ La recette de §7.2 aux trois appareils, §9.3 et §9.5.
13. ⬜ La migration prouvée compatible, **appliquée et contrôlée** ; la CI
    rejouée en local : compatible, et la CI rejouée sans échec (§9.5) ;
    l'application attend la mise en service.
14. ✅ Aucun service payant : le plan gratuit de Resend, et 24 mails d'alerte
    par jour au plus, tenu par `digest.ts` et ses tests.

---

## 11. Décisions

D1 à D4 rendues par Clément le 26 octobre 2026, en QCM, chaque fois l'option
recommandée ; D5 à D21 prises par la spécification.

| # | Décision | Raison |
| --- | --- | --- |
| **D1** | On aime le bento entier : un cœur et un compteur sous la boîte dans le fil, à côté du Popy sur la page | La barre que le fil prévoit depuis le chantier 2 ; une table ; un cœur par case demanderait 6 à 9 cibles de plus dans des cases déjà denses |
| **D2** | Un filtre avant la publication, la modération après, sur signalement | Le minimum d'Apple, sans attente pour l'auteur ; modérer avant ferait attendre chaque commentaire, quand les items attendent déjà 6,9 jours en médiane (chantier 17) |
| **D3** | On commente une fois son bento publié et son compte gardé | Chaque commentaire mène à un bento ; le pseudo et les règles viennent avec la publication, sans écran neuf ; un banni ne revient pas en réinstallant (D3 du 28) |
| **D4** | Des commentaires à plat, sans réponse ni mention ; les émojis passent comme du texte | Une liste, une table ; une mention n'a de sens que prévenue, ce que fera le 24 |
| **D5** | Aimer est ouvert à tout compte, anonyme compris ; un cœur par compte et par bento, jamais le sien ; le nombre est public, la liste non | D3 du 28 : liker reste ouvert à tous ; le geste le plus léger, sans pseudo |
| **D6** | Un commentaire : 1 à 280 caractères, sur une ligne, sans lien ; filtré en mots entiers après normalisation, par une liste à part de celle des pseudos | §4.4 : la liste des pseudos refuserait 11 mots courants sur 20 ; un lien est le premier outil du spam |
| **D7** | Au plus 5 commentaires par minute et 50 par jour par compte ; un signalement en attente par signaleur et par cible | Contenir une rafale avant qu'un humain la voie |
| **D8** | L'auteur supprime le sien, le propriétaire tout commentaire de son bento ; l'équipe masque, avec un motif que seul l'auteur voit ; ni modification ni historique | Se protéger soi-même sous son bento ; le motif répond à l'article 17 du DSA |
| **D9** | Le blocage passe en base, la liste locale versée une fois ; le bloqué ne commente ni n'aime plus les bentos de qui l'a bloqué, et ses commentaires y disparaissent pour tous ; les versions publiées gardent leur liste locale | Un harceleur qui commente reste sinon visible de tous sous le bento de sa cible ; un compte gardé retrouve sa liste |
| **D10** | Signaler un commentaire, un compte ou un bento, avec un motif parmi six et un détail facultatif, par une fonction qui copie le texte signalé ; ouvert à tout compte | Google exige de signaler contenus et utilisateurs ; la copie survit à la suppression ; le défaut de §4.2 |
| **D11** | Un mail à l'équipe au premier signalement en attente, puis au plus un par heure, groupé, par le battement du 17 ; aux adresses que Clément pose sur Coolify ; l'équipe s'engage à 24 heures | Les 120 jours de §1.2 ; 24 mails par jour au pire, sous les 100 de Resend ; le délai que l'app promet déjà et qu'Apple attend |
| **D12** | Les mails de modération partent de `moderation.bento-pop.com`, par une clé Resend propre au back-office | La réputation de `auth.bento-pop.com` ne dépend que des codes (D12 du 28) ; un banni peut marquer son mail comme indésirable ; 3 domaines au plan gratuit |
| **D13** | Bannir passe par la suppression avec motif du chantier 14 : profil, compte d'authentification, registre ; le motif part avant à l'adresse du compte, s'il est gardé | §4.5 : un banni garde aujourd'hui son compte et son adresse ; l'article 17 du DSA |
| **D14** | « Accepter les commentaires » et « Afficher les j'aime », allumés pour tous ; éteints, rien ne s'écrit et ce qui existe est masqué, rendu au rallumage | Le réglage du 26 part avec le 22 ; le modèle de `searchable` au 20 |
| **D15** | `app_config.comments_enabled` coupe les commentaires sans nouvelle version : l'app cache tout, la base refuse ; les likes restent | La proposition de la roadmap, pour une crise de modération |
| **D16** | Les nombres se lisent par paquets, après le fil ou la page, dans une barre de hauteur fixe ; sur la page, dans la bande de l'avatar | Le premier écran ne les attend jamais, et rien ne bouge à leur arrivée ; la page garde le budget du chantier 7 (§5.1) |
| **D17** | Le web ne change pas au 22 | Commenter demande l'app ; montrer des commentaires sur le web demanderait d'y modérer et d'y signaler aussi |
| **D18** | Aucune notification d'un like ou d'un commentaire au 22 | La zone du 24 les portera, et la même source servira les push |
| **D19** | Les règles de l'app et la section 6 des mentions légales couvrent commentaires, filtre, sanctions et contestation ; l'adresse des conditions ne change pas | Apple (tolérance zéro), Google (conditions acceptées), DSA (article 14) ; la 1.1 et la 0.1.0 ouvrent cette adresse |
| **D20** | Un signalement traité et un commentaire masqué s'effacent 12 mois après, à l'ouverture de la modération, comme le registre | Garder la trace d'une sanction le temps d'une contestation, pas au-delà |
| **D21** | L'export de ses données ajoute ses commentaires, ses likes et ses blocages | Ce sont des données de son compte |

---

## 12. Suivis

- **Aimer une case**, écarté par D1 : « 12 personnes aiment ce film », et la
  case d'où l'on vient signalée à l'arrivée sur une page, légué par le
  chantier 7.
- **Répondre et mentionner**, avec la zone de notifications du 24.
- **Les notifications** d'un like ou d'un commentaire : au 24.
- **La liste des mots éditable au back-office**, si la liste de départ ne
  suffit pas.
- **Empêcher un banni de revenir** avec la même adresse : garder une
  empreinte des adresses bannies, à la mesure des abus.
- **Les commentaires sur le web**, s'ils sont demandés.
- **Le pourquoi par case** (chantier 12) reprendra le filtre, le signalement
  et le mail.
- **La classification d'âge** d'Apple et les fiches des stores, à la sortie :
  versées au chantier 29.
