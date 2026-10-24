# Rôles d'accessibilité et vues recyclées sur iOS

> **Relevé du 24 octobre 2026**, sur `fix/roles-fabric`, partie de
> `feat/ux-20-match-par-bento` : les chantiers 19 et 20 n'étaient pas encore
> dans `main`. iPhone 17 Pro au simulateur, iOS 26.4, React Native 0.86.3,
> Expo SDK 57. **Arbitré par Clément le même jour** : corriger la mesure, et
> rendre aux cartes d'épisode leur rôle « lien ».
>
> **Réglages relu le même jour**, après la fusion du chantier 21 qui l'a créé,
> sur `chore/roadmap-19-20-21-livres` : ses rôles sont justes, et son mélange
> venait du compagnon d'`idb`, comme ailleurs (§4, Réglages).

---

## 1. La question

Au lot 4 du chantier 19, 12 cartes d'épisode sur 40, déclarées « lien »,
s'annonçaient « bouton » au parcours de « La table », et pas les mêmes d'un
appareil à l'autre. Le soupçon : Fabric recycle les vues natives sans remettre
leurs rôles à zéro (`prepareForRecycle` de `RCTViewComponentView`). Les cartes
avaient pris le rôle des bentos, « bouton », et le même mélange menaçait tout
écran où des vues de rôles différents se montent et se démontent.

Trois questions : ce qu'en dit React Native en amont ; quels écrans de l'app y
sont exposés ; et s'il faut harmoniser les rôles écran par écran, ou corriger
React Native par un `pnpm patch` qui remet les traits à zéro au recyclage.

## 2. En amont

Le dépôt s'appelle désormais `react/react-native`.

**Le rôle ne reste pas d'une vie à l'autre, d'après le code.** En 0.86.3,
`prepareForRecycle` défait les calques, l'émetteur d'événements et la mise en
page, mais garde `_props`, les props de la vie précédente. `updateProps` compare
les nouvelles props à celles-là, et pose donc le trait du nouveau rôle dès
qu'il diffère de l'ancien : la vue native et `_props` restent d'accord. La
branche `main` fait de même, et le dit en commentaire (« `prepareForRecycle`
resets `_removeClippedSubviews` but keeps `_props` »). Aucun ticket ne signale
un rôle, bouton ou lien, resté d'une vie à l'autre.

**Les défauts de recyclage connus touchent autre chose** :

