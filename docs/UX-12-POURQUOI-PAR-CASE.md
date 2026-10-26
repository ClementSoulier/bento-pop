# Chantier 12 · Le « pourquoi » par case

> Spécification écrite le 26 octobre 2026, à partir du code de la branche du
> chantier 22 (`feat/ux-22-likes-commentaires`, `f8bb87f`), dont le 12
> dépend et qui n'est pas encore en PR, elle-même partie de la branche du 28
> (PR #98), et de lectures sur la production, en lecture seule : la base
> mobile, projet « My Bento Pop ». Aucune écriture en production.
>
> **Arbitrages rendus le 26 octobre 2026 par Clément**, en QCM, D1 à D4
> (§11), chaque fois l'option recommandée ; D5 à D20 sont prises par la
> spécification. En résumé : on lit les pourquoi sous la boîte, en liste ; on
> les écrit après la publication, depuis sa page, sans toucher au
> compositeur ; tout auteur d'un bento publié les écrit, compte anonyme
> compris ; le web les montre aussi, sous la boîte.
>
> **Fait et recetté le 26 octobre 2026**, en cinq lots enchaînés : 67
> contrôles contre une pile Supabase locale à part, vingt-quatre défauts
> introduits exprès et tous attrapés ; la recette au simulateur iPhone 17 Pro
> et iPhone SE, à l'émulateur Pixel 8, au back-office et sur le web, trois
> défauts trouvés et corrigés en chemin (§9). **Rien n'est appliqué en
> production** : la mise en service attend Clément, après celle du 22 (§9.6).
>
> Placé après le chantier 22, arbitré le 15 septembre 2026 : le « pourquoi »
> reprend sa modération, le filtre, le signalement, le mail à l'équipe et le
> masquage, plutôt que d'en construire une seconde. Cf. [la
> roadmap](./MON-BENTO-POP-UX-ROADMAP.md) chantier 12, [le chantier
> 22](./UX-22-LIKES-COMMENTAIRES.md) pour la modération, [le chantier
> 7](./UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md) pour le budget de la page d'un
> bento, [le chantier 9](./UX-16-PLUSIEURS-BENTOS.md) pour le brouillon
> local, [le chantier 13](./UX-13-BENTO-HEBDOMADAIRE.md) pour les cases des
> éditions, [le chantier 1](./UX-01-PAGE-BENTO-PUBLIQUE.md) pour la page web.
> Même sortie store unique que tous les chantiers.

---

## 1. Intention

### 1.1 Ce que la roadmap demande

« Un bento est une image. Rien n'explique pourquoi ces six choix. » La
proposition : un champ facultatif d'une ligne par case, pour faire passer le
bento du statut d'image à celui de contenu qu'on a envie de lire, et donner
matière à une rubrique dans l'émission.

L'arbitrage que la roadmap réserve : c'est du texte libre d'utilisateur, donc
une charge de modération, les obligations de la règle 1.2 d'Apple, un
stockage, et un affichage dans une grille déjà dense. Le 22 a installé la
modération ; Clément a tranché le 26 octobre où on le lit (D1), quand on
l'écrit (D2), qui l'écrit (D3) et si le web le montre (D4).

### 1.2 Mesuré le 26 octobre 2026, en production

En lecture seule, sur « My Bento Pop ».

- **28 bentos publiés, par 28 comptes, tous à six cases** : 168 cases en
  ligne. 4 bentos publiés ces 30 derniers jours, 17 en 90 jours : **au plus
  24 « pourquoi » nouveaux par mois** si chaque auteur remplissait ses six
  cases. 13 bentos complets n'ont jamais été publiés.
- **Le bento principal a six cases** : Film, Série, Artiste, Chanson,
  Créateur de contenu, Lieu. Une édition en aura de 2 à 6 ; aucune n'existe
  encore (`editions` vide), aucun compte n'a de second bento.
- **Un bento publié ne se retouche presque jamais** : une seule case changée
  après la publication, sur un seul bento. 18 heures séparent la création de
  la publication, en médiane.
- **Les titres des cases publiées** : 10,5 caractères en médiane, 23 au
  neuvième décile, 51 au plus.
- **Le seul texte libre des membres, aujourd'hui** : les propositions
  d'items, hors pseudo et nom affiché, vide pour les 64 profils. **197
  propositions du 29 mai au 20 octobre**, chacune validée par l'équipe avant
  d'être visible, en 6,9 jours de médiane : 134 validées, 21 fusionnées, 32
  refusées, 10 en attente. **Les 11 refus motivés disent tous « n'existe
  pas »**, les 21 autres n'ont pas de motif. 44 des 168 cases publiées
  tiennent un item proposé par l'auteur du bento.
- **113 comptes, tous anonymes** (§1.2 du 22) : le 28, qui permet de garder
  son compte, sortira avec la prochaine version.
- **3 signalements en cinq mois**, tous sur un bento, classés sans suite 120
  jours après en médiane : personne n'était prévenu, ce que le 22 corrige.

### 1.3 Ce que demandent Apple, Google et le DSA

Les mêmes textes qu'au 22, relus le même jour (§1.3 du 22) : un texte libre
publié par un membre est un contenu d'utilisateur, au même titre qu'un
commentaire.

