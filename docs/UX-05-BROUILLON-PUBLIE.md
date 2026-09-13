# Chantier 5 · Brouillon, publié, dépublication

> Spécification écrite le 13 septembre 2026, à partir d'un audit du code et
> d'une **mesure sur les données de production**. Le chantier tel qu'il était
> cadré dans la roadmap posait une question d'architecture ; la mesure la
> tranche en trois lignes, et fait apparaître un problème plus grave que
> celui qu'on cherchait.

---

## 1. Ce que disent les données

Relevé le 13 septembre 2026 sur le Supabase mobile.

| | |
|---|---|
| Bentos existants | 58 |
| Publiés | 26 |
| **Non publiés** | **32** |
| dont complets 6/6, rien ne les bloque | **15** |
| dont partiels, 1 à 5 cases | **16** |
| dont vides | 1 |

Et, sur les 26 publiés :

| | |
|---|---|
| Modifiés après publication | **1**, soit 4 % |
| Cases changées après publication, toutes personnes confondues | **1** |
| Délai de cette modification | **108 jours** après la publication |

Deux conclusions, et elles ne vont pas dans la direction prévue.

### 1.1 L'arbitrage A contre B est tranché par l'usage

La roadmap posait deux options : **A**, assumer que l'édition est en direct et
le dire clairement ; **B**, un vrai brouillon local jusqu'au tap sur Publier.

L'option B est une réécriture du chemin d'écriture des cases, du store, de la
reprise après fermeture de l'app, et de la résolution de conflit entre le
local et le distant. C'est le poste le plus coûteux du chantier.

Elle servirait **une personne sur vingt-six**, dont la modification est
arrivée **trois mois et demi** après la publication. À ce délai, ce n'est pas
quelqu'un qui croit corriger un brouillon, c'est quelqu'un qui revient
délibérément changer d'avis. Cette personne n'a pas besoin d'un modèle
brouillon, elle a besoin de savoir que son changement est déjà en ligne.

**On prend A.** Le coût de B n'est pas justifié par un seul cas, et il retarde
ce qui compte vraiment.

### 1.2 Le vrai problème est la publication, pas l'édition

**31 bentos sur 58 sont finis ou presque et ne sont pas publiés.** Le fil « La
table » pourrait plus que doubler sans qu'une seule personne compose quoi que
ce soit de neuf.

Les 15 complets ne sont bloqués par rien : leur bouton dit « Publier mon
bento », il fonctionne, ils ne l'ont pas touché. La dernière case a été
remplie il y a **26 jours en médiane**. Ces gens ont fait tout le travail et
sont partis à la dernière marche.

Les 16 partiels, eux, ont une explication mécanique, et elle est dans le code.

---

## 2. Lot 0 : le bouton principal du composer ne fait rien

C'est un bug, il est dans le fichier que ce chantier doit ouvrir de toute
façon, et il touche la moitié de la population qu'on cherche à récupérer.

`app/(tabs)/compose.tsx` :

```ts
const onPrimary = () => {
  if (filled === 0) {
    router.push({ pathname: '/search-modal', params: { category: 'film' } });
    return;
  }
  void onPublish();
};

const onPublish = async () => {
  if (!userId || !allFilled) return;   // ← sortie silencieuse
  …
};
```

Et le libellé :

```tsx
: `Compléter (${6 - filled} restant${6 - filled > 1 ? 's' : ''})`
```

Donc pour quiconque a **entre 1 et 5 cases** remplies, le bouton le plus gros
de l'écran affiche « Compléter (3 restants) », **n'est pas grisé**, et
**ne fait strictement rien** quand on le touche. Pas de navigation, pas de
message, pas de retour haptique, rien.

Le cas vide a été traité (il ouvre la première case) et le cas plein aussi.
C'est le milieu qui est tombé, et le milieu, c'est 16 bentos.