- [#57515](https://github.com/react/react-native/issues/57515) : une vue
  recyclée perd le trait « sélectionné » ou « désactivé » quand son rôle change
  et que son état ne change pas, deux écrivains se partageant les traits.
  Corrigé par [#57516](https://github.com/react/react-native/pull/57516), un
  seul écrivain qui dérive les traits du rôle et de l'état, **dans 0.88.0**
  (15 octobre 2026) ; 0.86 et 0.87 l'ont encore. Dans l'app, seuls le bandeau
  des bentos du composer et la barre d'onglets, qui ne se démonte pas, posent
  « sélectionné », sur des boutons qui le restent : relevé juste après bascules
  et détours, §4.
- [#57196](https://github.com/react/react-native/pull/57196), ouverte :
  `accessibilityViewIsModal` reste actif sur une vue recyclée. Et
  [#58361](https://github.com/react/react-native/issues/58361), ouverte : le
  contenu d'une `<Modal>` absent de l'arbre. L'app n'utilise ni l'un ni
  l'autre.
- [#59047](https://github.com/react/react-native/pull/59047), fusionnée : le
  même ménage sur Android, pour le recyclage des vues qu'on y active à part.

**Un `pnpm patch` serait sans effet.** L'app compile React Native
précompilé : `RCT_USE_PREBUILT_RNCORE=1` par défaut, faute de
`ios.buildReactNativeFromSource`, et le projet des pods lie
`React-Core-prebuilt/React.xcframework` sans compiler `RCTViewComponentView.mm`.
Patcher ce fichier imposerait de compiler React Native depuis les sources,
builds EAS comprises, plus longues.

## 3. La mesure

**Le banc**, à côté d'une autre session, sans rien partager
(`RECETTE-MOBILE.md`, §1) : une pile Supabase locale à part, sur 54351, avec
les données de la pile commune recopiées ; un simulateur dans son propre jeu
d'appareils et son compagnon `idb` ; Metro sur 8082 ; la landing de ce worktree
sur 3213, qui sert les 40 épisodes réels du chantier 19 par son bouchon.

**La sonde**, `apps/mobile/scripts/ax-probe.m`, injectée au lancement : chaque
seconde, les traits UIKit de tous les éléments ; à chaque montage et à chaque
recyclage, ceux de la vue avant et après. C'est la vérité côté app,
indépendante du lecteur. `lldb` ne s'attache pas sur ce Mac, dont le mode
développeur est désactivé.

**Les parcours de « La table »**, de haut en bas, l'app relancée à froid :

| Cartes d'épisode | Compagnon `idb` | Posts | Traits UIKit faux | Rôle lu par `idb` faux |
| --- | --- | --- | --- | --- |
| lien | le même tout le parcours | 44 | 0 | **18** |
| lien | neuf à chaque lecture | 44 | 0 | 0 |
| bouton | le même tout le parcours | 45 | 0 | 0 |
| bouton | le même, après une lecture des Crédits | 45 | 0 | **1** |
| lien, code final | neuf à chaque lecture | 45 | 0 | 0 |

Les 18 viennent de **trois vues**, celles des bentos de @recettese,
@recette_proprio et @recette_visites, en tête du fil, reprises ensuite par des
cartes d'épisode. La sonde les voit passer du trait « bouton » au trait
« lien » à leur montage, puis garder « lien » ; `idb` les lit « bouton » à
chaque passage : 18 cartes, ces trois vues tournant avec trois autres d'un
post à l'autre. Le relevé du lot 4 du chantier 19 a le même dessin : à partir
du neuvième post, un motif qui revient tous les six posts, avec deux cartes
fausses par tour au lieu de trois.

Avec les cartes en « bouton », tous les posts partagent un rôle et le cache ne
peut plus mentir entre eux : 0 faux. Mais une lecture des Crédits suffit pour
qu'une carte « bouton » se lise « lien » : le passage au « bouton » cachait
l'artefact sans rendre la mesure fiable.

**Le cache est dans le compagnon d'`idb`.** Sur la même app, sans la toucher,
deux cartes lues `AXGenericElement` se lisent `AXLink` dès le compagnon
relancé : leurs vues avaient d'abord servi aux cases vides de l'écran de
mécanique, sans rôle. VoiceOver ne passe pas par ce compagnon ; il lit les
traits de la vue dans l'app, ceux de la sonde. La voix elle-même s'entend sur
un vrai téléphone, au chantier 29.

## 4. Relevé écran par écran

Les écrans où des éléments de rôles différents se succèdent ou se remplacent :
« Trouver » et ses quatre états, le profil et ses Crédits, le composer et son
bandeau, la modale de recherche, « La table » dans ses états de chargement,
d'erreur, de reprise et de liste vide, la page d'un bento et ses états sans
bento, les mêmes goûts, et Réglages, relu à part après le chantier 21.
Parcourus avec des défilements et des allers-retours qui font recycler les
vues ; chaque relevé lu par un compagnon `idb` neuf.

Le rôle **déclaré** est celui du code, relevé à part ; **UIKit**, les traits de
la sonde ; **`idb` neuf**, le rôle lu. Un interrupteur sort en traits bouton et
interrupteur, lu `AXCheckBox` ; un champ de saisie en traits de saisie, lu
`AXTextField` ; une barre de progression en « mise à jour fréquente », lue
`AXGenericElement` ; un lien sans action des Crédits en texte désactivé. La
dernière colonne dit ce qu'était la vue avant d'être reprise, quand la sonde
l'a vue porter un libellé.

| Écran | Relevés | Éléments | Conformes | Vues reprises d'un autre rôle |
| --- | --- | --- | --- | --- |
| Profil | 3 | 25 | 25 | 0 |
| Crédits | 1 | 12 | 12 | 1 |
| Trouver | 7 | 29 | 29 | 5 |
| La table | 5 | 14 | 14 | 0 |
| Page d'un bento | 3 | 15 | 15 | 3 |
| Mêmes goûts | 1 | 2 | 2 | 0 |
| Modale de recherche | 1 | 12 | 12 | 1 |
| Composer | 5 | 48 | 48 | 0 |
| Réglages | 8 | 92 | 92 | 8 |
| **Total** | **34** | **249** | **249** | **18** |

#### Profil

| Relevé | Élément | Déclaré | UIKit | `idb` neuf | Vue reprise de |
| --- | --- | --- | --- | --- | --- |
| sans bento publié | Reprendre mon bento | button | button | button |  |
| sans bento publié | Crédits & attributions | button | button | button |  |
| sans bento publié | Politique de confidentialité | link | link | link |  |
| sans bento publié | Conditions d'utilisation | link | link | link |  |
| sans bento publié | Exporter mes données | button | button | button |  |
| sans bento publié | Activer les notifications | button | button | button |  |
| sans bento publié | Supprimer mon compte | button | button | button |  |
| retour des Crédits | Reprendre mon bento | button | button | button |  |
| retour des Crédits | Crédits & attributions | button | button | button |  |
| retour des Crédits | Politique de confidentialité | link | link | link |  |
| retour des Crédits | Conditions d'utilisation | link | link | link |  |
| retour des Crédits | Exporter mes données | button | button | button |  |
| retour des Crédits | Activer les notifications | button | button | button |  |
| retour des Crédits | Supprimer mon compte | button | button | button |  |
| bento publié, interrupteurs | Voir mon bento public | button | button | button |  |
| bento publié, interrupteurs | Éditer mon bento | button | button | button |  |
| bento publié, interrupteurs | Crédits & attributions | button | button | button |  |
| bento publié, interrupteurs | Politique de confidentialité | link | link | link |  |
| bento publié, interrupteurs | Conditions d'utilisation | link | link | link |  |
| bento publié, interrupteurs | Exporter mes données | button | button | button |  |
| bento publié, interrupteurs | Activer les notifications | button | button | button |  |
| bento publié, interrupteurs | Afficher mes visites | switch | switch | switch |  |
| bento publié, interrupteurs | Apparaître dans la recherche | switch | switch | switch |  |
| bento publié, interrupteurs | Retirer mon bento du fil | button | button | button |  |
| bento publié, interrupteurs | Supprimer mon compte | button | button | button |  |

#### Crédits

| Relevé | Élément | Déclaré | UIKit | `idb` neuf | Vue reprise de |
| --- | --- | --- | --- | --- | --- |
| depuis le profil | Retour | button | button | button |  |
| depuis le profil | Politique de confidentialité | link | link | link |  |
| depuis le profil | Conditions d'utilisation | link | link | link |  |
| depuis le profil | Site officiel · bento-pop.com | link | link | link |  |
| depuis le profil | Wikimedia : Les illustrations du catalogue provi… | link | link | link |  |
| depuis le profil | TMDb : Les affiches de films et de séries provie… | link | link | link |  |
| depuis le profil | MusicBrainz (legacy) : Certains artistes / chans… | link | link | link |  |
| depuis le profil | OpenStreetMap (legacy) : Certains lieux historiq… | link | link | link |  |
| depuis le profil | Wikidata (legacy) : Certains créateurs sont iden… | link | link | link |  |
| depuis le profil | Fredoka | link | link | link |  |
| depuis le profil | Bungee | link | link | link | aucun, « Série : Severance » |
| depuis le profil | Extenda Yotta · design custom Bento Pop | text | text | text |  |

#### Trouver

| Relevé | Élément | Déclaré | UIKit | `idb` neuf | Vue reprise de |
| --- | --- | --- | --- | --- | --- |
| suggestions | Chercher un pseudo ou un titre | champ | champ | champ |  |
| suggestions | Chercher Get Lucky, présent dans 2 bentos | button | button | button | link, « Conditions d'utilisation » |
| suggestions | Chercher Interstellar, présent dans 2 bentos | button | button | button |  |
| suggestions | Chercher Kyoto, présent dans 2 bentos | button | button | button | link, « Site officiel · bento-pop.co » |
| suggestions | Chercher Severance, présent dans 2 bentos | button | button | button | link, « Wikimedia : Les illustration » |
| suggestions | Chercher Squeezie, présent dans 2 bentos | button | button | button | link, « TMDb : Les affiches de films » |
| « dune » | Chercher un pseudo ou un titre | champ | champ | champ |  |
| « dune » | Voir le bento de @recette_proprio, Proprio Recet… | button | button | button | button, « Chercher Get Lucky, présent » |
| « recette », comptes | Chercher un pseudo ou un titre | champ | champ | champ |  |
| « recette », comptes | Voir le bento de @recette_proprio, Proprio Recet… | button | button | button | button, « Voir le bento de @recette_pr » |
| « recette », comptes | Voir le bento de @recette_visites, Recette Visit… | button | button | button |  |
| « recette », comptes | Voir le bento de @recettese | button | button | button |  |
| aucun résultat | Chercher un pseudo ou un titre | champ | champ | champ |  |
| aucun résultat | Chercher Get Lucky, présent dans 2 bentos | button | button | button | button, « Voir le bento de @recette_pr » |
| aucun résultat | Chercher Interstellar, présent dans 2 bentos | button | button | button |  |
| aucun résultat | Chercher Kyoto, présent dans 2 bentos | button | button | button |  |
| aucun résultat | Chercher Severance, présent dans 2 bentos | button | button | button | button, « Voir le bento de @recette_vi » |
| aucun résultat | Chercher Squeezie, présent dans 2 bentos | button | button | button |  |
| retour aux suggestions | Chercher un pseudo ou un titre | champ | champ | champ |  |
| retour aux suggestions | Chercher Get Lucky, présent dans 2 bentos | button | button | button | button, « Chercher Get Lucky, présent » |
| retour aux suggestions | Chercher Interstellar, présent dans 2 bentos | button | button | button | button, « Chercher Interstellar, prése » |
| retour aux suggestions | Chercher Kyoto, présent dans 2 bentos | button | button | button | button, « Chercher Kyoto, présent dans » |
| retour aux suggestions | Chercher Severance, présent dans 2 bentos | button | button | button | button, « Chercher Severance, présent » |
| retour aux suggestions | Chercher Squeezie, présent dans 2 bentos | button | button | button | button, « Chercher Squeezie, présent d » |
| erreur | Chercher un pseudo ou un titre | champ | champ | champ |  |
| erreur | Réessayer la recherche | button | button | button |  |
| reprise après erreur | Chercher un pseudo ou un titre | champ | champ | champ |  |
| reprise après erreur | Voir le bento de @recette_proprio, Proprio Recet… | button | button | button | aucun, « @recette_proprio, Proprio Re » |
| reprise après erreur | Voir le bento de @recette_roles, Recette Rôles, … | button | button | button |  |

#### La table

| Relevé | Élément | Déclaré | UIKit | `idb` neuf | Vue reprise de |
| --- | --- | --- | --- | --- | --- |
| contenu | Émission Bento Pop, saison 2, épisode 5 : Émissi… | link | link | link |  |
| contenu | Émission Bento Pop, saison 2, épisode 4 : Il rep… | link | link | link |  |
| contenu | Podcast Bento Pop, saison 1, épisode 3 : L'hérit… | link | link | link | link, « Podcast Bento Pop, saison 1, » |
| contenu | Émission Bento Pop, saison 1, épisode 2 : Game O… | link | link | link | link, « Podcast Bento Pop, saison 1, » |
| contenu | Podcast Bento Pop, saison 1, épisode 2 : On revi… | link | link | link | link, « Émission Bento Pop, saison 1 » |
| contenu | Émission Bento Pop, saison 1, épisode 1 : Game A… | link | link | link | link, « Émission Bento Pop, saison 1 » |
| erreur | Réessayer le chargement | button | button | button |  |
| reprise | Bento de @recette_roles, publié il y a 3 min. Fi… | button | button | button |  |
| reprise | Émission Bento Pop, saison 2, épisode 5 : Émissi… | link | link | link |  |
| reprise | Émission Bento Pop, saison 2, épisode 4 : Il rep… | link | link | link |  |
| liste vide | Composer mon bento | button | button | button |  |
| à nouveau peuplée | Bento de @recette_roles, publié il y a 4 min. Fi… | button | button | button |  |
| à nouveau peuplée | Bento de @recettese, publié il y a 16 h. Film : … | button | button | button |  |
| à nouveau peuplée | Bento de @recette_proprio, publié il y a 17 h. F… | button | button | button |  |

#### Page d'un bento

| Relevé | Élément | Déclaré | UIKit | `idb` neuf | Vue reprise de |
| --- | --- | --- | --- | --- | --- |
| bento publié | Retour | button | button | button |  |
| bento publié | 1 bento a les mêmes goûts que celui-ci | button | button | button |  |
| bento publié | Options pour @recette_proprio | button | button | button | aucun, « Chargement du bento de @rece » |
| bento publié | Film : Dune | aucun | aucun | aucun |  |
| bento publié | Série : The Bear | aucun | aucun | aucun |  |
| bento publié | Artiste : Daft Punk | aucun | aucun | aucun |  |
| bento publié | Chanson : Get Lucky | aucun | aucun | aucun |  |
| bento publié | Créateur de contenu : Squeezie | aucun | aucun | aucun |  |
| bento publié | Lieu : Kyoto | aucun | aucun | aucun |  |
| bento publié | Compose le tien | button | button | button |  |
| bento publié | Partager le bento | button | button | button |  |
| adresse sans bento | Retour | button | button | button |  |
| adresse sans bento | Voir le bento de @alice8364043 | button | button | button | aucun, « Chargement du bento de @alic » |
| chargement en échec | Retour | button | button | button | button, « Retour » |
| chargement en échec | Réessayer de charger le bento de @alice8629688 | button | button | button | aucun, « Chargement du bento de @alic » |

#### Mêmes goûts

| Relevé | Élément | Déclaré | UIKit | `idb` neuf | Vue reprise de |
| --- | --- | --- | --- | --- | --- |
| une ligne | Retour | button | button | button |  |
| une ligne | Bento de @recettese : 3 items en commun, Get Luc… | button | button | button |  |

#### Modale de recherche

| Relevé | Élément | Déclaré | UIKit | `idb` neuf | Vue reprise de |
| --- | --- | --- | --- | --- | --- |
| case film | Fermer la recherche | button | button | button | button, « Retour » |
| case film | Cherche un film… | champ | champ | champ |  |
| case film | Choisir Interstellar, choisi 2 fois | button | button | button |  |
| case film | Choisir Dune | button | button | button |  |
| case film | Choisir Catalogue film 8636393 | button | button | button |  |
| case film | Choisir Catalogue film 8630231 | button | button | button |  |
| case film | Choisir Catalogue film 8629688 | button | button | button |  |
| case film | Choisir Catalogue film 8364043 | button | button | button |  |
| case film | Choisir Dune | button | button | button |  |
| case film | Choisir Dune | button | button | button |  |
| case film | Choisir Catalogue film 5311806 | button | button | button | aucun, « Film : Dune » |
| case film | Choisir Film 311397 | button | button | button |  |

#### Composer

| Relevé | Élément | Déclaré | UIKit | `idb` neuf | Vue reprise de |
| --- | --- | --- | --- | --- | --- |
| une case pleine | 1 case sur 6 remplie | progressbar | progressbar | progressbar |  |
| une case pleine | Film : Interstellar | button | button | button |  |
| une case pleine | Ajouter série | button | button | button |  |
| une case pleine | Ajouter artiste | button | button | button |  |
| une case pleine | Ajouter chanson | button | button | button |  |
| une case pleine | Ajouter créateur de contenu | button | button | button |  |
| une case pleine | Ajouter lieu | button | button | button |  |
| une case pleine | Compléter (5 restants) | button | button | button |  |
| bandeau des bentos | Éditer mon bento | button | button | button |  |
| bandeau des bentos | Composer l’édition Le grand inventaire | button | button | button |  |
| bandeau des bentos | Composer l’édition La semaine du film qui pique | button | button | button |  |
| bandeau des bentos | Composer l’édition Le duel du samedi | button | button | button |  |
| bandeau des bentos | Film : Dune | button | button | button |  |
| bandeau des bentos | Série : The Bear | button | button | button |  |
| bandeau des bentos | Artiste : Daft Punk | button | button | button |  |
| bandeau des bentos | Chanson : Get Lucky | button | button | button |  |
| bandeau des bentos | Créateur de contenu : Squeezie | button | button | button |  |
| bandeau des bentos | Lieu : Kyoto | button | button | button |  |
| bandeau des bentos | Voir mon bento public | button | button | button |  |
| une édition | 0 case sur 3 remplie | progressbar | progressbar | progressbar | progressbar, « 0 case sur 3 remplie » |
| une édition | Éditer mon bento | button | button | button |  |
| une édition | Éditer l’édition La semaine du film qui pique | button | button | button |  |
| une édition | Composer l’édition Le grand inventaire | button | button | button |  |
| une édition | Composer l’édition Le duel du samedi | button | button | button |  |
| une édition | Ajouter le film que tu trouves surcoté | button | button | button |  |
| une édition | Ajouter la série que tu caches | button | button | button |  |
| une édition | Ajouter le son de ton été | button | button | button |  |
| une édition | Commence par le film que tu trouves surcoté | button | button | button |  |
| retour au principal | Éditer mon bento | button | button | button |  |
| retour au principal | Éditer l’édition La semaine du film qui pique | button | button | button |  |
| retour au principal | Composer l’édition Le grand inventaire | button | button | button |  |
| retour au principal | Composer l’édition Le duel du samedi | button | button | button |  |
| retour au principal | Film : Dune | button | button | button |  |
| retour au principal | Série : The Bear | button | button | button |  |
| retour au principal | Artiste : Daft Punk | button | button | button |  |
| retour au principal | Chanson : Get Lucky | button | button | button |  |
| retour au principal | Créateur de contenu : Squeezie | button | button | button | button, « Créateur de contenu : Squeez » |
| retour au principal | Lieu : Kyoto | button | button | button |  |
| retour au principal | Voir mon bento public | button | button | button |  |
| retour à l'édition, après détours | 0 case sur 3 remplie | progressbar | progressbar | progressbar | progressbar, « 0 case sur 3 remplie » |
| retour à l'édition, après détours | Éditer mon bento | button | button | button |  |
| retour à l'édition, après détours | Éditer l’édition La semaine du film qui pique | button | button | button |  |
| retour à l'édition, après détours | Composer l’édition Le grand inventaire | button | button | button |  |
| retour à l'édition, après détours | Composer l’édition Le duel du samedi | button | button | button |  |
| retour à l'édition, après détours | Ajouter le film que tu trouves surcoté | button | button | button |  |
| retour à l'édition, après détours | Ajouter la série que tu caches | button | button | button |  |
| retour à l'édition, après détours | Ajouter le son de ton été | button | button | button |  |
| retour à l'édition, après détours | Commence par le film que tu trouves surcoté | button | button | button |  |

#### Réglages

Relu à part le 24 octobre 2026, après la fusion du chantier 21 qui l'a créé,
sur `chore/roadmap-19-20-21-livres` : au lot 3 de ce chantier, après quelques
allers-retours, `idb` y lisait « Conditions d'utilisation » en case à cocher
(`UX-21-PROFIL.md`, §8, lot 3). Même banc que plus haut, à trois choses près :
le simulateur du jeu d'appareils par défaut et la pile Supabase locale commune,
aucune autre session n'en recettant ce jour-là, et Metro sur 8083. Le compte
connecté, @recette_proprio, a son bento publié et les notifications
autorisées. L'écran tient en un défilement : « Retour », deux boutons et deux
liens sous « À propos », deux interrupteurs sous « Notifications », deux sous
« Confidentialité », un bouton par compte bloqué, puis « Retirer mon bento du
fil » et « Supprimer mon compte ».

Le même parcours deux fois, l'app relancée à froid : Réglages ouvert depuis le
profil, le retour des Crédits, un aller-retour au profil, un détour par
« Modifier le profil », un par « La table », trois allers-retours ; puis deux
comptes bloqués posés dans le stockage de l'app, app arrêtée, et retirés après,
pour Réglages à l'ouverture et après détours.

| Compagnon `idb` | Relevés | Éléments | Traits UIKit faux | Rôle lu par `idb` faux |
| --- | --- | --- | --- | --- |
| le même tout le parcours | 6 | 66 | 0 | **5** |
| neuf à chaque lecture | 8 | 92 | 0 | 0 |

Les cinq lectures fausses suivent la règle de §3 : chacune rend le rôle de la
première vie de sa vue, que la sonde a vue passer.

- « Retirer mon bento du fil », bouton, lu interrupteur : sa vue avait d'abord
  servi à « Les éditions » ;
- « Politique de confidentialité », lien, lu interrupteur : d'abord
  « Apparaître dans la recherche » ;
- « Mes items », interrupteur, lu bouton : d'abord « Retirer mon bento du
  fil » ;
- « Afficher mes visites », interrupteur, lu lien : d'abord « Conditions
  d'utilisation » ;
- « Apparaître dans la recherche », interrupteur, lu bouton : d'abord
  « Retirer mon bento du fil ».

Avec un compagnon neuf, 92 éléments sur 92 ont leur rôle déclaré, dont 8 sur
des vues reprises d'un autre rôle : trois Popys et « Changer de pseudo », les
boutons de « Modifier le profil », repris en lien ou en interrupteur, et
l'interrupteur « Les éditions », repris en bouton. Les titres, des textes que
la sonde ne relève pas, sont lus en-têtes à chaque relevé, par les deux
compagnons : « Réglages », « À propos », « Notifications », « Confidentialité »,
« Compte », et « Comptes bloqués » quand la liste existe. Les deux autres états
des notifications, « Activer les notifications » et « Ouvrir les réglages »,
deux boutons, n'ont pas été relus : ils demandent de retirer l'autorisation au
simulateur.

| Relevé | Élément | Déclaré | UIKit | `idb` neuf | Vue reprise de |
| --- | --- | --- | --- | --- | --- |
| à l'ouverture | Retour | button | button | button |  |
| à l'ouverture | Crédits & attributions | button | button | button |  |
| à l'ouverture | Politique de confidentialité | link | link | link |  |
| à l'ouverture | Conditions d'utilisation | link | link | link |  |
| à l'ouverture | Exporter mes données | button | button | button |  |
| à l'ouverture | Mes items | switch | switch | switch |  |
| à l'ouverture | Les éditions | switch | switch | switch |  |
| à l'ouverture | Afficher mes visites | switch | switch | switch |  |
| à l'ouverture | Apparaître dans la recherche | switch | switch | switch |  |
| à l'ouverture | Retirer mon bento du fil | button | button | button |  |
| à l'ouverture | Supprimer mon compte | button | button | button |  |
| retour des Crédits | Retour | button | button | button |  |
| retour des Crédits | Crédits & attributions | button | button | button |  |
| retour des Crédits | Politique de confidentialité | link | link | link |  |
| retour des Crédits | Conditions d'utilisation | link | link | link |  |
| retour des Crédits | Exporter mes données | button | button | button |  |
| retour des Crédits | Mes items | switch | switch | switch |  |
| retour des Crédits | Les éditions | switch | switch | switch |  |
| retour des Crédits | Afficher mes visites | switch | switch | switch |  |
| retour des Crédits | Apparaître dans la recherche | switch | switch | switch |  |
| retour des Crédits | Retirer mon bento du fil | button | button | button |  |
| retour des Crédits | Supprimer mon compte | button | button | button |  |
| un aller-retour au profil | Retour | button | button | button |  |
| un aller-retour au profil | Crédits & attributions | button | button | button |  |
| un aller-retour au profil | Politique de confidentialité | link | link | link |  |
| un aller-retour au profil | Conditions d'utilisation | link | link | link |  |
| un aller-retour au profil | Exporter mes données | button | button | button |  |
| un aller-retour au profil | Mes items | switch | switch | switch | switch, « Apparaître dans la recherche » |
| un aller-retour au profil | Les éditions | switch | switch | switch |  |
| un aller-retour au profil | Afficher mes visites | switch | switch | switch | switch, « Mes items » |
| un aller-retour au profil | Apparaître dans la recherche | switch | switch | switch |  |
| un aller-retour au profil | Retirer mon bento du fil | button | button | button | switch, « Les éditions » |
| un aller-retour au profil | Supprimer mon compte | button | button | button |  |
| après « Modifier le profil » | Retour | button | button | button |  |
| après « Modifier le profil » | Crédits & attributions | button | button | button | button, « Popy content » |
| après « Modifier le profil » | Politique de confidentialité | link | link | link |  |
| après « Modifier le profil » | Conditions d'utilisation | link | link | link | button, « Popy intello » |
| après « Modifier le profil » | Exporter mes données | button | button | button |  |
| après « Modifier le profil » | Mes items | switch | switch | switch | button, « Popy diable » |
| après « Modifier le profil » | Les éditions | switch | switch | switch |  |
| après « Modifier le profil » | Afficher mes visites | switch | switch | switch | button, « Popy bisou » |
| après « Modifier le profil » | Apparaître dans la recherche | switch | switch | switch |  |
| après « Modifier le profil » | Retirer mon bento du fil | button | button | button | button, « Popy gêné » |
| après « Modifier le profil » | Supprimer mon compte | button | button | button |  |
| après « La table » | Retour | button | button | button |  |
| après « La table » | Crédits & attributions | button | button | button |  |
| après « La table » | Politique de confidentialité | link | link | link |  |
| après « La table » | Conditions d'utilisation | link | link | link |  |
| après « La table » | Exporter mes données | button | button | button |  |
| après « La table » | Mes items | switch | switch | switch |  |
| après « La table » | Les éditions | switch | switch | switch |  |
| après « La table » | Afficher mes visites | switch | switch | switch |  |
| après « La table » | Apparaître dans la recherche | switch | switch | switch |  |
| après « La table » | Retirer mon bento du fil | button | button | button |  |
| après « La table » | Supprimer mon compte | button | button | button |  |
| trois allers-retours | Retour | button | button | button |  |
| trois allers-retours | Crédits & attributions | button | button | button |  |
| trois allers-retours | Politique de confidentialité | link | link | link |  |
| trois allers-retours | Conditions d'utilisation | link | link | link |  |
| trois allers-retours | Exporter mes données | button | button | button |  |
| trois allers-retours | Mes items | switch | switch | switch | switch, « Apparaître dans la recherche » |
| trois allers-retours | Les éditions | switch | switch | switch |  |
| trois allers-retours | Afficher mes visites | switch | switch | switch | switch, « Mes items » |
| trois allers-retours | Apparaître dans la recherche | switch | switch | switch |  |
| trois allers-retours | Retirer mon bento du fil | button | button | button | switch, « Les éditions » |
| trois allers-retours | Supprimer mon compte | button | button | button |  |
| deux comptes bloqués | Retour | button | button | button |  |
| deux comptes bloqués | Crédits & attributions | button | button | button |  |
| deux comptes bloqués | Politique de confidentialité | link | link | link |  |
| deux comptes bloqués | Conditions d'utilisation | link | link | link |  |
| deux comptes bloqués | Exporter mes données | button | button | button |  |
| deux comptes bloqués | Mes items | switch | switch | switch |  |
| deux comptes bloqués | Les éditions | switch | switch | switch |  |
| deux comptes bloqués | Afficher mes visites | switch | switch | switch |  |
| deux comptes bloqués | Apparaître dans la recherche | switch | switch | switch |  |
| deux comptes bloqués | Débloquer @recette_nouveau | button | button | button |  |
| deux comptes bloqués | Débloquer @recette_se_bis | button | button | button |  |
| deux comptes bloqués | Retirer mon bento du fil | button | button | button |  |
| deux comptes bloqués | Supprimer mon compte | button | button | button |  |
| comptes bloqués, après détours | Retour | button | button | button |  |
| comptes bloqués, après détours | Crédits & attributions | button | button | button | button, « Popy content » |
| comptes bloqués, après détours | Politique de confidentialité | link | link | link |  |
| comptes bloqués, après détours | Conditions d'utilisation | link | link | link | button, « Popy intello » |
| comptes bloqués, après détours | Exporter mes données | button | button | button |  |
| comptes bloqués, après détours | Mes items | switch | switch | switch |  |
| comptes bloqués, après détours | Les éditions | switch | switch | switch | button, « Changer de pseudo » |
| comptes bloqués, après détours | Afficher mes visites | switch | switch | switch | button, « Popy bisou » |
| comptes bloqués, après détours | Apparaître dans la recherche | switch | switch | switch |  |
| comptes bloqués, après détours | Débloquer @recette_nouveau | button | button | button |  |
| comptes bloqués, après détours | Débloquer @recette_se_bis | button | button | button |  |
| comptes bloqués, après détours | Retirer mon bento du fil | button | button | button | button, « Popy diable » |
| comptes bloqués, après détours | Supprimer mon compte | button | button | button |  |

## 5. L'arbitrage et ce qui reste

**Arbitré le 24 octobre 2026** :

- **Ni harmonisation ni patch.** Rien à harmoniser sur 157 éléments, et un
  patch serait sans effet sur React Native précompilé.
- **La mesure corrigée** : un compagnon `idb` neuf avant chaque relevé d'arbre
  où le rôle compte, la sonde pour trancher entre l'app et l'outil,
  `RECETTE-MOBILE.md`, §4.
- **Les cartes d'épisode reprennent le rôle « lien »**, celui de la
  spécification du chantier 19 : le tap quitte l'app. Relu sur le code final :
  45 posts sur 45 justes, à la sonde comme à un compagnon `idb` neuf.

**La CI, rejouée en local**, les Actions du dépôt étant désactivées : lint et
typage 8 sur 8 ; tests 226 pour l'admin, 193 pour la landing, 779 pour l'app,
le rôle des cartes n'ayant aucun test qui le fige ; e2e 41 sur 41 ; build 3
sur 3. `accessibilite.test.ts` ne change pas : sa règle, un rôle déclaré sur
chaque élément tapable, reste la bonne.

**Sur Android**, relu le même jour à l'émulateur Pixel 8, sous Android 17,
dans un AVD à part, l'app branchée sur la même pile : React Native 0.86 n'y
recycle pas les vues (`enableViewRecycling` éteint), et donne à un lien la
classe `android.view.View` et le rôle « Lien », sa chaîne française. Lu dans
le journal de TalkBack, cf. `RECETTE-MOBILE.md`, « Lire ce que dit TalkBack,
sans l'entendre » : les 41 cartes annoncées « Link », l'émulateur étant en
anglais, chacune avec son indication, « S'ouvre dans YouTube. », « … Spotify. »,
« … Deezer. », « … Apple Podcasts. », « … sur bento-pop.com. » ; 22 bentos
« Button » ; aucun post à deux rôles. Un seul nœud par carte, tapable, sans
enfant dans l'arbre réduit aux nœuds qu'atteint TalkBack.

**Ce qui reste** :

- **La voix**, sur un vrai téléphone, au chantier 29.
- **Les états perdus au recyclage**, #57515, corrigé en 0.88.0 : le seul cas
  possible dans l'app est un bouton désactivé qui reprendrait la vue d'un
  élément désactivé d'un autre rôle, comme la ligne sans lien des Crédits.
  Jamais observé ; il part avec la montée de React Native.

## 6. Vu en passant, hors du sujet

- **Des mots de React Native lus en anglais.** La case des conditions se lit
  « checkbox, unchecked » ; « busy », « expanded » de même. React Native a ses
  chaînes françaises, mais l'app ne déclare que l'anglais
  (`CFBundleDevelopmentRegion`), sans localisation française : iOS lui sert
  donc l'anglais, même sur un téléphone en français.
- **Le pseudo en tête de la page d'un bento n'est pas un titre** : lu
  `AXStaticText`, quand celui du profil est un en-tête.