- **Apple, règle 1.2** : filtrer ce qui se publie, signaler un contenu,
  bloquer un utilisateur, publier un contact ; le refus type ajoute une
  tolérance zéro et une action sous 24 heures. Le 22 a tout installé ; le 12
  y range un texte de plus.
- **Google Play** : signaler **les contenus et les utilisateurs** dans l'app,
  bloquer, modérer en continu.
- **DSA** : recevoir les notifications de contenus illicites (article 16),
  par un mécanisme électronique facile d'accès, là où le contenu se lit ;
  motiver le retrait auprès de l'auteur (article 17) ; décrire sa modération
  dans ses conditions (article 14). La page web d'un bento porte déjà
  « Signaler ce bento », un mail prérempli vers l'équipe (§4.5). Lecture
  d'ingénieur, pas avis juridique.

---

## 2. Objectif et critères de succès

Qu'un bento se lise, et plus seulement se regarde, sans que rien de ce qu'on
y écrit ne reste en ligne plus de 24 heures s'il enfreint les règles.

- **Écrire** en une ligne pourquoi chaque choix, depuis son bento, sans
  toucher au geste du compositeur.
- **Lire** les pourquoi sous la boîte, dans l'app et sur le web, sans que le
  premier écran de la page bouge d'un point.
- **Modérer** avec les outils du 22 : le filtre avant, le signalement après,
  le mail à l'équipe, masquer en un geste.
- **Donner à l'équipe** la liste des pourquoi, matière à une rubrique.
- **Ne rien casser** : la 1.1 et la 0.1.0 lisent, composent et suppriment
  comme avant ; un bento sans pourquoi, tous aujourd'hui, garde sa page au
  pixel près, dans l'app et sur le web.
- **0 €** : aucun service nouveau.

---

## 3. Périmètre

**Dans le chantier.**

- Le pourquoi d'une case : l'écrire, le changer, l'effacer (D2, D3, D5).
- La section « Pourquoi ces choix » sous la boîte de la page d'un bento, dans
  l'app (D1) et sur le web (D4).
- Le filtre avant publication et le rythme (D5, D6).
- Ce que devient le pourquoi quand la case change (D7), et la fusion des
  doublons qui ne vide plus de case (D17).
- Signaler un pourquoi, le masquer avec un motif (D8).
- Le back-office : l'onglet « Pourquoi » de Modération, les signalements et
  le mail (D9).
- L'interrupteur `app_config.whys_enabled` (D10).
- L'export de ses données (D13), les règles et la politique de
  confidentialité (D14).

**Hors du chantier** (§12) : le pourquoi dans « La table », dans l'image de
partage et dans l'aperçu des liens (D11) ; les notifications (D12) ; aimer ou
commenter un pourquoi ; chercher dans les pourquoi ; un pourquoi du bento
entier ; une sélection de l'équipe pour l'émission, au-delà de la liste.

---

## 4. Ce que disent le code et la base

### 4.1 La case et son item

- **Une case est une ligne de `bento_items`** : `bento_id`, `category_id`,
  `item_id`, `added_at`, de clé `(bento_id, category_id)`
  (`20260511000000_initial_schema.sql`). Aucune colonne de texte. Ce que dit
  la case, son étiquette, sa question d'édition, vient de `bento_categories`.
- **Le client l'écrit directement**, sans fonction : un `upsert` des trois
  colonnes pour remplir ou remplacer, un `delete` pour vider
  (`src/lib/bento-actions.ts`). La 1.1 et la 0.1.0 font de même
  (`6426779`, §4.7).
- **Deux déclencheurs** la gardent : le type de l'item doit être celui de la
  case (`bento_items_check_type`), et toute écriture retire la marque de
  publication à la validation du 18 (`bento_items_unmark_on_edit`).
- **Le même item peut tenir deux cases d'un bento** : aucune clé unique sur
  `(bento_id, item_id)`, et « Artiste musical » et « Créateur de contenu »
  partagent le type Personne.

### 4.2 Le compositeur

- **Un toucher remplit la case et referme son écran** (`app/search-modal.tsx`,
  `router.back()`) : ni confirmation ni état choisi, seulement un toast
  « Annuler ». Il n'existe aucun écran de relecture avant la publication, ni
  aucune fiche d'item.
- **Le compositeur tient un écran** : `compose-layout.ts` garde sa boîte entre
  0,65 et 1, budget validé au chantier 2.
- **Un bento publié change en direct** : « En ligne · tes modifications sont
  visibles tout de suite » (`app/(tabs)/compose.tsx`). Aucun brouillon d'un
  bento publié (« On prend A », chantier 5).
- **Sans profil, rien en base** (chantier 9) : le brouillon vit dans
  `useDraft`, persisté sous `bento-pop-draft`, `{ slots, termsAcceptedAt }`.
  `publish_first_bento` le verse à la publication et n'en lit que
  `category_id` et `item_id`.

### 4.3 La page d'un bento dans l'app

- **Sa structure** (`app/u/[pseudo].tsx`) : un `ScrollView` qui tient l'en-tête,
  la bande des autres bentos, la boîte, puis « Ses autres bentos » en entier
  (`AccountBentoList`, chantier 21), 48 points sous la boîte, sous un titre en
  Bungee 10 ; la barre des boutons flotte en bas. « Un filet, pas un mode de
  lecture » : là où le plancher d'échelle ne mord pas, rien ne défile tant
  que le compte n'a qu'un bento.
