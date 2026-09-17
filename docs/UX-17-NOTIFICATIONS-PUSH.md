# Chantier 17 · Notifications push

> Spécification écrite le 17 septembre 2026, à partir du code de `main`
> (`76adba2`), de lectures sur la production avec la clé anonyme **et** la clé
> de service en lecture seule, et de la documentation d'Expo et d'Apple
> consultée à la source le jour même. Aucune écriture en production.
>
> **Arbitrages rendus le 17 septembre 2026**, les neuf de §11. En résumé :
> l'envoi part d'un déclencheur SQL vers le back-office, qui appelle Expo avec
> son SDK Node ; deux notifications seulement, « ton item est validé » et
> « une édition est sortie » ; l'autorisation se demande juste après avoir
> proposé un item ; le transactionnel est actif d'emblée, l'éditorial attend
> un accord explicite ; les jetons morts se purgent sur accusé de réception et
> périment à 60 jours.
>
> **Deux préalables qui ne m'appartiennent pas** : une clé APNs et un compte
> de service FCM. Ils prennent du délai administratif, et rien ne se teste
> sans eux. Cf. §8, lot 0.
>
> Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md) chantier 17, et
> [le chantier 13](./UX-13-BENTO-HEBDOMADAIRE.md), avec qui il partage sa
> sortie store. **Depuis le 17 septembre 2026, cette sortie est unique** : elle
> attend que tous les chantiers de la roadmap soient terminés et recettés, cf.
> §9.
>
> **Mis à jour le 17 septembre 2026, l'après-midi**, après trois décisions de
> Clément valables pour toute la roadmap (une seule sortie store, migrations
> appliquées en production au fur et à mesure, recette sur appareil seulement à
> la sortie), trois vérifications et trois arbitrages, D10 à D12 de §11 :
>
> - **Le simulateur iOS et l'émulateur Android reçoivent les notifications**,
>   contrairement à ce que disaient §6.4 et §7.3 : la recette se fait avant la
>   fusion, sur ce Mac. Seul l'appareil réel attend la sortie, au chantier 29.
> - **« Une édition est sortie » ne peut pas naître d'un déclencheur** : un
>   déclencheur réagit à une écriture, pas au passage de l'heure. `pg_cron`
>   appelle le back-office toutes les 5 minutes (D10).
> - **La chaîne se branche en production dès que l'envoi est déployé**, et
>   tourne sans destinataire jusqu'à la sortie (D11).
> - **Une fusion prévient l'auteur comme une validation** (D12) : 19 des 146
>   items proposés et modérés en production ont été fusionnés.
> - **Le canal sortant est bien en place en production**, mesuré en lecture
>   seule : `pg_net`, les deux déclencheurs de la landing, leurs secrets, et des
>   appels réussis. La roadmap le disait à tort absent.

---

## 1. Intention

### 1.1 Le chiffre qui commande le chantier

Mesuré le 17 septembre 2026 sur la production, en lecture seule.

| Mesure | Valeur |
| --- | --- |
| Personnes ayant proposé au moins un item | 26 |
| Items proposés par un utilisateur | 123, tous validés |
| **Délai de validation, médiane** | **165,9 heures, soit 6,9 jours** |
| Délai maximum | 347,3 heures, 14,5 jours |
| File de modération au 17/09 | vide |
| Items refusés | 32 |
| Items fusionnés | 22 |

**Quelqu'un propose un item, attend sept jours en médiane, et n'apprend jamais
qu'il a été accepté.** Il doit rouvrir l'app, aller au bon onglet, et
remarquer qu'un badge a disparu. Le code le dit lui-même, depuis la V1 :

```
// apps/admin/src/app/(protected)/catalogue/actions.ts:102-103
 * `rejected_reason` est optionnel et ne sert pour l'instant qu'à
 * la traçabilité admin (pas de notification user en V1).
```

### 1.2 Une hypothèse de la roadmap, mesurée et tombée

La roadmap avançait qu'un item refusé passerait inaperçu **et laisserait un
trou visible** dans un bento publié, « à confirmer en recette ». Confirmé,
donc, et négativement :

```
cases de bento pointant sur un item refusé ou fusionné : 2
  dont dans un bento PUBLIÉ : 0
```

`admin_merge_items` réécrit les liaisons des items fusionnés, et aucun refus
n'a touché un bento en ligne. **Le trou n'existe pas.** L'argument du chantier
n'est donc pas celui-là : c'est le silence de sept jours, et lui seul.

### 1.3 Ce que le chantier 13 attend de celui-ci

Le « Fait quand » du chantier 13 dit : « quelqu'un qui a déjà publié son bento
a une raison de revenir composer ». Une raison qu'on ne découvre qu'en ouvrant
l'app n'en est pas une. Mesuré au chantier 13 : **25 bentos publiés sur 27 sans
activité depuis plus de sept jours, 28 jours en médiane.** Une édition
hebdomadaire sans notification n'atteint que ceux qui reviennent d'eux-mêmes,
c'est-à-dire les deux autres.