**Correction.** « Compléter » doit compléter : ouvrir la **première case
vide** dans l'ordre de lecture de la boîte, exactement comme le cas vide
ouvre `film`. Une seule règle pour les trois états, au lieu de deux cas
particuliers et d'un trou.

Ça ne prouve pas que ces 16 personnes reviendront. Ça prouve que quand elles
ont essayé de continuer, l'app ne leur a pas répondu.

---

## 3. Lot A : savoir si c'est public

### 3.1 Le client ne le sait pas

`loadOwnBento` sélectionne bien `published_at`
(`src/lib/bento-actions.ts:121`), et le store `state/bento.ts` ne le garde
pas : il ne contient que `slots`. **Rien dans l'app ne sait si le bento est
en ligne.**

C'est la cause directe de tout le reste. Le CTA dit « Publier mon bento » pour
l'éternité, y compris trois mois après la publication. `publishBento` a dû
être rendue idempotente (`.is('published_at', null)`) précisément pour
survivre à ces taps répétés, et le commentaire qui l'accompagne le dit sans
détour : le fil se serait retrouvé trié sur les derniers taps de bouton.

L'idempotence est le bon correctif défensif. Elle n'excuse pas que l'app
ignore son propre état.

### 3.2 Ce qu'on ajoute

`published_at` remonte jusqu'au store, et trois choses en découlent.

**Le CTA change de nature une fois publié.** « Publier mon bento » devient
« Voir mon bento public », qui pousse vers `/u/[pseudo]`. C'est déjà ce que
fait `onPublish` après succès, donc la destination existe.

**Une mention discrète sous la boîte** quand le bento est publié : les
modifications sont visibles tout de suite. Pas une modale, pas un bandeau
qui recouvre, une ligne de texte. C'est l'option A assumée : on ne cache pas
le comportement, on le nomme.

**La date de publication est affichée** quelque part sur le profil. Elle
existe déjà en base, personne ne la voit, et c'est elle qui donne à quelqu'un
la certitude que son bento est bien parti.

### 3.3 Ce qu'on n'ajoute pas

Pas de bouton « Enregistrer ». Pas d'état intermédiaire. Pas de diff entre le
local et le distant. C'est exactement ce qu'on vient d'écarter, et le
réintroduire par la bande annulerait la décision.

---

## 4. Lot B : dépublier

Aujourd'hui, la seule façon de retirer son bento du fil est de **supprimer son
compte**. C'est disproportionné, et c'est le genre de chose qui se remarque
quand quelqu'un veut juste souffler.

### 4.1 Aucune migration nécessaire

La politique `bentos_update_own` de la migration initiale :

