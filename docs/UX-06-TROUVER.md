# Chantier 6 · Onglet « Trouver »

> Spécification écrite le 13 septembre 2026, à partir de mesures faites sur la
> production le jour même. Chantier 6 de
> [`MON-BENTO-POP-UX-ROADMAP.md`](./MON-BENTO-POP-UX-ROADMAP.md).
>
> Hérite du vocabulaire de [`UX-03-RECHERCHE-ITEM.md`](./UX-03-RECHERCHE-ITEM.md)
> (suggestions avant la frappe, tuiles, haptique) et de la couche de données de
> [`UX-02-FIL-LA-TABLE.md`](./UX-02-FIL-LA-TABLE.md) (client injecté, une seule
> requête, pagination par curseur).

---

## 1. Intention

L'onglet « Trouver » demande de connaître un pseudo pour s'en servir. C'est le
paradoxe de l'annuaire : le seul moyen de trouver quelqu'un est de savoir
d'avance qui l'on cherche. Ce chantier remplace cette question par une autre,
que tout le monde peut poser : **qui d'autre a mis ça dans sa boîte ?**

### 1.1 Le défaut de fond

Deux lignes de `search.tsx` portent tout le problème.

```ts
.ilike('pseudo', `${debounced}%`)   // ligne 47 : préfixe, et rien d'autre
.limit(12);                          // ligne 49 : aucun filtre sur la publication
```

La première enferme la recherche dans le préfixe du pseudo. La seconde produit
un **cul-de-sac** : on tape « Voir » et on tombe sur « Bento introuvable »
(`app/u/[pseudo].tsx:348`).

Ce n'est pas un cas limite. **46 des 72 comptes de la production, soit 64 %,
sont trouvables et ne mènent nulle part.** La majorité des résultats de la
recherche sont morts. C'est la même classe de défaut que le bouton « Voir mon
bento public » corrigé au chantier 5, à ceci près qu'ici il touche les deux
tiers de la population au lieu d'un utilisateur sur vingt-six.

### 1.2 La règle qui tient tout le chantier

**On ne propose que ce qui mène quelque part.**

Une phrase, trois conséquences, et elles couvrent l'intégralité du périmètre :

| Ce qu'on propose | Ce qui est écarté | Ce que ça supprime |
|---|---|---|
| les comptes ayant un bento publié | les 46 autres | 64 % de résultats morts |
| les items présents dans un bento publié | les 140 autres items du catalogue | 51 % de recherches à zéro résultat |
| en suggestion, les items présents dans **plusieurs** bentos | le reste | des raccourcis qui ramènent une seule personne |

---

## 2. Objectif et critères de succès

**Objectif.** Trouver quelqu'un sans connaître son pseudo, et ne jamais tomber
sur un écran vide après un tap.

| Critère | Mesure | Seuil |
|---|---|---|
| Aucun cul-de-sac | comptes proposés sans bento publié | **0** |
| Recherche sans zéro | items proposés absents de tout bento publié | **0** |
| Trouver sans savoir | `dark_hifus` trouvé en tapant `hifus` | oui |
| Trouver par le contenu | `inception` ramène les 2 bentos concernés | oui |
| Latence | RPC `search_bentos`, à chaud, p50 | **< 200 ms** |
| Egress | images téléchargées par une recherche | **0 octet** |

---

## 3. Périmètre

**Dans le périmètre**

- réécriture de `app/(tabs)/search.tsx` ;
- deux fonctions SQL : `search_bentos`, `shared_items` ;
- un module `src/lib/search.ts` testable ;
- l'état d'accueil de l'onglet, avant toute frappe.

**Hors périmètre, et pourquoi**

- **Les 46 comptes sans bento publié.** Ce chantier les cache, il ne les
  réveille pas. La relance relève du chantier 8, la publication au bon moment
  du chantier 9. Les cacher est déjà la bonne réponse ici : proposer un compte
  vide à un visiteur ne sert ni l'un ni l'autre.
- **La recherche dans le catalogue** (`search_items`, modale de composition).
  Elle marche, elle a son chantier, elle ne bouge pas.
- **Les liens profonds et les liens partagés** vers un bento dépublié. Ils
  continuent d'afficher « Bento introuvable », et c'est correct : quelqu'un
  s'est retiré volontairement, on ne réécrit pas l'histoire de son lien.
- **Les doublons du catalogue** (§12), qui dégradent la recherche mais se
  règlent en modération, pas en code.

### 3.1 Audit des autres culs-de-sac

La question posée était : en reste-t-il ailleurs. Les six navigations vers
`/u/[pseudo]` de l'app ont été relues une par une.

| Emplacement | Origine du pseudo | Verdict |
|---|---|---|
| `compose.tsx:82` | CTA « Voir mon bento public » | protégé au chantier 5 |
| `compose.tsx:99` | après une publication réussie | sûr par construction |
| `profile.tsx:166` | lien du profil | protégé au chantier 5 |
| `table.tsx:74` | ligne du fil | le fil ne contient que des bentos publiés |
| **`search.tsx:202`** | **résultat de recherche** | **le seul non protégé** |
| `share.ts:32` | URL partagée, pas une navigation | hors sujet |

**Un seul reste, et c'est celui de ce chantier.** L'audit est donc clos, pas
reporté.

---

## 4. Ce que dit la production

Mesuré le 13 septembre 2026 sur le projet mobile hébergé, en lecture seule.
Les scripts sont jetables, les chiffres sont ci-dessous.

### 4.1 La population

| | |
|---|---|
| comptes | **72**, tous avec un pseudo |
| bentos | 58, dont **26 publiés** |
| `bento_items` sur bentos publiés | 156 |
| items au catalogue | 329, dont 277 validés |

Les 26 bentos publiés sont **tous complets**, 6 cases sur 6. Il n'y a aucun
bento publié partiel à gérer dans l'affichage des résultats.

