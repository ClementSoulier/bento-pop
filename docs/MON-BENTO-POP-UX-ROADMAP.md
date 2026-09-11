# Mon Bento Pop · Roadmap UX

> **Statut : à attaquer.** Rédigé le 11 septembre 2026 à partir d'un audit du code de `apps/mobile` (routes, composants bento, state, libs) et de `apps/landing`.
>
> Chaque chantier se traite **un par un**, avec une étape de planification dédiée avant implémentation. Cocher au fur et à mesure et noter la PR en face.

**Légende effort** : S = moins d'une journée · M = 1 à 3 jours · L = plus de 3 jours ou arbitrage produit nécessaire.
**Légende statut** : ⬜ à faire · 🟡 en cours · ✅ livré et vérifié.

---

## 0. Ordre d'attaque

| # | Chantier | Impact | Effort | Dépend de | Statut |
|---|---|---|---|---|---|
| 1 | Page web `/u/[pseudo]` + OG image | Acquisition | M | rien | 🟡 lots 0 à 7 livrés · [spec](./UX-01-PAGE-BENTO-PUBLIQUE.md) |
| 2 | Flux « Derniers bentos » dans À la une | Rétention | S | rien | ⬜ |
| 3 | Recherche d'item : suggestions, autofocus, haptique | Complétion | M | rien | ⬜ |
| 4 | `expo-image` partout | Perf + egress | S | rien | ⬜ |
| 5 | Modèle brouillon / publié + dépublication | Confiance | M | rien | ⬜ |
| 6 | Onglet « Découvrir » (recherche par item) | Découverte | M | 2 | ⬜ |
| 7 | Page bento public : scale + React Query | Bug + perf | S | rien | ⬜ |
| 8 | Signaux de retour (vues, item validé, réactions) | Rétention | L | 1 | ⬜ |
| 9 | Onboarding : pseudo au moment de publier | Activation | M | 5 | ⬜ |
| 10 | Profil éditable (nom, pseudo, Popy) | Appropriation | S | rien | ⬜ |
| 11 | Accessibilité et polish | Qualité | S | rien | ⬜ |
| 12 | Le « pourquoi » par case | Contenu | L | arbitrage modération | ⬜ |

---

## 1. Page web `/u/[pseudo]` + OG image

> **Spécification détaillée : [`UX-01-PAGE-BENTO-PUBLIQUE.md`](./UX-01-PAGE-BENTO-PUBLIQUE.md)** (architecture, UX, SEO, perf, plan de dev en 9 lots, stratégie de test).

**Constat.** `shareBento()` partage `https://bento-pop.com/u/<pseudo>` (`apps/mobile/src/lib/share.ts:19`). Cette route **n'existe pas** sur la landing : `apps/landing/src/app/` ne contient que `emissions`, `podcasts` et les pages légales. Les universal links sont bien servis (`apps/landing/src/app/.well-known/apple-app-site-association/route.ts` et `assetlinks.json/route.ts`), donc l'app s'ouvre si elle est installée, mais :

- toute personne sans l'app tombe sur `not-found.tsx` ;
- aucune `opengraph-image`, donc aucun aperçu quand le lien est collé dans Discord, iMessage ou Twitter.

Chaque partage réussi est aujourd'hui une acquisition perdue.

**Proposition.**

- `apps/landing/src/app/u/[pseudo]/page.tsx` en SSR, lecture via le client Supabase **mobile** (`apps/admin/src/lib/supabase/mobile.ts` montre le pattern des deux projets distincts). La RLS autorise déjà la lecture publique des bentos publiés.
- `generateMetadata` avec titre, description et image.
- `apps/landing/src/app/u/[pseudo]/opengraph-image.tsx` : rendu 1200×630 de la grille bento.
- Deux CTA store plus un lien « Compose le tien ».
- Page 404 propre si le pseudo n'existe pas ou si le bento n'est pas publié.

**Bonus même chantier.** `ShareImage.tsx` ne porte que le pseudo. Ajouter `bento-pop.com/u/<pseudo>` en bas de l'image PNG pour fermer la boucle même quand elle circule en capture d'écran.