### 1.4 La règle qui tient le chantier

> **Deux familles de notifications, deux régimes. On ne les mélange jamais.**

- **Transactionnelle** : une réponse à un geste de la personne. « Ton item est
  validé. » Elle est attendue, elle ne se négocie pas, et elle est hors du
  champ de la règle 4.5.4 d'Apple.
- **Éditoriale** : une information que l'équipe décide d'envoyer. « Une
  nouvelle édition est sortie. » Elle exige un accord explicite et un moyen de
  s'en retirer, **dans l'app**.

Tout le reste de ce document découle de cette séparation : deux types en base,
deux réglages, deux moments de consentement.

---

## 2. Objectif et critères de succès

**Objectif.** Que quelqu'un qui propose un item sache quand il est validé, et
que quelqu'un qui a publié son bento sache qu'une édition est sortie.

**Critères, mesurables.**

1. Un item validé dans le back-office fait arriver une notification sur
   l'appareil de son auteur, en moins d'une minute.
2. Un item refusé aussi, avec sa raison quand elle existe.
3. Une édition qui sort prévient ceux qui l'ont accepté, et personne d'autre.
4. Un tap ouvre l'écran concerné, pas l'accueil.
5. Chaque type se coupe depuis l'app, et la coupure tient.
6. Un jeton mort cesse d'être utilisé dans les 24 heures qui suivent
   l'accusé de réception qui le signale.
7. L'app fonctionne exactement pareil sans aucune autorisation accordée.

---

## 3. Périmètre

**Dans le chantier.**

- Une table de jetons par compte et par appareil, et son cycle de vie.
- La demande d'autorisation, à un moment choisi, et son refus respecté.
- Deux notifications : item modéré, édition sortie.
- Une section Notifications dans le profil, avec un interrupteur par type.
- L'envoi côté serveur, et la relecture des accusés de réception.
- Le tap qui ouvre le bon écran.

**Hors du chantier, et pourquoi.**

- **« Ton bento est prêt à publier »** : 12 bentos complets non publiés,
  mesurés, mais c'est l'objet du chantier 18, qui les publierait sans rien
  notifier. Deux réponses à la même question valent moins qu'une.
- **La zone de notifications dans l'app** : chantier 24, qui dépend du 22.
- **Les notifications de likes et commentaires** : chantier 22.
- **Le compte récupérable** : chantier 28, qui supprimera à la racine le
  problème des jetons orphelins.

---

## 4. Ce que disent le code, la base et les documentations

### 4.1 Méthode

- Code lu sur `main` à `76adba2`, chaque constat porte son fichier et sa ligne.
- Production lue en `GET` seulement, clé anonyme d'abord, clé de service
  ensuite pour ce que la RLS masque. Aucun `POST`, `PATCH` ni `DELETE`.
- Documentation d'Expo et guidelines d'Apple **ouvertes le jour même**, pas
  citées de mémoire. Les extraits ci-dessous sont copiés de la source.

### 4.2 Rien n'existe, et c'est vérifié jusqu'au verrou

`expo-notifications`, `expo-device` et `expo-server-sdk` sont absents des six
`package.json` du dépôt, de `pnpm-lock.yaml`, et de `node_modules` : **pas même
en dépendance transitive.**

`apps/mobile/app.json`, 88 lignes : aucune section `notification`, aucun plugin
`expo-notifications`, aucun `googleServicesFile`. Les quatre plugins déclarés
sont `expo-router`, `expo-font`, `expo-secure-store` et `expo-splash-screen`.

Côté natif, dans des dossiers **gitignorés** donc régénérés à chaque
`prebuild` :

```
ios/MonBentoPop/MonBentoPop.entitlements   associated-domains seulement
                                           pas d'aps-environment
ios/MonBentoPop/Info.plist:50              NSFaceIDUsageDescription seulement
                                           pas d'UIBackgroundModes
android/.../AndroidManifest.xml:2-6        INTERNET, VIBRATE, stockage ≤ 32,
                                           SYSTEM_ALERT_WINDOW
                                           pas de POST_NOTIFICATIONS
```

Aucune table de jetons dans les 26 migrations. Aucun envoi : zéro occurrence
de `exp.host` dans tout le dépôt.

### 4.3 Trois briques réutilisables, déjà éprouvées en production

**Le canal sortant existe.** `pg_net` est installé
(`20260911000000_revalidate_landing_on_publish.sql:23`) et trois déclencheurs
s'en servent, tous selon le même gabarit : secret lu dans
`vault.decrypted_secrets`, `net.http_post` asynchrone,
`timeout_milliseconds := 3000`, et un `exception when others then return
coalesce(new, old)` qui garantit qu'un appel raté n'empêche jamais l'écriture.

| Déclencheur | Table | Fichier |
| --- | --- | --- |
| `bentos_revalidate_landing` | `bentos` | `20260916120000:124` |
| `editions_revalidate_landing` | `editions` | `20260917120000:103` |