- **La boîte tient le premier écran** (`public-layout.ts`, chantier 7) : à la
  même taille que dans le fil, rien par-dessus ; le 17 Pro est au plancher.
- **Une case ne se touche pas** : une `View` accessible d'un bloc, « Film :
  Inception, 2010 » (`Tile.tsx`, `tile-pending.ts`). Seul le compositeur en
  fait un bouton.
- **L'onglet Profil rend la même page**, par un client sans session : son
  propriétaire n'y voit que ce que voient les autres.

### 4.4 « La table »

Toucher un bento, cases comprises, ouvre sa page (`FeedPost.tsx`). Le post
est un seul bouton pour le lecteur d'écran, qui lit « Film : Inception. »
pour chaque case (`feed.ts`).

### 4.5 Le web

- **La landing lit la base mobile à la clé anonyme**, sans session
  (`lib/supabase/mobile.ts`), par une seule requête, `BENTO_SELECT`
  (`lib/bento/queries.ts`), qui embarque `bento_items` et leurs `items`. Une
  colonne inconnue (`42703`) la fait réessayer sans `avatar`, puis sans
  `searchable` : une landing redéployée avant sa migration ne tombe pas.
- **La page, dans l'ordre** : l'identité, la boîte, « Compose le tien »,
  « Crédits images », « Ses autres bentos », **« Signaler ce bento »**, un
  `mailto` prérempli vers `contact@bento-pop.com` (`BentoReportLink`), puis
  le pied de page.
- **Aucun script** : les cases sont des composants serveur ; l'e2e vérifie
  que la page n'envoie aucun JavaScript à elle, qu'elle pèse moins de 60 Ko
  compressée et qu'elle n'a qu'un `h1` (`e2e/smoke.test.ts`).
- **Le cache** : 300 secondes, et une purge à la demande, par `pg_net`, que
  seul `bentos` déclenche, à la publication, la dépublication ou la mise en
  avant (`revalidate_landing_bento`). Changer une case ne purge rien.

### 4.6 La modération du 22

- **Réutilisables tels quels** : `normalize_for_filter` et
  `comment_filter_hit`, qui prennent n'importe quel texte, et la liste
  `blocked_terms`, 53 termes ; côté back-office, le mail groupé
  (`lib/moderation`), qui marche par signalement.
- **Propres aux commentaires** : `submit_report` ne connaît que `comment`,
  `account` et `bento`, ne copie le texte que d'un commentaire, et la
  contrainte de `target_kind` ferme la liste ; le back-office aussi (`KINDS`,
  `ReportRow`, `hideComment`) ; le mail dit « Cible » d'un type inconnu.
- **Ce qui est masqué s'efface 12 mois après**, à l'ouverture de Modération
  (D20 du 22).

### 4.7 Les versions publiées

Lues sur `6426779`, le code de la 1.1 et de la 0.1.0.

- **Des listes de colonnes partout** sur `bentos`, `bento_items` et `items`,
  aucun `select('*')`, aucune fonction : un `upsert` des trois colonnes de
  `bento_items`, un `delete` pour vider une case, la suppression du profil
  qui emporte tout en cascade.
- **Une table nouvelle, liée à la case par une seule clé étrangère composée
  en cascade, ne leur change rien.** Sans cascade, leur suppression d'une
  case, d'un compte, et la fusion du back-office échoueraient. Deux clés
  étrangères dans sa clé, vers `bentos` et `bento_items` par exemple, feraient
  un chemin de plusieurs à plusieurs qui rendrait leurs requêtes embarquées
  ambiguës (`PGRST201`), et celles de la landing et du back-office avec.
- **Elles remplacent un item par une mise à jour de la ligne**, pas par une
  suppression : seul un déclencheur peut effacer le pourquoi de l'item
  remplacé.

### 4.8 La fusion des doublons

`admin_merge_items` (`20260907000000_admin_merge_items_enrichment.sql`)
supprime d'abord la case du doublon **dès que le bento tient l'item gardé,
dans n'importe quelle case**, pour éviter un conflit de clé que la clé
`(bento_id, category_id)` rend impossible. Une personne choisie comme artiste
et comme créateur de contenu, en deux fiches, perdrait ainsi une case à la
fusion ; avec le 12, son pourquoi aussi. La réécriture de l'item vient avant
la marque `merged_into_id` du doublon.

### 4.9 L'export

`src/lib/data-export.ts` lit les bentos et leurs cases ; la 1.1 n'exportera
pas les pourquoi, qu'elle ne sait pas écrire.

---

## 5. Design

### 5.1 La section sous la boîte (D1)

- **Sous la boîte**, avant « Ses autres bentos », une section « Pourquoi ces
  choix », à 32 points de la boîte : un titre en Bungee 10, comme celui des
  autres bentos, puis une carte crème, contour d'encre, ombre « stamp », une
  ligne par case expliquée, dans l'ordre des cases :
  - l'étiquette de la case, son tampon ou la question de l'édition, en
    Bungee ;
  - le titre de l'item, en gras ;
  - le pourquoi, entre guillemets français, dans la police des
    commentaires.
- **Rien tant qu'aucune case n'est expliquée** : la page des 28 bentos en
  ligne ne change pas d'un point.