**Attention.** Voir la note mémoire sur l'egress Supabase : les images du catalogue doivent passer par `next/image` sur la landing, le CDN ignore `cacheControl`.

**Fait quand** : un lien partagé depuis l'app, ouvert sur un device sans l'app, affiche le bento complet et un aperçu riche dans les messageries.

---

## 2. Flux « Derniers bentos » dans À la une

**Constat.** `featured.tsx` n'affiche que les bentos cochés `is_featured` côté BO. Par défaut l'écran est vide et montre l'état « Pas encore de featured » (`apps/mobile/app/(tabs)/featured.tsx:97`). L'onglet est donc inutile tant que l'équipe n'a rien curé.

**Proposition.** Une section « Derniers bentos » sous les featured : même requête que `loadFeaturedBentos` (`apps/mobile/src/lib/featured.ts:33`) sans le filtre `is_featured`, triée `published_at desc`, limitée à 20. Pagination ou infinite scroll optionnels en v2.

**Fait quand** : l'onglet À la une n'est jamais vide dès qu'un bento est publié dans la base.

---

## 3. Recherche d'item : suggestions, autofocus, haptique

**Constat** (tout dans `apps/mobile/app/search-modal.tsx`) :

- écran vide à l'ouverture, « Tape pour chercher », alors que six cases sont à remplir ;
- pas d'`autoFocus` ni de `returnKeyType="search"` sur le `TextInput` : un tap perdu, six fois ;
- deux taps pour valider (sélection de la tuile puis « Choisir X » en bas) ;
- le popup anti-doublon est une `Alert` native à trois boutons dont « Ajouter quand même » en `destructive` rouge, ce qui casse la DA et culpabilise une action légitime ;
- pas de `KeyboardAvoidingView` : sur petit écran le clavier peut recouvrir le CTA ;
- `TILE_WIDTH` est figé au chargement du module via `Dimensions.get('window')`.

Côté composer (`apps/mobile/app/(tabs)/compose.tsx`) :

- aucun feedback quand une case se remplit : la modale se ferme, la tuile est là. Pas d'`expo-haptics` dans les dépendances, `react-native-reanimated` est installé mais inutilisé sur cet écran ;
- le CTA principal est `disabled` quand `filled === 0` (`compose.tsx:181`) : un nouvel utilisateur arrive sur un gros bouton grisé.

**Proposition.**

- Suggestions par défaut à l'ouverture : items les plus choisis de la catégorie, via un `count` groupé par `item_id` sur `bento_items` (nouvelle fonction SQL ou vue matérialisée, mise en cache React Query).
- `autoFocus`, `returnKeyType="search"`, `KeyboardAvoidingView`.
- Second tap sur une tuile déjà sélectionnée = validation.
- Remplacer l'`Alert` anti-doublon par une ligne « On a peut-être déjà ça » injectée dans la liste des résultats, ou à défaut par une feuille custom aux couleurs Bento.
- `expo-haptics` sur la validation d'une case, animation Reanimated d'entrée de la tuile, barre de progression animée.
- CTA « Commence par ton film » quand le bento est vide, qui ouvre directement la modale.

**Fait quand** : remplir les six cases se fait sans écran vide, sans tap superflu, et chaque case validée produit une réponse tactile et visuelle.

---

## 4. `expo-image` partout

**Constat.** Toutes les images distantes passent par `<Image>` de React Native : pas de cache disque, pas de placeholder, pas de fondu. Les mêmes visuels du catalogue sont retéléchargés à chaque scroll de À la une.

**Proposition.** Migrer vers `expo-image` : cache disque, `placeholder`, `transition`, `contentFit`. Gain visuel immédiat et réduction directe de l'egress Supabase Storage.

**Fichiers concernés** : `Tile.tsx`, `MiniBentoCard.tsx`, `ShareImage.tsx`, `search-modal.tsx`, `search.tsx`, `profile.tsx`, `u/[pseudo].tsx`.

**Attention.** `share-image.ts` utilise `Image.prefetch` de React Native pour précharger avant `captureRef` (`apps/mobile/src/lib/share-image.ts:18`). À adapter à l'API `expo-image` et à retester sur device réel, la capture est sensible aux races de chargement.