```sql
create policy "bentos_update_own"
  on public.bentos
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

Elle autorise déjà le propriétaire à écrire `published_at = null`. Et
`bentos_read_published` rend le bento invisible aux autres dès que
`published_at` est nul, tout en le laissant visible à son auteur. La
dépublication est donc un `update` d'une colonne, sans SQL nouveau.

### 4.2 La forme

Dans le profil, à côté de l'export de données et de la suppression de compte,
mais **visuellement séparée de la suppression**. Ce sont deux gestes de nature
opposée : l'un est réversible d'un tap, l'autre est définitif. Les poser côte
à côte dans le même style, c'est fabriquer l'erreur.

Confirmation légère, une seule phrase : le bento sort du fil et de sa page
publique, les cases restent, on peut republier quand on veut. Pas de
`Alert.alert` alarmiste.

Et une conséquence à ne pas rater : après dépublication, le CTA du composer
redevient « Publier mon bento ». Le lot A rend ça automatique, puisque tout
découle de `published_at`.

### 4.3 Ce que la dépublication ne fait pas

Elle ne vide pas les cases. Elle ne touche pas `is_featured`. Elle ne prévient
personne. Un bento dépublié puis republié **garde sa date d'origine** si l'on
ne fait rien, ce qui le remettrait à sa place historique dans le fil plutôt
qu'en tête. À trancher en implémentation : je penche pour **reposer la date à
la republication**, parce qu'un bento qui revient est une nouveauté pour ceux
qui ne l'avaient pas vu, et parce que sinon il rentre invisible.

Attention, ce point entre en tension directe avec l'idempotence de
`publishBento`, écrite pour empêcher exactement ce comportement. Il faudra
distinguer **republier après dépublication** (repose la date) de **retaper le
bouton sur un bento déjà en ligne** (ne touche à rien). Le lot A rend cette
distinction possible, puisqu'à partir de là le bouton ne dit plus « Publier »
quand le bento est déjà public.

---

## 5. Lot C : `is_featured` est écrit par l'utilisateur

Trouvé en lisant la politique ci-dessus, et ça n'a rien à voir avec la
publication, sinon que c'est la même table et le même chantier.

`bentos_update_own` autorise le propriétaire à modifier **n'importe quelle
colonne** de sa ligne. Aucun `grant update (colonnes)` n'existe dans les
migrations, donc la restriction n'est pas non plus au niveau des privilèges.

Or `bentos` porte `is_featured` et `featured_order`, qui sont le signal
**éditorial** géré par le back-office du chantier 14 et qui pilotent la mise
en avant dans l'app. N'importe qui sachant appeler PostgREST avec sa propre
session peut donc se mettre en avant.

Ce n'est pas une fuite de données et personne ne l'a fait. C'est une garantie
éditoriale qui n'en est pas une, sur un produit dont l'argument est justement
que des créateurs identifiés y composent leur bento.

**Correction**, une migration courte :

```sql
revoke update on public.bentos from authenticated;
grant update (published_at) on public.bentos to authenticated;
```

À vérifier avant d'appliquer : que l'app n'écrit bien que `published_at` sur
cette table. `publishBento` et la dépublication du lot B sont les deux seuls
appelants ; `updated_at` doit être posé par un trigger et non par le client,
sans quoi il faut l'ajouter au `grant`. **Ce contrôle conditionne la
migration**, et une erreur ici casse la publication pour tout le monde.

---

## 6. Ce que ce chantier ne fait pas, et qui compte plus

Les **15 bentos complets, non bloqués, non publiés depuis 26 jours** ne
s'expliquent par aucun bug. Le bouton marche. Ils ne l'ont pas touché.

Ce chantier leur enlève une ambiguïté, il ne va pas les chercher. Les
hypothèses plausibles sont ailleurs :

- ils ne savent pas que « publier » est ce qui manque, l'écran ne dit nulle
  part ce que ça change ;
- ils n'ont pas envie d'être vus, et personne ne leur a dit à qui ;
- ils ne sont jamais revenus dans l'app après avoir rempli la dernière case,
  et rien ne les y a ramenés.

Ça relève d'une relance, d'une notification, ou d'une explication à l'endroit
où l'on remplit la dernière case. C'est un sujet à part entière, plus proche
du chantier 8 que de celui-ci, et je le signale pour qu'il ne se perde pas
derrière une roadmap qui semble déjà le couvrir.

---

## 7. Plan de développement

| Lot | Quoi | Coût | Dépend de |
|---|---|---|---|
| 0 | « Compléter » ouvre la première case vide | S | rien |
| A | `published_at` dans le store, CTA et mention | S | rien |
| B | Dépublier, depuis le profil | S | A |
| C | Migration des privilèges de colonne sur `bentos` | S | vérification préalable |

Chaque lot est livrable seul. Le lot 0 corrige un bug avéré et pourrait
partir dès la prochaine mise à jour à distance : il ne touche à aucun module
natif, donc il n'a pas besoin d'une build.

---

## 8. Recette

### 8.1 Faite au simulateur, le 13 septembre 2026

iPhone 17 Pro, build de développement sur le Supabase de production, compte
`recettecina` supprimé après, profil puis auth.

| Cas | Attendu | Résultat |
|---|---|---|
| 0 case, tap sur le CTA | ouvre `film` | ouvre `film` |
| 1 case, tap sur « Compléter (5 restants) » | ouvre `série` | ouvre `série`, **le bug est fermé** |
| trou au milieu | ouvre le trou | couvert par test unitaire |
| 6 cases, jamais publié | « Publier mon bento » | publie |
| 6 cases, publié | « Voir mon bento public » | navigue |
| Bento publié | mention « en ligne » à la place de « 6 / 6 » | affichée sur une ligne |
| Profil, publié | date de publication | « En ligne · publié à l'instant » |
| Retirer du fil | disparaît, cases intactes | disparaît, 6 cases conservées |
| Après retrait | le CTA redevient « Publier mon bento » | oui, et « 6 / 6 » revient |
| Republier | date fraîche, en tête du fil | 19 h 50 → 19 h 55, en tête |
| Faille `is_featured` | reproductible avant migration | **confirmée**, cf. 8.3 |

**Le budget vertical est intact.** La ligne « en ligne » remplace la barre de
progression au lieu de s'ajouter, précisément pour ne pas rétrécir la boîte.
Mesuré sur les deux captures : bas de boîte à 2180 px et haut du bouton à
2325 px, **identique au pixel** dans les deux états. C'est le calcul qui
s'était trompé au chantier 3 et il ne fallait pas y retoucher à l'aveugle.

### 8.2 Deux défauts trouvés en recette, pas prévus par cette spéc

**« Voir mon bento public » menait à un cul-de-sac.** Une fois le bento
retiré, le bouton restait affiché sur le profil et ouvrait « Bento
introuvable ». L'app proposait elle-même une impasse, juste après un geste
volontaire. Il n'apparaît plus que si le bento est en ligne, et
« Éditer mon bento » devient « Reprendre mon bento » en rouge, action unique.

**Le fil ne se rafraîchissait pas.** `staleTime` d'une minute, `gcTime` de
trente : après un retrait, la base disait `published_at: null` pendant que
« La table » affichait toujours le bento. Du point de vue de la personne qui
vient de se retirer, le geste n'a pas marché. `publishBento` et
`unpublishBento` invalident désormais la requête `['feed']`. Le défaut
existait déjà à la publication, il n'avait simplement jamais été vu.

### 8.3 La faille `is_featured`, mesurée et non déduite

Sonde exécutée sur la production le 13 septembre : création d'une session
anonyme avec la clé publique, exactement comme l'app, création d'un profil et
d'un bento par l'utilisateur lui-même, puis

```
PATCH /rest/v1/bentos?id=eq.<id>   {"is_featured": true, "featured_order": 1}
```

Réponse **200**, et l'état en base confirme `is_featured: true`. Compte de
sonde supprimé dans la foulée, aucun résidu (3 bentos en avant, les mêmes
qu'avant).

**La migration `20260913200000_bentos_column_privileges.sql` n'est pas encore
appliquée.** Elle doit l'être sur le Supabase mobile, et la sonde rejouée
après pour vérifier que le `PATCH` échoue et que publier et dépublier marchent
toujours.

## 9. Définition de terminé

- [x] Le bouton principal du composer fait quelque chose dans les trois états
- [x] L'app sait si le bento est publié, et le dit
- [x] On peut se retirer du fil sans supprimer son compte
- [x] Republier après dépublication remonte en tête. Retaper sur un bento déjà
      en ligne n'est plus possible, le CTA a changé de nature, et le filtre
      `.is('published_at', null)` reste en place par sécurité
- [x] Le fil reflète immédiatement une publication ou un retrait
- [x] Le budget vertical du composer est inchangé, mesuré au pixel
- [x] 179 tests, lint et typecheck verts
- [x] Recette faite, données de production rendues telles quelles
- [ ] **Migration des privilèges de colonne appliquée**, et sonde rejouée
- [ ] Livraison : le lot 0 part par mise à jour à distance, le reste attend
      une build
