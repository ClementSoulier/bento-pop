# Mon Bento Pop — audit compliance Apple App Store / Google Play

État au 11 mai 2026, après livraison du **sprint P7 compliance** (commits `07b62d9`, `db1f739`, `db6d0fe`, `182f805`, `6868783`, `a6e0c60`).

**Légende** : ✅ prêt — 🟡 partiel — ❌ bloquant ou pas commencé.

## 0. Status global

Premier build EAS Preview iOS en cours. La majorité des bloquants Apple ont été levés :

| Bloc | Avant P7 | Après P7 |
|---|---|---|
| Assets store (icon, splash, adaptive) | ❌ | ✅ |
| Privacy + Terms publiés + dans l'app | ❌ | ✅ |
| Suppression de compte (Apple 5.1.1(v)) | ❌ | ✅ |
| Modération UGC : report + filtre pseudos (Apple 1.2) | ❌ | ✅ (P7) — manque le BO admin pour traiter |
| Attributions APIs (TMDb obligatoire) | ❌ | ✅ |
| Apple Dev account | ❌ | ✅ |
| EAS Build configuré (projectId, secrets, expo-updates) | ❌ | ✅ |

Il reste essentiellement des actions **non-code** (assets de présentation stores, descriptions, screenshots, devices tests) et 2 chantiers code (BO admin reports + ban en P8, offline banner).

---

## 1. Assets & branding

| # | Item | État | Action |
|---|---|---|---|
| 1.1 | App icon iOS (1024×1024 PNG opaque) | ✅ | Généré par `scripts/generate-assets.mjs` (sharp), déclaré dans `app.json:icon` |
| 1.2 | Android adaptive icon | ✅ | foreground transparent + background `#fbbf24` |
| 1.3 | iOS / Android splash | ✅ | 2732×2732 + Splash JS animé prend le relais (`Splash.tsx`) |
| 1.4 | Web favicon | ✅ | 48×48 généré + déclaré dans `app.json:web.favicon` |
| 1.5 | Screenshots App Store (6.5" + 6.7") | ❌ | À capturer après TestFlight sur device, mini 3 par taille |
| 1.6 | Screenshots Play Store | ❌ | Phone + tablet, mini 2 chacun |
| 1.7 | Feature graphic Play Store (1024×500) | ❌ | Bannière promo |
| 1.8 | Description courte + longue (FR) | ❌ | ~30 min à rédiger pour les deux stores |

---

## 2. Légal — Privacy, Terms, Attributions

| # | Item | État | Détail |
|---|---|---|---|
| 2.1 | Privacy policy URL publique | ✅ | `bento-pop.com/confidentialite` — étendue avec section 2.2 « Application mobile » + 2.3 « Sources externes » + section 6 « Suppression compte mobile » |
| 2.2 | Terms of Service URL | ✅ | `bento-pop.com/mentions-legales` — section 6 dédiée à l'app : distribution, modération, attributions |
| 2.3 | Lien Privacy + Terms dans l'app | ✅ | Tab Profil → section À propos → ouvre les pages via `Linking.openURL` |
| 2.4 | Attribution TMDb | ✅ | Page `/credits` — disclaimer Apple/TMDb exact |
| 2.5 | Attribution MusicBrainz | ✅ | Page `/credits` (mention CC-BY-NC-SA 4.0) |
| 2.6 | Attribution OpenStreetMap | ✅ | Page `/credits` (« © OpenStreetMap contributors ») |
| 2.7 | Attribution Wikidata | ✅ | Page `/credits` (mention CC0) |
| 2.8 | Page Crédits | ✅ | `/credits.tsx` avec sections Légal / Sources / Polices + version |

---

## 3. UGC moderation (Apple 1.2)

| # | Item | État | Détail |
|---|---|---|---|
| 3.1 | Mécanisme de **report** | ✅ | Bouton « Signaler » dans la top bar de `/u/[pseudo]` → Alert confirmation → INSERT public.reports |
| 3.2 | Mécanisme de **block** | ❌ | Hors-scope P7. Faisable simplement en local (liste de pseudos masqués par device) — à faire si Apple le demande au review |
| 3.3 | **Éjection** d'un user par l'admin | 🟡 | Possible via BO admin (DELETE users via service-role), mais pas de bouton UI dédié. À ajouter en **P8** |
| 3.4 | Filtre **pseudos offensants** | ✅ | Table `blocked_pseudo_patterns` + trigger SQL en SECURITY DEFINER + 15 patterns seed (slurs FR/EN, vulgarités, usurpation admin) |
| 3.5 | Filtre contenu items | ✅ | Items viennent d'APIs curatées (TMDb, MB, OSM) — pas de free-text user |
| 3.6 | Réponse aux reports < 24h | 🟡 | Process organisationnel : abonnez-vous à un email signalements via Supabase webhook OU vérifier la table 1×/jour côté BO. **Le BO admin de modération arrive en P8.** |