`display_name` est **nul pour les 72 comptes**. La deuxième ligne des
résultats de recherche est donc vide aujourd'hui pour tout le monde, ce qui
libère la place utilisée en §5.4. Le chantier 10 la remplira, et §5.4 dit ce
qui se passe ce jour-là.

### 4.2 Le cul-de-sac, chiffré

| | comptes | part |
|---|---|---|
| trouvables aujourd'hui | 72 | 100 % |
| menant à un bento réel | 26 | 36 % |
| menant à « Bento introuvable » | **46** | **64 %** |

### 4.3 La recherche par item est plus mince que la roadmap ne le supposait

La roadmap écrivait « qui a mis Interstellar dans sa case film ». Voici ce que
la donnée répond.

**137 items distincts** garnissent les 156 cases des bentos publiés. Leur
distribution :

| présent dans | nombre d'items |
|---|---|
| 1 bento | **126** |
| 2 bentos | 5 |
| 3 bentos | 4 |
| 4 bentos | 2 |

**Onze items sur 137, soit 8 %, sont dans plus d'un bento.** La réponse la plus
fréquente à « qui a mis X » est donc **une seule personne**, et le maximum
observé est quatre.

Par catégorie, la dispersion est presque totale :

| catégorie | cases | items distincts | partagés |
|---|---|---|---|
| film | 26 | 24 | 2 |
| series | 26 | 23 | 2 |
| artist | 26 | 23 | 2 |
| **track** | 26 | **26** | **0** |
| creator | 26 | 21 | 2 |
| place | 26 | 20 | 3 |

Les six items les plus partagés : Angers (4), Joyca (4), Hans Zimmer (3),
Paris (3), Breaking Bad (3), Joueur du Grenier (3).

**Ce que ça change à la conception, et ça la change beaucoup.** À ce volume,
la recherche par item n'est pas un outil d'affinité, « voici les douze
personnes qui partagent ton goût ». C'est un **moyen d'atteindre une personne
qu'on ne saurait pas nommer**. Un résultat unique est une réussite, pas un
échec, et l'écran ne doit surtout pas être conçu pour en afficher douze.

Le vrai échec serait le zéro résultat, et il guette :

> **140 des 277 items validés, soit 51 %, ne sont dans aucun bento publié.**

Autocompléter sur le catalogue enverrait donc une recherche sur deux dans le
vide. D'où la deuxième ligne du tableau du §1.2 : **la recherche par item
porte sur les 137 items réellement posés, pas sur les 277 du catalogue.**

### 4.4 Le préfixe rate des pseudos existants

19 % des pseudos (14 sur 72) contiennent un `_`. Leur partie signifiante est
souvent après.

| requête | en préfixe | en sous-chaîne |
|---|---|---|
| `hifus` | **0** | 1 (`dark_hifus`) |
| `an` | 0 | 7, dont 4 avec bento publié |
| `kere` | 2 | 2 |

`dark_hifus`, l'animateur du média, est **introuvable en tapant `hifus`**. Le
passage en sous-chaîne est donc un correctif, pas un confort.

Il a un prix : `_` et `%` sont des jokers `ilike`, et 14 pseudos plus 2 titres
d'items en contiennent. C'est déjà la raison d'être de `keepPrefixMatches`
(`src/lib/pseudo-match.ts:37`). §6.1 les échappe en SQL, à la source.

### 4.5 Le plancher de deux caractères

Nombre de correspondances en sous-chaîne, sur les 26 comptes vivants et les
137 items posés :

| requête | comptes | items |
|---|---|---|
| `a` | 15 | **94** |
| `e` | 10 | 94 |
| `an` | 4 | 30 |
| `in` | 1 | 24 |

Une lettre ramène les deux tiers du corpus, ce qui n'est pas une recherche.
**Plancher à deux caractères**, contre un seul aujourd'hui.

### 4.6 Sous-chaîne ou similarité : les deux

`search_items` filtre sur `similarity > 0.15` (pg_trgm). Comparaison des deux
stratégies sur des requêtes réalistes, mesurée :

| requête | `similarity` | `ilike %q%` |
|---|---|---|
| `seigneur` | 2 titres pertinents, **plus « seven » à 0,15** | les 2 titres, rien d'autre |
| `anneaux` | les 2 titres, à 0,33 et **0,20** | les 2 titres |
| `incepton` (faute) | **Inception, 0,58** | **rien** |
| `angers` | Angers 1,00, **plus Los Angeles 0,27 et Angoulême 0,21** | Angers |

Aucune des deux ne domine. La similarité seule laisse entrer du bruit à seuil
bas et **rate un titre long** : « Le Seigneur des anneaux : La Communauté de
l'anneau » ne score que 0,23 pour `seigneur`, parce que le trigramme se dilue
sur 51 caractères, or la médiane des titres est de 11 caractères et le maximum
de 51. La sous-chaîne seule rate les fautes de frappe.

**Décision : l'union des deux, avec un seuil de similarité relevé à 0,3.** La
sous-chaîne garantit les titres longs, la similarité rattrape les fautes, et
0,3 élimine « seven » et « Los Angeles ». Formalisé en §6.1.

### 4.7 Latences de référence

Requêtes équivalentes, exécutées sous session anonyme, donc RLS appliquée :

| requête | latence | lignes |
|---|---|---|
| `users` `ilike` pseudo, existant | 359 ms à froid, 49 ms à chaud | 4 |
| `users` + `inner join` bentos publiés | 168 ms | 2 |
| `bento_items` → `items` `ilike`, bentos publiés | **87 ms** | 2 |
| `rpc/search_items` | 70 ms | 1 |

La jointure qui porte tout le chantier coûte **87 ms**. Le budget de 200 ms du
§2 laisse donc de la marge, et la dérive se verra.

---

## 5. Design

### 5.1 Une seule barre, deux sections

