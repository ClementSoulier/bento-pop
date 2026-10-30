# Chantier 29 · La recette de sortie

> Spécification écrite le 27 octobre 2026, à partir du code de
> `feat/ux-27-succes` (`734d736`, la PR #105, elle-même sur la #104, la #103,
> la #102 et la #101), des spécifications des chantiers 1 à 28, et de lectures
> faites sans rien écrire : la base mobile, projet « My Bento Pop », la fiche
> publique de l'App Store, et les pages d'aide d'Apple et de Google. Aucune
> écriture en production.
>
> **Arbitrages rendus le 27 octobre 2026 par Clément**, en QCM, D1 à D3
> (§11) : la sortie s'appelle **2.0.0** ; elle **attend le lot 5b du 17**,
> donc la clé APNs et le compte FCM ; elle se met en ligne **d'un coup**,
> plutôt qu'en publication échelonnée. D4 à D24 sont pris par la
> spécification, sauf l'âge minimum (D23), rendu ensuite par Clément en
> QCM, l'option recommandée : **15 ans**.
>
> **Ce chantier ne se termine qu'à la sortie**, par la recette sur deux vrais
> téléphones, en build de production. Fait le 27 octobre, avant elle : la
> liste de sortie, rassemblée et dédoublonnée (§4) ; les fiches des stores,
> prêtes à recopier (§6) ; les notes de version (§7) ; la 2.0.0 dans
> `app.json` ; une répétition de la build de release au simulateur et à
> l'émulateur, sur une pile Supabase locale (§8). La liste se coche sur la
> page « Mes tâches Bento Pop » (D5). Le même jour, les deux suivis de code
> que la préparation a trouvés : VoiceOver en français (D18), et les textes
> légaux justes, l'âge de 15 ans compris (D14, D23). Sur
> `feat/ux-29-recette-de-sortie`, **PR #106**, fusionnée le 27 octobre au
> soir avec les PR #101 à #105 ; l'étape 1 de l'ordre de sortie faite le
> 28 octobre : tout est en service (§3).
>
> **Le 28 octobre, la sortie attend aussi la refonte visuelle** (D25),
> dessinée le même jour dans Claude Design et devenue les chantiers 30 à 34
> de la roadmap : une étape de plus au §3, entre le 5b et la répétition. Le
> dossier du design est dans [`docs/design-v2/`](./design-v2/LISEZMOI.md).

---

## 1. Où en est la sortie

Relevé le 27 octobre 2026 ; la base et le back-office, le 28.

| Quoi | État |
|---|---|
| App Store | **1.1**, servie depuis le 7 septembre, classée **4+**, iOS 16.4 minimum |
| Play Store | **0.1.0**, relevé le 17 septembre |
| `app.json` | **2.0.0** (D1), au lieu de la 1.3.0 |
| Builds jamais publiées | la 1.2.0 et la 1.3.0, construites en septembre, sur TestFlight et le canal interne |
| Base de production | toutes les migrations des chantiers ; celles du 22, du 12, du 23, du 24, du 25 et du 27 appliquées le 28 octobre, chacune contrôlée en lecture |
| Back-office et landing | le code de toutes les fusions ; le domaine `moderation.bento-pop.com` posé chez Resend le 28 octobre |
| Notifications push | le battement du 17 en service depuis le 26 septembre, sans destinataire ; le 5b fait et recetté le 28 octobre (PR #108), la clé APNs et le compte FCM posés le même jour |
| Refonte visuelle | ajoutée le 28 octobre : les chantiers 30 à 34, avant la sortie (D25) ; le design versé dans `docs/design-v2/` ; le 30, le socle, fait et recetté le 30 octobre sans changer aucun écran, sa part versée au §4 |

**Vingt-trois chantiers touchent l'app** depuis la 1.1 : les 2, 3, 5, 6, 7, 8,
9, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27 et 28. Le 4 est
absorbé par les 2 et 3, le 10 par le 21, le 26 par les 20, 22, 23 et 25 ; le
1 est sur le web et le 14 au back-office. S'y ajoutent, depuis le 28
octobre, les cinq de la refonte visuelle, les 30 à 34 (D25).

---

## 2. Pourquoi une recette à part

Décidé le 17 septembre 2026 : un chantier se fusionne après sa recette au
simulateur et à l'émulateur, ce qui demande un vrai téléphone s'ajoute à la
liste de ce chantier, et **la sortie store unique attend que la liste soit
vide**. Le simulateur ne montre ni la voix de VoiceOver et de TalkBack, ni
l'haptique, ni la fluidité d'une build de production, ni les notifications
de l'environnement de production d'APNs, ni les apps tierces (Instagram,
TikTok, WhatsApp, YouTube).

Une build de production ne se comporte pas non plus comme une build de
développement : pas de LogBox, le code embarqué plutôt que servi par Metro,
la mise à jour à distance active au lancement, cf.
[`DEPLOIEMENT-MOBILE.md`](./DEPLOIEMENT-MOBILE.md) §5. D'où la répétition du
§8, avant la build EAS.

---

## 3. L'ordre de sortie

| # | Étape | Qui | Fait quand |
|---|---|---|---|
| 1 | Les fusions et les mises en service des 22, 12, 23, 24, 25 et 27, le back-office redéployé | Clément ; l'agent passe les contrôles en lecture seule | chaque `scripts/check-*.sql` rend l'attendu : ✅ le 28 octobre, tous |
| 2 | Le lot 5b du 17 : la clé APNs et le compte FCM dans EAS, `google-services.json` dans l'app, la recette de bout en bout en local | Clément pour les clés et le fichier, l'agent pour le reste | une notification reçue et tapée au simulateur et à l'émulateur : ✅ le 28 octobre, PR #108 |
| 3 | La refonte visuelle, chantiers 30 à 34 de la roadmap (D25) | l'agent ; Clément pour les arbitrages de chaque chantier et ses fusions | chaque écran identique à sa maquette de `docs/design-v2/`, au simulateur et à l'émulateur |
| 4 | La répétition de la build de release (§8), refaite après le 5b et la refonte | l'agent | elle démarre, se branche, publie et lit sans défaut bloquant |
| 5 | La build de production 2.0.0 : `pnpm release` depuis `apps/mobile` | Clément | elle arrive sur TestFlight et sur le canal interne de Play |
| 6 | La recette de sortie : la liste du §4 et les parcours du §5, sur un iPhone et un Android | Clément, l'agent lisant la base et les journaux sans rien écrire | la liste est vide |
| 7 | Les fiches des stores du §6, les notes de version du §7 | Clément, dans les deux consoles | chaque fiche enregistrée |
| 8 | La soumission : l'App Store en revue, Play du canal interne à la production | Clément | les deux stores servent la 2.0.0, à 100 % (D3) |
| 9 | Le jour même : `ios_latest_version` et `android_latest_version` à `2.0.0` | Clément, au back-office | le bandeau de mise à jour s'affiche dans la 1.1 |
| 10 | Après : le plancher de version (D8 du 13), la première édition, une vraie mise à jour à distance (lot B) | Clément, l'agent pour la mise à jour | cf. §4, passe G |

**Une correction trouvée à l'étape 6** repart de l'étape 4 : correctif,
répétition, nouvelle build. Le numéro de build suit tout seul
(`autoIncrement`), la version reste 2.0.0.

---

## 4. La liste de sortie

Cinquante-quatre points, rassemblés le 27 octobre depuis la roadmap et les
vingt-six spécifications, puis dédoublonnés, et deux de plus versés par le
30 le 30 octobre (30-a, 30-b) : un contrôle demandé par
plusieurs chantiers n'a qu'une ligne, numérotée au chantier qui en tient la
version la plus complète. Chaque point dit d'où il vient : *versé*, listé par
la roadmap au chantier 29 ; *spec seule*, laissé à l'appareil par une
spécification sans figurer dans cette liste ; *implicite*, jamais vu sur
l'appareil concerné, sans renvoi écrit. La liste se coche sur la page « Mes
tâches Bento Pop » (D5).

**Les sources**, abrégées : RM, la roadmap ; UX-NN, la spécification du
chantier NN ; REC, `RECETTE-MOBILE.md` ; MAJ, `MISES-A-JOUR-APP.md` ; DEP,
`DEPLOIEMENT-MOBILE.md` ; ROLES, `RELEVE-ROLES-IOS.md` ; SC,
`STORE-COMPLIANCE.md`.

**Les prérequis communs**, cités par leur code :

- **P1 · La build de sortie** : la 2.0.0 de production, installée par
  TestFlight et par le canal interne de Play, sur un vrai iPhone et un vrai
  Android, plus un second téléphone quand le point le dit. Une build de
  développement ne vaut pas : elle charge son code depuis Metro, la mise à
  jour au lancement y est éteinte, et LogBox y montre ce qu'une build de
  production tait.
- **P2 · Les migrations en production** : celles des 22, 12, 23, 24, 25 et
  27, dans cet ordre, chacune suivie du redéploiement qu'elle appelle.
  Rempli le 28 octobre : toutes appliquées et contrôlées, le back-office à
  jour.
- **P3 · Écrire en production**, avec les comptes de P6 seulement.
- **P4 · Le 5b du 17** : la clé APNs et le compte de service FCM dans EAS,
  `google-services.json` dans l'app et une build Android neuve ;
  `EXPO_ACCESS_TOKEN` posé sur le back-office. Rempli le 28 octobre (PR
  #108), sauf `EXPO_ACCESS_TOKEN`, qui attend le robot d'Expo (D17 du 17).
  Push est coché depuis le même jour sur l'identifiant d'app : les profils
  d'approvisionnement iOS sont à refaire à la build 2.0.0, ce qu'EAS fait
  seul s'il accède à Apple, connexion de Clément ou clé d'API App Store
  Connect ; Apple a refusé celle de l'outil le 28 octobre (`-20209`).
- **P5 · Resend** : `auth.bento-pop.com` en service depuis le 26 octobre,
  `moderation.bento-pop.com` depuis le 28, à la mise en service du 22 ; 100
  mails par jour pour tout le compte, codes et modération ensemble.
- **P6 · Deux comptes de recette** (D16) : celui de Clément et un compte de
  recette gardé par une adresse de l'équipe, supprimé à la fin avec tout ce
  qu'il a écrit. Les signalements de recette se classent sans suite au
  back-office.

**Avant la soumission, tout sauf la passe G** (D15).

**La refonte visuelle (D25)** change l'apparence de presque chaque écran :
les points qui tiennent à l'apparence se relisent après elle, comme 13-a,
dont la puce devient « CRÉA » et le titre passe en Fredoka SemiCondensed.
Chacun des chantiers 30 à 34 verse ici sa part à sa livraison, comme les
autres : au moins le mouvement réduit, les boîtes de dialogue qui gardent
le focus de VoiceOver et le nouvel ordre des onglets lu à voix haute. Le 30,
le socle, a versé la sienne le 30 octobre : 30-a et 30-b en passe B, les cinq
retours haptiques du design en 3-a, la boîte de dialogue, la feuille et la
notification reçue app ouverte en 11-a ; ses composants n'entrent dans les
écrans qu'aux 31 à 34, qui nommeront les leurs.

### Passe A · Avant d'installer, puis au premier lancement

Sur chaque téléphone, dans cet ordre. Les deux premiers points supposent la version du store encore installée : les faire avant tout le reste.

- **21-b · La mise à jour depuis la 1.1, sur un téléphone qui bloquait des comptes.** iOS ; Android en 21-e. Versé.
  - Prérequis : Un téléphone sur la 1.1, avec des blocages ; P1, P2 (migration du 22).
  - Gestes : Sur un iPhone qui a la 1.1 de l'App Store et des comptes bloqués, installer la build de sortie par-dessus ; lancer.
  - Attendu : « les blocages repris au premier lancement, rattachés à leur compte » ; la session gardée ; au passage, la liste locale versée une fois en base (D9 du 22).
  - Sources : RM:1193-1195 ; UX-21:759-764, UX-21:882 ; UX-22:818 ; UX-28:546-548
- **21-e · La mise à jour depuis la 0.1.0 du Play Store, sur un Android qui bloquait des comptes.** Android. Ajouté le 27 octobre, pendant de 21-b.
  - Prérequis : Un Android sur la 0.1.0, avec des blocages ; P1, P2 (migration du 22).
  - Gestes : Sur un Android qui a la 0.1.0 du Play Store et des comptes bloqués, installer la 2.0.0 du canal interne par-dessus ; lancer.
  - Attendu : Comme 21-b : les blocages repris au premier lancement, rattachés à leur compte ; la session gardée.
  - Sources : RM:1193-1195 (pour la 1.1) ; relevé du 27 octobre, ambiguïté 12
- **11-b · Démarrage à froid en mode avion.** Les deux. Versé.
  - Prérequis : P1 : une build de développement « charge son code depuis Metro ».
  - Gestes : App fermée, mode avion activé, ouvrir l'app ; deux fois.
  - Attendu : « L'app doit s'ouvrir, sans rester sur le jaune » ; « aucune légende de mise à jour ». Hors ligne, un compte connu retombe sur l'accueil : défaut connu, hors du point.
  - Sources : RM:151-152, RM:1356 ; UX-11:417, UX-11:691-697, UX-11:1018-1023 ; MAJ:285-288
- **16-c · La reprise d'un brouillon, et un premier lancement sans réseau.** Les deux. Versé.
  - Prérequis : P1 ; une installation neuve.
  - Gestes : Installation neuve, réseau coupé au premier lancement, pour que `signInAnonymously` échoue ; parcourir l'accueil, composer ; fermer l'app ; rétablir le réseau, relancer ; publier.
  - Attendu : Le cas du rejet App Store 2bf822e0, « transformé en chemin qui marche » : on compose sans session, le brouillon est repris après le redémarrage, la publication passe une fois en ligne.
  - Sources : RM:1313-1316 ; UX-16:940-942, UX-16:1053-1058
- **8-c · La boîte d'autorisation d'iOS ouverte par la question du rappel, puis un refus.** iOS. Versé.
  - Prérequis : P1 ; une installation neuve.
  - Gestes : Sur un iPhone qui n'a jamais autorisé les notifications : répondre « Oui » à la question du rappel, refuser dans la boîte du système ; quitter à nouveau un bento prêt.
  - Attendu : « ni question ni lien ensuite » : quand le système ne peut plus demander, « ni la question ni le lien ne s'affichent ».
  - Sources : RM:1258-1259 ; UX-08:281-286
- **2-b · Le fil et la page d'un bento sur réseau mobile, cache vide.** Les deux. Versé (19) ; spec seule (2, budget du §8) ; spec seule, assumé (7).
  - Prérequis : P1 ; une carte SIM avec données ; la route des épisodes, en service depuis le 24/10.
  - Gestes : En 4G, Wi-Fi coupé, après une installation neuve : ouvrir « La table », défiler jusqu'aux épisodes et à leurs vignettes ; ouvrir la page d'un bento ; revenir sur l'onglet.
  - Attendu : Premier post peint en moins de 1,2 s, cache vide, en 4G ; les vignettes de YouTube et du site, de 78 à 166 ko, arrivent ; le fil n'attend pas les épisodes plus d'une seconde (D14 du 19) ; second passage sans requête d'image ; la page d'un bento sans attente (45 à 48 ms au p50 en filaire, le gain sur réseau mobile « extrapolé »).
  - Sources : RM:1242-1243 ; UX-02:586-593 ; UX-19:466-469, UX-19:733 ; UX-07:1225-1226, UX-07:1465
- **2-c · Passer hors ligne en cours d'usage.** Les deux, iPhone surtout. Spec seule (2) ; implicite sur iPhone (6, 7, 11) : le simulateur iOS n'a pas de mode avion.
  - Prérequis : P1
  - Gestes : En défilant « La table », passer en mode avion ; dans « Trouver », lancer une recherche ; ouvrir la page d'un bento, puis rétablir le réseau et taper « Réessayer » ; sur iPhone, ouvrir hors ligne la modale de recherche d'une case.
  - Attendu : Fil : « échec propre, pas d'écran blanc, la liste déjà chargée reste affichée » ; « Trouver » : « le message d'erreur et le bouton « Réessayer » » ; page : « Connexion perdue » et un bouton, « sans attendre », puis la page se remplit ; le bandeau « Pas de connexion » ne recouvre aucun contrôle ; dans la modale, feuille native d'iOS, le bandeau ne se voit pas, ce que le 11 assume.
  - Sources : UX-02:771-772 ; UX-06:775 ; UX-07:1067-1069, UX-07:1110-1112, UX-07:1178-1179 ; UX-11:325-327, UX-11:560-564

### Passe B · Seul, sur chaque téléphone

Après les parcours du §5, ce que seul un vrai téléphone montre : l'haptique, la fluidité, l'iPhone SE en main.

- **3-a · Haptique.** Les deux. Versé (3, 11) ; spec seule (6).
  - Prérequis : P1 : ni simulateur ni émulateur ne restituent l'haptique.
  - Gestes : Dans le composer : taper une tuile d'« Au menu » ou d'un résultat, revenir sur la case remplie ; remplir les six cases d'affilée ; vider une case ; provoquer un échec d'écriture. Dans « Trouver » : taper une puce de suggestion.
  - Attendu : Selon le 3 : un impact léger au tap d'une tuile, un succès quand la case est remplie au retour sur le composer, une erreur à l'échec ; l'haptique « n'est pas envahissante au sixième déclenchement ». Selon le 11 : « se sentir une fois, au moment de la validation, jamais en double ». Puces : un retour de sélection. Les deux attendus divergent (D17).
  - **Décidé le 27 octobre (D17), d'après `src/lib/haptics.ts` : un impact léger au toucher d'une tuile, d'une puce de « Trouver » ou du cœur ; le motif « succès » quand la case est enregistrée ; le motif « erreur » sur un échec d'écriture. Rien en vidant une case.**
  - **Versé par le 30 le 30 octobre (D11, D23 du 30) : les écrans refaits aux 31 à 34 adoptent les cinq retours du design, une sélection légère (un onglet, une puce, un interrupteur), un impact moyen (le cœur), « succès » (une publication, un code validé), « avertissement » (l'ouverture d'une confirmation destructive) et « erreur » (un code faux), chacun joué une fois par l'écran ; les attendus ci-dessus se relisent avec eux. Appelés au simulateur et à l'émulateur sans erreur, jamais sentis.**
  - Sources : RM:148, RM:216, RM:427-428, RM:1353, RM:1354 ; UX-03:55, UX-03:604-613, UX-03:929, UX-03:1009, UX-03:1052-1053 ; UX-06:440-442, UX-06:770-771, UX-06:921-923 ; UX-11:411, UX-11:676-678 ; DEP:163
- **2-a · Fluidité de « La table » en build de production.** Les deux. Versé.
  - Prérequis : P1 : au simulateur et en build de débogage, « ni l'un ni l'autre ne prouve quoi que ce soit ». Des bentos d'édition dans le fil pour la part du 13 (D15).
  - Gestes : Dérouler « La table » d'un bout à l'autre, deux fois ; sur Android, en défilement rapide ; avec des bentos d'édition, des boîtes de tailles différentes qui se succèdent (13). Mesurer si possible, `dumpsys gfxinfo` contre une app système, comme au §12.2 du 2.
  - Attendu : « pas de saccade perceptible, pas de cellule blanche persistante » ; « pas de cellule blanche visible plus d'une image » ; mémoire « stable, pas de croissance monotone ». Repère : 62,5 % de trames saccadées à l'émulateur en build de débogage, 1,3 % pour le témoin.
  - **La part des éditions passe en G, après le plancher (D15).**
  - Sources : RM:149-150, RM:215, RM:242, RM:402-404, RM:1352, RM:1354-1355 ; UX-02:586-593, UX-02:792-793, UX-02:924, UX-02:926-958 ; UX-11:414, UX-11:685-687 ; UX-13:979 ; DEP:161-162
- **8-e · La ligne de date et son compteur sur iPhone SE, en grand texte.** iOS (SE). Versé.
  - Prérequis : P1 ; un vrai iPhone SE.
  - Gestes : Sur un vrai iPhone SE, taille du texte au maximum, ouvrir la page d'un bento qui a des visites.
  - Attendu : Non écrit : la ligne n'a été vue qu'à la taille par défaut, où elle « tient en rétrécissant d'environ 5 % ».
  - Sources : RM:1265-1266 ; UX-08:656-657. Peut-être déjà vue au simulateur
- **13-a · « CRÉATEUR DE CONTENU » dans le fil sur iPhone SE.** iOS (SE). Versé par la ligne 29 du tableau, absent du §29.
  - Prérequis : P1 ; un post dont la case Créateur s'affiche vide, seul cas où l'intitulé se montre dans le fil (D20).
  - Gestes : Sur un vrai iPhone SE, dans « La table », regarder l'intitulé « CRÉATEUR DE CONTENU » dans la rangée à trois d'un bento principal.
  - Attendu : « coupé ou non » : « au calcul il déborde dans le fil sur iPhone SE », à 96 % de sa ligne, et « aucun écran ne l'a confirmé ».
  - **Décidé le 27 octobre (D20) : sur un vrai SE seulement si un bento de production a une case Créateur masquée ; sinon au simulateur SE, sur une pile locale, une case masquée posée exprès.**
  - Sources : RM:242 ; UX-13:982-983 ; REC:1541-1544 ; `packages/supabase-mobile/src/bento.ts:363-366`
- **21-d · L'onglet Profil sur un vrai iPhone SE.** iOS (SE). Versé.
  - Prérequis : P1 ; un vrai iPhone SE.
  - Gestes : Sur un vrai iPhone SE, l'onglet Profil d'un compte publié, au repos puis en défilant.
  - Attendu : « à juger en main » : la boîte à son plancher, sa moitié basse, 172 points, sous les boutons au repos, la page qui défile ; deux pistes à trancher.
  - Sources : RM:1199-1201 ; UX-21:771-775, UX-21:902-906
- **11-c · Le gris des onglets inactifs, à valider par la direction artistique.** Les deux. Spec seule.
  - Prérequis : P1 ; Rob.
  - Gestes : Rob regarde la barre d'onglets, les onglets inactifs à 60 % d'encre sur blanc.
  - Attendu : « à valider à l'œil par Rob, DA, avant la mise en revue ».
  - Sources : UX-11:1028-1030
- **12-b · « AROUND THE WORLD » coupé dans sa case à 200 % sur Android.** Android. Versé, « Relevé en chemin, hors du 12 ».
  - Prérequis : P1 ; ce bento en production.
  - Gestes : Android, texte à 200 %, ouvrir le bento dont une case porte ce titre.
  - Attendu : Non écrit : à l'émulateur, il « se coupe dans sa case » ; à constater, puis corriger ou accepter (D19).
  - **Constaté le 27 octobre, build de release à l'émulateur, texte à 200 % : « AROUND THE WOR… ». C'est l'ellipse prévue par `tile-title.ts`, quand le titre a rétréci jusqu'à son plancher ; TalkBack lit le titre entier. Accepté (D19).**
  - Sources : RM:1339-1341 ; UX-12:613-614
- **12-c · Changer la taille du texte, écran ouvert, redémarre l'activité Android.** Android. Versé, « Relevé en chemin, hors du 12 ».
  - Prérequis : P1
  - Gestes : Android : commencer une saisie sans l'enregistrer, un pourquoi ou un commentaire, changer la taille du texte dans les réglages, revenir à l'app.
  - Attendu : Non écrit : à l'émulateur, l'activité redémarre et « perd un champ non enregistré », « comme partout ailleurs dans l'app » ; iOS change la taille à chaud (D19).
  - **Accepté (D19) : le comportement d'Android pour toute l'app, déjà décrit dans `RECETTE-MOBILE.md`.**
  - Sources : RM:1341-1342 ; UX-12:614-616 ; REC:1441-1445
- **14-a · L'étiquette « Invité » et la télémétrie, sur appareil.** Les deux + back-office. Spec seule : la livraison mobile « mérite sa propre recette d'un bloc, sur simulateur puis sur appareil ».
  - Prérequis : P1 ; un profil éditorial en production, aucun aujourd'hui, à supprimer ensuite.
  - Gestes : Au back-office, composer et publier le bento d'un profil éditorial ; dans l'app, le voir dans « La table » et sur sa page ; lancer l'app sur chaque téléphone, puis lire sa ligne dans « Utilisateurs ».
  - Attendu : Fil : « étiquette noire et jaune sur l'angle de la boîte » ; page de l'app : « pastille losange sur le Popy, à la place de l'étoile » ; « invité » l'emporte sur « coup de cœur » ; « Utilisateurs » montre la dernière visite, la plateforme et la version du téléphone.
  - Sources : RM:217 ; UX-14:789-790, UX-14:815-829, UX-14:831-841
- **30-a · Le catalogue du design system fermé en production.** Les deux. Versé par le 30 (D12).
  - Prérequis : P1.
  - Gestes : Sur chaque téléphone, ouvrir `bentopop://dev/catalogue`, puis `bentopop://dev/catalogue/calques` : l'adresse tapée dans Safari sur l'iPhone, un lien dans une note sur l'Android.
  - Attendu : l'app s'ouvre sur son accueil, aucune page du catalogue ; c'est le garde-fou de `app/dev/_layout.tsx`, éprouvé le 30 octobre sur des builds Release locales, au simulateur et à l'émulateur.
  - Sources : UX-30 §6, §10.5 ; D12 du 30
- **30-b · Le mouvement réduit suivi en direct, sur un écran refait.** Les deux. Versé par le 30 (D10).
  - Prérequis : P1 ; un écran refait aux 31 à 34 qui anime : la barre d'onglets, un toast, une feuille.
  - Gestes : L'app ouverte sur cet écran, allumer « Réduire les animations » (iPhone, Accessibilité, Mouvement) ou « Supprimer les animations » (Android, Accessibilité), revenir à l'app sans la relancer, ouvrir la feuille ou faire paraître le toast ; puis éteindre le réglage et recommencer.
  - Attendu : sans relance, ni rebond ni confettis, les apparitions en fondus de 120 ms ; tout revient une fois le réglage éteint. Vu au simulateur et à l'émulateur au lot 2 du 30, dans les deux sens.
  - Sources : UX-30 §4.6, §10.2 ; D10 du 30

### Passe C · À deux téléphones

Un compte par téléphone, cf. P6. Les nombres d'un bento vivent une minute en mémoire : revenir sur l'écran plutôt qu'attendre.

- **2-d · Le reste de la checklist « sur device réel » du 2.** Les deux. Spec seule.
  - Prérequis : P1, P3 ; un second téléphone.
  - Gestes : Repérer un coup de cœur en haut d'écran, puis en cellule recyclée ; sur une installation neuve, regarder les cases avant l'arrivée des images ; publier depuis un second compte, puis tirer pour rafraîchir sur le premier téléphone ; bloquer un compte, revenir au fil.
  - Attendu : « COUP DE CŒUR » « n'est pas rognée en haut d'écran ni en cellule recyclée » ; « les cases affichent leur dégradé de palette avant l'image, jamais un rectangle gris » ; le post publié « apparaît en tête avec « à l'instant » » ; le post du compte bloqué « a disparu ».
  - Sources : UX-02:748, UX-02:758-759, UX-02:765-766, UX-02:769, UX-02:778-779. Les autres cases ouvertes du 2 sont soldées ailleurs
- **12-a · Les pourquoi, sur deux vrais téléphones.** Les deux + back-office + web. Versé.
  - Prérequis : P1, P2 : la migration du 12 après celle du 22, back-office redéployé ; P3 ; deux comptes.
  - Gestes : A, l'auteur : publier, trouver l'invitation sous la boîte, écrire trois pourquoi dont un qui porte un mot de la liste. B, un autre compte : lire la section, signaler un pourquoi. Au back-office, le masquer ; A lit le motif, puis réécrit ; au composer de A, remplacer un item expliqué ; sur le web, la section.
  - Attendu : Le pourquoi refusé l'est sous son champ ; masqué, il se grise chez A avec son motif et disparaît chez B ; réécrit, il revient, l'ancien motif parti ; au composer, la question d'abord, puis « Remplacer » efface le pourquoi ; le web suit, sans cache.
  - Sources : RM:242 ; UX-12:491-504, UX-12:581-605, UX-12:617-618, UX-12:716-717
- **20-a · « Apparaître dans la recherche » entre deux téléphones.** Les deux, deux téléphones. Versé.
  - Prérequis : P1, P3 ; deux comptes qui partagent un item.
  - Gestes : A éteint le réglage ; B cherche A dans « Trouver », puis ouvre un bento qui partage un item avec A ; A rallume.
  - Attendu : B ne le trouve « ni dans « Trouver » ni parmi ses mêmes goûts », « puis le retrouve une fois le réglage rallumé » ; la page de A reste ouverte par son lien.
  - Sources : RM:1215-1217 ; UX-20:244-245, UX-20:455-458, UX-20:557-559
- **21-c · Un changement de pseudo entre deux téléphones.** Les deux, deux téléphones. Versé.
  - Prérequis : P1, P3 ; deux comptes.
  - Gestes : A bloque B ; B change de pseudo ; A cherche B, puis ouvre Réglages.
  - Attendu : A « ne le voit toujours pas, et le retrouve sous son nouveau pseudo dans ses réglages ».
  - Sources : RM:1196-1198 ; UX-21:759-761, UX-21:882
- **22-a · Likes, commentaires, signalement et blocage, sur deux vrais téléphones.** Les deux, deux téléphones + back-office. Versé.
  - Prérequis : P1, P2 (mise en service du 22), P3, P5 ; « Les nombres d'un bento vivent une minute en mémoire » ; lire un blocage en base et dans le stockage des deux apps.
  - Gestes : Le propriétaire sur un téléphone, le commentateur sur l'autre, comptes gardés : aimer depuis « La table » puis la page ; commenter ; le filtre, un mot refusé, un lien, puis « en retard » ; supprimer ; signaler un commentaire, un compte, un bento ; bloquer, puis retrouver la liste après « J'ai déjà un compte » sur l'autre téléphone ; refuser les commentaires, puis les likes.
  - Attendu : Ceux du §7.2 du 22 : le nombre suit sur les deux téléphones au retour ; le bloqué ne commente ni n'aime plus, ses commentaires disparaissent ; le blocage suit le compte d'un téléphone à l'autre, sans qu'un déblocage soit défait par l'autre ; la barre et la base suivent les refus.
  - Sources : RM:242, RM:1335 ; UX-22:572-601, UX-22:717-722, UX-22:731-732 ; REC:1410-1422
- **23-a · Suivre et valider une demande, sur deux vrais téléphones.** Les deux, deux téléphones. Versé.
  - Prérequis : P1, P2 (migration du 23, après celles du 22 et du 12), P3 ; deux comptes qui ont un pseudo.
  - Gestes : B suit A depuis sa page, puis ne suit plus ; A allume « Valider mes abonnés » ; B demande ; A voit la demande, l'accepte, en refuse une autre, retire un abonné ; « Abonnements » dans « La table » de B ; A bloque B.
  - Attendu : Ceux du §7.2 du 23 : la ligne de date change ; « Suivre » à la place de « Compose le tien », sans que la boîte perde un point ; « Abonnements » vide, puis rempli ; le blocage retire l'abonnement des deux côtés.
  - Sources : RM:1343-1345 ; UX-23:357-369, UX-23:475-476, UX-23:505-507
- **24-a · La zone « Notifs » et sa pastille, sur deux vrais téléphones.** Les deux, deux téléphones + back-office. Versé.
  - Prérequis : P1, P2 (migration du 24, après celles du 22, du 12 et du 23), P3
  - Gestes : B aime et commente un bento de A, le suit, publie ; faire valider puis refuser des items de A au back-office ; A regarde la pastille, ouvre l'onglet, tape chaque ligne ; un like de plus. Puis A sur un second téléphone du même compte gardé.
  - Attendu : La pastille dit le bon nombre, « 9+ » au-delà de 9, la liste les bonnes lignes, regroupées ; ouvrir l'onglet lit tout ; chaque tap mène où dit le §5 du 24 ; deux téléphones d'un même compte gardé voient la même chose (D8).
  - Sources : RM:1343-1345 ; UX-24:150-157, UX-24:252-266, UX-24:357-358, UX-24:426
- **25-a · Instagram et TikTok ouverts pour de vrai.** Les deux, deux téléphones. Versé.
  - Prérequis : P1, P2 (migration du 25 après celle du 24, landing et back-office redéployés), P3 ; les apps Instagram et TikTok.
  - Gestes : Saisir ses deux pseudos, dont une adresse collée ; sur l'autre téléphone, depuis la page de ce compte, taper les deux glyphes, avec puis sans les apps ; éteindre « Afficher mes réseaux ».
  - Attendu : « l'app du réseau si elle est installée, le site sinon » ; réglage éteint, plus rien chez l'autre, ni sur le web.
  - Sources : RM:1346-1347 ; UX-25:57-59, UX-25:140-148, UX-25:241-243, UX-25:300
- **27-a · Gagner « Premier bento » en publiant.** Les deux, deux téléphones + web. Versé.
  - Prérequis : P1, P2 (migration du 27 après celle du 25), P3
  - Gestes : Un compte neuf publie son premier bento ; ouvrir sa page, puis « Notifs » ; sur l'autre téléphone, ouvrir sa page ; puis sur le web.
  - Attendu : « Premier bento » posé, la section aussitôt sur sa page, lue « Premier bento : un bento publié » ; « Notifs » : « Succès débloqué : Premier bento », et la ligne ouvre sa page ; l'autre compte et le web le voient.
  - Sources : RM:1343-1345 ; UX-27:69-77, UX-27:118-121, UX-27:200-204, UX-27:225-227
- **28-a · Un vrai code reçu par Resend, et le compte retrouvé sur un second téléphone.** Les deux + boîte mail réelle. Versé.
  - Prérequis : P1, P3 ; une vraie boîte mail ; Resend en service depuis le 26/10 ; 100 mails par jour pour tout le compte, partagés avec la modération.
  - Gestes : Téléphone A : juste après la première publication, « Garde ton compte » avec une vraie adresse, le code reçu. Téléphone B, ou A réinstallé : « J'ai déjà un compte », la même adresse, le code.
  - Attendu : Un code à 6 chiffres de `code@auth.bento-pop.com`, modèle « Ton code pour garder ton compte » ; même identifiant avant et après ; sur B, pseudo, bentos et identifiant retrouvés, le compte vide de B effacé ; « le premier vrai mail partira à la recette du chantier 29 ».
  - Sources : RM:1331-1332 ; UX-28:350-353, UX-28:425-455, UX-28:599-601, UX-28:616-624 ; UX-22:123-125

### Passe D · Avec le back-office : notifications et mails

Le back-office de production redéployé (P2), le 5b fait (P4), Resend en service (P5).

- **17-a · Une notification reçue en build de production.** Les deux. Versé.
  - Prérequis : P1, P3, P4
  - Gestes : Proposer un item, accepter la phrase puis la boîte du système ; le faire valider au back-office ; attendre ; taper la notification.
  - Attendu : Reçue « en moins d'une minute », par « l'environnement de production d'APNs, qu'aucune build de développement ne touche » ; le tap ouvre le composer sur la bonne case.
  - Sources : RM:782, RM:806, RM:1285-1288 ; UX-17:692-695, UX-17:700-702, UX-17:1047-1048, UX-17:1157-1158, UX-17:1183
- **17-b · L'écran verrouillé.** Les deux. Versé.
  - Prérequis : Comme 17-a.
  - Gestes : Téléphone verrouillé, faire valider un item ; déverrouiller en tapant la notification.
  - Attendu : La notification s'affiche sur l'écran verrouillé, « et son tap mène au bon écran une fois le téléphone déverrouillé ».
  - Sources : RM:1289-1290 ; UX-17:695, UX-17:1186
- **17-c · « Ouvrir les réglages » sur iOS.** iOS. Versé.
  - Prérequis : P1
  - Gestes : Refuser les notifications ; Profil, section Notifications, « Ouvrir les réglages ».
  - Attendu : La fiche de l'app dans Réglages ; au simulateur iOS 26.4, « il arrive à la racine des Réglages et non sur la fiche de l'app ».
  - Sources : RM:1291-1293 ; UX-17:1011, UX-17:1050
- **17-d · Une désinstallation réelle et son `DeviceNotRegistered`.** Les deux. Versé, « si la recette du lot 5b ne l'a pas vu ». **Vu au 5b sur Android le 28 octobre** : l'appareil révoqué 19 minutes après la désinstallation ; reste iOS.
  - Prérequis : P4 ; une lecture de `push_tokens` ; du temps.
  - Gestes : Désinstaller l'app d'un téléphone enregistré ; envoyer une notification à son compte ; relire l'appareil en base.
  - Attendu : L'accusé finit par dire `DeviceNotRegistered` et le jeton se révoque, puis « cesse d'être utilisé en moins de 24 heures » ; « Expo ne promet aucun délai ».
  - Sources : RM:1294-1295 ; UX-17:706-708, UX-17:1051, UX-17:1074-1075, UX-17:1164-1165, UX-17:1189
- **18-a · « Bento publié » sur un vrai téléphone.** Les deux. Versé.
  - Prérequis : P1, P3, P4 : « Le tap sur Android se voit dès le lot 5b ».
  - Gestes : Compléter un bento par une proposition, le bouton dit « Publication à la validation » ; valider la proposition au back-office ; recevoir ; taper.
  - Attendu : Le bento sort à la validation, sans rouvrir l'app ; la notification dit « Bento publié », l'item nommé dessous ; le tap ouvre la page publique du bento.
  - Sources : RM:835, RM:1274-1277 ; UX-18:268-276, UX-18:428-430, UX-18:482-485, UX-18:491, UX-18:510, UX-18:522-524
- **18-b · Une validation reçue composer ouvert.** Les deux. Spec seule, un suivi.
  - Prérequis : Comme 18-a.
  - Gestes : Rester sur le composer pendant la validation au back-office.
  - Attendu : La notification arrive tout de suite ; le composer « attend le geste suivant pour dire « En ligne » » ; « À reprendre si la recette sur appareil le montre gênant ».
  - Sources : UX-18:525-528
- **22-b · Un vrai mail de modération, par Resend.** Boîte mail de l'équipe + back-office. Versé.
  - Prérequis : P2 : migrations du 22 puis du 12, back-office redéployé ; P5.
  - Gestes : Signaler un commentaire, puis un pourquoi ; attendre le battement ; ouvrir le mail ; « Ouvrir la modération » ; masquer. Si l'on bannit un compte de recette, le mail de son motif.
  - Attendu : Un mail de `moderation.bento-pop.com` aux adresses de l'équipe, au plus un par heure, groupé, qui nomme le commentaire et le pourquoi (« Pourquoi de @… · Spam ou arnaque · « … » ») et mène à l'écran où masquer prend un geste ; le battement suivant n'envoie rien ; le motif d'un bannissement part à l'adresse gardée.
  - Sources : RM:1335-1336, RM:1339 ; UX-22:743-750, UX-22:775-777, UX-22:820-822 ; UX-12:600-602, UX-12:650-652
- **19-c · Un épisode publié au back-office à une date proche.** Les deux + back-office. Versé.
  - Prérequis : P1 ; un épisode à publier en production.
  - Gestes : Au back-office, publier un épisode daté de quelques minutes ; tirer pour rafraîchir « La table » avant, puis après sa date.
  - Attendu : « absent puis présent dans la minute qui suit sa date, sans nouvelle version de l'app ».
  - Sources : RM:893, RM:1239-1241 ; UX-19:321-322, UX-19:600-602, UX-19:729
- **8-a · Le rappel reçu en build de production.** Les deux. Versé.
  - Prérequis : P1, P3 ; un brouillon ou un bento prêt, sans item en attente ; le rappel tombe « le premier 18 h qui tombe au moins 12 heures plus tard », donc le plus souvent le lendemain.
  - Gestes : Avec un bento complet, tout validé, jamais publié : le quitter pour un autre onglet, « Oui, rappelle-moi », ou le lien « Me le rappeler demain » ; laisser le téléphone verrouillé jusqu'au rappel ; taper la notification, l'app fermée.
  - Attendu : Reçu à 18 h sur iPhone, entre 18 h et 19 h sur Android, l'écran verrouillé, titre « Ton bento est prêt » ; « son tap, l'app fermée, ouvre le composer sur ce bento », « Publier mon bento » en évidence.
  - Sources : RM:860, RM:1251-1254 ; UX-08:292-296, UX-08:512-513, UX-08:708-711
- **8-b · Le rappel après un redémarrage, et Android en économie d'énergie.** Android (le même geste sur iPhone). Versé.
  - Prérequis : Comme 8-a.
  - Gestes : Programmer le rappel, redémarrer le téléphone avant l'heure ; refaire sur un Android en économie d'énergie.
  - Attendu : « Android le reprogramme au démarrage, ce que l'émulateur n'a pas montré » ; en économie d'énergie, l'arrivée dans « la fenêtre d'une heure ».
  - Sources : RM:1255-1257 ; UX-08:708-711

### Passe E · Hors de l'app : web, messageries, apps tierces

Ce que l'app produit et que d'autres affichent.

- **1-a · Rendu de la page web publique sur de vrais écrans.** Web : Safari iOS, Chrome Android, iPad, bureau. Versé : « la QA appareil de la page web publique ».
  - Prérequis : Production ; des bentos publiés qui couvrent ces cas. La checklist date du 11/09 : la page porte depuis ce qu'y ont ajouté les 8, 12, 21, 23, 25 et 27, qu'elle ne cite pas.
  - Gestes : Ouvrir `bento-pop.com/u/<pseudo>` sur un iPhone SE (375 px), un iPhone 15 Pro Max, un Pixel 8, un iPad et un bureau à 1440 px. Varier : bento à 6, à 3 et à 0 case visible ; item sans image, crédit long, titre très long, titre japonais ; pseudo de 3 et de 20 caractères, pseudo avec un point.
  - Attendu : Sur SE : « la grille tient entièrement, aucun débordement, le CTA ne recouvre rien » ; la même tenue sur les autres écrans.
  - Sources : RM:214, RM:361, RM:1351 ; UX-01:4, UX-01:507-520
- **1-b · Aperçus de partage dans les messageries.** Messageries sur iOS et Android (iMessage : iOS) ; débogueurs : bureau. Versé.
  - Prérequis : P1. Un bento secondaire et un bento d'édition publiés en production, ce que la production interdit avant la sortie (D15). « Afficher mes visites » allumé.
  - Gestes : « Partager » depuis l'app le bento principal, puis un bento secondaire (16) et un bento d'édition (13). Coller chaque lien dans iMessage, WhatsApp et Discord, au moins deux messageries ; pour le principal, aussi X et Slack, et LinkedIn et Facebook par leurs débogueurs d'URL. Relever le compteur de visites du bento avant et après.
  - Attendu : Un aperçu avec image et titre partout (WhatsApp n'en montre pas au-delà d'environ 300 Ko ; l'image fait 68 Ko en JPEG) ; une grande carte sur X. Le lien d'un secondaire ou d'une édition montre ce bento-là et non le principal : « Le HTML et l'image sont produits par deux requêtes séparées ». L'aperçu « ne doit rien compter » au compteur.
  - **Décidé le 27 octobre (D21) : deux messageries suffisent, iMessage et WhatsApp. La part d'un bento secondaire et d'un bento d'édition passe en G, après le plancher (D15).**
  - Sources : RM:150, RM:242, RM:1263-1264, RM:1309-1312, RM:1355-1356 ; UX-01:35, UX-01:322, UX-01:522-528, UX-01:617, UX-01:632 ; UX-08:173, UX-08:787 ; UX-11:415, UX-11:688-690 ; UX-13:980-981 ; UX-16:938-939
- **1-c · Liens universels et liens profonds.** iOS, Android. Versé.
  - Prérequis : P1 ; un téléphone sans l'app.
  - Gestes : Taper un lien `bento-pop.com/u/<pseudo>` sur un iPhone avec l'app, sur un iPhone sans l'app, sur un Android avec l'app ; ouvrir un lien `bentopop://` sur un téléphone sans l'app. Le navigateur intégré d'Instagram est en 8-d.
  - Attendu : iPhone avec l'app : « le lien ouvre l'app, pas Safari » ; sans l'app : « la page web s'affiche, la bannière Smart App apparaît dans Safari » ; Android avec l'app : « le lien ouvre l'app » ; `bentopop://` « ne casse rien si l'app est absente ».
  - Sources : RM:1351 ; UX-01:530-535
- **1-d · Accessibilité, performance et sécurité de la page web.** Hors appareil : navigateur de bureau, terminal. Versé (§11.4 du 1), hors appareil.
  - Prérequis : Production. `verify-prod.sh` couvre déjà statuts, métadonnées, image Open Graph et liens universels.
  - Gestes : Navigation au clavier ; zoom à 200 % ; contrastes à l'outil sur les tuiles à photo claire ; Lighthouse mobile en « Slow 4G » ; onglet réseau, puis second chargement ; `curl` de la page ; `/u/%25`, `/u/../../etc/passwd`, `/u/<script>`. VoiceOver sur la page : en 11-a.
  - Attendu : « Navigation clavier complète, focus toujours visible » ; « Zoom 200 %, aucun texte tronqué ni chevauchement » ; Lighthouse : Accessibilité 100, Performance, SEO et Bonnes pratiques à 95 au moins ; images en WebP par `/_next/image`, aucune requête directe vers `supabase.co`, servies du cache au second chargement ; clé anonyme absente de la sortie ; « 404 propre » sur les trois adresses.
  - Sources : RM:361 ; UX-01:511-513, UX-01:537-551
- **8-d · Les visites depuis de vrais navigateurs.** Web sur téléphone : Safari, Instagram, TikTok. Versé.
  - Prérequis : Production : le web compte depuis le 23/10 ; « Afficher mes visites » allumé ; deux jours de suite.
  - Gestes : Ouvrir la page web d'un bento dans Safari d'iPhone, puis le lendemain sans avoir relancé Safari ; ouvrir un lien vers ce bento depuis les apps Instagram et TikTok, dans leur navigateur intégré ; dans celui d'Instagram, taper le lien `bentopop://`.
  - Attendu : Une visite par personne et par jour, recomptée le lendemain dans Safari, « c'est le défaut corrigé au lot 5 » ; les navigateurs intégrés comptent ; Instagram : « la page web s'affiche, le lien `bentopop://` ouvre l'app ».
  - Sources : RM:1260-1263 ; UX-08:787, UX-08:795-801 ; UX-01:534
- **19-a · Le tap d'un épisode, les apps installées.** Les deux. Versé.
  - Prérequis : P1 ; les apps YouTube, Spotify, Deezer et Apple Podcasts ; aucun épisode Deezer ni Apple Podcasts en production.
  - Gestes : Taper une émission, puis un podcast de chaque plateforme, avec puis sans les apps ; un podcast que Spotify n'a pas encore repris.
  - Attendu : « une émission ouvre l'app YouTube, un podcast l'app Spotify, Deezer ou Apple Podcasts ; sans l'app, le navigateur » ; un épisode non repris ouvre sa page sur bento-pop.com.
  - **Aucun épisode Deezer ni Apple Podcasts en production : YouTube, Spotify et la page du site seulement.**
  - Sources : RM:1227-1230 ; UX-19:200-212, UX-19:583-586, UX-19:603-605
- **19-b · Les épisodes en production.** Les deux. Versé.
  - Prérequis : P1 : la variable vaut `https://bento-pop.com` par défaut.
  - Gestes : Avec la build de production, sans `EXPO_PUBLIC_LANDING_URL`, ouvrir « La table » et défiler ; comparer aux pages publiques des émissions et des podcasts.
  - Attendu : La route de bento-pop.com « y rend ce que montrent les pages publiques » : 40 épisodes au 24/10, chacun à sa date parmi les bentos.
  - Sources : RM:1236-1238 ; UX-19:285-286, UX-19:669-672
- **20-b · Un bento mis en avant d'un compte retiré, sur bento-pop.com.** Web + app. Versé.
  - Prérequis : P1 ; un bento mis en avant dont le compte est sur un téléphone de recette : seul son titulaire écrit le réglage.
  - Gestes : Le titulaire d'un bento mis en avant éteint le réglage dans l'app ; quelques minutes après, lire la page et le sitemap.
  - Attendu : La page en `noindex`, le compte absent du sitemap, « quelques minutes après le changement ».
  - Sources : RM:1218-1219 ; UX-20:560-561, UX-20:582, UX-20:603
- **21-a · Un lien partagé avant un changement de pseudo.** Les deux + messageries + web. Versé.
  - Prérequis : P1, P3 ; un compte de recette : un changement de pseudo par 30 jours.
  - Gestes : Partager le lien d'un compte ; changer son pseudo ; ouvrir l'ancien lien depuis iMessage et WhatsApp, sans puis avec l'app.
  - Attendu : Son aperçu dans les deux messageries ; la landing en 308 vers le nouveau pseudo ; l'app ouverte par le lien universel, « qui remplace l'adresse ».
  - Sources : RM:1189-1192 ; UX-21:880, UX-21:889

### Passe F · À la voix : VoiceOver et TalkBack

Un seul point, le plus long : chaque écran neuf écouté, écouteurs mis.

- **11-a · VoiceOver et TalkBack à la voix.** Les deux ; (1) web, Safari iOS. Versé : « Les rôles et les libellés ont été relus par `idb` et `uiautomator`, jamais à l'oreille ».
  - Prérequis : P1, P2 : les écrans des 22, 12, 23, 24, 25 et 27 n'existent qu'une fois leurs migrations appliquées ; des likes, commentaires, abonnés, notifications, liens et succès à faire lire.
  - Gestes : Écouteurs mis, VoiceOver sur l'iPhone, TalkBack sur l'Android, téléphones en français :
    (11) un parcours entier : accueil, composer, une case remplie, publication, page publique ;
    (3) la modale de recherche après l'`autoFocus`, puis choisir une tuile ;
    (2) « La table », post par post ;
    (19) une carte d'épisode ;
    (20) la pastille « Mêmes goûts » et une ligne de son écran ;
    (21) un bento de la liste d'un compte, le crayon, la grille des Popys, le champ du pseudo ;
    (12) « Pourquoi ces choix », une ligne et ses options, « Tes pourquoi » ;
    (22) le cœur, la bulle, un commentaire, la feuille d'actions ;
    (23) « Suivre » et la ligne de date ;
    (24) l'onglet « Notifs » et ses lignes ;
    (25) les glyphes Instagram et TikTok ;
    (27) une médaille ;
    (28) « Garde ton compte », le champ du code, « J'ai déjà un compte » ;
    (30) sur les écrans refaits aux 31 à 34 : une confirmation dans sa boîte de dialogue, une feuille, une notification reçue app ouverte, un toast ;
    (1) la page web dans Safari d'iPhone.
  - Attendu : (11) l'ordre de lecture suit l'écran, « Case Film » s'annonce avant son contenu, un toast se dit tout seul, la perte et le retour de connexion s'annoncent, chaque élément tapable dit son rôle, « aucun libellé ne s'annonce en anglais » (D18) ;
    (3) la grille atteinte en balayant vers la droite, le nombre de propositions annoncé, le toast annoncé ;
    (2) un balayage par post, « La grille n'est pas parcourue case par case » ;
    (19) « un seul arrêt, le libellé lu en entier, le rôle « lien » […] et l'indication du tap » ;
    (20) « un seul arrêt, le libellé lu en entier, tous les items communs compris » ;
    (21) un bento « annoncé par son titre puis sa date » ; « Modifier le profil » ; le Popy choisi dit « sélectionné » ; « Libre. » ou « Déjà pris. », « qu'aucun lecteur n'annonce encore d'elle-même » ;
    (12) les options d'une ligne annoncées après elle ;
    (22) « J'aime, 12 » avec l'état sélectionné, « Commentaires, 3 » ;
    (23) « Suivre @pseudo », « Abonné à @pseudo », « Demande envoyée à @pseudo », la ligne de date en entier avec son indice ;
    (24) « Notifications, 3 nouvelles, onglet 4 sur 5 », chaque ligne en phrase, « nouveau » compris ;
    (25) « Instagram de @lea.cine : @lea_cine », indice « Ouvre Instagram » ;
    (27) « Premier bento : un bento publié » ;
    (28) non écrit, les rôles n'ont été relus qu'à l'arbre ;
    (30) le focus reste dans la boîte de dialogue et dans la feuille, l'action qui engage d'abord, « Annuler » en dernier ; le geste d'échappement (deux doigts en Z sur iPhone) ou le retour d'Android ferme la feuille et annule la boîte de dialogue ; la notification se dit toute seule, avec « Ouvrir » et « Fermer » parmi ses actions ; le toast se dit poliment, sans prendre le focus. Relu à l'arbre au simulateur et à l'émulateur aux lots 4 et 5 du 30, jamais entendu ;
    (1) « chaque case annoncée avec sa catégorie et son titre ».
  - **Corrigé le 27 octobre (D18) : sur iOS, VoiceOver lisait en anglais les mots que React Native compose, « checkbox, unchecked », « radio button », « busy », même sur un iPhone en français. Relu sur une build Release corrigée, la case des conditions s'annonce « non coché » sur un bouton, cf. §8 ; la voix elle-même reste à entendre ici.**
  - Sources : RM:148-149, RM:1183-1188, RM:1211-1214, RM:1231-1235, RM:1328-1330, RM:1353, RM:1354-1355 ; UX-01:538 ; UX-02:394-406, UX-02:790-791 ; UX-03:437-449, UX-03:1054-1055 ; UX-11:306-309, UX-11:412, UX-11:528-550, UX-11:679-684 ; UX-12:607-609, UX-12:617-618, UX-12:716-717 ; UX-19:213-215, UX-19:609-613, UX-19:646-649, UX-19:710 ; UX-20:445-447, UX-20:459-463, UX-20:584 ; UX-21:765-769, UX-21:859-862 ; UX-22:289-290, UX-22:600-601, UX-22:731-732 ; UX-23:475-476, UX-23:558 ; UX-24:116, UX-24:357-358, UX-24:438 ; UX-25:57-59, UX-25:241, UX-25:307 ; UX-27:72-73, UX-27:225 ; UX-28:599-601 ; REC:995-997 ; ROLES:108-110, ROLES:517

### Passe G · Après la mise en ligne et le plancher de version

Ce qui demande une édition, un bento secondaire ou une mise à jour à distance en production, interdits avant (D15). Sur la 2.0.0 en ligne, dans les jours qui suivent.

- **M-a · La mise à jour appliquée au lancement, qui « n'a jamais tourné pour de vrai ».** Les deux. Versé par l'en-tête de la roadmap, absent du §29.
  - Prérequis : P1 ; un accès EAS ; une mise à jour à publier (D22) ; un vrai mauvais réseau, ou le conditionneur réseau.
  - Gestes : Installer la build de production ; publier une vraie mise à jour à distance sur la branche `production`, pour la `runtimeVersion` de cette build ; vérifier ce que sert le serveur par le `curl` de la roadmap ; relancer à froid ; refaire sur un réseau très lent.
  - Attendu : Téléchargée et appliquée au lancement courant ; la légende de mise à jour n'apparaît qu'au téléchargement ; jamais de `reloadAsync` sur un téléchargement incomplet ; réseau très lent : « l'app doit démarrer au bout des 1500 ms, sans attendre ». Le mode avion est en 11-b.
  - **Décidé le 27 octobre (D22) : aucune mise à jour publiée pour la runtime 2.0.0 avant la sortie. Après la mise en ligne, une mise à jour sans changement visible, `npx eas-cli update --branch production --environment production --message "…"` : sans `--environment`, le code publié perdrait l'adresse de Supabase. Reconnue à la légende de mise à jour, au lancement qui suit, puis plus jamais pour elle.**
  - Sources : RM:92-107, RM:140-143 ; MAJ:178-200, MAJ:278-294, MAJ:309 ; DEP:191-211
- **16-a · La matrice du 16 sur iPhone SE et Pixel 8.** iOS (SE), Android (Pixel 8). Versé.
  - Prérequis : P1 ; un compte à deux bentos en production (D15).
  - Gestes : Avec un compte à deux bentos publiés, sur un vrai iPhone SE et un vrai Pixel 8 : le composer et sa bande de sélection, la page publique et la sienne, la bascule d'un bento à l'autre, le lien `/u/<pseudo>/<slug>`, le parcours d'un nouveau venu.
  - Attendu : La boîte ne passe jamais sous le bouton : « l'écart au bouton ne descend jamais sous son minimum » ; un compte à un seul bento ne voit aucun changement.
  - **Après le plancher (D15). Déjà vue en partie au simulateur SE et à l'émulateur Pixel 8, par les 21 et 13.**
  - Sources : RM:1299-1305 ; UX-16:916-935, UX-16:1070-1075. Peut-être vue en partie au simulateur
- **16-b · Un signalement depuis un bento secondaire, jusqu'au back-office.** Les deux + back-office. Versé.
  - Prérequis : P1, P2 : le back-office redéployé avec la modération du 22 ; P3 ; un bento secondaire en production (D15).
  - Gestes : Depuis la page d'un bento secondaire, « Signaler » ; au back-office, suivre le lien de modération.
  - Attendu : « `target_bento_id` mène bien au bento signalé et non au principal du compte » ; à mesurer après la sortie : 100 % des signalements de bento le portent.
  - **Après le plancher (D15).**
  - Sources : RM:1306-1308 ; UX-16:936-937, UX-16:1114
- **16-d · La création d'un bento secondaire depuis le back-office, de bout en bout.** Les deux + back-office + web. Versé.
  - Prérequis : P1 ; « pas avant la sortie store unique et le plancher de version » (D15).
  - Gestes : Au back-office, ajouter un second bento à un compte (`addBentoToAccount`), le remplir, le publier ; l'ouvrir à son adresse dans l'app et sur le web ; rouvrir un ancien lien du compte.
  - Attendu : « un compte porte deux bentos publiés, chacun à son adresse » ; « tous les liens déjà partagés montrent toujours le bento principal ».
  - **Après le plancher (D15).**
  - Sources : RM:727, RM:1317-1319 ; UX-16:849, UX-16:1096-1097
- **13-b · Le back-office des éditions sur un écran étroit.** Web : back-office sur écran étroit. Spec seule : au §7.3 E du 13, ni dans la ligne ni dans le §29.
  - Prérequis : Accès au back-office de production ; une édition à ouvrir (D15).
  - Gestes : Ouvrir l'écran Éditions du back-office sur un écran étroit : la liste, l'éditeur de cases, l'aperçu.
  - Attendu : Non écrit. Au bureau, le lot 3 avait corrigé un sélecteur de genre qui affichait « ur », une adresse coupée sur deux lignes et une pastille passée sous un bouton.
  - **Après la première édition (D15).**
  - Sources : UX-13:984, UX-13:1061-1068
- **13-c · Le bento principal inchangé au pixel sur appareil réel.** Les deux. Spec seule : DoD 5 du 13, « ⬜ comparaison avant et après sur appareil réel ».
  - Prérequis : Une build d'avant le 13 installable (D20).
  - Gestes : Sur un même vrai téléphone, capturer le bento principal, page, fil et composer, avec une build d'avant le 13, puis avec la build de sortie ; comparer au pixel.
  - Attendu : Identique, hors les deux corrections voulues du lot 6, les défauts 9 et 12, qui changent le rendu des cases.
  - **Remplacé le 27 octobre (D20) par les comparaisons au pixel faites au simulateur à chaque chantier depuis le 13 ; sur l'appareil, un regard.**
  - Sources : UX-13:1140-1142, UX-13:1238, UX-13:1249-1254
- **17-e · Une édition annoncée, et chaque type coupé, en build de production.** Les deux. Spec seule : le « fait quand » du 17, que la roadmap renvoie au 29.
  - Prérequis : P1, P4 ; une édition qui sort en production (D15).
  - Gestes : Accepter « Les éditions » après une publication, ou en rejoignant une édition ; une édition sort ; taper la notification ; dans le profil, couper « Mes items » et faire valider un item ; couper « Les éditions » ; relancer l'app.
  - Attendu : Prévenu de la sortie d'une édition, « et personne d'autre » qui ne l'a pas acceptée ; le tap fait pulser son « + titre » ; « Couper « Mes items » : plus rien n'arrive, et « Les éditions » continue » ; la coupure « tient au redémarrage ».
  - **Après la première édition (D15).**
  - Sources : RM:782, RM:806 ; UX-17:703-705, UX-17:1016, UX-17:1160-1162, UX-17:1185, UX-17:1187

### Hors appareil

- **22-c · Les fiches des stores, à la soumission.** Couverts par le §6 de cette spécification, à saisir dans les deux consoles à la soumission (§3, étape 7). Sources : RM:323-324, RM:1332-1334, RM:1336-1338 ; UX-22:107-110, UX-22:757-758, UX-22:848-849 ; UX-28:494-495, UX-28:637-639

---

## 5. Les parcours complets

Après les passes A à F, chaque chantier parcouru de bout en bout sur les
deux téléphones, d'après son « fait quand » ou sa définition de terminé.

- **1** · Partager un bento depuis l'app ; ouvrir le lien sur un téléphone sans l'app : le bento complet, l'appel vers les stores, la bannière Smart App ; puis avec l'app, par le lien universel ; la page d'un compte avec ce qu'y ont ajouté les 8, 12, 21, 23, 25 et 27. Fait quand : RM:382. `UX-01-PAGE-BENTO-PUBLIQUE.md`
- **2** · « La table » : défiler tout le fil, bentos et épisodes ; reconnaître un coup de cœur ; taper un post et revenir à la même position ; tirer pour rafraîchir après une publication ; repasser sans retélécharger d'image. RM:400. `UX-02-FIL-LA-TABLE.md`
- **3** · Le composer : ouvrir chacune des six cases sur « Au menu », clavier levé ; remplir d'un tap ; annuler par le toast ; proposer un item absent ; « Commence par ton film » sur un bento vide. RM:453. `UX-03-RECHERCHE-ITEM.md`
- **4** · Absorbé par les 2 et 3 (RM:218, RM:524-538), sans parcours propre.
- **5** · Publier, lire « Voir mon bento public » et l'état en ligne, se retirer du fil sans supprimer son compte, republier en tête. RM:565. `UX-05-BROUILLON-PUBLIE.md`
- **6** · « Trouver » : les puces « on retrouve souvent », `hifus` qui trouve `dark_hifus`, un titre qui ramène ses bentos en deux sections, un tap qui ouvre le bento, jamais « Bento introuvable ». RM:595. `UX-06-TROUVER.md`
- **7** · La page d'un bento, depuis le fil, « Trouver » et un lien : la boîte entière, la rangée basse en fin de défilement sur SE ; le retour sur un bento déjà vu sans requête ; « Rien en ligne » et « Connexion perdue ». Le « rendu sur appareil réel » y reste à voir (UX-07:1222). RM:631. `UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md`
- **8** · Ouvrir le bento d'un autre, dans l'app et sur le web : une visite par jour ; « Afficher mes visites » ; quitter un bento prêt sans publier, la question du rappel, puis la notification et son tap. RM:860. `UX-08-SIGNAUX-DE-RETOUR.md`
- **9** · Avec le 16, même spécification : un nouveau venu passe l'accueil et les règles, compose six cases sans compte, donne son pseudo et accepte les CGU au moment de publier, arrive sur sa page. RM:225, RM:743. `UX-16-PLUSIEURS-BENTOS.md`, lot 5
- **10** · Fondu dans le 21 (RM:234, RM:989-991) : « Modifier le profil » se parcourt avec lui.
- **11** · Toute l'app à la plus grande taille de police et au lecteur d'écran : l'action principale de chaque écran atteignable, aucun mot coupé ; bloquer puis débloquer depuis Réglages ; le bandeau hors ligne sans recouvrement. UX-11:70-82. `UX-11-ACCESSIBILITE-POLISH.md`
- **12** · Après la publication, écrire ses pourquoi depuis sa page ; en lire d'autres sous la boîte, dans l'app et sur le web ; en signaler un, le voir masqué ; remplacer un item expliqué au composer. UX-12:639-672. `UX-12-POURQUOI-PAR-CASE.md`
- **13** · Après le plancher (D15). L'équipe programme une édition au back-office, elle sort à sa date sans nouvelle version ; la rejoindre depuis le composer, la remplir, publier, la voir étiquetée dans « La table », la partager. Les seize étapes du §7.3 C et le contrôle D, que la DoD 12 veut sur appareils réels (UX-13:939-975, UX-13:1245). RM:776. `UX-13-BENTO-HEBDOMADAIRE.md`
- **14** · Back-office : lister les utilisateurs et l'entonnoir, en supprimer un avec son motif, composer le bento d'un créateur invité, qui paraît « Invité » dans le fil. RM:508-510. `UX-14-BACK-OFFICE-UTILISATEURS.md`
- **15** · La case Artiste qui trouve aussi un créateur, « Squeezie », et l'inverse ; au back-office, créer et activer un type, importer et valider ses candidats ; le bento principal inchangé. RM:658. `UX-15-NOUVELLES-CATEGORIES.md`
- **16** · Après le plancher (D15). Un compte à deux bentos publiés, chacun à son adresse, le second créé au back-office ; la bande de sélection dans le composer et sur la page ; les anciens liens qui montrent le principal. RM:727. `UX-16-PLUSIEURS-BENTOS.md`
- **17** · Proposer un item, la phrase puis la boîte du système, la validation au back-office, la notification et son tap ; accepter les éditions, en recevoir une ; couper chaque type dans le profil. RM:806. `UX-17-NOTIFICATIONS-PUSH.md`
- **18** · Compléter son bento par une proposition, « Publication à la validation », la validation au back-office : le bento sort sans rouvrir l'app, et « Bento publié » le dit. RM:835. `UX-18-PUBLICATION-AUTOMATIQUE.md`
- **19** · Les épisodes à leur date dans « La table », leur carte, le tap vers YouTube ou la plateforme du podcast. RM:893. `UX-19-EPISODES-LA-TABLE.md`
- **20** · Sur la page d'un bento, la pastille « Mêmes goûts », son écran et ses items communs, le tap vers un bento ; « Apparaître dans la recherche » éteint, puis rallumé. RM:927. `UX-20-MATCH-PAR-BENTO.md`
- **21** · La page d'un compte et tous ses bentos ; l'onglet Profil devenu sa page ; Réglages ; « Modifier le profil », Popy, nom, pseudo et ses 30 jours, ce qu'apportait le 10 ; un ancien lien redirigé. RM:979, RM:993. `UX-21-PROFIL.md`
- **22** · Aimer et commenter un bento, compte gardé ; le filtre ; signaler un commentaire, un compte, un bento ; bloquer ; refuser likes et commentaires ; l'équipe prévenue par mail masque d'un geste. RM:1055. `UX-22-LIKES-COMMENTAIRES.md`
- **23** · Suivre en un tap depuis la page d'un compte ; les bentos suivis dans « Abonnements » ; « Valider mes abonnés » et ses demandes. RM:1091. `UX-23-SUIVRE-UN-COMPTE.md`
- **24** · L'onglet « Notifs » : likes, commentaires, abonnés, bentos suivis et décisions de l'équipe, regroupés, la pastille exacte, chaque tap à sa destination. RM:1111. `UX-24-ZONE-DE-NOTIFICATIONS.md`
- **25** · Relier son Instagram et son TikTok par leurs pseudos ; les deux glyphes au bout de la ligne de date, leur tap vers le réseau ; « Afficher mes réseaux ». DoD : UX-25:270-288, le « fait quand » de RM:1140 ayant été revu par D1 (UX-25:296). `UX-25-COMPTES-INSTAGRAM-TIKTOK.md`
- **26** · Refermé par le 25 (RM:232, RM:933-935) : ses six réglages de la section Confidentialité se parcourent avec les 8, 20, 22, 23 et 25.
- **27** · Publier son premier bento et gagner « Premier bento », visible sur sa page dans l'app et sur le web, annoncé dans « Notifs ». RM:1160. `UX-27-SUCCES.md`
- **28** · Garder son compte par son adresse et un code, juste après la première publication ; le retrouver sur un autre téléphone ; se déconnecter et se reconnecter ; supprimer son compte. RM:1019. `UX-28-COMPTE-RECUPERABLE.md`

---

## 6. Les fiches des stores

Ce que les deux consoles demandent pour la 2.0.0, rempli d'après le code et
les migrations de la branche. **Rien n'y est saisi par l'agent** : Clément
recopie les réponses dans App Store Connect et dans la Play Console.

**Les captures des stores** se prennent dans l'app refaite (D25), qui porte
aussi la nouvelle icône d'app : celles de la 1.1 ne montrent plus l'app.

### 6.1 Apple : la classification d'âge (D7)

Le questionnaire d'App Store Connect porte depuis juillet 2026 une question
« Social Media », obligatoire depuis septembre pour toute mise à jour. Apple
la définit ainsi : la redistribution, l'amplification ou l'interaction avec
le contenu des utilisateurs au travers d'un fil ou d'un moyen de découverte
semblable, qui le diffuse visiblement à beaucoup d'utilisateurs. « La
table », les j'aime, les commentaires et les abonnements en relèvent : **la
note minimale passe de 4+ à 13+**, 16+ en Australie et A16 au Brésil, avec
la mention « Social Media » sur la fiche.

| Rubrique | Question | Réponse | Pourquoi |
|---|---|---|---|
| In-App Controls | Parental Controls | Non | aucun réglage pour les parents |
| In-App Controls | Age Assurance | Non | aucune vérification d'âge |
| Capabilities | Unrestricted Web Access | Non | les liens s'ouvrent hors de l'app, dans le navigateur ou l'app concernée ; aucun navigateur intégré |
| Capabilities | User-Generated Content | **Oui** | bentos, commentaires, pourquoi, items proposés, pseudos et noms |
| Capabilities | Social Media | **Oui** | « La table », j'aime, commentaires, abonnements |
| Capabilities | Social Media Disabled for Users Under 13 | Non | demanderait l'API Declared Age Range, absente |
| Capabilities | Messaging and Chat | Non | aucun message privé : les commentaires sont publics, sous un bento |
| Capabilities | Advertising | Non | aucune publicité |
| Mature Themes, Medical or Wellness, Sexuality or Nudity, Violence, Chance-Based Activities | toutes | Aucun | l'app montre des titres d'œuvres et leurs images libres, jamais leur contenu ; le contenu des utilisateurs passe un filtre et la modération |

La réponse « Messaging and Chat » ne change pas la note : 4+ dans le monde,
A12 au Brésil, où « Social Media » vaut déjà A16.

### 6.2 Apple : la confidentialité de l'app (D8, D13)

App Store Connect, App Privacy. L'inventaire du 27 octobre, tiré des
migrations et du code, fait foi : **aucune analytique, aucun rapport de
plantage, aucune publicité, aucun identifiant publicitaire**, aucune
connexion par un réseau social. Supabase, Expo, Apple, Google et Resend
traitent pour le compte de l'éditeur.

**Collectez-vous des données ?** Oui. **Pistage** (« Used to Track You ») :
**non**, pour toutes.

| Type de données | Ce que c'est dans l'app | Lié à l'utilisateur | Finalités |
|---|---|---|---|
| Contact Info · Email Address | l'adresse d'un compte gardé, facultative (28) | Oui | App Functionality |
| Contact Info · Name | le nom affiché, facultatif, qui peut porter un vrai nom (21) | Oui | App Functionality |
| Contact Info · Other User Contact Info | les pseudos Instagram et TikTok, facultatifs (25) | Oui | App Functionality |
| User Content · Other User Content | bentos, items proposés, pourquoi, commentaires, détail d'un signalement | Oui | App Functionality |
| Identifiers · User ID | l'identifiant du compte et le pseudo | Oui | App Functionality |
| Identifiers · Device ID | le jeton de notification (17), l'identifiant des mises à jour d'Expo | Oui | App Functionality |
| Usage Data · Product Interaction | j'aime, abonnements, blocages, lecture de « Notifs », dernier lancement, visites comptées | Oui | App Functionality, Analytics |
| Diagnostics · Other Diagnostic Data | la plateforme et la version de l'app à chaque lancement (14) | Oui | Analytics |

**Non collectées** : localisation, contacts, santé, finances, données
sensibles, historique de navigation, **historique de recherche** (les
requêtes ne sont jamais gardées), achats, photos et vidéos, audio, données
de plantage et de performance, données publicitaires.

**Le manifeste de confidentialité** que la build embarque est celui
qu'Expo génère, relevé au §8 : horodatage des fichiers, `UserDefaults`,
heure de démarrage du système, aucun pistage. Chaque bibliothèque y
ajoute le sien. C'est le même mécanisme qu'a accepté la revue de la 1.1 ;
le rapport de confidentialité de l'archive (Xcode, Organizer, « Generate
Privacy Report ») le confirmera sur la build de production.

### 6.3 Apple : les notes pour la revue

À coller dans App Store Connect, App Review Information, Notes. En anglais,
la langue des équipes de revue.

```text
No sign-in is needed: the app creates an anonymous account on first launch, and every screen can be tried without one.

To publish a bento: open the "Compose" tab, fill the boxes with items, then publish. A pseudonym and the terms of use are asked at that moment.

Commenting requires a published bento and a kept account: Profile tab, "Réglages", "Garder mon compte", then an email address you can read and the 6-digit code sent to it.

User-generated content (guideline 1.2):
• pseudonyms, names, comments and "pourquoi" texts go through a filter before they are published;
• every bento, comment and "pourquoi" can be reported ("Signaler"), and any account blocked ("Bloquer");
• reports reach the team by email within the hour and are handled in our back-office, where a comment can be hidden and an account banned and erased.

Account deletion (guideline 5.1.1(v)): Profile tab, "Réglages", "Supprimer mon compte". Also on the web: https://bento-pop.com/suppression-compte

Push notifications are optional: an item the team validated, a bento published, and, if accepted, the weekly edition.

Terms: https://bento-pop.com/mentions-legales
Privacy: https://bento-pop.com/confidentialite
Contact: contact@bento-pop.com
```

### 6.4 Google Play : la sécurité des données (D13)

Play Console, Contenu de l'application, Sécurité des données. Google ne
compte pas comme un partage ce que traitent les prestataires pour le
compte de l'éditeur : **aucune donnée n'est partagée**.

| Question | Réponse |
|---|---|
| L'app collecte-t-elle ou partage-t-elle des données ? | Oui |
| Toutes les données sont-elles chiffrées en transit ? | Oui : HTTPS partout |
| Peut-on demander la suppression de ses données ? | Oui : dans l'app, Réglages, « Supprimer mon compte », et sur https://bento-pop.com/suppression-compte |

| Catégorie · type | Ce que c'est dans l'app | Obligatoire ou facultative | Finalités |
|---|---|---|---|
| Informations personnelles · Nom | le nom affiché | Facultative | Fonctionnement de l'app, gestion du compte |
| Informations personnelles · Adresse e-mail | l'adresse d'un compte gardé | Facultative | Fonctionnement de l'app, gestion du compte, prévention des fraudes, sécurité et conformité |
| Informations personnelles · ID utilisateur | l'identifiant du compte, le pseudo | Obligatoire | Fonctionnement de l'app, gestion du compte |
| Informations personnelles · Autres informations | les pseudos Instagram et TikTok | Facultative | Fonctionnement de l'app |
| Activité dans l'app · Interactions avec l'app | dernier lancement, visites comptées, lecture de « Notifs » | Obligatoire | Fonctionnement de l'app, analyses |
| Activité dans l'app · Historique des recherches dans l'app | les requêtes, traitées sans être gardées : cocher « traitement éphémère » | Obligatoire | Fonctionnement de l'app |
| Activité dans l'app · Autres contenus générés par l'utilisateur | bentos, items proposés, pourquoi, commentaires, détail d'un signalement | Facultative | Fonctionnement de l'app |
| Activité dans l'app · Autres actions | j'aime, abonnements, blocages | Facultative | Fonctionnement de l'app |
| Infos et performances de l'app · Autres données sur les performances | la plateforme et la version de l'app | Obligatoire | Analyses |
| Appareil ou autres ID | le jeton de notification, l'identifiant d'installation de Firebase une fois `google-services.json` ajouté (5b), celui des mises à jour d'Expo | Obligatoire | Fonctionnement de l'app |

### 6.5 Google Play : la classification, le public cible, l'accès

**La classification du contenu** (questionnaire IARC), catégorie des
réseaux sociaux et du contenu des utilisateurs :

| Question | Réponse |
|---|---|
| Les utilisateurs échangent-ils du contenu, du texte ou des images ? | **Oui** : bentos, commentaires, pourquoi |
| L'app partage-t-elle la position de l'utilisateur ? | Non |
| Des achats numériques ? | Non |
| Un accès libre à internet ? | Non |
| Violence, sexualité, langage, substances, jeux d'argent | Non |

Attendu : PEGI 3, avec la mention « Les utilisateurs interagissent ».

**Le public cible** (D9) : **13 ans et plus**, aligné sur la note d'Apple.
Inclure les moins de 13 ans ferait entrer l'app dans le programme Familles
de Google et ses exigences, qu'elle ne remplit pas.

**L'accès à l'app** : tout est accessible sans compte, sauf commenter.

```text
Aucune connexion n'est nécessaire : l'app crée un compte anonyme au premier lancement.
Pour commenter, il faut un bento publié et un compte gardé : onglet Profil, « Réglages », « Garder mon compte », puis une adresse email que vous pouvez lire et le code à 6 chiffres reçu.
```

### 6.6 La politique de confidentialité et la page de suppression (D14)

Les deux stores comparent les fiches à la politique publiée. Relevé le
27 octobre dans `apps/landing/src/app/confidentialite/page.tsx` et
`apps/landing/src/app/suppression-compte/page.tsx`, **et corrigé le même
jour** (§9.1) : ce qui suit est le relevé d'avant la correction. Les
attributions des mentions légales à TMDb, MusicBrainz, OpenStreetMap et
Wikidata sont gardées : une partie du catalogue en vient.

**Ce qui est faux aujourd'hui**

- La session serait « persistée dans le stockage sécurisé de l'appareil » :
  elle vit dans AsyncStorage, par choix (`src/supabase/client.ts`).
- Le pseudo serait « choisi à l'onboarding » : il l'est à la première
  publication, depuis le 9.
- L'app « interroge en temps réel » TMDb, MusicBrainz, OpenStreetMap et
  Wikidata : elle ne cherche plus que dans le catalogue de Supabase ; seules
  les affiches se chargent encore depuis le CDN de TMDb. Les mentions légales
  citent toujours ces quatre sources.
- L'adresse email ne servirait qu'aux codes et ne serait jamais partagée :
  elle sert aussi au motif d'un bannissement, et Resend la reçoit. L'écran
  « Garder mon compte » dit de même : « Elle n'est jamais affichée ni
  partagée ».
- La suppression serait totale et immédiate : restent l'entrée du registre
  des suppressions, 12 mois ; les signalements qui visent le compte, jusqu'à
  un an après leur traitement ; ses propositions d'items, au catalogue, sans
  auteur.

**Ce qui manque** : les notifications push (le jeton, Expo, APNs et FCM,
les tickets gardés 30 jours) ; la télémétrie de lancement ; les items
proposés ; le Popy, les anciens pseudos et leur redirection ; le registre
des suppressions ; ce qui reste sur le téléphone ; l'export dans les
droits ; les durées de conservation ; et **un âge minimum**, que ni la
politique, ni les mentions légales, ni l'écran des règles ne fixaient :
15 ans, décidé le 27 octobre (D23).

**La page de suppression** ne cite que le compte, l'adresse, le pseudo, le
nom et les bentos : partent aussi commentaires, j'aime, pourquoi,
abonnements, réseaux, succès, appareils de notification, télémétrie, anciens
pseudos et blocages. Ses « 30 jours glissants » de sauvegardes et les « ~7
jours » de journaux de la politique sont à confronter au plan Supabase du
projet mobile.

**Relevé en chemin** : le plugin d'`expo-secure-store`, que l'app n'importe
plus, ajoute à l'Info.plist une phrase d'autorisation Face ID en anglais,
sans aucun usage. Retirée (D24).

---

## 7. Les notes de version

**App Store**, « Nouveautés de cette version », 4 000 caractères au plus :

```text
Mon Bento Pop fait peau neuve.

• La table : le fil des bentos de la communauté, avec les émissions et les podcasts de Bento Pop à leur date.
• Le bento de la semaine : chaque jeudi, une nouvelle édition à composer.
• Compose sans compte : ton pseudo ne se choisit qu'à la publication, et tu peux avoir plusieurs bentos.
• Trouver : cherche un item, découvre les bentos qui le contiennent, et ceux qui partagent tes goûts.
• Ton profil : tous tes bentos, ton Popy, ton nom et ton pseudo, tes comptes Instagram et TikTok.
• J'aime, commentaires, et le pourquoi de chaque case.
• Suis les comptes que tu aimes, et retrouve tout dans l'onglet Notifs.
• Des notifications quand l'équipe valide ton item ou publie ton bento, et un rappel si ton bento attend.
• Les visites de ton bento, et huit succès à débloquer.
• Garde ton compte avec ton adresse email, et retrouve-le sur un autre téléphone.
• Six réglages de confidentialité, et une app plus lisible, en grand texte comme au lecteur d'écran.
```

**Google Play**, « Notes de version », 500 caractères au plus :

```text
Mon Bento Pop fait peau neuve : La table, le fil des bentos et des émissions de Bento Pop ; le bento de la semaine, chaque jeudi ; plusieurs bentos par compte, composés sans compte ; j'aime, commentaires et le pourquoi de chaque case ; suivre un compte et l'onglet Notifs ; ton profil, ton Popy, Instagram et TikTok ; des notifications quand ton item est validé ou ton bento publié ; tes visites et huit succès ; ton compte gardé par ton email.
```

444 caractères, compté.

Le bento de la semaine n'apparaît qu'à la première édition, composée une fois
le plancher de version relevé (D8 du 13) : quelques jours au plus après la
mise en ligne (D11).

---

## 8. La répétition en release

Faite le 27 octobre 2026 sur la 2.0.0 de la branche, branchée sur une pile
Supabase locale qui porte toutes les migrations jusqu'au 27, jamais sur la
production (D6). La landing par défaut, bento-pop.com, n'est lue que par
la route des épisodes, comme dans la vraie build.

**Les deux builds.**

- **iOS** : `expo prebuild`, `pod install`, puis `xcodebuild` en
  configuration **Release** pour le simulateur. Le code est embarqué
  (`main.jsbundle`), la version est 2.0.0, la mise à jour à distance active ;
  la cible compilée ne porte que l'adresse de la pile locale, aucune trace du
  projet de production.
- **Android** : `expo prebuild`, puis `gradlew :app:assembleRelease`, en
  11 minutes. Le code est embarqué ; la même cible. Deux écarts avec la build
  de production : le trafic HTTP en clair autorisé dans le manifeste généré,
  la pile locale n'ayant pas de TLS, et la signature par la clé de débogage
  du gabarit. Le dossier `android/` étant généré et ignoré par git, rien n'en
  part dans le dépôt.

**Ce qui a tourné**, au simulateur iPhone 17 Pro et à l'émulateur Pixel 8 :

| Geste | iOS | Android |
|---|---|---|
| Installée par-dessus une build de développement et ses données, comme une mise à jour | démarre sur le compte en place et son bento | idem, la pastille de « Notifs » à 1 |
| Les cinq onglets | Compose, « La table » et son filtre, Trouver, « Notifs » et le succès gagné, Profil et son compteur de visites | idem |
| Une écriture | un j'aime, relu en base | un j'aime sur le bento publié depuis l'iPhone, relu en base |
| Une installation neuve, de l'accueil à la publication | l'accueil, les règles et les conditions, six cases par leurs suggestions, un pseudo proposé, la publication, « Garde ton bento », la question des éditions, la page publique | idem jusqu'à « Garde ton bento » |
| En base après la publication | publié, 6 cases, les conditions horodatées, « Premier bento » posé | publié, « Premier bento » posé |
| Les journaux | une seule erreur, attendue : la vérification de mise à jour refusée en 400, faute du canal qu'EAS pose à la build ; l'app démarre sur son code embarqué en moins d'une seconde | aucune erreur JavaScript, aucun plantage |

**Aucun défaut propre à la release.** Deux constats en relisant l'arbre
d'accessibilité et l'Info.plist de la build, antérieurs à elle :

- **VoiceOver lit en anglais les mots que React Native compose lui-même**,
  sur un simulateur réglé en français : la case des conditions s'annonce
  « checkbox, unchecked ». React Native 0.86.3 n'embarque aucune traduction
  pour iOS : dans `React-Core.podspec`, la déclaration du bundle de
  confidentialité écrase celle du bundle des chaînes, et son fichier
  français est vide de toute façon, les traductions n'existant que dans un
  format interne à Meta. `CFBundleAllowMixedLocalizations`, essayé et
  relu sur la build, n'y change rien : retiré. **Corrigé le même jour**
  (D18, §9.1) : relu sur une nouvelle build Release, au simulateur en
  français, la case s'annonce « non coché » puis « coché », sur un bouton ;
  les motifs de signalement n'ont plus de valeur anglaise.
- **Une phrase d'autorisation Face ID, en anglais, sans aucun usage**, posée
  par le plugin d'`expo-secure-store`. Retirée par `faceIDPermission: false`,
  vérifié sur l'Info.plist régénéré, D24.

À l'émulateur, texte à 200 %, le point 12-b est constaté : « AROUND THE
WOR… », l'ellipse prévue (D19).

**Ce qu'elle ne tranche pas**, et qui reste à la liste du §4 : un vrai
téléphone, l'environnement de production d'APNs et de FCM, la signature des
stores, le démarrage en mode avion, le réseau mobile, la vérification de
mise à jour sur le canal `production`, que seule EAS pose.

**À refaire après le 5b et la refonte visuelle**, la build Android changeant
avec `google-services.json`, et toute l'app avec la refonte (§3, étape 4),
par
`apps/mobile/scripts/release-locale.sh ios|android [dossier de la pile]`.
Le script refuse toute cible qui n'est pas une pile locale, et tout `.env`
laissé dans `apps/mobile`.

---

## 9. Livraison

### 9.1 Fait le 27 octobre 2026

Sur `feat/ux-29-recette-de-sortie`, partie de la branche de la PR #105, le
27, et ouverte en **PR #106**, empilée sur la #105, fusionnée le soir même.

- **La spécification** : la liste de sortie (§4) et ses parcours (§5), les
  fiches des stores (§6), les notes de version (§7).
- **La 2.0.0** dans `apps/mobile/app.json` (D1), au lieu de la 1.3.0, et
  la phrase Face ID retirée de l'Info.plist (D24).
- **La répétition en release** (§8), et son script,
  `apps/mobile/scripts/release-locale.sh`.
- **La liste sur la page** « Mes tâches Bento Pop », à cocher pendant la
  recette (D5).
- **`docs/STORE-COMPLIANCE.md`** marqué périmé, renvoyant ici (D10).
- **Relevé en chemin, hors du 29** : la purge de nuit du chantier 8, passée
  chaque nuit depuis le 24 octobre, sans échec ; noté dans sa spécification
  et dans la roadmap.
- **Le français de VoiceOver** (D18) : `src/lib/a11y-states.ts`, testé sous
  `node:test`, remplace sur iOS les rôles et états que React Native lirait en
  anglais par des traits natifs et des valeurs françaises, et les garde sur
  Android. Dix endroits, un de plus que le relevé : le garde-fou ajouté à
  `src/components/accessibilite.test.ts` a trouvé « Voir les commentaires
  précédents », dont l'état tenait sur trois lignes. Deux défauts introduits
  exprès, un rôle radio et un état en attente écrits en dur, l'ont chacun
  fait tomber.
- **Les textes légaux** (D14, D23) : la politique de confidentialité, la
  page de suppression et les mentions légales disent ce que le code fait,
  d'après le §6.6, l'âge de 15 ans compris ; l'écran des règles le dit
  aussi, et « Garder mon compte » ne promet plus que l'adresse n'est jamais
  partagée. Les durées viennent de la page des tarifs de Supabase : sur le
  plan gratuit, les journaux sont gardés 1 jour, et la base n'a aucune
  sauvegarde automatique.

### 9.2 Ce qui attend

Le code attendu avant la sortie : la refonte visuelle, chantiers 30 à 34
(D25), et ce que la recette trouverait. Dans l'ordre du §3 : le 5b du 17
(D2), fait le 28 octobre, la refonte, la répétition refaite, la build de
production, la recette, les fiches et la soumission. Les mises
en service sont faites depuis le 28 octobre, et les textes légaux corrigés
sont en ligne depuis la fusion, servis par bento-pop.com le 27 octobre à
20:00 UTC.

---

## 10. Definition of Done

| # | Point | État |
|---|---|---|
| 1 | La liste de sortie rassemblée, dédoublonnée et sourcée | ✅ le 27 octobre |
| 2 | Les fiches des stores prêtes à recopier | ✅ le 27 octobre |
| 3 | Les notes de version, dans les limites des deux stores | ✅ le 27 octobre |
| 4 | La 2.0.0 dans `app.json` | ✅ le 27 octobre |
| 5 | Une répétition en release sans défaut, sur iOS et Android | ✅ le 27 octobre |
| 6 | Le 5b du 17 fait et recetté, la répétition refaite | 🟡 le 5b le 28 octobre (PR #108) ; la répétition ⬜, après la refonte (15) |
| 7 | La build de production 2.0.0 sur TestFlight et le canal interne | ⬜ |
| 8 | La liste vide, sur un iPhone et un Android | ⬜ |
| 9 | Les fiches saisies dans les deux consoles | ⬜ |
| 10 | Les deux stores servent la 2.0.0 | ⬜ |
| 11 | `app_config` : la dernière version à 2.0.0 le jour même, le plancher relevé une fois les deux stores à jour | ⬜ |
| 12 | VoiceOver ne lit plus aucun mot anglais de React Native (D18) | ✅ le 27 octobre, relu au simulateur ; la voix à la recette (11-a) |
| 13 | L'âge minimum fixé (D23) | ✅ le 27 octobre, 15 ans |
| 14 | Les textes légaux justes, l'âge minimum compris (D14) | ✅ le 27 octobre, en ligne depuis la fusion, le soir même |
| 15 | La refonte visuelle faite et recettée, chantiers 30 à 34 (D25) | 🟡 ajoutée le 28 octobre ; le 30 fait et recetté le 30 octobre, sa part versée au §4 ; les 31 à 34 à faire |

---

## 11. Décisions

| # | Décision | Pourquoi |
|---|---|---|
| **D1** | La sortie s'appelle **2.0.0** | Rendue par Clément en QCM, l'option recommandée. La refonte se voit, et la 2.0.0 ne se confond pas avec la 1.3.0 du 16 septembre, construite avec les seuls 16 et 9. Supérieure à la 1.1 servie par l'App Store, vérifiée le 27 octobre ; `runtimeVersion` suit la version, donc les mises à jour à distance viseront la runtime 2.0.0 |
| **D2** | La sortie attend le lot 5b du 17 | Rendue par Clément en QCM, l'option recommandée. Sans la clé APNs et le compte FCM, Android dit « Ce téléphone ne peut pas recevoir de notifications pour l'instant », et iOS demande l'autorisation sans que rien n'arrive ; brancher Android ensuite demanderait une build et une revue de plus |
| **D3** | La mise en ligne se fait d'un coup | Rendue par Clément en QCM, plutôt que la publication échelonnée recommandée : sur l'App Store, la publication sans échelonnement ; sur Play, la production à 100 % |
| **D4** | La recette se fait sur la build de production elle-même, installée par TestFlight et le canal interne | C'est elle qui part en revue. `pnpm release` la pose sur les deux canaux de test, et rien n'est soumis avant que la liste soit vide ; une correction repart de la répétition (§3) |
| **D5** | La liste se coche sur la page « Mes tâches Bento Pop » | Clément la tient sur un autre appareil que celui qu'il teste ; la spécification garde la référence et les sources |
| **D6** | Une répétition en release, au simulateur et à l'émulateur, sur une pile locale, avant la build EAS | Elle trouve à moindre coût ce qui ne casse qu'en release, sans toucher la production ni dépenser une build EAS ; refaite après le 5b |
| **D7** | La classification d'âge : contenu des utilisateurs et « Social Media », oui ; messagerie, navigateur, publicité, non. **13+** | La question « Social Media » est obligatoire depuis septembre 2026, et « La table » en relève d'après la définition d'Apple. Les commentaires sont publics, sous un bento : ce n'est pas une messagerie, et la réponse ne change pas la note |
| **D8** | Le jeton de notification est déclaré comme identifiant d'appareil, lié au compte, sans pistage | Déclarer une donnée de trop ne coûte rien ; en omettre une expose à un rejet |
| **D9** | Le public cible sur Play : 13 ans et plus | Aligné sur Apple, et hors du programme Familles, dont l'app ne remplit pas les exigences |
| **D10** | `docs/STORE-COMPLIANCE.md` est marqué périmé et renvoie ici | Écrit en mai 2026, il dit encore qu'il n'y a ni blocage ni modération au back-office |
| **D11** | Les notes de version ne promettent que ce que la 2.0.0 montre dans ses premiers jours | Le bento de la semaine attend le plancher de version, relevé quelques jours après la mise en ligne |
| **D12** | Le plancher de version se relève seulement quand les deux stores servent la 2.0.0, puis la première édition se compose | D8 du 13, inchangée : un compte à deux bentos casse sa page publique dans les versions publiées |
| **D13** | Les fiches de confidentialité suivent l'inventaire du §6, tiré des migrations et du code | Ce que la base garde fait foi, pas ce que l'app affiche |
| **D14** | La politique de confidentialité de la landing est complétée avant la soumission de ce qu'elle tait encore (§6.6) | Les deux stores la comparent aux fiches. Fait le 27 octobre, avec la page de suppression, les mentions légales et deux phrases de l'app (§9.1) |
| **D15** | La recette en deux temps : avant la soumission, tout sauf ce qui demande une édition, un bento secondaire ou une mise à jour à distance en production ; ces points-là après le plancher, sur la 2.0.0 en ligne (passe G) | La production les interdit avant le plancher (D8 du 13, et le 16 pour un second bento) ; leurs écrans sont recettés au simulateur et à l'émulateur, et un défaut s'y corrigerait par une mise à jour à distance |
| **D16** | La recette écrit en production avec deux comptes, celui de Clément et un compte de recette, supprimé à la fin avec tout ce qu'il a écrit | Seule la production porte les vrais services, APNs, FCM et Resend ; un compte de recette borne ce que voient les autres, comme l'exception de `RECETTE-MOBILE.md` §1 |
| **D17** | L'haptique attendue est celle du code : un impact léger au toucher, « succès » à la case enregistrée, « erreur » sur un échec | Le 3 et le 11 divergeaient ; `src/lib/haptics.ts` fait foi |
| **D18** | VoiceOver ne doit lire aucun mot anglais : les rôles et états que React Native compose en anglais sont remplacés par des traits natifs et des valeurs françaises portées par l'app, sur iOS ; Android garde ceux de React Native | Constaté le 27 octobre sur la build de release, simulateur en français : React Native n'a aucune traduction utilisable sur iOS (§8). Corrigé le même jour par `src/lib/a11y-states.ts`, dix endroits, et gardé par `accessibilite.test.ts` (§9.1) |
| **D19** | 12-b et 12-c sont acceptés | 12-b est l'ellipse prévue par `tile-title.ts`, sous le plancher de taille, TalkBack lisant le titre entier ; 12-c, le comportement d'Android pour toute l'app, déjà décrit |
| **D20** | 13-a se constate sur un vrai SE seulement si une case Créateur masquée existe en production ; 13-c est remplacé par les comparaisons au pixel du simulateur | L'intitulé ne paraît que sur une case vide ; la build « d'avant » de 13-c n'existe sur aucun store |
| **D21** | Deux messageries suffisent : iMessage et WhatsApp | Les plus utilisées ; les spécifications en demandaient deux, trois ou six |
| **D22** | La mise à jour au lancement (lot B) s'éprouve après la mise en ligne, par une mise à jour sans changement visible, publiée avec `--environment production` | Aucune mise à jour ne doit viser la runtime 2.0.0 avant la sortie ; sans `--environment`, et sans les variables dans l'environnement de la machine, le code publié perdrait l'adresse de Supabase. Corrigé dans `DEPLOIEMENT-MOBILE.md` §6, qui l'omettait |
| **D23** | L'âge minimum de l'app est de **15 ans**, écrit dans les règles, la politique et les mentions légales, sans contrôle d'âge | Rendue par Clément en QCM le 27 octobre, l'option recommandée. Aucun texte n'en fixait ; Apple et Play classeront l'app 13+ ; la politique fonde le pseudo et le bento sur le consentement, et la loi Informatique et Libertés fixe à 15 ans l'âge d'un consentement seul. Ce n'est pas un avis juridique |
| **D24** | La phrase d'autorisation Face ID est retirée de l'Info.plist | Posée en anglais par le plugin d'`expo-secure-store`, que l'app n'importe plus, sans aucun usage ; `faceIDPermission: false` la supprime, vérifié sur l'Info.plist régénéré |
| **D25** | La sortie attend aussi la refonte visuelle, chantiers 30 à 34 de la roadmap | Rendue par Clément en QCM le 28 octobre, l'option recommandée (D1 de la refonte) : les écrans refaits ne passent qu'une fois par la recette sur deux vrais téléphones, et les captures des stores se prennent dans l'app refaite, avec sa nouvelle icône. La répétition se refait après elle ; le thème sombre attend après la sortie (D3 de la refonte) |