**Fait quand** : plus aucun `Image` de `react-native` sur une URL distante, et le second affichage d'une même liste est instantané.

---

## 5. Modèle brouillon / publié + dépublication

**Constat.** `setBentoSlot` écrit en base immédiatement (`apps/mobile/src/lib/bento-actions.ts:44`), donc toute édition après publication est live tout de suite alors que l'utilisateur croit modifier un brouillon. En plus `publishBento` refait `published_at = now()` à chaque appel (`bento-actions.ts:66`), donc la date « bento publié le X » se réinitialise à chaque republication. Et il n'existe aucun moyen de dépublier son bento sans supprimer son compte.

**Proposition.** Deux options à trancher en planification :

- **A, assumer le live** : une fois publié, le bouton « Publier mon bento » devient « Voir mon bento public », et un bandeau discret indique « Tes modifications sont visibles tout de suite ». Ne pas toucher à `published_at` s'il est déjà posé. Faible coût.
- **B, vrai brouillon** : les modifications restent locales jusqu'au tap sur Publier. Coût plus élevé, réécriture du flux d'écriture des slots, mais modèle mental plus sain.

Dans les deux cas : ajouter « Dépublier mon bento » dans le profil, et corriger `publishBento` pour ne pas écraser un `published_at` existant.

**Fait quand** : l'utilisateur sait à tout instant si ce qu'il voit est public, et peut se retirer sans supprimer son compte.

---

## 6. Onglet « Découvrir »

**Constat.** `search.tsx` ne cherche que par préfixe de pseudo (`apps/mobile/app/(tabs)/search.tsx:44`). On ne connaît pas les pseudos des autres, c'est le paradoxe de l'annuaire. Pire : la requête ne filtre pas les users sans bento publié, donc on peut taper « Voir » et arriver sur « Bento introuvable » (`u/[pseudo].tsx:365`).

**Proposition.** Renommer l'onglet en « Découvrir » et le structurer en trois entrées :

- les bentos récents (réutilise le chantier 2) ;
- la **recherche par item** : « qui a mis Interstellar dans sa case film ? ». La donnée est déjà là dans `bento_items`, c'est le geste social naturel ;
- la recherche par pseudo, avec un `inner join` sur les bentos publiés pour supprimer les résultats morts.

**Fait quand** : on peut trouver quelqu'un sans connaître son pseudo, et aucun résultat de recherche ne mène à un cul-de-sac.

---

## 7. Page bento public : scale et React Query

**Constat.** `u/[pseudo].tsx:322` utilise `scale={0.94}` en dur alors que le composer calcule un scale dynamique (`compose.tsx:110`). Hauteur native de la grille : environ 512pt, soit 481pt à 0.94. Sur un iPhone SE, header profil et grille dépassent la hauteur disponible et les CTA sticky recouvrent la dernière rangée.

Par ailleurs l'écran n'utilise pas React Query : `useEffect` plus `useState` maison, donc pas de cache, pas de retry, rechargement complet à chaque visite. `loadPublicBentoByPseudo` fait deux requêtes séquentielles (`bento-actions.ts:135`).

**Proposition.** Reprendre le calcul de scale dynamique du composer, ou rendre la page scrollable. Passer le chargement en `useQuery`. Fusionner les deux requêtes en une jointure.

**Fait quand** : la grille est entièrement visible sur iPhone SE, et revenir sur un bento déjà consulté est instantané.

---

## 8. Signaux de retour

**Constat.** Une fois publié, il ne se passe plus rien : pas de compteur de vues, pas de réaction, pas de notification (`expo-notifications` absent des dépendances). Cas le plus dur : un utilisateur qui propose un item au catalogue voit sa publication bloquée (`compose.tsx:57`) sans aucun moyen de savoir quand la modération le débloque, sinon rouvrir l'app au hasard.

**Proposition**, par ordre de rapport effort sur impact :

1. **Compteur de vues** : table `bento_views`, affichage sur le profil (« 47 personnes ont ouvert ton bento »). À alimenter aussi depuis la page web du chantier 1.
2. **Notification item validé** : `expo-notifications` plus un trigger côté modération quand un item passe `pending` vers `validated`. Débloque un cul-de-sac réel.
3. **Réaction par case** plutôt que like global : « 12 personnes ont le même film ». Un `count` par `item_id` sur `bento_items`, aucune modération supplémentaire à prévoir.