Pas de sélecteur « chercher un pseudo / chercher un item ». Un sélecteur
demande à l'utilisateur de trancher avant de savoir, et se trompe dans les
deux sens : on tape « joyca » sans savoir si c'est un pseudo ou un créateur du
catalogue. C'est justement le cas réel, `Joyca` est un item présent dans
4 bentos.

**Une barre, une requête, deux sections dans les résultats.**

```
  ┌──────────────────────────────────────┐
  │ 🔍  pseudo, film, série, artiste…    │
  └──────────────────────────────────────┘

  COMPTES
  ┌──────────────────────────────────────┐
  │ 🍙  @dark_hifus              [VOIR]  │
  └──────────────────────────────────────┘

  DANS LES BENTOS
  ┌──────────────────────────────────────┐
  │ 🍙  @ralgan                  [VOIR]  │
  │     Film · Inception                 │
  └──────────────────────────────────────┘
  ┌──────────────────────────────────────┐
  │ 🍙  @keremasan               [VOIR]  │
  │     Film · Inception                 │
  └──────────────────────────────────────┘
```

Une section vide ne se rend pas, en-tête compris. Les en-têtes reprennent le
style du compteur actuel : Bungee 10, interlettrage 2, `rgba(10,10,10,0.55)`,
capitales.

**Le `@` disparaît de la barre.** Il est peint en dur à
`search.tsx:101-103` et annonce un pseudo, ce qui devient faux. Le `@` reste
dans les résultats, où il désigne bien un compte.

### 5.2 Avant la frappe : « on retrouve souvent »

L'écran d'accueil actuel affiche « Tape pour chercher » et rien d'autre. Avec
26 bentos publiés, une barre nue est inutilisable : personne ne devine quoi
taper.

À la place, les **items présents dans au moins deux bentos publiés**, en
puces tapables, avec leur nombre. Onze aujourd'hui, plafonnées à douze comme
les suggestions du chantier 3.

```
  ON RETROUVE SOUVENT
  ╭─────────────╮ ╭───────────╮ ╭──────────────────╮
  │ Angers · 4  │ │ Joyca · 4 │ │ Hans Zimmer · 3  │
  ╰─────────────╯ ╰───────────╯ ╰──────────────────╯
```

Ce sont exactement les onze recherches qui ramènent plus d'une personne
(§4.3). Le bloc n'est donc pas décoratif : c'est la porte d'entrée vers la
seule partie du corpus où la recherche par item est réellement sociale.

Un tap remplit la barre avec le titre et lance la recherche. Il ne saute pas
directement aux résultats : voir le texte apparaître dans le champ enseigne le
geste, et laisse la possibilité de le modifier.

**Pas d'images dans ce bloc.** 106 des 137 items posés en ont une, et douze
vignettes se téléchargeraient à **chaque** entrée dans l'onglet, alors que les
résultats ne s'affichent qu'après un geste délibéré. Des puces de texte, donc,
et un onglet qui ne coûte rien à ouvrir. C'est un écart assumé avec les
chantiers 2 et 3, qui affichent des images parce qu'elles y sont le contenu.

**Le titre d'une puce est plafonné à 28 caractères**, `cleanTitle` coupant à
la frontière de mot. Trouvé en recette : « Le Seigneur des anneaux : La
Communauté de l'anneau », 51 caractères, occupait une rangée entière et se
faisait rogner à l'endroit exact où il devenait informatif. Mesuré sur
iPhone 17 Pro, au-delà de 28 caractères la puce cesse d'être une puce.

Si `shared_items` renvoie moins de deux lignes, le bloc ne se rend pas et l'on
retombe sur « Tape pour chercher ». Additif, jamais bloquant.

### 5.3 Trois états, et le quatrième qui manquait

| État | Rendu |
|---|---|
| moins de 2 caractères | titre, barre, bloc « on retrouve souvent » |
| chargement | l'`ActivityIndicator` de la barre, résultats précédents conservés |
| résultats | les deux sections |
| **aucun résultat** | **nouveau, voir ci-dessous** |

L'écran actuel n'a pas d'état vide distinct : une `FlatList` sans données
affiche « 0 résultats » et du jaune. Le nouvel état vide dit ce qui a été
cherché et ce qu'on peut faire :

> **Rien pour « xyz ».**
> Essaie un titre de film, une série, un artiste, ou le pseudo de quelqu'un.

suivi du bloc « on retrouve souvent », qui redevient utile précisément là.

L'état d'erreur réseau existant (`search.tsx:131-167`, message plus bouton
« Réessayer ») est conservé tel quel.

### 5.4 La ligne de résultat : ce que la mesure permet

C'était la question ouverte de la roadmap. Trois options étaient sur la table.

**Le post plein format de « La table » : écarté.** Il mesure **614 pt** de
haut (`UX-02` §5.3). Deux résultats ne tiendraient pas sur un écran.

**`MiniBentoCard`, à récupérer dans l'historique : écarté.** Le composant
existe en `94fe5ca^`, 168 pt de large, aperçu en dégradés sans images. Il
était dessiné pour un carrousel horizontal, une forme que cet écran n'a pas.
Et son aperçu en dégradés ne dit rien : il ne montre pas l'item qui a
provoqué le résultat, donc il ne répond pas à la question posée.

**La ligne existante, augmentée : retenue.** `Row` (`search.tsx:198`) fait
déjà le travail. Une ligne de plus suffit : `Film · Inception`.

Et cette ligne est **gratuite**, au pixel :

```
avatar        44 pt
colonne texte 16 (@pseudo) + 3 + 15 (item) = 34 pt
hauteur ligne max(44, 34) + 10 + 10 = 64 pt, inchangée
```

La colonne de texte est plus courte que l'avatar. La mention de l'item se loge
dans la place déjà occupée par le vide. **La ligne de résultat ne grandit
pas.**