**Mesuré en production le 17 septembre 2026, en lecture seule** : `pg_net`
0.20.0 installé, `bentos_revalidate_landing` et `editions_revalidate_landing`
actifs, les secrets `landing_base_url` et `landing_revalidate_token` présents,
et trois appels sortants réussis (200) le 15 septembre, les seuls que `pg_net`
conserve encore. `pg_cron` est disponible (1.6.4), pas installé.

**Les deux événements ont leur point d'accroche.** `items_touch_lifecycle_on_update`
(`20260528120000_catalog_status_and_moderation.sql:126`) pose déjà
`validated_at` et `rejected_at` : c'est là que naît l'information. ~~Et
`editions_revalidate_landing` se déclenche déjà à la sortie d'une édition.~~
**Corrigé le 17 septembre 2026, l'après-midi** : il se déclenche quand l'équipe
écrit l'édition (`after insert or update or delete`, `20260917120000:104-106`),
pas quand sa date de sortie passe. Rien dans la base ne réagit au passage de
l'heure : c'est l'objet de D10.

**Une table par personne existe déjà comme modèle.** `public.user_telemetry`
(`20260915000000_close_privilege_gaps.sql`) porte `user_id`, `platform` et
`app_version`, avec ses `revoke` : la table de jetons s'alignera sur sa forme.

**Un point d'entrée HTTP authentifié existe aussi comme modèle** :
`apps/landing/src/app/api/revalidate/route.ts:19-29`, jeton porteur comparé en
temps constant.

### 4.4 Trois obstacles durs

**Une build native, obligatoire.** `expo-notifications` absent du verrou, et
les dossiers natifs gitignorés : aucune mise à jour à distance ne peut ajouter
ça. Le chantier 17 ne sort donc qu'avec une build, ce qui est précisément
pourquoi il est dans le même paquet que le 13.

**Aucun précédent de permission à l'exécution.** Recherche exhaustive sur
`apps/mobile` : `requestPermission`, `PermissionsAndroid`, `usePermissions`,
`expo-camera`, `expo-image-picker` rendent **zéro résultat**. L'app ne demande
strictement rien aujourd'hui. Il n'y a rien à copier, et la seule chaîne de
permission iOS présente, `NSFaceIDUsageDescription`, vient d'`expo-secure-store`
et n'est jamais déclenchée.

**Aucune surface de réglage.** Recherche de `Switch`, `toggle`, `preference`
sur `apps/mobile/app` et `apps/mobile/src/components` : **zéro résultat.** Pas
un interrupteur dans toute l'app. Or la règle 4.5.4 exige un retrait dans
l'app. Il faut donc créer cette surface de zéro, et c'est un lot à part
entière.

### 4.5 Ce que disent Expo et Apple, copié de la source

**Expo, le 17 septembre 2026** :

> TOO_MANY_REQUESTS: You are exceeding the request limit of 600 notifications
> per second per project.

et, sur la même page :

> We recommend checking push receipts 15 minutes after sending your push
> notifications. […] push receipts are cleared after 24 hours.

Trois conséquences qui décident de l'architecture :

1. **Le SDK qui fait le travail est du Node.** `expo-server-sdk-node`, maintenu
   par Expo, gère la limite de 600/s, la compression gzip, six connexions
   simultanées au plus et les reprises exponentielles. Le réécrire en PL/pgSQL
   serait refaire tout cela à la main.
2. **Les accusés de réception se relisent en différé**, quinze minutes plus
   tard, et ils sont effacés à 24 heures. Ce sont eux, et eux seuls, qui
   révèlent `DeviceNotRegistered`. Il faut donc un travail planifié.
3. **`pg_cron` n'est pas installé.** Les seules extensions du projet mobile
   sont `uuid-ossp`, `pg_trgm` et `pg_net`. Le travail planifié ne peut donc
   pas vivre dans Postgres sans ajouter une extension.

**Apple, règle 4.5.4, copiée mot pour mot** :

> Push Notifications must not be required for the app to function, and should
> not be used to send sensitive personal or confidential information. Push
> Notifications should not be used for promotions or direct marketing purposes
> unless customers have explicitly opted in to receive them via consent
> language displayed in your app's UI, and you provide a method in your app
> for a user to opt out from receiving such messages.

« Ton item est validé » répond à un geste : ce n'est ni une promotion ni du
marketing direct. « Une nouvelle édition est sortie » s'en approche assez pour
qu'on applique le régime strict sans discuter : accord explicite, formulé dans
l'app, et retrait possible depuis l'app.