- **Pour les autres**, chaque ligne porte un bouton « … » de 44 points, qui
  ouvre la feuille d'actions du 22 : « Signaler ce pourquoi ».
- **Pour son propre bento**, la page lit ses pourquoi par la session (§4.3),
  masqués compris : une ligne masquée se grise à 65 % d'encre et dit
  « Masqué par l'équipe · motif ». Le titre de la section porte « Modifier ».
  Sans aucun pourquoi, la section devient une invitation : « Dis pourquoi
  ces choix, une ligne par case. » et un bouton « Écrire mes pourquoi ».
- **Le lecteur d'écran** lit le titre comme un en-tête, puis chaque ligne
  d'un bloc : « Film : Inception. Pourquoi : … ». Le bouton « … » se nomme
  « Options du pourquoi, Film ».
- **Le premier écran ne bouge pas** : la section vit sous la boîte, que le
  budget du chantier 7 garde entière ; il faut défiler pour la lire, comme
  pour les autres bentos.

### 5.2 Écrire ses pourquoi (D2, D3, D5)

- **Après la publication, depuis sa page** : l'invitation, puis « Modifier »,
  ouvrent l'écran modal « Tes pourquoi », une ligne par case remplie :
  l'étiquette et le titre, un champ d'une ligne, « Pourquoi ce choix ? ». La
  première publication ouvre la page (`app/onboarding/pseudo.tsx`) :
  l'invitation s'y voit dès la fermeture de la feuille « Garde ton bento »
  du 28.
- **Le champ** : 120 caractères au plus, le compte qui reste dès 20, les
  émojis permis, aucun saut de ligne. « Suivant » passe au champ d'après ;
  « Enregistrer » écrit ce qui a changé, un champ vidé efface son pourquoi.
  Un refus du filtre se dit sous son champ, sans rien perdre des autres :
  « Ce pourquoi contient un mot ou un lien refusé. », la phrase des
  commentaires.
- **Le compositeur ne change pas** : un toucher remplit la case, son écran
  tient toujours, et le brouillon local du 9 ne garde aucun texte.
- **Tout auteur d'un bento publié** écrit les pourquoi de ses cases, compte
  anonyme compris (D3) : il a un pseudo et a accepté les règles en publiant.
- `KeyboardAvoidingView` en `padding` sur les deux plateformes, piège relevé
  au 22.

### 5.3 Quand la case change (D7)

- **Remplacer l'item d'une case efface son pourquoi** : il expliquait l'autre.
  Le compositeur le dit avant : « Remplacer « Inception » ? Son pourquoi sera
  effacé. » ; seulement quand la case en a un.
- **Vider la case** l'efface aussi, dans la même transaction.
- **Un item proposé, en attente**, garde son pourquoi, que seul l'auteur voit
  jusqu'à la validation, comme l'item.
- **La fusion de deux doublons par l'équipe le garde** : c'est le même item
  (D17).
- La 1.1 et la 0.1.0 suivent les mêmes règles, tenues en base (§6.3).

### 5.4 Le web (D4)

- **La même section, sous la boîte de `/u/[pseudo]`**, après « Compose le
  tien » et avant les crédits, pour la raison qui y place déjà les crédits :
  six lignes sous la boîte repousseraient le seul bouton de la page hors de
  l'écran d'un téléphone. Un `h2`, une liste de définitions, rendue au
  serveur, sans script.
- **« Signaler ce bento »** couvre ses pourquoi : son mail prérempli demande,
  avec le motif, la case visée si c'est un pourquoi. L'équipe le masque
  depuis le back-office.
- **Aussitôt à jour** : écrire, changer, effacer ou masquer un pourquoi
  purge la page, comme une publication (§6.3).
- **Une landing redéployée avant la migration** réessaie sans les pourquoi,
  comme pour `avatar`.
- Ni l'aperçu des liens ni « Ses autres bentos » ne les montrent (D11).

### 5.5 Signaler et masquer (D8)

- **Signaler un pourquoi** : l'écran « Signaler » du 22, avec sa cible
  nouvelle ; le texte est copié au signalement, la trace survit à son
  effacement.
- **Masquer** : l'équipe masque, avec un motif que seul l'auteur voit (§5.1),
  en un geste depuis le signalement, le motif repris. Les autres ne voient
  plus la ligne.
- **Réécrit par son auteur**, un pourquoi masqué repasse au filtre et
  redevient visible : c'est un autre texte, que l'on peut signaler à nouveau.
  Le bannissement reste la réponse à la récidive.

### 5.6 Le back-office (D9)

- **Modération gagne un troisième onglet, « Pourquoi »** : les 100 derniers,
  du plus récent au plus ancien, l'auteur, le bento, la case, l'item, le
  texte et son état ; « Masquer », avec un motif, et « Rétablir ». C'est
  aussi la liste où l'équipe puise sa rubrique.
- **Les signalements d'un pourquoi** se traitent comme ceux d'un commentaire :
  le texte signalé, « Masquer le pourquoi » en un clic, « Classer sans
  suite », « Bannir ».
- **Le mail groupé** les compte : « un pourquoi ».

### 5.7 L'interrupteur (D10)

`app_config.whys_enabled`, allumé : éteint, l'app cache la section et
l'écran, la base refuse d'écrire, et la lecture ne rend plus rien, web
compris. Les pourquoi restent stockés et reviennent au rallumage.