C'est aussi ce qui tranche entre le texte et une vignette de l'item. La
vignette coûterait une image par ligne, une deuxième image sur une ligne qui
en a déjà une, et 23 % des items posés n'en ont pas. Le texte coûte zéro pixel
et zéro octet. Et la réponse à « qui a mis Inception » est une personne, pas
une affiche que l'utilisateur vient précisément de nommer.

**Le jour où `display_name` sera rempli** (chantier 10), la colonne passe à
16 + 3 + 15 + 3 + 15 = 52 pt et la ligne à 72 pt. Prévu, acceptable, et à
vérifier ce jour-là : c'est noté en §12.

Le libellé de catégorie vient de `CATEGORY_META`, déjà partagé avec la grille.

### 5.5 Ce qu'on ne met pas

- **Pas de compteur « 4 personnes ont ça ».** Il ne serait vrai que pour onze
  items sur 137 et afficherait « 1 personne » le reste du temps, ce qui
  souligne la rareté au lieu de la valeur.
- **Pas de tri par affinité.** Il n'y a pas de signal pour le calculer, et le
  chantier 3 a déjà refusé d'en inventer un (`UX-03` §4.1).
- **Pas de pagination.** 20 résultats plafonnés, sur 26 bentos publiés.
  Réexamen au même seuil qu'ailleurs : 50 000 lignes dans `bento_items`.
- **Pas de recherche dans les sous-titres ni les années.** `subtitle` porte
  souvent l'année (« 2010 »), et la recherche deviendrait bruitée sans gain
  démontré.

### 5.6 Accessibilité

- La barre garde `autoCapitalize="none"` et `autoCorrect={false}`, et gagne
  `returnKeyType="search"` plus `accessibilityLabel="Chercher un pseudo ou un
  titre"`.
- Chaque ligne annonce sa raison :
  `Voir le bento de @ralgan, qui a Inception dans sa case film`. Pour une
  correspondance de pseudo, le libellé actuel est conservé.
- Les en-têtes de section portent `accessibilityRole="header"`.
- Les puces de suggestion :
  `Chercher Angers, présent dans 4 bentos`.
- **Tout texte de l'écran plafonne `maxFontSizeMultiplier` à 1,4**, comme
  `FeedPostHeader`. La recette a montré pourquoi : sans plafond, à la plus
  grande taille système, le titre se rognait en « TROUV » en débordant de
  l'écran, le champ chassait la loupe hors de la barre, et « Rien pour
  « xyz » » perdait la requête, c'est-à-dire la seule information que cet
  état apporte.
- **Les branches sans liste défilent.** À la plus grande taille système, le
  bloc de suggestions dépasse la hauteur de l'écran ; sans `ScrollView` il
  devenait inatteignable. La `SectionList` défile déjà.
- Cible tactile des puces : 44 pt de haut minimum, quitte à dépasser la
  hauteur du texte.

### 5.7 Retour tactile

`expo-haptics` est déjà là depuis le chantier 3. Un `selectionAsync()` au tap
sur une puce de suggestion, rien sur les lignes de résultat : elles mènent à
une navigation, qui a déjà son propre retour.

---

## 6. Contrat de données

### 6.1 `search_bentos`

Une seule fonction, un seul aller-retour, un seul point où vit la règle
« proposer uniquement ce qui mène quelque part ».

```sql
create or replace function public.search_bentos(q text, lim int default 20)
returns table (
  bento_id uuid,
  pseudo text,
  display_name text,
  is_featured boolean,
  match_kind text,
  item_id uuid,
  item_title text,
  category_id int,
  score real
)
language sql
stable
as $$
  with needle as (
    select
      btrim(q) as raw,
      '%' || replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  ),
  live as (
    -- Le coeur de la regle : seuls les bentos publies existent ici, donc
    -- aucune branche en aval ne peut produire un cul-de-sac.
    select b.id as bento_id, b.is_featured, u.pseudo, u.display_name
    from public.bentos b
    join public.users u on u.id = b.user_id
    where b.published_at is not null
  ),
  by_pseudo as (
    select
      l.bento_id, l.pseudo, l.display_name, l.is_featured,
      'pseudo'::text as match_kind,
      null::uuid as item_id, null::text as item_title, null::int as category_id,
      (case
         when lower(l.pseudo) = lower((select raw from needle)) then 3.0
         when lower(l.pseudo) like lower(replace((select pat from needle), '%', '')) || '%' escape '\' then 2.5
         else 2.0
       end)::real as score
    from live l
    where l.pseudo ilike (select pat from needle) escape '\'
  ),
  by_item as (
    select
      l.bento_id, l.pseudo, l.display_name, l.is_featured,
      'item'::text as match_kind,
      i.id as item_id, i.title as item_title, i.category_id,
      greatest(
        case when i.title ilike (select pat from needle) escape '\' then 1.0 else 0 end,
        similarity(i.title, (select raw from needle))
      )::real as score
    from live l
    join public.bento_items bi on bi.bento_id = l.bento_id
    join public.items i on i.id = bi.item_id
    where i.title ilike (select pat from needle) escape '\'
       or similarity(i.title, (select raw from needle)) > 0.3
  ),
  ranked as (
    select *,
      row_number() over (
        partition by bento_id
        order by (match_kind = 'pseudo') desc, score desc, item_title asc
      ) as rn
    from (select * from by_pseudo union all select * from by_item) u
  )
  select bento_id, pseudo, display_name, is_featured,
         match_kind, item_id, item_title, category_id, score
  from ranked
  where rn = 1
  order by (match_kind = 'pseudo') desc, score desc, pseudo asc
  limit lim;
$$;

grant execute on function public.search_bentos(text, int) to anon, authenticated;
```

Cinq points méritent d'être justifiés.

**`security invoker`, la valeur par défaut, est conservée**, comme
`popular_items`. La RLS s'applique, et la règle de visibilité reste écrite à
un seul endroit.