---

## 4. Account management (Apple 5.1.1(v))

| # | Item | État | Détail |
|---|---|---|---|
| 4.1 | Création de compte | ✅ | Anonymous sign-in au boot + pseudo à l'onboarding |
| 4.2 | **Suppression du compte depuis l'app** | ✅ | Tab Profil → bouton rouge « Supprimer mon compte » → Alert destructive → `deleteOwnAccount` (DELETE users → cascade bentos → bento_items) puis `resetAndReinit` (signOut + relance anonymous + reset stores). Migration RLS `users_delete_own` appliquée |
| 4.3 | Recovery / claim email + password | 🟡 | Hors MVP — accepté par Apple tant que la suppression existe |
| 4.4 | Export RGPD | 🟡 | À ajouter à la demande utilisateur (email) tant qu'il n'y a pas de bouton in-app |

---

## 5. Configuration technique

| # | Item | État | Détail |
|---|---|---|---|
| 5.1 | Bundle ID iOS (`com.bentopop.mobile`) | ✅ | |
| 5.2 | Package Android (`com.bentopop.mobile`) | ✅ | |
| 5.3 | Version + buildNumber/versionCode | ✅ | `0.0.1` + EAS `appVersionSource: remote` + `autoIncrement` |
| 5.4 | **Apple Developer account** ($99/an) | ✅ | |
| 5.5 | Google Play Developer account ($25 one-time) | ❌ | À souscrire plus tard, Android repoussé |
| 5.6 | App Store Connect record | 🟡 | Sera créé automatiquement au 1er `eas submit`, mais le record manuel (description, screenshots, age rating) reste à remplir |
| 5.7 | Play Console record | ❌ | Idem, suit P5.5 |
| 5.8 | App Tracking Transparency prompt | ✅ | Non nécessaire (aucun tracking, pas d'IDFA) |
| 5.9 | Permissions iOS (Info.plist) | ✅ | Aucune sensible. `ITSAppUsesNonExemptEncryption: false` déclaré (US export compliance) |
| 5.10 | Permissions Android | ✅ | Aucune sensible |
| 5.11 | Universal Links / App Links | ❌ | `bento-pop.com/u/*` ouvre encore le navigateur si app installée. AASA file + intent filter Android = ~2h dev. À faire en **P8** ou plus tard |
| 5.12 | Deep links `bentopop://` | ✅ | Configuré dans `app.json:scheme` |
| 5.13 | EAS projectId | ✅ | `eecbef8a-0943-4bec-b592-59e4b5016e5f` |
| 5.14 | EAS Build env secrets | ✅ | `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY/TMDB_TOKEN` via `eas env:create` |
| 5.15 | `expo-updates` + `runtimeVersion` | ✅ | Installé + `runtimeVersion.policy: appVersion` |

---

## 6. Data safety / Privacy labels

À déclarer dans App Store Connect (App Privacy) et Play Console (Data Safety) au moment du record manuel.

| Donnée collectée | Linkée à user | Tracking | Optionnelle |
|---|---|---|---|
| Pseudo | Oui | Non | Non |
| Display name | Oui | Non | Oui |
| UUID device (`auth.users.id`) | Oui | Non | Non |
| Items composés | Oui | Non | Non |
| Signalements (table reports) | Oui (reporter) | Non | Oui (action user) |
| Adresse IP | Oui | Non | Non (technique seulement) |

**Aucune analytics tierce, aucun tracker publicitaire, pas d'IDFA / GAID** = excellent positionnement App Privacy.

---

## 7. UX / robustesse

| # | Item | État | Détail |
|---|---|---|---|
| 7.1 | Loading states partout | ✅ | |
| 7.2 | Error states | 🟡 | Featured + Search tabs montrent un état vide mais pas d'UI dédiée à un fail API. Polish P8 |
| 7.3 | Offline → message clair | ❌ | `@react-native-community/netinfo` + banner. ~1h dev. À faire en **P8** |
| 7.4 | Pas de dead-end screens | ✅ | |
| 7.5 | Boutons inutilisables désactivés | ✅ | |
| 7.6 | Cold start sans crash | ✅ | Vérifié via expo export web + iOS (smoke tests) |
| 7.7 | Données chargées pendant le splash | ✅ | Splash custom Bento + session pré-chargée |
| 7.8 | Logout / clear data | ✅ | Couvert par « Supprimer mon compte » |

---

## 8. Tests pré-soumission

| # | Quoi | État |
|---|---|---|
| 8.1 | Test sur iPhone réel (TestFlight build) | 🟡 — en cours, build EAS preview lancé |
| 8.2 | Test sur Android réel | ❌ — repoussé, account Play à venir |
| 8.3 | Test orientation portrait verrouillée | ✅ |
| 8.4 | Test darkMode système (l'app force `light`) | ✅ après fix NativeWind `darkMode: class` |
| 8.5 | Test petite taille écran (iPhone SE 4.7") | ❌ |
| 8.6 | Test grand écran (iPhone 16 Pro Max 6.9") | ❌ |
| 8.7 | Test accessibility VoiceOver / TalkBack | ❌ — chantier à part |
| 8.8 | Test scroll long avec beaucoup de bentos | ❌ — peu de data en BDD pour l'instant |

---

## 9. Restant pour TestFlight

L'app est techniquement prête pour un build interne. Le 1er TestFlight peut partir une fois que :

1. **Build EAS preview** termine sans erreur ✅ (en cours)
2. **Test du `.ipa` sur ton iPhone** via TestFlight Internal Testing (tu peux y inviter jusqu'à 100 Apple IDs sans review Apple)
3. **Le BO admin reports** est en place (P8) — au minimum un dump SQL régulier sinon Apple peut tiquer

Pour la **review Apple publique** (App Store), il faut en plus :
- Screenshots, description, age rating, App Privacy labels remplis
- Block UI côté mobile (3.2) — fortement recommandé si UGC visible publiquement
- Pré-modération de la table `blocked_pseudo_patterns` enrichie au-delà des 15 patterns seed

---

## 10. Suivi : P8 priorisé

Sprint suivant si on continue :

| Ordre | Tâche | Effort | Pourquoi |
|---|---|---|---|
| 1 | **BO admin reports + bannir** (page `/reports`, bouton Bannir sur `/bentos`) | 3h | Apple peut demander des preuves de modération réactive |
| 2 | **Offline banner** (`netinfo` + UI haut d'écran) | 1h | UX, pas de crash si réseau down |
| 3 | **Block user côté mobile** (liste locale par device) | 2h | Apple guideline 1.2 — recommandé pas obligatoire |
| 4 | **Universal Links** `bento-pop.com/u/*` | 2-3h | UX premium au partage |
| 5 | **Export RGPD** in-app (JSON download) | 2h | Conformité européenne renforcée |
| 6 | **Error states** Featured + Search | 1h | Polish |

**Total P8** : ~12h dev. Permet de viser une review App Store sereine.

---

## 11. Effort restant estimé

| Bloc | Effort dev | Effort manuel (toi) |
|---|---|---|
| **Sprint P8** (voir section 10) | 12h | aucun |
| Screenshots + descriptions stores | 0h | 2-3h après TestFlight |
| Souscription Google Play | 0h | $25 + 1-2 jours validation |
| App Store Connect record (App Privacy labels, age rating, etc.) | 0h | 2h |
| Tests sur devices réels | 0h | 2-3h en cumul |

---

## 12. Risques de rejet — réévaluation

1. ~~**Apple guideline 1.2 (UGC)**~~ → résolu côté code (report + filtre pseudos + suppression compte). Reste à démontrer un process de réponse aux reports < 24h — un screenshot du BO ou un email type peut suffire en review.
2. ~~**Apple 5.1.1(v) account deletion**~~ → résolu.
3. **Attribution TMDb** → résolu (page Crédits + disclaimer Apple exact). À surveiller : ne pas afficher de logo TMDb modifié.
4. **Pseudos offensants** → 15 patterns en seed, à enrichir avec le BO admin. Si Apple reviewer trouve un pseudo offensant pendant le review (probabilité faible en interne), il faudra remettre la patch et resoumettre.
5. **Crash anonymous sign-in** si Supabase down au review → Probabilité très faible mais à mitiger en P8 (catch erreur init → écran « réessayer » au lieu du splash infini).

---

## 13. Changelog

- **11/05/2026 P7** — Sprint compliance livré : assets, account deletion, page Crédits, report UGC + filtre pseudos, liens Privacy/Terms dans l'app. Pages légales étendues à l'app. EAS configuré (projectId, secrets, expo-updates, runtimeVersion).
- **11/05/2026 audit P6** — Création initiale du document.