### 5.8 Les textes (D14)

- **Les règles de l'app** (`app/onboarding/terms.tsx`) et la section 6 des
  mentions légales nomment les pourquoi : « pseudonymes, bentos, pourquoi et
  commentaires », « masquer un pourquoi ou un commentaire ».
- **La politique de confidentialité** : le pourquoi d'une case, facultatif,
  public, gardé tant que la case garde son item, effacé avec elle ; un
  pourquoi masqué, effacé 12 mois après.

---

## 6. Contrat

### 6.1 La table

```sql
create table public.bento_whys (
  id            uuid primary key default gen_random_uuid(),
  bento_id      uuid not null,
  category_id   smallint not null,
  body          text not null check (char_length(body) between 1 and 120),
  status        text not null default 'visible'
                  check (status in ('visible', 'hidden')),
  hidden_reason text,
  hidden_at     timestamptz,
  hidden_by     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (bento_id, category_id),
  foreign key (bento_id, category_id)
    references public.bento_items (bento_id, category_id) on delete cascade
);
```

- **Une seule clé étrangère, composée, en cascade** (§4.7) : vider une case,
  supprimer un bento ou un compte, bannir, emporte son pourquoi.
- **Un identifiant propre**, pour qu'un signalement le vise par
  `submit_report`, qui prend un `uuid`.
- **RLS**, tous droits retirés à `anon` et `authenticated`, puis la lecture
  de `id`, `bento_id`, `category_id`, `body`, `created_at` et `updated_at`
  seulement : le motif d'un masquage ne se lit que par sa fonction.
- **Une règle de lecture** : visible, l'interrupteur allumé, le bento
  publié, l'item de la case validé. La landing et la page de l'app
  l'embarquent sous `bento_items`, dans la requête qu'elles font déjà.

### 6.2 Les fonctions

Toutes en `security definer`, `search_path` vide, pour `authenticated`
seulement ; leurs erreurs portent une clé que l'app traduit en phrase.

- **`set_bento_why(p_bento uuid, p_case text, p_body text)`** : écrit,
  remplace ou, vide, efface le pourquoi d'une case de son bento, nommée par
  sa clé, `film` ou `ed3_2`, comme l'app nomme ses cases.
  Refuse sans session, hors de ses bentos, sur une case vide, l'interrupteur
  éteint. Réduit les blancs puis rogne, comme un commentaire ; refuse un
  texte de plus de 120 caractères ou avec un caractère de contrôle
  (`why_invalid`), un lien ou un mot de la liste (`why_refused_filter`), plus
  de 30 écritures par heure (`why_too_fast`), comptées dans un journal d'une
  journée ; effacer reste toujours permis. Écrit `visible` : un pourquoi
  masqué réécrit d'un autre texte revient, le même texte le laisse masqué
  (D8).
- **`my_bento_whys(p_bento uuid)`** : les pourquoi de son bento, masqués
  compris, avec leur motif ; pour la page de son propre bento et l'écran
  « Tes pourquoi ».
- **`submit_report`** : la cible `why`, une colonne
  `reports.target_why_id`, en `on delete set null`, le texte copié dans
  `target_text`, le bento et son auteur notés ; la contrainte de
  `target_kind` s'élargit. La 1.1 et la 0.1.0 insèrent toujours `bento`.
- **`my_social_export`** ajoute les pourquoi, avec leur état et leur motif.

### 6.3 Les déclencheurs

- **Sur `bento_items`, à la mise à jour de `item_id`** : efface le pourquoi
  de la case, sauf pendant une fusion, que `admin_merge_items` signale à sa
  transaction (D17).
- **Sur `bento_whys`**, à chaque écriture : la purge de la page web du bento,
  par `pg_net`, comme `revalidate_landing_bento`, et sans jamais faire
  échouer l'écriture.
- **`admin_merge_items`** ne supprime plus la case d'un doublon que le bento
  tient déjà ailleurs : il réécrit l'item, la clé ne pouvant entrer en
  conflit (§4.8).

### 6.4 La configuration et les types

- `app_config.whys_enabled boolean not null default true`, lu par l'app au
  démarrage, avec `comments_enabled`.
- `packages/supabase-mobile/src/types.ts` : la table, les deux fonctions, la
  cible `why` de `ReportTargetKind`.

---

## 7. Recette

### 7.1 Les contrôles de la base

`scripts/check-whys.mjs`, sur le modèle de `check-social.mjs`, contre une
pile Supabase locale à part, à la clé anonyme et avec de vrais comptes :

- écrire, remplacer, effacer ; hors de ses bentos, sur une case vide, sans
  session, refusé ;
- 120 caractères acceptés, 121 refusés ; les 20 mots courants de §1.2 du 22
  acceptés ; un mot de la liste, un lien, refusés ;
- un pourquoi d'un bento non publié, d'un item en attente, masqué, ou
  l'interrupteur éteint : invisible à la clé anonyme ; le motif jamais lu par
  la table ;
- remplacer l'item, par la fonction de l'app comme par l'`upsert` de la 1.1,
  efface le pourquoi ; vider la case aussi ; la fusion le garde, et ne vide
  plus de case ;