**`published_at is not null` est écrit explicitement** alors que la RLS le
couvre presque. Presque, parce que la policy dit
`published_at is not null or user_id = auth.uid()` : sans ce filtre, un
utilisateur retrouverait **son propre brouillon** dans ses résultats, et
taperait « Voir » pour arriver sur « Bento introuvable ». Le cul-de-sac
reviendrait par la porte de derrière, pour une personne au lieu de 46.

**Les jokers sont échappés à la source.** Le triple `replace` traite `\`, `%`
et `_` dans cet ordre, le `\` d'abord sans quoi il échapperait les échappements
suivants. C'est ce qui rend `keepPrefixMatches` inutile sur ce chemin : le
filtre client existait faute d'échappement SQL.

**Un bento apparaît une fois.** Le `row_number` déduplique : quelqu'un dont le
pseudo **et** un item correspondent sort en correspondance de pseudo, et
quelqu'un dont deux items correspondent sort une fois, sur le mieux scoré.
Sans ça, taper « an » afficherait la même personne trois fois.

**`lim` porte sur l'ensemble, pas par section.** À 26 bentos publiés, les
correspondances de pseudo ne peuvent pas saturer les 20 places. Le jour où
elles le pourraient, il faudra deux limites. Noté en §12.

### 6.2 `shared_items`

```sql
create or replace function public.shared_items(lim int default 12)
returns table (id uuid, title text, category_id int, picks int)
language sql
stable
as $$
  select i.id, i.title, i.category_id, count(*)::int as picks
  from public.bento_items bi
  join public.bentos b on b.id = bi.bento_id and b.published_at is not null
  join public.items i on i.id = bi.item_id
  group by i.id, i.title, i.category_id
  having count(*) >= 2
  order by count(*) desc, i.title asc
  limit lim;
$$;

grant execute on function public.shared_items(int) to anon, authenticated;
```

`image_url` n'est **pas** dans la signature : le bloc de suggestions
n'affiche pas d'images (§5.2), et l'exposer inviterait à en afficher plus tard
sans repasser par la décision.

Pourquoi pas `popular_items` : elle exige une `category_key` et classe le
catalogue entier, y compris les items que personne n'a posés. Les deux
questions sont différentes, et changer une signature déjà en production pour
les fusionner coûterait plus que dix lignes de SQL.

### 6.3 Pas d'index, et à partir de quand

`ilike '%q%'` et `similarity()` ne peuvent pas se servir d'un index btree.
Aujourd'hui : 72 lignes dans `users`, 277 dans `items`, 283 dans
`bento_items`. Le parcours séquentiel coûte 87 ms mesurés, et un index
coûterait plus en maintenance qu'il ne rapporterait.

**Seuil de réexamen : 5 000 items au catalogue.** À ce moment :

```sql
create index items_title_trgm on public.items using gin (title gin_trgm_ops);
create index users_pseudo_trgm on public.users using gin (pseudo gin_trgm_ops);
```

La signature des fonctions n'aura pas à changer.

### 6.4 `src/lib/search.ts`

Nouveau module, sur le patron de `feed.ts` et `suggestions.ts`.

```ts
export type SearchMatch = {
  bentoId: string;
  pseudo: string;
  displayName: string | null;
  isFeatured: boolean;
  /** L'item qui a provoqué le résultat, `null` si c'est le pseudo. */
  item: { id: string; title: string; category: CategoryKey } | null;
};

export type SearchResults = {
  accounts: SearchMatch[];
  viaItems: SearchMatch[];
};

export type SharedItem = { id: string; title: string; category: CategoryKey; picks: number };

/** Deux caractères, cf. §4.5. */
export const MIN_QUERY_LENGTH = 2;
export const SEARCH_LIMIT = 20;
export const SHARED_ITEMS_COUNT = 12;

export async function searchBentos(
  client: SupabaseClient<Database>,
  q: string,
  options?: { limit?: number },
): Promise<SearchRow[]>;

export async function loadSharedItems(
  client: SupabaseClient<Database>,
  limit?: number,
): Promise<SharedItem[]>;

/** Pur : découpe en sections et retire les pseudos bloqués. */
export function splitResults(
  rows: readonly SearchRow[],
  blocked: ReadonlySet<string>,
): SearchResults;