**Fait quand** : un utilisateur qui rouvre l'app une semaine plus tard trouve quelque chose de nouveau qui le concerne.

---

## 9. Onboarding : pseudo au moment de publier

**Constat.** Parcours actuel : splash, CGU, pseudo, mécanique, composer. On exige un identifiant unique, avec check réseau, avant que l'utilisateur ait vu la moindre valeur.

Détail au passage : la pagination affiche 3 points (`splash.tsx:103` actif 0, `mechanics.tsx:116` actif 2) et l'écran pseudo annonce « ÉTAPE 2 / 3 », mais l'écran CGU s'intercale sans être compté. Le parcours réel fait quatre écrans.

**Proposition.** Laisser composer la case film dès l'entrée, demander le pseudo au moment de publier, quand il y a quelque chose à perdre. Le pseudo peut être pré-généré (`generatePseudoSuggestions` existe déjà dans `apps/mobile/src/lib/pseudo.ts`) et modifiable ensuite.

**Attention.** La gate CGU est une obligation App Store Guideline 1.2 (cf. `docs/STORE-COMPLIANCE.md`), elle doit rester avant toute contribution publique. Et `terms_accepted_at` est posé dans l'`INSERT` de la ligne `users` (`pseudo.tsx:66`), donc décaler la création du profil implique de revoir ce couplage. À cadrer en planification, dépend du chantier 5.

**Fait quand** : un nouvel utilisateur peut remplir sa première case sans avoir créé de compte, et la conformité CGU est préservée.

---

## 10. Profil éditable

**Constat.** Pas d'édition du `display_name`, pas de changement de pseudo, pas de choix du Popy (dérivé d'un hash du pseudo, `apps/mobile/src/lib/popy-avatar.ts:38`).

**Proposition.** Trois formulaires simples. Le choix du Popy nécessite une colonne `users.avatar` (déjà anticipée en commentaire dans `popy-avatar.ts`). Le changement de pseudo doit gérer la redirection des anciens liens ou au minimum prévenir que l'ancienne URL cassera.

**Fait quand** : l'utilisateur peut personnaliser son identité sans supprimer et recréer son compte.

---

## 11. Accessibilité et polish

- La loupe est un **emoji** 🔍 (`search-modal.tsx:238`, `search.tsx:106`) alors que `react-native-svg` et `@expo/vector-icons` sont installés : rendu différent iOS et Android, et lu à voix haute par VoiceOver.
- Plusieurs titres ont un `lineHeight` inférieur au `fontSize` (`fontSize: 28, lineHeight: 26` dans compose, featured, search) : avec la taille de police système augmentée, les glyphes Extenda se font rogner. Aucun `allowFontScaling={false}` ni `maxFontSizeMultiplier` nulle part dans l'app.
- Le crédit image en `rgba(255,255,255,0.5)` sur photo (`Tile.tsx:283`) est sous le seuil de contraste, alors que c'est une obligation légale CC-BY-SA.
- Faute dans le menu de signalement : « Confirme-tu ? » (`u/[pseudo].tsx:427`).
- Les états de chargement sont des `ActivityIndicator` centrés : les remplacer par des squelettes de tuiles sur featured et bento public.

---

## 12. Le « pourquoi » par case

**Constat.** Un bento est une image. Rien n'explique pourquoi ces six choix.

**Proposition.** Un champ facultatif d'une ligne par case. C'est ce qui ferait passer le bento du statut d'image à celui de contenu qu'on a envie de lire, et ce qui donnerait matière à une rubrique dans l'émission.

**Arbitrage nécessaire.** C'est du texte libre utilisateur : charge de modération, obligations UGC Apple 1.2, stockage, affichage dans la grille déjà dense. À trancher avant toute implémentation.

---

## Hors périmètre de cette roadmap

Reste hors scope tant que ce n'est pas explicitement demandé : auth avec mot de passe (« claim » de compte), messagerie, commentaires sur les bentos des autres, plusieurs bentos par utilisateur, internationalisation.