- signaler un pourquoi, depuis un compte sans profil ; la trace survit à son
  effacement ; un signalement en attente par signaleur et par cible ;
- le rythme ; la cascade au bannissement ; l'export ;
- **les lectures et les écritures de la 1.1 et de la 0.1.0**, relues sur
  `6426779`, rejouées telles quelles : rien ne change.

Puis des défauts introduits exprès, un par règle, tous attrapés.

### 7.2 Aux trois appareils

Au simulateur iPhone 17 Pro et iPhone SE, à l'émulateur Pixel 8, sur la pile
locale :

1. la page d'un bento sans pourquoi, identique au pixel avant et après ;
2. publier, voir l'invitation, écrire trois pourquoi, dont un refusé ;
3. lire la section depuis un autre compte, la signaler ;
4. masquer au back-office ; l'auteur lit le motif, l'autre compte ne voit
   plus la ligne ; réécrire, revoir ;
5. remplacer un item expliqué au compositeur, la question puis l'effacement ;
6. la plus grande taille de texte, écran ouvert, et 200 % sur Android ;
7. le web : la section, la purge, la landing avant la migration ;
8. l'interrupteur éteint puis rallumé.

---

## 8. Lots

1. **La base** : la migration, `check-whys.mjs`, les défauts introduits
   exprès, les contrôles en lecture de la mise en service.
2. **Les données de l'app** : `whys.ts`, pur et testé, les actions, la
   lecture embarquée de la page, l'export, l'interrupteur.
3. **Les écrans** : la section, l'invitation, « Tes pourquoi », la question
   du compositeur, le signalement.
4. **Le back-office et la landing** : l'onglet, les signalements, le mail ;
   la section du web, son repli, les règles et la confidentialité.
5. **La recette** de §7.2, la DoD point par point.

---

## 9. Livraison

Fait et recetté le 26 octobre 2026, en cinq lots enchaînés, sur
`feat/ux-12-pourquoi-par-case`, en PR #100, empilée sur la #99 du chantier 22
tant qu'elle n'est pas fusionnée. Rien n'est appliqué en production : la mise
en service attend Clément (§9.6).

### 9.1 Lot 1 · La base

- `20261026210000_bento_whys.sql` : `bento_whys` et son journal du rythme,
  l'interrupteur, la règle de lecture par `why_is_public`, les deux
  déclencheurs, la fusion sans sa suppression préalable, la cible `why` de
  `submit_report`, `set_bento_why`, `my_bento_whys`, l'export.
- `scripts/check-whys.mjs` : **67 contrôles** contre une pile Supabase locale
  à part, à la clé anonyme et avec de vrais comptes, la purge de la page web
  comprise, par un récepteur que le script ouvre lui-même ; aucun échec.
- **Vingt-quatre défauts introduits exprès**, un par règle, tous attrapés ;
  le banc attend deux secondes après chaque migration, le temps que PostgREST
  recharge son schéma, sans quoi un contrôle échouait au hasard.
- **Le contrat a changé en chemin** : `set_bento_why` prend la clé de la case,
  `film` ou `ed3_2`, et non son numéro, que l'app ne connaît pas pour une
  édition.
- `scripts/check-whys.sql` : les contrôles en lecture de la mise en service.

### 9.2 Lot 2 · Les données de l'app

- `whys.ts`, pur, et ses tests ; `why-actions.ts`, testé contre le bouchon
  PostgREST ; la lecture des pourquoi embarquée dans la requête de la page,
  avec leur identifiant pour le signalement ; `useOwnWhys`, remis à zéro au
  changement de compte ; l'interrupteur ; l'export.

### 9.3 Lot 3 · Les écrans

- La section « Pourquoi ces choix » et son invitation, l'écran « Tes
  pourquoi », la question du compositeur avant de remplacer ou de vider une
  case expliquée, « Signaler un pourquoi », les règles de l'app.

### 9.4 Lot 4 · Le back-office et la landing

- Modération gagne l'onglet « Pourquoi », masquer et rétablir ; un
  signalement de pourquoi se masque en un clic, le motif repris ; le mail les
  nomme ; un pourquoi masqué s'efface 12 mois après.
- La landing lit les pourquoi dans sa requête, retombe sur l'ancienne sans
  eux (`PGRST200`) ; la section vient après « Compose le tien » ; le mail de
  « Signaler ce bento » demande la case visée ; la politique de
  confidentialité et la section 6 des mentions légales nomment les pourquoi.
- **Relevé en chemin, antérieur au 12** : le bouchon de l'e2e de la landing
  ne rendait pas `edition_id`, que PostgREST rend toujours, nul pour un bento
  libre. La landing lisait donc chaque bento du bouchon comme une édition sans
  cases : depuis le chantier 13, l'e2e dessinait des boîtes vides, et ses
  tests passaient sur les titres de la description. Le bouchon le rend
  désormais ; les 53 tests passent, boîtes dessinées.

### 9.5 Lot 5 · La recette

Sur une pile locale à part, un Metro à part, deux simulateurs dans leur
propre jeu d'appareils et l'émulateur `Recette_Textes_Pixel_8`, rebranchés
sans recompiler.