**Le simulateur et l'émulateur, vérifiés à la source le 17 septembre 2026,
l'après-midi.** La page d'installation des notifications d'Expo indique qu'on
peut les tester sur un émulateur Android doté des services Google Play, et sur
un simulateur iOS à partir d'Xcode 14, macOS 13 et iOS 16
([source](https://docs.expo.dev/push-notifications/push-notifications-setup/)).
Les notes de version d'Xcode 14 précisent que, sur un Mac Apple silicon ou à
puce T2, le simulateur reçoit les notifications distantes par l'environnement
*sandbox* d'APNs, avec des jetons propres au couple simulateur et Mac, de
longueur variable
([source](https://developer.apple.com/documentation/xcode-release-notes/xcode-14-release-notes)).
Un compte développeur Apple payant reste nécessaire pour la clé.

Ce Mac : Apple silicon, macOS 26.6, Xcode 26.4.1, simulateur iOS 26.4, et deux
émulateurs avec Google Play, Pixel 8 (Android 37) et Pixel Tablet (Android 35).
Deux conséquences : la recette de §7.3 se fait avant la fusion, et `token` ne
suppose aucune longueur.

### 4.6 La télémétrie ne voit qu'un appareil, et ça dépasse ce chantier

```
public.user_telemetry : 1 ligne
  app_version 1.2.0 · platform ios · vue il y a 2 jours
```

Une seule, pour 61 comptes et 27 bentos publiés. L'explication est dans
l'historique : la télémétrie est arrivée le **12 septembre** (`d77c82e`), et la
version publique sur l'App Store est la **1.1, sortie le 7**. Les appareils du
parc réel sont antérieurs et ne remontent rien.

**Deux conséquences, dont une hors de ce chantier.**

- Ici : on ne peut pas estimer combien de personnes recevraient une
  notification, ni quelle part du parc supporte quoi. Toute prévision de
  portée serait inventée.
- Ailleurs, et c'est plus grave : **l'adoption de la 1.3.0, que la migration B
  du chantier 16 attend, n'est pas mesurable par ce moyen.** À trancher
  séparément, cf. §12.

> **Corrigé le 17 septembre 2026.** La migration B n'attendait aucune adoption :
> aucune version publiée ne lit l'embed dont elle change la forme. Elle est
> appliquée en production depuis ce jour, cf.
> [le chantier 13](./UX-13-BENTO-HEBDOMADAIRE.md), §6.2. Et la 1.3.0 ne sera
> pas publiée : la sortie store attend la fin de tous les chantiers.

### 4.7 Ce qui ne bouge pas

- Le fonctionnement de l'app sans aucune autorisation. C'est la règle 4.5.4,
  et c'est aussi la seule position tenable : l'app se sert très bien en
  silence aujourd'hui.
- Les trois déclencheurs de purge de la landing, qui gardent leur gabarit.
- `user_telemetry`, sa forme et ses droits.
- La landing, qui **ne reçoit aucune clé de service** : c'est une règle du
  projet, et elle décide de §6.2.

---

## 5. Design

### 5.1 Les deux notifications, et rien d'autre

| Type | Déclencheur | Texte | Tap ouvre | Régime |
| --- | --- | --- | --- | --- |
| `item_moderated` | `items.status` passe à `validated`, `merged` ou `rejected` (D12) | « *Titre* est validé, ta case est en ligne. », avec le titre de l'item conservé pour une fusion, ou « *Titre* n'a pas été retenu. » avec la raison si elle existe | le composer, sur la case concernée | transactionnel |
| `edition_released` | le travail planifié trouve une édition sortie et pas encore annoncée (D10) | « *Titre de l'édition* est sortie. » | le composer, sur l'édition | éditorial |

**Le texte nomme l'item, pas l'action.** « Interstellar est validé » dit
quelque chose ; « Un de vos items a été modéré » ne dit rien et se lit comme
un message automatique.

### 5.2 La table de jetons

```sql
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Le jeton Expo, `ExponentPushToken[…]`. Unique : un appareil qui
  -- réinstalle en obtient un nouveau, l'ancien mourra de lui-même.
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  -- Les deux réglages, séparés parce que leurs régimes le sont.
  transactional boolean not null default true,
  editorial boolean not null default false,
  created_at timestamptz not null default now(),
  -- Touché à chaque ouverture de l'app. Un jeton qu'on n'a pas vu depuis
  -- 60 jours ne reçoit plus rien.
  last_seen_at timestamptz not null default now(),
  -- Posé quand un accusé de réception dit `DeviceNotRegistered`.
  revoked_at timestamptz
);
```

**Par appareil et non par compte** : quelqu'un peut avoir deux téléphones, et
couper les notifications sur l'un sans les couper sur l'autre. C'est aussi ce
que la purge impose, puisque `DeviceNotRegistered` désigne un jeton.

**`editorial` à faux par défaut**, `transactional` à vrai : la règle 4.5.4 au
mot près.

Droits : le client insère et met à jour **ses** lignes, il ne lit jamais celles
des autres. L'envoi passe par la clé de service, côté back-office.

### 5.3 Le moment de la demande

**Juste après avoir proposé un item**, jamais au premier lancement.

À cet instant, la demande a un sens et se formule toute seule : « on te
préviendra quand il sera validé ». L'attente médiane étant de 6,9 jours, la
promesse a de la valeur. Au premier lancement, la même boîte arrive avant tout
geste, se refuse massivement, et **iOS ne la repropose jamais**.

L'accord éditorial se demande ailleurs et autrement : à la première ouverture
d'une édition, avec une phrase qui dit ce qu'on enverra et à quelle fréquence.
Deux demandes distinctes, parce que deux régimes.

### 5.4 La surface de réglage, qui n'existe pas encore

Une section **Notifications** dans `app/(tabs)/profile.tsx`, entre « À propos »
et « Compte », avec deux interrupteurs :

- **Mes items** : quand l'équipe valide ou refuse ce que j'ai proposé.
- **Les éditions** : quand une nouvelle édition sort.

C'est le premier interrupteur de l'app. Il faut donc créer le composant, et
tenir la même exigence que le reste : cible tactile d'au moins 44 points,
`accessibilityRole="switch"`, état annoncé, et un comportement qui survit à la
plus grande taille de police système.

**Couper un type ne retire pas l'autorisation système**, et l'inverse non plus.
L'écran doit dire lequel des deux bloque, sinon on coupe dans l'app et on ne
comprend pas pourquoi rien ne change, ou on refuse au système et l'app affiche
deux interrupteurs qui ne servent à rien.

---

## 6. Contrat technique

### 6.1 Le chemin d'une notification

```
  items.status → 'validated', 'merged' ou 'rejected'
        │
        │  trigger items_notify_moderation    (Postgres)
        ▼
  net.http_post  →  POST /api/push  (back-office)     jeton porteur, coffre
        │
        │  expo-server-sdk-node : débit, gzip, reprises
        ▼
  https://exp.host/--/api/v2/push/send
        │
        ▼
  push_tickets : un ticket par envoi, relu plus tard
```

```
  pg_cron, toutes les 5 minutes                     (Postgres, D10)
        │
        │  push_tick(), inerte sans les secrets de coffre
        ▼
  net.http_post  →  POST /api/push/tick  (back-office)
        │
        ├─ éditions sorties, pas encore annoncées  →  envoi  →  editions.announced_at
        │
        └─ tickets de plus de 15 minutes  →  accusés de réception
                 │
                 └─ DeviceNotRegistered  →  push_tokens.revoked_at
```

Le déclencheur ne fait **que** poster un événement : il n'ouvre pas de
connexion à Expo, ne lit pas de jeton, ne décide de rien. Il suit le gabarit
des trois déclencheurs existants, échec silencieux compris, parce qu'une
notification ratée ne doit jamais empêcher une validation d'item. Le travail
planifié suit la même règle : `push_tick()` ne fait que poster un appel, et
c'est le back-office qui décide.

### 6.2 Pourquoi le back-office, et pas la landing

La landing se redéploie à la fusion, ce qui serait commode. Mais elle **ne
détient que la clé anonyme** du projet mobile
(`apps/landing/src/lib/supabase/mobile.ts:41`), et lire les jetons d'un compte
comme les révoquer demande la clé de service. Lui donner cette clé violerait
une règle du projet : jamais de service-role sur la landing, qui est exposée
à Internet.

Le back-office la détient déjà (`apps/admin/src/lib/supabase/mobile.ts`), n'est
pas public, et peut faire tourner une tâche planifiée.

⚠️ **Le prix à payer, et il est réel : le back-office se redéploie à la main
sur Coolify.** Une notification qui cesse de partir parce que personne n'a
redéployé ne se verrait pas. La réponse est en §7.3 : un contrôle de santé qui
dit la date du dernier envoi réussi, visible sur le tableau de bord.

### 6.3 Les variables d'environnement Coolify

| Variable | Où | Portée | Pourquoi |
| --- | --- | --- | --- |
| `PUSH_WEBHOOK_TOKEN` | back-office | **runtime** | Le jeton que le déclencheur présente. Lu par la route à chaque appel, donc runtime suffit et une rotation ne demande pas de rebuild |
| `EXPO_ACCESS_TOKEN` | back-office | **runtime** | Facultatif chez Expo, mais il ferme l'envoi à qui aurait volé un jeton d'appareil. Lu au moment de l'envoi |

Les deux sont **runtime**, aucune n'est `NEXT_PUBLIC_`. C'est important :
une `NEXT_PUBLIC_` posée au runtime est ignorée en silence, et une variable
serveur posée au build fige sa valeur dans l'image.

Côté Supabase, deux secrets de coffre, comme ceux de la landing :

```sql
select vault.create_secret('https://<back-office>', 'push_webhook_url');
select vault.create_secret('<le même jeton>',       'push_webhook_token');
```

Ils se posent **dès que l'envoi est déployé** (D11). Sans eux, le déclencheur
et `push_tick()` ne font rien : la table, le déclencheur et le travail planifié
peuvent donc précéder l'envoi en production sans aucun effet.

### 6.4 Les préalables qui prennent du délai

- **Une clé APNs** (`.p8`) depuis le compte développeur Apple, avec son
  identifiant de clé et l'identifiant d'équipe. Elle se téléverse dans les
  identifiants EAS.
- **Un compte de service FCM** (JSON) depuis la console Firebase, projet
  Android `com.bentopop.mobile`, également téléversé dans EAS.

Sans ces deux-là, **rien ne se teste**, pas même au simulateur. ~~iOS ne
délivre aucune notification distante à un simulateur sans certificat, et
Android en émulateur exige les services Google Play.~~ **Corrigé le 17
septembre 2026** : avec eux, le simulateur iOS et les émulateurs Android de ce
Mac reçoivent les notifications, cf. §4.5.

### 6.5 Garde-fous

- Le déclencheur n'envoie **que** si l'item a un `submitted_by`, et jamais à
  l'administrateur qui vient de valider.
- L'envoi filtre sur `revoked_at is null` et `last_seen_at > now() - 60 days`.
- Le type éditorial filtre en plus sur `editorial = true`.
- Un accusé `DeviceNotRegistered` pose `revoked_at`, il ne supprime pas la
  ligne : on veut pouvoir compter les appareils perdus.
- La route refuse tout appel sans jeton porteur valide, comparé en temps
  constant, comme `/api/revalidate`.
- Sans les secrets `push_webhook_url` et `push_webhook_token`, le déclencheur
  et `push_tick()` ne postent rien.
- Une édition ne s'annonce qu'une fois, et seulement dans les 24 heures qui
  suivent sa sortie : une panne ne rattrape pas une édition de la semaine
  précédente, et la mise en service n'annonce pas les éditions déjà sorties.
- Un jeton déjà connu qu'un autre compte enregistre change de propriétaire, et
  ses réglages reviennent aux valeurs par défaut : l'accord éditorial ne passe
  pas d'un compte à l'autre.

---

## 7. Stratégie de test et de recette

### 7.1 Tests unitaires

- Le choix des destinataires : à partir d'un événement et d'un jeu de jetons,
  qui reçoit. Les cas qui comptent : jeton révoqué, jeton périmé, type coupé,
  auteur absent, et l'administrateur qui valide.
- La rédaction du texte : un titre long, un titre vide, une raison de refus
  absente, des guillemets dans le titre.
- La lecture d'un accusé de réception : `ok`, `DeviceNotRegistered`,
  `MessageTooBig`, une erreur inconnue.

### 7.2 Tests de base, sur Supabase local

Un `check-push.sql` sur le modèle de `check-editions.sql` : transaction
annulée, témoin compris.

1. Un client ne lit que ses propres jetons.
2. Un client ne peut pas poser `revoked_at`, ni changer `user_id`.
3. Valider un item sans `submitted_by` ne déclenche rien.
4. Le déclencheur ne lève pas sans secret de coffre, et la validation passe.
5. Deux appareils du même compte reçoivent deux lignes distinctes.
6. Un jeton déjà connu, enregistré par un autre compte, change de propriétaire
   au lieu d'échouer, et ses réglages reviennent aux valeurs par défaut.
7. Avec les secrets, modérer un item proposé met exactement un appel en file
   (`net.http_request_queue`), avec le bon type et le bon item.
8. Proposer un item avec un compte authentifié, comme le font la 1.1 et la
   0.1.0, passe toujours.

### 7.3 Recette

~~**Sur appareil réel, obligatoirement.** C'est le seul chantier du lot où le
simulateur ne sert à rien : iOS ne délivre pas de notification distante à un
simulateur, et l'émulateur Android exige les services Google Play.~~

**Corrigé le 17 septembre 2026, l'après-midi : au simulateur iOS et à
l'émulateur Android, avant la fusion**, cf. §4.5. La recette sur appareil réel
se fait seulement à la sortie, au chantier 29 : build de production,
environnement de production d'APNs, écran verrouillé, désinstallation réelle.

- Proposer un item, accorder l'autorisation, faire valider depuis le
  back-office, recevoir la notification en moins d'une minute.
- Taper dessus : le composer s'ouvre sur la bonne case.
- Refuser l'autorisation : l'app fonctionne exactement pareil, et aucun écran
  ne la redemande.
- Couper « Mes items » : plus rien n'arrive, et « Les éditions » continue.
- Désinstaller, attendre, envoyer : l'accusé finit par dire
  `DeviceNotRegistered`, et le jeton se révoque. Expo ne promet aucun délai :
  si l'accusé n'arrive pas pendant la recette, le point part au chantier 29.
- Un contrôle de santé sur le tableau de bord du back-office affiche la date
  du dernier envoi réussi et celle du dernier passage du travail planifié.

---

## 8. Plan de développement

### Lot 0 · Les préalables, qui ne m'appartiennent pas

La clé APNs et le compte de service FCM, téléversés dans EAS. **Rien ne se
reçoit sans eux, même au simulateur.** Ils ne bloquent pas le lot 1, mais la
recette des lots 2 à 5. À lancer dès maintenant, le délai est administratif.

### Lot 1 · La base : jetons, tickets, déclencheur

Une migration, développée et prouvée sur Supabase local. **Rien de visible.**

- `push_tokens` (§5.2), sa RLS et ses `grant` colonne : le client lit ses
  lignes et règle `transactional` et `editorial`, rien d'autre.
- `register_push_token(token, platform)`, en `security definer` : elle
  enregistre ou rafraîchit le jeton de l'appareil, touche `last_seen_at`, lève
  `revoked_at`, et reprend un jeton qu'un autre compte détenait (§6.5). Une
  insertion directe ne suffit pas : une session anonyme perdue recrée un compte
  sur le même appareil, et l'unicité du jeton ferait échouer l'enregistrement.
- `push_tickets` : un ticket Expo par envoi, pour relire son accusé de
  réception. Aucun droit client.
- `editions.announced_at`, posé par le back-office une fois l'édition annoncée.
- `items_notify_moderation`, déclencheur `after update of status` sur une
  validation, une fusion ou un refus, qui poste l'événement au back-office
  selon le gabarit de §4.3, inerte sans secret.
- `push_tick()`, que `pg_cron` appellera au lot 3, inerte sans secret.
- `check-push.sql`, les contrôles de §7.2.

**Compatibilité avec la 1.1 et la 0.1.0**, prouvée avant d'appliquer : aucune
ne lit `push_tokens`, `push_tickets` ni `editions`, créées après elles, et les
clients ne peuvent plus modifier un item depuis le 15 septembre
(`20260915000000_close_privilege_gaps.sql:213`) : le déclencheur ne part que
d'une modération du back-office. Appliquée en production à la validation du
lot, sur feu vert.

**Fait le 17 septembre 2026, en local**, sur une base rejouée depuis les
migrations : `20260917140000_push_notifications.sql` et `check-push.sql`, 25
contrôles tenus. Quatre défauts introduits exprès sont tous attrapés : droit
client sur `revoked_at`, déclencheur sans condition d'auteur, accord éditorial
qui suit le jeton, fusion oubliée. `check-editions.sql` tient ses 21
contrôles, `check-privileges.ts` et `check-types.ts` sont conformes, parcours
des versions publiées compris.

**Appliqué en production le 17 septembre 2026**, par le connecteur Supabase,
depuis le fichier du dépôt. Vérifié en lecture seule juste après : les deux
tables sous RLS et vides, le client authentifié limité à la lecture et aux
deux interrupteurs, l'anonyme refusé (`42501`), les quatre fonctions et le
déclencheur en place, **aucun secret `push_*` dans le coffre**, donc la chaîne
inerte. Les lectures des versions publiées rendent exactement la même chose
qu'avant : 277 items validés, 27 bentos publiés, le bento de dark_hifus lu
comme la 1.1 le lit, la page publique en 200.

### Lot 2 · L'app enregistre son jeton

`expo-notifications` et son plugin, la demande d'autorisation juste après
avoir proposé un item (D5), l'appel à `register_push_token` à chaque
ouverture. Une build native, recettée au simulateur et à l'émulateur.

### Lot 3 · L'envoi, et la chaîne branchée en production

Les routes `/api/push` et `/api/push/tick` du back-office,
`expo-server-sdk-node`, les tickets, les accusés, la révocation, l'annonce des
éditions. La migration qui installe `pg_cron` et programme `push_tick()`
toutes les 5 minutes (D10). Le contrôle de santé. Puis, l'envoi déployé, les
secrets de coffre et les variables Coolify : la chaîne tourne en production
sans destinataire (D11).

### Lot 4 · Les réglages, et le tap

La section Notifications du profil, deux interrupteurs, le premier composant
`Switch` de l'app. Le tap qui ouvre le bon écran.

### Lot 5 · Recette et documents

La recette de §7.3, au simulateur iOS et à l'émulateur Android. Les pièges
dans `RECETTE-MOBILE.md`, ce qui attend un appareil réel versé au chantier 29,
la roadmap, la DoD.

---

## 9. Livraison

- Une branche, une PR, fusionnée après CI verte.
- ~~**Même sortie store que les chantiers 13, 21 et 29**, décidée le 16
  septembre.~~ **Une seule sortie store, quand tous les chantiers de la roadmap
  sont terminés et recettés**, décidée le 17 septembre 2026. D'ici là, rien de
  ce chantier n'atteint les versions publiques, la 1.1 et la 0.1.0.
- **Ses migrations s'appliquent en production au fur et à mesure**, décidé le
  17 septembre 2026 : chacune doit rester compatible avec la 1.1 et la 0.1.0
  pendant toute la durée des chantiers, et cette compatibilité se prouve avant
  de l'appliquer.
- ~~Les deux secrets de coffre et les deux variables Coolify se posent avant la
  première validation d'item suivant le déploiement.~~ **Les deux secrets de
  coffre et les deux variables Coolify se posent dès que l'envoi est
  déployé** : PR fusionnée et back-office redéployé (D11). Le travail planifié
  tourne déjà, inerte jusque-là.

---

## 10. Definition of Done

1. Un item validé prévient son auteur en moins d'une minute, au simulateur iOS
   et à l'émulateur Android ; sur appareil réel à la recette de sortie (29).
2. Un item refusé aussi, avec sa raison quand elle existe.
3. Une édition qui sort prévient ceux qui l'ont accepté, et personne d'autre.
4. Un tap ouvre l'écran concerné.
5. Chaque type se coupe depuis l'app, et la coupure tient au redémarrage.
6. Refuser l'autorisation ne change rien au fonctionnement de l'app.
7. Un jeton signalé `DeviceNotRegistered` cesse d'être utilisé en moins de
   24 heures.
8. Les contrôles de `check-push.sql` passent sur Supabase local.
9. Le tableau de bord du back-office montre la date du dernier envoi réussi et
   celle du dernier passage du travail planifié.
10. Aucune notification promotionnelle n'est envoyée sans accord explicite,
    et le retrait est accessible dans l'app.
11. Les migrations sont appliquées en production, leur compatibilité avec la
    1.1 et la 0.1.0 prouvée avant.
12. La chaîne tourne en production sans destinataire : le contrôle de santé
    montre le travail planifié passer toutes les 5 minutes.

---

## 11. Décisions

| # | Décision | Raison |
| --- | --- | --- |
| **D1** | L'envoi part d'un déclencheur SQL vers le back-office, qui appelle Expo | Le gabarit `pg_net` est éprouvé trois fois en production, et `expo-server-sdk-node` gère déjà le débit de 600/s, la compression et les reprises |
| **D2** | Le back-office et non la landing | La landing n'a que la clé anonyme, et lui donner la clé de service violerait une règle du projet. Le prix : redéploiement à la main, compensé par le contrôle de santé |
| **D3** | Pas de fonction Edge Supabase | Deno, donc sans le SDK Node. Et une fonction Edge a déjà été retirée de ce projet parce qu'elle imposait un artefact à déployer à part |
| **D4** | Deux notifications seulement : item modéré, édition sortie | Les deux ont une justification mesurée. « Bento prêt à publier » est l'objet du chantier 18, qui le résoudrait sans notifier |
| **D5** | L'autorisation se demande juste après avoir proposé un item | C'est le moment où la promesse a du sens, l'attente médiane étant de 6,9 jours. iOS ne repropose jamais la boîte après un refus |
| **D6** | Transactionnel actif d'emblée, éditorial éteint | La règle 4.5.4 au mot près : accord explicite pour ce qui s'approche de la promotion |
| **D7** | Jetons purgés sur accusé de réception, et périmés à 60 jours | `DeviceNotRegistered` n'arrive qu'« un temps indéfini » après la désinstallation, d'après Expo. La péremption couvre le reste |
| **D8** | Un jeton par appareil, pas par compte | Deux téléphones se règlent séparément, et `DeviceNotRegistered` désigne un jeton |
| **D9** | Les deux variables Coolify sont **runtime** | Une `NEXT_PUBLIC_` posée au runtime est ignorée en silence, une variable serveur posée au build fige sa valeur dans l'image |
| **D10** | Le travail planifié vit dans Supabase : `pg_cron` appelle le back-office toutes les 5 minutes | Choisi le 17 septembre, l'après-midi. Un déclencheur ne réagit pas au passage de l'heure. Tout est versionné dans le dépôt, rien à régler à la main dans Coolify, et `pg_cron` 1.6.4 est disponible en production |
| **D11** | La chaîne se branche en production dès que l'envoi est déployé, sans attendre la sortie | Choisi le 17 septembre, l'après-midi. Elle tourne des mois sans destinataire, aucune app publique n'enregistrant d'appareil : on voit qu'elle marche bien avant la sortie |
| **D12** | Une fusion prévient l'auteur comme une validation, avec le titre de l'item conservé | Choisi le 17 septembre, l'après-midi. Mesuré en production : sur 146 items proposés et modérés, 123 validés, 19 fusionnés, 4 refusés. Pour l'auteur, sa case est remplie |

---

## 12. Suivis

- **L'adoption d'une version n'est pas mesurable.** La télémétrie est
  arrivée le 12 septembre, la version publique est la 1.1 du 7 septembre : le
  parc réel ne remonte rien. ~~La migration B du chantier 16 attend un chiffre
  qui ne viendra pas. À trancher autrement, et ce n'est pas ce chantier.~~
  **Corrigé le 17 septembre 2026** : la migration B n'attendait aucun chiffre,
  elle est appliquée en production depuis ce jour, cf. §4.6.
- **Le commentaire « pas de notification user en V1 »** se retire de
  `catalogue/actions.ts:103` et de trois endroits de
  `docs/MON-BENTO-POP-CATALOG.md`, lignes 126, 164 et 322.
- **Le contrôle de santé** est le premier du back-office. S'il en vient
  d'autres, en faire un écran plutôt qu'une ligne.
- **La zone de notifications dans l'app**, chantier 24, réutilisera la table
  de jetons et les deux types.
- **Le compte récupérable**, chantier 28, supprimera le problème des jetons
  orphelins à sa racine.