/** Pur : libellé lu par VoiceOver, cf. §5.6. */
export function matchAccessibilityLabel(match: SearchMatch): string;
```

**Le client est le premier paramètre, pas un import.** Même raison qu'au
chantier 2 : le singleton `@/supabase/client` tire `react-native-url-polyfill`,
AsyncStorage et `expo-constants`, ce qui rend tout module qui l'importe
inchargeable sous `node:test`.

**`splitResults` et `matchAccessibilityLabel` sont purs et séparés des appels
réseau.** C'est là que vivent le découpage en sections, le filtre des pseudos
bloqués et la traduction `category_id` → `CategoryKey`, donc c'est là que les
tests mordent.

Les fonctions d'appel **lèvent** en cas d'erreur plutôt que de renvoyer un
tableau vide : React Query décide, et l'écran distingue « aucun résultat » de
« panne », ce qu'un tableau vide rendrait impossible.

**Cache React Query.** `staleTime` 5 minutes sur `['search', q]`, comme
aujourd'hui. `['shared-items']` en `staleTime` 30 minutes et `gcTime` 1 heure,
comme les suggestions du chantier 3 : la liste bouge à la vitesse des
publications.

Le filtre des bloqués reste **côté client**, comme aujourd'hui : `useBlocked`
est un état local `AsyncStorage`, jamais envoyé au serveur, et ce chantier ne
change pas cette décision.

---

## 7. Performance et egress

**Ce que le chantier ajoute au réseau** : une requête RPC par recherche
débattue à 300 ms, et une requête au montage de l'onglet, mise en cache
30 minutes.

**Ce qu'il retire** : la requête `users` actuelle, et surtout les navigations
vers `/u/[pseudo]` qui n'aboutissaient pas. Chacune coûtait un aller-retour et
un écran perdu.

**Egress images : zéro octet.** Ni les résultats ni les suggestions ne portent
d'image (§5.2, §5.4). L'onglet « Trouver » devient le seul écran de l'app dont
l'ouverture ne télécharge aucune image. C'est délibéré, pas un oubli.

**Fluidité.** Au plus 20 lignes de 64 pt, sans image, sans dégradé. Il n'y a
rien à mesurer ici : les listes qui ont posé problème au chantier 2 rendaient
des grilles de six tuiles avec des images distantes.

---

## 8. Stratégie de test et QA

### 8.1 Tests unitaires, `node:test` + `tsx`

Dans `src/lib/search.test.ts`, sur `splitResults` et
`matchAccessibilityLabel`, purs par construction :

1. une correspondance de pseudo va dans `accounts`, pas dans `viaItems` ;
2. une correspondance d'item va dans `viaItems`, avec l'item renseigné ;
3. l'ordre renvoyé par le SQL est **préservé** dans chaque section ;
4. un pseudo bloqué est retiré des deux sections ;
5. le filtre des bloqués ignore la casse (`Dark_Hifus` bloqué via `dark_hifus`) ;
6. un `category_id` inconnu ne fait pas tomber la ligne : elle sort sans item,
   dans `accounts` (une catégorie désactivée ne doit pas effacer une personne) ;
7. entrée vide → deux sections vides, pas de `throw` ;
8. `match_kind` inattendu → la ligne est ignorée plutôt que mal classée ;
9. libellé VoiceOver avec item, sans item, et avec `display_name`.

### 8.2 Test d'intégration de l'appel, sur bouchon

Patron du chantier 2 : un vrai `supabase-js` pointé sur un serveur HTTP local,
pour exercer le constructeur d'URL réel et pas une imitation.

- `searchBentos` appelle bien `POST /rest/v1/rpc/search_bentos` ;
- le corps porte `q` **non tronqué et non transformé** : l'échappement est en
  SQL, un échappement client en plus doublerait les antislashs ;
- `limit` par défaut à 20 ;
- une réponse 500 lève ;
- `loadSharedItems` appelle `rpc/shared_items` avec `lim`.

### 8.3 Vérification contre la production

Une fois le lot 0 appliqué, script jetable, lecture seule, sous session
anonyme donc RLS active :

| Assertion | Attendu |
|---|---|
| `search_bentos('hifus')` | trouve `dark_hifus` |
| `search_bentos('inception')` | 2 lignes, `match_kind = 'item'` |
| `search_bentos('seigneur')` | les bentos portant les titres longs (§4.6) |
| `search_bentos('incepton')` | 2 lignes, rattrapées par la similarité |
| `search_bentos('angers')` | 4 lignes, et **ni Los Angeles ni Angoulême** |
| `search_bentos('%')` | **0 ligne**, le joker est échappé |
| `search_bentos('_')` | **seulement de vrais underscores**, voir ci-dessous |
| **tout pseudo renvoyé** | **a un bento publié**, vérifié ligne à ligne |
| tout `bento_id` renvoyé | apparaît **une seule fois** |
| `shared_items()` | 11 lignes, toutes à `picks >= 2` |
| latence à chaud | < 200 ms |

**L'attente sur `_` a été corrigée après coup.** Une première rédaction
attendait 0 ligne, par analogie avec `%`. C'est faux : `%` échappé ne
correspond à rien parce qu'aucun pseudo ni titre ne contient le caractère,
alors que 14 pseudos et 2 titres contiennent un vrai `_`. L'échappement
transforme le joker en littéral, il ne supprime pas les correspondances. La
bonne assertion est donc « strictement moins que le corpus, et toutes les
lignes contiennent réellement un `_` ». Vérifiée : 4 lignes.

Le compte anonyme créé par la sonde est supprimé, profil puis auth.

### 8.4 Recette manuelle, bloquante

Sur simulateur, sur les données de production.

1. Onglet « Trouver » à l'ouverture : le bloc « on retrouve souvent » affiche
   11 puces avec leur nombre. Aucune image ne se charge.
2. Taper une lettre : rien ne part, le bloc reste.
3. Taper `hi` : les résultats arrivent.
4. Taper `hifus` : `@dark_hifus` sort dans « Comptes ».
5. **Taper le pseudo d'un des 46 comptes sans bento publié : zéro résultat.**
   Le nom d'un compte de test est relevé avant la recette.
6. Taper `inception` : deux lignes sous « Dans les bentos », chacune portant
   `Film · Inception`.
7. Taper les deux : une requête qui remonte les deux sections, en-têtes
   visibles, sections dans l'ordre.
8. Taper `zzzz` : l'état vide, avec la requête citée et le bloc de
   suggestions.
9. Tap sur une puce : la barre se remplit, la recherche part, l'haptique se
   déclenche (sur appareil, pas sur simulateur).
10. Tap sur une ligne : le bento s'ouvre. **Aucun « Bento introuvable ».**
11. Bloquer quelqu'un depuis sa page, revenir, refaire la recherche : il a
    disparu des deux sections.
12. Mode avion : le message d'erreur et le bouton « Réessayer ».
13. VoiceOver : les en-têtes sont annoncés comme en-têtes, une ligne d'item
    annonce sa raison.
14. Taille de police système au maximum : les puces et les lignes tiennent.
15. Pseudo de 17 caractères, le plus long en production : pas de débordement.
16. Titre de 51 caractères (« Le Seigneur des anneaux… ») : la deuxième ligne
    est tronquée proprement, sur une ligne.

### 8.4 bis Ce que la recette a trouvé

Passée le 13 septembre 2026 sur simulateur iPhone 17 Pro, sur les données de
production, avec un compte de recette `recettesix` créé puis supprimé, profil
puis auth.

**Ce qui a marché du premier coup** : les deux sections et leur ordre, la
mention de la raison, la ligne restée à 64 pt mesurée à l'écran, le plancher
à deux caractères, le tap sur une puce, le tap sur une ligne, l'état vide,
l'état d'erreur, le filtre des bloqués, et les libellés VoiceOver.

**Trois défauts trouvés et corrigés dans la foulée.**

| Trouvé | Corrigé par |
|---|---|
| « Le Seigneur des anneaux : La Communauté de l'anneau » occupait une rangée entière de puces | plafond de 28 caractères, §5.2 |
| à la plus grande taille système, le titre se rognait en « TROUV », la requête disparaissait de l'état vide, le champ chassait la loupe | `maxFontSizeMultiplier` à 1,4 partout, §5.6 |
| à la plus grande taille système, le bloc de suggestions dépassait l'écran sans pouvoir défiler | `ScrollView` sur les branches sans liste, §5.6 |

**La démonstration du défaut de fond**, faite sur la production. Taper
« bento » correspond à **20 pseudos**, dont **19 sans bento publié**. L'écran
en affiche **un**. Et taper `recettesix`, le compte de recette qui n'avait
rien publié, ne renvoie rien : on ne se propose pas soi-même tant qu'on n'a
rien à montrer.

**Le blocage tient sa promesse.** La boîte de dialogue dit « Tu ne verras
plus son bento dans La table ni dans la recherche ». Après avoir bloqué
`@ralgan` depuis sa page, la recherche « inception » passe de deux lignes à
une, **sans nouvelle requête** : seul `blocked` a changé, le cache React
Query est intact.

**VoiceOver**, relevé dans l'arbre d'accessibilité (`idb ui describe-all`) :

```
[TextField ] Chercher un pseudo ou un titre
[Heading   ] DANS LES BENTOS
[Button    ] Voir le bento de @dark_hifus, qui a Le Seigneur des anneaux :
             La Communauté de l'anneau dans sa case film