- **iPhone 17 Pro, l'auteur** : un compte neuf compose, publie, ferme « Garde
  ton bento » et l'accord des éditions, et trouve l'invitation sous la boîte.
  Trois pourquoi, accents et émoji compris ; celui qui porte une injure est
  refusé sous son champ, les deux autres s'enregistrent. Masqué par l'équipe,
  le sien se grise avec son motif ; réécrit d'un autre texte, il revient,
  l'ancien motif parti. Au compositeur, remplacer un item expliqué demande
  d'abord ; « Annuler » ne touche à rien, « Remplacer » efface le pourquoi ;
  vider la case aussi. Les rôles relus avec un compagnon `idb` neuf, tous
  justes.
- **iPhone SE, le visiteur** : un compte sans profil lit la section et
  signale un pourquoi, « Spam ou arnaque » ; le signalement porte la cible
  `why` et la copie du texte. Masqué, le pourquoi disparaît pour lui ; réécrit,
  il revient. La plus grande taille de texte, écran ouvert, dans les deux
  sens. L'interrupteur éteint, puis rallumé.
- **Une page sans pourquoi, identique au pixel** : la même page, au SE, avec
  le JavaScript du 12 puis avec celui du 22, en haut et en bas de page, barre
  d'état mise à part.
- **Pixel 8** : un compte neuf publie et écrit à 200 % ; le clavier ne couvre
  pas le dernier champ ; le bouton retour ferme l'écran.
- **Le back-office** : le battement envoie « Pourquoi de @maeldouze · Spam ou
  arnaque · « … » » et mène à la modération ; le second n'envoie rien ;
  masquer prend un clic ; l'onglet « Pourquoi » liste, masque et rétablit.
- **Le web**, en build de production contre la même pile : la section après
  l'appel à l'action ; masquer au back-office, et la lecture suivante, sans
  cache, n'a plus le pourquoi ; rétablir, et il revient.
- **Trois défauts trouvés et corrigés** :
  - **le lecteur d'écran annonçait les options d'une ligne avant la ligne** :
    le cadre du bouton remontait de dix points ; il s'aligne sur la ligne, le
    « … » toujours à hauteur de l'étiquette ;
  - « bento-pop.com » se coupait au trait d'union dans « Tes pourquoi » : un
    trait d'union insécable ;
  - le bouchon de l'e2e de la landing, §9.4.
- **Relevé, hors du 12** : à 200 % sur Android, « AROUND THE WORLD » se coupe
  dans sa case ; et changer la taille du texte écran ouvert redémarre
  l'activité Android, ce qui perd un champ non enregistré, comme partout
  ailleurs dans l'app.
- La voix de VoiceOver et de TalkBack, un vrai mail par Resend et un vrai
  téléphone vont au chantier 29.

### 9.6 La mise en service, par Clément

Après celle du 22, dont la migration doit précéder celle-ci : `submit_report`
y est redéfini et le filtre en vient.

1. **La migration**, dans l'éditeur SQL de « My Bento Pop », puis les
   contrôles en lecture de `scripts/check-whys.sql`.
2. **La landing et le back-office** redéployés sur Coolify, après la fusion.
   Aucune variable nouvelle : la purge passe par les deux secrets du coffre
   déjà posés pour la publication.

---

## 10. Definition of Done

État au 26 octobre 2026 : 11 sur 13, les deux derniers à la mise en service.

1. ✅ Écrire, remplacer et effacer le pourquoi d'une case de son bento publié,
   et d'aucun autre, vérifié à la clé anonyme : contrôles 1, recette au
   17 Pro et au Pixel 8.
2. ✅ Le filtre refuse les mots de sa liste et les liens, et aucun des 20 mots
   courants de §1.2 du 22 : contrôles 2, et le refus sous son champ.
3. ✅ Un pourquoi masqué, d'un item en attente ou d'un bento non publié ne se
   lit nulle part ; son motif, par son auteur seul : contrôles 3 et 4,
   recette au 17 Pro et au SE.
4. ✅ Remplacer ou vider une case efface son pourquoi, depuis l'app comme
   depuis la 1.1 ; la fusion le garde et ne vide plus de case : contrôles 5,
   et la question du compositeur.
5. ✅ Signaler un pourquoi depuis un compte sans profil ; l'équipe reçoit le
   mail, masque en un geste, l'auteur lit le motif : recette du lot 5, sur
   Mailpit ; le vrai mail de Resend au chantier 29.
6. ✅ La section sous la boîte, dans l'app et sur le web ; la page d'un bento
   sans pourquoi identique au pixel près : recette du lot 5.
7. ✅ Le web à jour dès l'écriture ou le masquage ; la landing tient avant la
   migration : contrôles 11, recette du web, e2e.
8. ✅ `whys_enabled` coupe tout sans nouvelle version : contrôles 3, recette
   au SE.
9. ✅ La 1.1 et la 0.1.0 lisent, composent et suppriment comme avant, relues
   sur `6426779` : contrôles 5 et 8.
10. ⬜ Les règles, les mentions légales et la politique de confidentialité à
    jour, **en production** : écrites, la landing à redéployer après la
    fusion.
11. ✅ La recette de §7.2 aux trois appareils, §9.5.
12. ⬜ La migration prouvée compatible, **appliquée et contrôlée** ; la CI
    rejouée en local : compatible, et la CI rejouée sans échec, lint 8 sur 8,
    typage 8 sur 8, tests 962, 251 et 202, builds 3 sur 3, e2e 53 sur 53 ;
    l'application attend la mise en service.
