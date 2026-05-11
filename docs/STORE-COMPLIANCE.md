# Mon Bento Pop — audit compliance Apple App Store / Google Play

État au 11 mai 2026. Ce document liste tout ce qu'il faut avant de pouvoir soumettre l'app dans les stores.

**Légende** : ✅ prêt — 🟡 partiel — ❌ bloquant.

---

## 1. Assets & branding

| # | Item | État | Action |
|---|---|---|---|
| 1.1 | App icon iOS (1024×1024 PNG sans transparence) | ❌ | Générer depuis Popy + jaune. Placer dans `apps/mobile/assets/icon.png` + référencer dans `app.json` |
| 1.2 | Android adaptive icon (foreground 1024×1024 transparent + background color) | ❌ | `apps/mobile/assets/adaptive-icon.png`. Le background `#fbbf24` est déjà déclaré |
| 1.3 | iOS splash (recommandé 2732×2732 centré) | ❌ | `apps/mobile/assets/splash.png` + ajout `splash.image` dans `app.json`. Notre Splash JS animé reste en bonus après le splash natif |
| 1.4 | Web favicon | 🟡 | Manquant pour l'app web (séparé du favicon landing) — à voir si on déploie une version web |
| 1.5 | Screenshots App Store (6.5" + 6.7" iPhone, 12.9" iPad si supporté) | ❌ | À capturer après les vrais bentos. Minimum 3 par taille |
| 1.6 | Screenshots Play Store (phone + tablet, min 2 chacun) | ❌ | Idem |
| 1.7 | Feature graphic Play Store (1024×500) | ❌ | Une bannière de présentation |
| 1.8 | Description courte + longue (FR) | ❌ | À rédiger pour les deux stores |

---

## 2. Légal — Privacy, Terms, Attributions

| # | Item | État | Action |
|---|---|---|---|
| 2.1 | Privacy policy URL publique | ❌ | À publier sur `bento-pop.com/confidentialite-mobile` (séparée ou unifiée avec celle de la landing). Couvre : UUID anonymous, pseudo, items choisis, dates |
| 2.2 | Terms of Service URL | ❌ | `bento-pop.com/conditions-mobile`. Couvre : règles d'usage, UGC, modération, droits sur le contenu |
| 2.3 | Lien Privacy + Terms accessible **dans l'app** | ❌ | Ajouter dans la tab Profil un bloc « Mentions / Confidentialité » qui ouvre le navigateur |
| 2.4 | Attribution TMDb | ❌ | Mention obligatoire : « This product uses the TMDB API but is not endorsed or certified by TMDB. » + logo TMDb. À placer dans la modal de recherche film/série OU dans la page Crédits |
| 2.5 | Attribution MusicBrainz | ❌ | « Music metadata from MusicBrainz » (CC-BY-NC-SA 4.0) |
| 2.6 | Attribution OpenStreetMap | ❌ | « © OpenStreetMap contributors » sur les résultats lieu |
| 2.7 | Attribution Wikidata | 🟡 | CC0 — pas obligatoire mais cool de mentionner |
| 2.8 | Page « Crédits » dans l'app | ❌ | Liste les 4 attributions, lien vers le site, version + build, lien legal |

---

## 3. UGC moderation (Apple guideline 1.2 — strict)

Apple **rejette systématiquement** les apps avec UGC sans modération. C'est le poste de risque #1.

| # | Item | État | Action |
|---|---|---|---|
| 3.1 | Mécanisme de **report** d'un bento ou pseudo | ❌ | Bouton « Signaler » sur la page `/u/<pseudo>` → form ou mailto → enregistre en BDD (table `reports`) |
| 3.2 | Mécanisme de **block** d'un utilisateur | ❌ | Liste de pseudos bloqués stockée localement (par device) + filtre dans la recherche / featured. Spec MVP : peut être un simple « masquer » |
| 3.3 | Mécanisme d'**éjection** d'un user par l'admin | 🟡 | BO admin a déjà accès complet via service-role — possible de manuellement update `users.is_banned` ou supprimer la ligne. Ajouter un bouton « Bannir » à `/bentos` |
| 3.4 | Filtre automatique des **pseudos offensants** | ❌ | Liste de mots interdits côté server à la création du profil. Approche pragmatique : liste FR + EN basique des slurs et termes vulgaires + check regex |
| 3.5 | Filtre du contenu des items (titres de film, etc.) | ✅ | Les items viennent d'APIs externes curatées (TMDb, MB, OSM) — pas de risque de free-text offensif |
| 3.6 | Réponse aux reports < 24h | ❌ | Process pas en place. À l'usage : email contact pro + monitoring de la table reports |

---

## 4. Account management (Apple guideline 5.1.1(v))

Apple exige depuis 2022 : si l'app permet la création de compte, elle **doit** permettre la suppression.

| # | Item | État | Action |
|---|---|---|---|
| 4.1 | Création de compte | ✅ | Anonymous sign-in au boot, pseudo à l'onboarding |
| 4.2 | **Suppression du compte** depuis l'app | ❌ | Tab Profil → « Supprimer mon compte » → confirmation → DELETE users (cascade vers bentos / bento_items). Mandatory pour Apple |
| 4.3 | Recovery / claim (v2) | 🟡 | Pas dans le MVP — accepté tant que l'utilisateur peut au moins supprimer |
| 4.4 | Export des données (RGPD) | 🟡 | Pas critique au lancement. À l'usage : bouton « Télécharger mes données » qui dump bento + items au JSON |

---

## 5. Configuration technique

| # | Item | État | Action |
|---|---|---|---|
| 5.1 | Bundle ID iOS (`com.bentopop.mobile`) | ✅ | Déclaré dans `app.json` |
| 5.2 | Package Android (`com.bentopop.mobile`) | ✅ | Idem |
| 5.3 | Version + buildNumber/versionCode | 🟡 | Version `0.0.1` actuelle. EAS gère le buildNumber auto via `autoIncrement`. OK |
| 5.4 | Apple Developer account ($99/an) | ❌ | À souscrire pour TestFlight + App Store |
| 5.5 | Google Play Developer account ($25 one-time) | ❌ | À souscrire pour Play Store |
| 5.6 | App Store Connect record | ❌ | Créer l'app après account Apple |
| 5.7 | Play Console record | ❌ | Idem |
| 5.8 | App Tracking Transparency prompt | ✅ | Non nécessaire (on ne track pas entre apps, pas d'IDFA) |
| 5.9 | Permissions iOS (Info.plist) | ✅ | Aucune permission sensible demandée |
| 5.10 | Permissions Android | ✅ | Aucune permission sensible |
| 5.11 | Universal Links / App Links (`bento-pop.com/u/*` → ouvre l'app) | ❌ | Optionnel mais super UX. Demande un AASA file sur le domaine + intent filter Android. P7 |
| 5.12 | Deep links via `bentopop://` custom scheme | ✅ | Déjà configuré dans `app.json:scheme` |

---

## 6. Data safety / Privacy labels

À déclarer dans App Store Connect (App Privacy) et Play Console (Data Safety).

| Donnée collectée | Linkée à user | Utilisée pour tracking | Optionnelle |
|---|---|---|---|
| Pseudo | Oui | Non | Non (obligatoire) |
| Display name (optionnel) | Oui | Non | Oui |
| UUID device (`auth.users.id`) | Oui | Non | Non |
| Items composés (film, série…) | Oui | Non | Non |
| Email (v2 claim) | Oui | Non | Oui |
| Adresse IP | Oui | Non | Non (technique seulement) |

**Aucune analytics tierce ni tracking publicitaire** = excellent positionnement Apple Privacy.

---

## 7. UX / robustesse

| # | Item | État | Action |
|---|---|---|---|
| 7.1 | Loading states partout | ✅ | ActivityIndicator sur onboarding/pseudo, search, featured, public bento |
| 7.2 | Error states gérés | 🟡 | Featured + Search tabs n'ont pas d'UI d'erreur (juste « pas de résultat »). À ajouter |
| 7.3 | Offline → message clair | ❌ | Actuellement l'app reste figée sur l'écran courant si réseau down. Détecter via `@react-native-community/netinfo` + afficher banner |
| 7.4 | Pas de dead-end screens | ✅ | Retour systématique disponible |
| 7.5 | Boutons inutilisables désactivés | ✅ | StampButton + VoteOption gèrent disabled |
| 7.6 | Cold start sans crash | ✅ | Testé via expo export |
| 7.7 | Données chargées en arrière-plan pendant le splash | ✅ | Session anonymous + profile pré-chargés avant écran principal |
| 7.8 | Logout / clear data | 🟡 | Pas exposé. À combiner avec « Supprimer mon compte » |

---

## 8. Tests pré-soumission

| # | Quoi | État |
|---|---|---|
| 8.1 | Test sur iPhone réel (TestFlight build) | ❌ |
| 8.2 | Test sur Android réel | ❌ |
| 8.3 | Test orientation portrait verrouillée | ✅ |
| 8.4 | Test darkMode système (l'app force `light`) | 🟡 — vérifier qu'aucune zone n'est noire/illisible |
| 8.5 | Test petite taille écran (iPhone SE 4.7") | ❌ |
| 8.6 | Test grand écran (iPhone 16 Pro Max 6.9") | ❌ |
| 8.7 | Test accessibility VoiceOver / TalkBack | ❌ |
| 8.8 | Test scroll long avec beaucoup de bentos | ❌ |

---

## 9. Priorisation pour passer en TestFlight / Beta Play

### Doit absolument être fait **avant le 1er build** :
1. **Assets** : icon iOS 1024×1024, adaptive icon Android, splash (1.1, 1.2, 1.3)
2. **Privacy policy + Terms publiés** sur bento-pop.com (2.1, 2.2)
3. **Lien Privacy + Crédits APIs dans l'app** (2.3, 2.4, 2.5, 2.6, 2.8)
4. **Suppression de compte depuis l'app** (4.2) — Apple ne pardonne pas
5. **Mécanisme de report** + **Filtre pseudos offensants** (3.1, 3.4)
6. **Apple Developer + Google Play accounts** (5.4, 5.5)

### Peut attendre la version 1.0 publique :
- Block user UI (3.2)
- BO admin « Bannir » (3.3)
- Universal Links (5.11)
- Offline banner (7.3)
- Screenshots et page store (1.5 → 1.8)
- Export RGPD (4.4)

### Peut attendre v1.1+ :
- Claim de compte v2 (4.3)
- Accessibility audit (8.7)

---

## 10. Effort estimé

| Bloc | Effort dev | Effort manuel (toi) |
|---|---|---|
| Assets (icon + splash) | 2h | Aucun si je génère depuis Popy |
| Privacy/Terms texte + lien dans app | 1h dev | 2h rédaction |
| Account deletion | 3h dev | Aucun |
| Report + filtre pseudos | 4h dev | Aucun |
| Page Crédits + attributions | 1h dev | Aucun |
| Souscriptions stores | 0h | 30 min + $124 |
| Screenshots + descriptions | 0h | 2-3h |

**Total estimé : ~11h dev + ~5h toi + souscriptions.** Pour un MVP store-ready réaliste : compter une semaine focus + souscriptions stores.

---

## 11. Risques de rejet identifiés

1. **Apple guideline 1.2 (UGC)** : risque très élevé sans report + filtre + suppression de compte. Quasi-certain rejet sans ces 3.
2. **Apple guideline 5.1.1(v) (account deletion)** : rejet automatique si pas implémenté.
3. **Attribution TMDb** : TMDb fait des scans des apps utilisant leur API. Une app non attribuée peut perdre l'accès API (pas Apple-level, mais notre clé serait révoquée).
4. **Spam pseudos** : si un user créé `@motoffensif` au premier launch, Apple reviewer le voit, fail.
5. **Crash anonymous sign-in** : si Supabase down au moment du review, l'app est inutilisable → reject.

Mitigations :
- (1, 2) Implémenter les 3 features listées dans la priorisation
- (3) Page Crédits avec attribution TMDb visible
- (4) Filtre côté server + table de mots interdits
- (5) Fallback gracieux : si Supabase fail au sign-in, montrer un écran « réessayer » plutôt qu'un crash

---

## 12. Quand on attaque ?

Recommandation : prochaine itération dédiée « Store Compliance Sprint ». Tu vois quand entre P5 et P7 c'est le bon timing.

Si tu veux qu'on fasse **bloc par bloc** ensuite, je peux prendre :
1. **Assets** (icon + adaptive + splash native) → 1 commit
2. **Account deletion** → 1 commit (UI + edge function ou cascade)
3. **Page Crédits + attributions** → 1 commit
4. **Report bento + filtre pseudos** → 1 commit
5. **Liens Privacy / Terms dans la tab Profil** → 1 commit

Dis-moi.