```

Le titre est lu **en entier** alors qu'il est visuellement tronqué, ce qui est
le comportement voulu.

**Latences relevées** par `check-search-bentos.mjs` sur 37 requêtes :
p50 **48 ms**, p95 **107 ms**, pour un budget de 200. Premier appel à froid,
non compté : environ 400 ms, dont l'établissement TLS et le démarrage du
pooler.

**Un défaut trouvé en relecture, après la recette, et corrigé.** Le tap sur
une puce remplissait la barre avec le titre brut alors que la puce affiche
`cleanTitle` : on aurait touché « mia paper planes » et vu apparaître « mia
paper planes (larsht_ edit) ». Et surtout le piège inverse, qu'il fallait
éviter en corrigeant : la forme affichée est **tronquée** avec une ellipsis,
et `ilike '%…%'` ne correspond à rien, donc une puce n'aurait pas trouvé
l'item qu'elle annonce. `sharedItemQuery` rend la forme nettoyée entière.
Aucun des titres actuellement suggérés ne change de forme, vérifié contre la
production, donc ce que la recette a observé reste vrai.

**Le corpus bouge pendant qu'on l'observe.** Entre la mesure du §4 et la fin
de la recette, deux comptes se sont créés et le classement de `shared_items`
a changé : « imagine dragons », « jojo's bizarre adventure » et « Kickstart
My Heart » sont entrés, « Orelsan » et le titre long sont sortis du top 12.
Les chiffres du §4 sont donc un instantané, ce que leur date dit déjà. Les
invariants vérifiés, eux, sont structurels et ne dépendent pas des valeurs.

**Deux défauts trouvés et NON corrigés**, parce qu'ils débordent du chantier.
Ils sont en §12.

### 8.5 Ce qui n'est pas testé, assumé

- Le classement par pertinence. Il n'a pas de vérité de terrain à ce volume, et
  les assertions du §8.3 vérifient la présence, pas l'ordre entre deux items
  également valables.
- Le rendu Android. La ligne n'utilise aucune ombre native ni superposition,
  les deux pièges connus du produit.

---

## 9. Plan de développement

Un lot, une validation.

### Lot 0 · Les deux fonctions SQL

`apps/mobile/supabase/migrations/2026…_search_bentos.sql` : `search_bentos`,
`shared_items`, les `grant`. Appliquée en production, puis §8.3 exécuté et
ses résultats collés dans cette spéc.

Rien ne bouge dans l'app à ce lot : les fonctions sont inertes tant que
personne ne les appelle.

### Lot 1 · `src/lib/search.ts`

Le module et `search.test.ts` (§8.1), plus le test sur bouchon (§8.2). Aucun
écran ne change. Types Supabase régénérés pour les deux RPC.

### Lot 2 · Les deux sections, et la fin du cul-de-sac

Réécriture de `search.tsx` sur `searchBentos` : la barre sans `@`, le plancher
à deux caractères, les deux sections, la ligne augmentée.

**C'est le lot qui ferme le défaut**, et il vaut à lui seul le chantier :
après lui, plus aucun résultat de recherche ne mène à « Bento introuvable ».

`keepPrefixMatches` et son test sont supprimés ; `pickExactPseudo`, utilisé par
`pseudo.ts` pour les liens profonds, reste.

### Lot 3 · L'accueil et l'état vide

Le bloc « on retrouve souvent », l'état vide nommant la requête, l'haptique sur
les puces.

### Lot 4 · Recette et mesures

§8.4 en entier, les latences relevées, les captures partagées, la spéc mise à
jour avec ce que la recette a trouvé.

---

## 10. Definition of Done

Renseignée le 13 septembre 2026. **12 critères sur 12.**

| # | Critère | Vérifié par | État |
|---|---|---|---|
| 1 | Aucun résultat de recherche ne mène à « Bento introuvable » | 57 lignes sur 37 requêtes, contrôlées ligne à ligne contre la vérité de terrain, plus la recette | ✅ |
| 2 | `dark_hifus` se trouve en tapant `hifus` | §8.3 et §8.4 bis | ✅ |
| 3 | `inception` ramène les 2 bentos, avec leur case | recette, capture | ✅ |
| 4 | Aucun item proposé n'est absent des bentos publiés | `having count(*) >= 2`, plus le contrôle « chaque suggestion ramène au moins deux résultats » | ✅ |
| 5 | Un bento n'apparaît jamais deux fois | §8.3, sur les 37 requêtes | ✅ |
| 6 | Les jokers `_` et `%` ne cassent rien | §8.3, avec l'attente corrigée | ✅ |
| 7 | La ligne de résultat n'a pas grandi | mesurée à l'écran : 64 pt, avec et sans mention d'item | ✅ |
| 8 | Zéro image téléchargée par une recherche | ni les puces ni les lignes n'en portent, vérifié à l'écran | ✅ |
| 9 | RPC sous 200 ms à chaud | p50 48 ms, p95 107 ms | ✅ |
| 10 | Tests unitaires et bouchon verts, suite complète verte | 37 nouveaux tests, 212 au total | ✅ |
| 11 | Les pseudos bloqués sont filtrés dans les deux sections | tests 4 et 5, plus la recette sur `@ralgan` | ✅ |
| 12 | VoiceOver annonce la raison d'un résultat | arbre d'accessibilité relevé, §8.4 bis | ✅ |

**Ce qui reste, et qui n'appartient pas à ce chantier** : la recette sur
appareil réel, qui accumule déjà cinq chantiers, et où seule l'haptique des
puces est propre à celui-ci. Le simulateur ne restitue pas l'haptique.

## 11. Décisions tranchées

| Question | Décision | Raison |
|---|---|---|
| Sélecteur pseudo / item ? | **non**, une barre | on ne sait pas d'avance ce qu'on tape, `Joyca` est les deux |
| Résultats mélangés ou en sections ? | **deux sections** | l'ordre est stable et lisible sans lire chaque ligne |
| Forme du résultat ? | **la ligne existante, augmentée** | le post fait 614 pt, `MiniBentoCard` ne montre pas la raison |
| Vignette de l'item ? | **non, du texte** | zéro pixel, zéro octet, et 23 % des items n'ont pas d'image |
| Récupérer `MiniBentoCard` ? | **non** | dessiné pour un carrousel, muet sur la raison du résultat |
| Sous-chaîne ou similarité ? | **les deux**, seuil 0,3 | mesuré en §4.6, aucune ne domine |
| Préfixe ou sous-chaîne sur le pseudo ? | **sous-chaîne** | `hifus` ne trouvait pas `dark_hifus` |
| Une RPC ou deux requêtes ? | **une RPC** | un aller-retour, une déduplication, un ordre |
| Chercher dans le catalogue entier ? | **non**, dans les items posés | 51 % du catalogue ramènerait zéro |
| Compteur « n personnes » ? | **non** | vrai pour 11 items sur 137 |
| Index trigramme ? | **pas maintenant** | 87 ms mesurés, seuil posé à 5 000 items |
| Plancher de la requête ? | **2 caractères** | une lettre ramène 94 items sur 137 |

---

## 12. Suivis générés par ce chantier

**Bloquer quelqu'un est une porte à sens unique.** Trouvé en recette. La
boîte de dialogue promet « Tu peux annuler à tout moment depuis ce menu », or
le menu vit sur `/u/[pseudo]`, page que le fil filtrait déjà et que la
recherche filtre désormais aussi. Il n'existe **aucune liste des comptes
bloqués** dans l'app : une fois bloqué, quelqu'un devient injoignable, donc
indéblocable. Le défaut préexiste à ce chantier, `search.tsx` filtrait déjà
les bloqués, mais il ferme la dernière porte et rend la promesse fausse. Le
correctif est une ligne « Comptes bloqués » dans le profil, avec la liste et
un bouton par ligne. C'est du ressort du chantier 11, et ça n'a pas été fait
ici : c'est le blocage qui est en cause, pas la recherche.

**Le texte ne plafonne son grossissement nulle part ailleurs.** À la plus
grande taille de police système, l'écran « Trouver » cassait ; il a été
corrigé. Mais **20 usages d'`Extenda` dans l'app n'ont pas de plafond**, plus
`TopChip`, dont le libellé déborde de l'écran par la droite au même réglage.
Un seul écran a été traité, celui qu'on livre : on ne laisse pas un titre
rogné sur l'écran qu'on livre, et on n'entreprend pas la reprise des 20
autres au milieu d'un chantier de recherche. Chantier 11.

**Les doublons du catalogue dégradent la recherche.** Trois titres existent en
double parmi les items validés : « arcane » (creator et series), « joueur du
grenier » (artist et creator), « lesadpanda » (artist et creator). Et deux
variantes coexistent pour un même film : « le seigneur des anneaux » et « Le
Seigneur des anneaux : La Communauté de l'anneau ». **Observé en recette** :
taper « seigneur » affiche trois lignes, dont deux portent le titre long et
une le titre court, pour le même film. `admin_merge_items` existe depuis la migration du 30 mai, c'est un geste
de modération, pas de code. À faire passer dans le back-office.

**Les 46 comptes sans bento publié restent 46.** Ce chantier les cache. Les
faire publier est le sujet des chantiers 8 et 9, et la mesure du chantier 5 y
ajoute que 15 de ces bentos sont complets et non bloqués, en attente depuis
26 jours en médiane.

**Deux limites au lieu d'une**, le jour où les correspondances de pseudo
pourront saturer les 20 places (§6.1).

**L'index trigramme** à 5 000 items au catalogue (§6.3).

**La hauteur de la ligne quand `display_name` sera rempli** par le chantier 10 :
64 pt deviennent 72 pt, à revérifier au point (§5.4).

**`track` n'a aucun item partagé** sur 26 cases. La musique est la catégorie la
plus dispersée du produit, et le chantier 3 avait déjà relevé qu'elle a la plus
mauvaise couverture d'images, 10 sur 26. Deux signaux qui pointent le même
endroit, à regarder ensemble un jour.