13. ✅ Aucun service payant.

---

## 11. Décisions

D1 à D4 rendues par Clément le 26 octobre 2026, en QCM, chaque fois l'option
recommandée ; D5 à D20 prises par la spécification.

| # | Décision | Raison |
| --- | --- | --- |
| **D1** | On lit les pourquoi sous la boîte de la page, en liste, une ligne par case expliquée | La boîte et ses 168 cases en ligne ne bougent pas ; une liste se lit d'un trait, et la même vit sur le web, sans script ; une feuille au toucher d'une case aurait changé le premier écran et demandé un script au web |
| **D2** | On les écrit après la publication, depuis la page de son bento, dans l'écran « Tes pourquoi » | Le compositeur garde son geste unique et son budget d'un écran, le brouillon local ne garde aucun texte ; la première publication ouvre la page |
| **D3** | Tout auteur d'un bento publié écrit les pourquoi de ses cases, compte anonyme compris | Le pourquoi vit dans son propre bento, sous son pseudo, comme ses items ; les 113 comptes sont anonymes, et un banni peut déjà republier un bento en réinstallant |
| **D4** | Le web montre les pourquoi, sous la boîte, rendus au serveur | C'est la page qu'on partage ; « Signaler ce bento » y existe déjà ; la purge la tient à jour (D16) |
| **D5** | Un pourquoi : 1 à 120 caractères, sur une ligne, émojis permis, sans lien ; filtré comme un commentaire, par la même liste | Une phrase qui se lit d'un coup d'œil et à l'antenne ; la liste du 22 refuse 0 des 20 mots courants |
| **D6** | Un filtre avant, la modération après, sur signalement, au même mail et au même engagement de 24 heures | La règle des commentaires (D2 du 22) ; valider avant ferait attendre 6,9 jours, comme les propositions |
| **D7** | Remplacer ou vider une case efface son pourquoi ; le compositeur le dit avant ; un item en attente garde le sien, caché comme lui | Il expliquait l'autre item ; 1 case sur 168 a changé après publication, la question restera rare |
| **D8** | Signaler un pourquoi ; l'équipe masque avec un motif que seul l'auteur voit ; réécrit, il repasse au filtre et revient | Google demande de signaler un contenu précis, le DSA de motiver ; un texte nouveau se juge à nouveau, la récidive se bannit |
| **D9** | Un onglet « Pourquoi » dans Modération, les 100 derniers, masquer et rétablir ; les signalements traités comme ceux d'un commentaire | L'équipe lit tout, au plus 24 par mois au rythme d'aujourd'hui, et y trouve sa rubrique |
| **D10** | `app_config.whys_enabled` coupe les pourquoi sans nouvelle version, web compris | L'interrupteur des commentaires (D15 du 22), pour une crise |
| **D11** | Ni « La table », ni l'image de partage, ni l'aperçu des liens, ni « Ses autres bentos » ne montrent les pourquoi | Leurs budgets sont au plus juste ; on lit les pourquoi sur la page, où mène le toucher du fil |
| **D12** | Aucune notification d'un pourquoi | La zone du 24 |
| **D13** | L'export ajoute ses pourquoi, leur état et leur motif | Des données de son compte |
| **D14** | Les règles, la section 6 des mentions légales et la politique de confidentialité nomment les pourquoi | Apple, Google et l'article 14 du DSA, comme au 22 |
| **D15** | Une table à part, une ligne par case, liée à la case par une seule clé étrangère composée, en cascade ; un identifiant propre | §4.7 : rien ne change pour la 1.1 et la 0.1.0, ni pour les requêtes embarquées de la landing et du back-office |
| **D16** | Toute écriture d'un pourquoi purge la page web de son bento | Un pourquoi masqué ne reste pas 5 minutes de plus en ligne ; l'auteur voit le sien en partageant aussitôt |
| **D17** | La fusion de deux doublons garde le pourquoi et ne vide plus de case | §4.8 : la suppression préalable ne protégeait d'aucun conflit et vidait une case à tort |
| **D18** | Au plus 30 écritures de pourquoi par heure et par compte | Contenir un script, chaque écriture purgeant une page ; six cases et leurs retouches tiennent dedans |
| **D19** | Un pourquoi masqué s'efface 12 mois après, avec les commentaires masqués | La règle du 22 (D20) |
| **D20** | Les éditions et les seconds bentos ont leurs pourquoi, comme le bento principal | Le même modèle de case ; rien de visible avant la sortie store unique |

---

## 12. Suivis

- **Hors du chantier** : le pourquoi dans « La table », l'image de partage et
  l'aperçu des liens (D11) ; les notifications, au 24 (D12) ; aimer ou
  commenter un pourquoi ; chercher dans les pourquoi ; un pourquoi du bento
  entier ; une sélection de l'équipe pour l'émission.
- **Relevé en chemin, hors du 12** : le commentaire de `lib/editions.ts`
  dit que supprimer une case d'édition supprime ses `bento_items` en
  cascade ; la clé étrangère n'a pas de `on delete`, la suppression serait
  refusée. Sans danger tant qu'aucune édition n'a de bento.
- **La recette d'appareil** : la voix de VoiceOver et de TalkBack, un vrai
  téléphone, au chantier 29.
