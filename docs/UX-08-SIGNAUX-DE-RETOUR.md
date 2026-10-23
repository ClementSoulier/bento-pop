# Chantier 8 · Signaux de retour : les visites et le rappel

> Spécification écrite le 23 octobre 2026, à partir du code de `main`
> (`6f0c93a`) et de lectures sur la production, en lecture seule. Aucune
> écriture en production.
>
> **Arbitrages rendus le 23 octobre 2026**, les dix premiers de §11, les six
> suivants pris par la spécification et ouverts à la contestation. En résumé :
> une visite, c'est ouvrir la page d'un bento publié, dans l'app ou sur
> bento-pop.com, jamais le défilement de La table ; le compteur est public,
> toujours affiché, même à zéro, et son propriétaire peut le masquer ; le web
> compte sans traceur, une visite par personne et par jour, dès le
> déploiement. Un bento complet, entièrement validé et jamais publié propose
> un rappel quand on le quitte sans publier, ou par un lien sous le bouton :
> une seule notification, le lendemain à 18 h, programmée par le téléphone.
>
> **Lot 1 fait le 23 octobre 2026**, sur le Supabase local : la migration,
> `check-visits.sql` (43 contrôles, et 18 défauts introduits exprès tous
> attrapés), `check-privileges.ts` étendu, les types partagés, et la
> compatibilité relue sur `6426779`, le commit de la 1.1 et de la 0.1.0
> (§8, lot 1). Rien n'est appliqué en production : la migration part avec la
> PR des lots 1 et 2 (D8).
>
> **Lot 2 fait le 23 octobre 2026** : la landing compte une visite par une
> image d'un pixel, sans JavaScript, affiche le compteur à côté de la date,
> et la politique de confidentialité le décrit. Recetté en local contre le
> Supabase local (§8, lot 2).
>
> **Lot 3 fait le 23 octobre 2026** : l'app compte la visite d'une page,
> affiche le compteur sur la page et le profil, et porte « Afficher mes
> visites ». Recetté au simulateur iPhone 17 Pro et SE, et à l'émulateur
> Pixel 8, contre le Supabase local (§8, lot 3).
>
> Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md) chantier 8, [le chantier
> 1](./UX-01-PAGE-BENTO-PUBLIQUE.md) pour la page web, [le chantier
> 9](./UX-16-PLUSIEURS-BENTOS.md) pour le brouillon local, [le chantier
> 17](./UX-17-NOTIFICATIONS-PUSH.md) pour les notifications et [le chantier
> 18](./UX-18-PUBLICATION-AUTOMATIQUE.md) pour la publication à la validation.
> Même sortie store unique que tous les chantiers.

---

## 1. Intention

### 1.1 Ce que le recadrage du 15 septembre a laissé au chantier

La notification d'item validé est partie au 17, la publication à la
validation au 18, la réaction par case au 22. Le chantier 8 garde deux
choses : **le compteur de visites** et **le rappel des bentos complets
jamais publiés**. Son « fait quand » : le propriétaire d'un bento sait
combien de personnes l'ont ouvert, et quelqu'un qui a rempli toutes ses
cases sans publier est relancé.

### 1.2 Le rappel, mesuré

Relevé le 23 octobre 2026 sur la production, en lecture seule. **53 bentos**,
28 publiés, 25 non publiés, dont **13 complets** : 11 entièrement validés, 2
avec un item en attente, aucun bloqué par un refus. Les 12 autres sont
incomplets.

| Bentos complets | Publiés | Jamais publiés |
| --- | --- | --- |
| Sans proposition de leur auteur | **18**, dont 14 dans l'heure qui suit la dernière case | **0** |
| Avec une proposition de leur auteur | 10, tous plus d'un jour après, 8 plus d'une semaine après (14 jours en médiane) | **13** |

**Aucun bento complet sans proposition n'est resté non publié.** Les 13 qui
le sont portent tous un item proposé par leur auteur : ils ont attendu la
modération, puis personne n'est revenu publier. Dans la nouvelle app, ce
cas est celui des chantiers 17 et 18, qui préviennent de la validation et
publient à sa place.

Le rappel vise donc ce qui reste (D1) : **un bento complet, dont tout est
validé, jamais publié**. Deux populations :

- **Les 11 bentos d'aujourd'hui, et les 2 qui les rejoindront à la
  validation de leur item.** Ils ne peuvent pas être relancés : leurs
  auteurs ont la 1.1 ou la 0.1.0, aucun n'a de jeton de notification
  (`push_tokens` est vide), et l'app n'a pas leur email. Dix sur onze ont
  rempli leurs six cases en moins d'un quart d'heure, entre le 4 juillet et
  le 25 août, il y a 59 à 111 jours. À la sortie store, s'ils rouvrent
  l'app, le composer leur dira « Publier mon bento » et leur proposera le
  rappel (§5.3).
- **Les bentos de la nouvelle app.** Le chantier 9 a déplacé le pseudo et
  les CGU au moment de publier : c'est une marche que les versions publiées
  n'avaient pas, et qu'aucune donnée ne peut encore mesurer, le premier
  bento d'un compte restant sur le téléphone jusqu'à la publication.

### 1.3 Les visites, jamais mesurées

Rien ne compte une ouverture de bento, nulle part. La page web est rendue
en statique et régénérée toutes les 5 minutes (`revalidate = 300`,
`apps/landing/src/app/u/[pseudo]/page.tsx:29`) : même les journaux du
serveur ne voient pas les visites. La politique de confidentialité
l'affirme : aucun SDK de suivi tiers (`confidentialite/page.tsx:101`).

---

## 2. Objectif et critères de succès

Qu'un bento publié dise combien de fois on l'a ouvert, et qu'un bento prêt
ne reste pas en plan sans que son auteur l'ait voulu.

- Chaque ouverture de la page d'un bento publié compte une visite, une par
  personne, par jour et par bento.
- Le compteur se lit sur la page du bento, dans l'app et sur le web, et
  sur le profil de son propriétaire.
- Personne ne peut retrouver qui a ouvert quel bento.
- Un bento prêt et quitté sans publier propose le rappel, une fois.
- Les versions publiées ne voient rien changer.

---

## 3. Périmètre

**Dans le chantier :**

- la base : les visites, leur sel du jour et leur purge, le compteur lisible
  par tous, le réglage « Afficher mes visites », la date de première
  publication ;
- la landing : la route qui enregistre une visite, le compteur sur la page,
  la politique de confidentialité ;
- l'app : la visite à l'ouverture d'une page, le compteur sur la page et sur
  le profil, l'interrupteur, le rappel et son tap.

**Hors du chantier :**

- **une notification des visites** (D4) : elle rejoint le chantier 24, la
  zone de notifications, avec les likes ;
- **le compteur dans La table** (D14) : la barre d'actions réservée par le
  chantier 2 (`ACTIONS_HEIGHT = 0`) attend les likes du 22, qui la
  dessineront ;
- **la case d'où l'on vient**, léguée par le chantier 7 : elle relève des
  signaux par case, partis au 22 avec la réaction par case ;
- **les 11 bentos prêts de l'ancienne app** : aucun canal ne les atteint
  avant la sortie (§1.2) ;
- **l'écran de confidentialité** : il naît avec le chantier 20, qui
  accueillera l'interrupteur (D9).

---

## 4. Ce que disent le code et la base

- **Les pages d'un bento** s'ouvrent depuis La table
  (`app/(tabs)/table.tsx:87`), Trouver (`app/(tabs)/search.tsx:504`), un
  autre bento du même compte (`app/u/[pseudo].tsx:235`), un lien partagé et
  le profil du propriétaire (`app/(tabs)/profile.tsx:223`). Sur le web,
  `/u/<pseudo>` et `/u/<pseudo>/<slug>`, le second pour les bentos
  secondaires et les éditions.
- **La page web est statique** pendant 5 minutes : une visite ne peut se
  compter que depuis le navigateur, après affichage. C'est aussi ce qui
  écarte les robots d'aperçu des messageries, qui ne lisent que le HTML.
- **La landing n'a que la clé anonyme** du Supabase mobile
  (`MOBILE_SUPABASE_ANON_KEY`), côté serveur. Le chantier 17 a écarté de
  lui donner la clé de service (D2 du 17).
- **Chaque lancement de l'app ouvre une session anonyme**
  (`src/state/session.ts:71`) : toute personne qui ouvre une page dans
  l'app a un identifiant de compte.
- **Le premier bento d'un compte vit sur le téléphone** jusqu'à sa
  publication (`src/state/draft.ts:61`, chantier 9) : la base n'en sait
  rien.
- **Le composer dit déjà quand un bento est prêt** : `compose-cta.ts:158`
  rend « Publier mon bento » quand toutes les cases sont remplies, tout
  validé, rien de refusé.
- **Rien ne distingue en base un bento jamais publié d'un bento dépublié** :
  la dépublication remet `published_at` à nul. Aucune version publiée ne
  sait dépublier, la fonction étant arrivée le 13 septembre
  (`14b1b58`) quand la 1.1 date du 7 (`6426779`), et le back-office ne
  dépublie pas : les 25 bentos non publiés d'aujourd'hui ne l'ont jamais
  été.
- **`bentos` ne doit pas porter le compteur.** Toute écriture sur la table
  touche `updated_at` et appelle la revalidation de la landing
  (`bentos_revalidate_landing`). Une visite par ligne la ferait tourner à
  chaque ouverture.
- **Les versions publiées lisent `bentos` par des listes de colonnes**, mais
  le profil de la 1.1 lit `users` en `select('*')` : une colonne de plus y
  arrive, sans effet sur le code qui ne la lit pas.
- **`users` ne s'écrit que colonne par colonne** : insertion de `id`,
  `pseudo` et `terms_accepted_at`, mise à jour de la télémétrie et de
  `terms_accepted_at` (relevé en production le 23 octobre).
- **Les briques existent** : `pgcrypto` 1.3, `pg_cron` 1.6.4 et ses deux
  tâches `push-tick` et `push-purge`
  (`20260923100000_push_schedule.sql:129`), le coffre de Supabase pour les
  secrets, `expo-notifications` et ses deux canaux Android, `items` et
  `editions` (`src/lib/push-runtime.ts:60`), la phrase qui précède la boîte
  du système (D14 du 17), le tap routé par `pushTargetFromData`
  (`src/lib/push.ts:208`), l'interrupteur accessible du profil.

---

## 5. Design

### 5.1 Ce qui compte comme une visite (D2, D6, D13)

Une visite, c'est **l'affichage de la page d'un bento publié**, dans l'app
ou dans un navigateur.

| Situation | Compte |
| --- | --- |
| Page ouverte dans l'app par un autre compte | une visite par compte, par jour et par bento |
| Page ouverte dans un navigateur | une visite par empreinte, par jour et par bento |
| Page ouverte par son propriétaire, dans l'app | rien |
| Page ouverte par son propriétaire, dans un navigateur | une visite, l'empreinte ne le distinguant pas |
| Bento qui défile dans La table | rien |
| Robot d'aperçu d'une messagerie, préchargement du navigateur | rien |
| Bento non publié, introuvable | rien |

**L'empreinte du web** est l'adresse IP et le navigateur, hachés avec un
sel tiré chaque jour et détruit le lendemain ; elle n'est jamais conservée
en clair. Deux personnes derrière la même box, avec le même navigateur,
comptent une fois ; une personne qui change de réseau compte deux fois.
C'est le prix de l'absence de traceur, et c'est pourquoi le compteur dit
« visites », pas « personnes ».

**Dans l'app**, l'identifiant du compte passe par le même hachage : la base
dédoublonne sans savoir qui a ouvert quoi. Le lendemain, plus rien ne
relie une visite à quelqu'un.

### 5.2 Où se lit le compteur (D3, D7, D9)

| Où | Qui | Texte |
| --- | --- | --- |
| La page du bento, dans l'app | tout le monde | « 47 visites », à côté de la date de publication |
| La page du bento, sur le web | tout le monde | idem (`BentoPublicView.tsx:151`) |
| Le profil | le propriétaire | « En ligne · publié il y a 3 jours · 47 visites » (`profile.tsx:211`) |

« 0 visite », « 1 visite », « 2 visites » : zéro et un au singulier. Le
compteur s'affiche toujours, même à zéro (D7). Les libellés se mesurent sur
l'écran le plus étroit à la plus grande police, comme ceux du chantier 13 :
si la ligne du profil déborde, le compteur passe sur sa propre ligne.

Sur le web, la page statique porte le chiffre de son dernier rendu, vieux
de 5 minutes au plus. ~~La réponse à l'enregistrement de la visite le
remplace par le chiffre du moment, visite comprise.~~ **Depuis le lot 2** :
le chiffre reste celui du rendu, sans la visite en cours. Le remplacer
demandait du JavaScript propre à la page, ce que la page d'un bento
n'expédie pas (§8, lot 2).

### 5.3 Le rappel (D1, D5, D10, D11, D12)

Un bento est **prêt** quand le composer dit « Publier mon bento » et qu'il
n'a jamais été publié : un brouillon local l'est toujours, un bento en base
l'est si sa date de première publication est vide. Un bento dépublié n'est
jamais prêt au sens du rappel : son auteur l'a retiré.

**Trois portes, un seul accord, une seule fois par bento :**

| Porte | Quand |
| --- | --- |
| La question au départ | on quitte le composer pour un autre onglet avec un bento prêt |
| La question au départ | on revient de l'écran du pseudo ou des CGU sans avoir publié |
| Le lien | « Me le rappeler demain », sous « Publier mon bento », tant que le bento est prêt |

La question est une alerte native, comme celles du chantier 17 :

> **Ton bento est prêt**
> On te le rappelle demain s'il n'est pas publié ?
> [Oui, rappelle-moi] [Non merci]

« Oui » demande l'autorisation du système si elle manque, puis programme
le rappel. « Non merci » est retenu pour ce bento : ni la question ni le
lien ne reviennent. Quand le système ne peut plus demander (refus sur iOS,
second refus sur Android), ni la question ni le lien ne s'affichent, comme
la phrase du chantier 17. Le passage de l'app en arrière-plan ne peut rien
afficher : c'est le lien qui couvre ce départ (D10).

**Le rappel :**

| | |
| --- | --- |
| Quand | le premier 18 h qui tombe au moins 12 heures plus tard, heure du téléphone : quitté à 10 h, le lendemain à 18 h ; à 3 h du matin, le jour même à 18 h |
| Titre | « Ton bento est prêt » (18 caractères, sous les 28 que montre un titre d'après D24 du 17) |
| Texte | « Publie-le pour qu'il rejoigne La table. » ; pour un bento secondaire ou d'édition : « « *Titre* » n'attend plus que toi : publie-le pour qu'il rejoigne La table. » |
| Tap | le composer, sur ce bento, le bouton « Publier mon bento » en évidence |
| Canal Android | « Rappels », un troisième canal à côté de « Mes items » et « Les éditions » |
| Nombre | un seul, jamais renouvelé |

**Le rappel tombe** quand le bento est publié, quand il cesse d'être prêt
(une case vidée, un item remplacé par une proposition en attente), quand il
est supprimé, et quand le compte est effacé. À chaque lancement, l'app
annule les rappels programmés dont le bento n'est plus prêt.

### 5.4 Masquer ses visites (D9)

Une section **Confidentialité** dans le profil, entre « Notifications » et
« Compte », avec un interrupteur :

- **Afficher mes visites** : les autres voient combien de fois ton bento a
  été ouvert.

Allumé par défaut. Éteint, personne d'autre ne voit le chiffre, ni dans
l'app, ni sur le web, ni par l'API ; le propriétaire le voit toujours, ~~avec
« visibles par toi seul »~~ **depuis le lot 3**, sans rien de plus sur sa
ligne d'état, déjà en limite de largeur : c'est l'interrupteur qui le dit,
« Masquées : toi seul les vois. ». Les visites continuent de se compter. Le réglage
vaut pour tout le compte. Il rejoindra l'écran de confidentialité quand le
chantier 20 le créera.

---

## 6. Contrat technique

### 6.1 La base

Une migration, `2026102xxxxxxx_bento_visits.sql`.

```sql
-- Le sel du jour, tiré à la première visite du jour, détruit le lendemain.
create table public.visit_salts (
  day date primary key,
  salt bytea not null
);

-- Le dédoublonnage du jour : une ligne par visiteur haché, purgée le
-- lendemain. Rien n'y est lisible par un client.
create table public.bento_visit_keys (
  bento_id uuid not null references public.bentos(id) on delete cascade,
  day date not null,
  key_hash bytea not null,
  primary key (bento_id, day, key_hash)
);

-- Ce qui reste : un nombre par bento, par jour et par source.
create table public.bento_visit_days (
  bento_id uuid not null references public.bentos(id) on delete cascade,
  day date not null,
  source text not null check (source in ('app', 'web')),
  visits int not null default 0,
  primary key (bento_id, day, source)
);

alter table public.users
  add column show_visits boolean not null default true;
alter table public.bentos
  add column first_published_at timestamptz;
```

- **Le jour** est celui de Paris, `(now() at time zone 'Europe/Paris')::date`.
- **Le hachage** : `extensions.digest(salt || identité, 'sha256')`, avec
  pour identité l'identifiant du compte dans l'app, l'adresse IP et le
  navigateur sur le web.
- **`record_bento_visit_app(p_bento uuid) returns int`**, `security
  definer`, accordée à `authenticated` seulement. Ne compte que si le bento
  est publié et que l'appelant n'en est pas le propriétaire ; insère la
  clé, et n'incrémente le jour que si l'insertion a eu lieu. Rend le
  compteur tel que l'appelant a le droit de le voir.
- **`record_bento_visit_web(p_bento uuid, p_fingerprint text, p_secret
  text) returns int`**, `security definer`, accordée à `anon`. Refuse tout
  appel dont le secret ne correspond pas à `bento_visit_secret`, dans le
  coffre (D15). Même règle de comptage, source `web`.
- **`bento_visit_count(p_bento uuid) returns int`**, accordée à `anon` et
  `authenticated` : la somme des jours, ou nul si le bento n'est pas publié
  ou que son propriétaire masque ses visites, sauf pour le propriétaire.
- **`first_published_at`** est posée par un déclencheur `before insert or
  update` quand `published_at` passe à une valeur et qu'elle est vide.
  Rattrapage : `first_published_at = published_at` pour les 28 bentos en
  ligne, exact pour la raison de §4. Aucun droit d'écriture client sur
  cette colonne (D16).
- **`grant update (show_visits) on public.users to authenticated`**, sous la
  RLS existante, qui ne laisse écrire que sa propre ligne.
- **La purge** : une tâche `visits-purge`, `40 3 * * *`, efface les clés et
  les sels des jours passés. Seuls les nombres restent.
- **Aucune lecture des trois tables** pour `anon` et `authenticated` : tout
  passe par les trois fonctions.

### 6.2 La landing

> **Revu au lot 2** : une image d'un pixel plutôt qu'un appel `POST` depuis
> un composant client, et la dernière adresse de `X-Forwarded-For` plutôt
> que la première. Ce qui suit décrit ce qui est construit.

- **`GET /api/bento-opened?b=<id>&d=<jour>`**, appelée par `<VisitBeacon>`,
  une image d'un pixel que rend la page, composant serveur. Le jour de
  Paris dans l'adresse n'est qu'une clé de cache, que la route ne lit pas :
  Safari ressert l'image depuis son cache mémoire, `no-store` ou pas, et ne
  la redemanderait pas le lendemain (recette du lot 5). Lit l'adresse IP
  (`X-Forwarded-For`, **dernière** valeur, celle que pose le proxy de
  Coolify ; les premières peuvent venir du visiteur) et le navigateur,
  écarte les robots connus et les préchargements (`Sec-Purpose: prefetch`),
  puis appelle `record_bento_visit_web` avec le secret. Rend toujours le
  même GIF transparent, `Cache-Control: no-store`, et dit dans
  `X-Bento-Visit` ce qu'est devenue la visite : `recorded`, `invalid`,
  `bot`, `prefetch`, `no-address`, `disabled` ou `error`. Le nom évite les
  motifs des listes de blocage (`track`, `analytics`, `collect`, `beacon`,
  `pixel`).
- **`readBentoVisits`** lit `bento_visit_count` à part de
  `lookupPublicBento`, que les images de partage appellent aussi sans en
  avoir l'usage. En échec, elle rend `null` et la page s'affiche sans
  compteur, ce qui couvre une landing déployée avant la migration.
- **Une variable d'environnement** : `BENTO_VISIT_SECRET`, sur l'app
  **landing** dans Coolify, **au runtime** (D9 du 17 : une variable serveur
  posée au build se fige dans l'image). Même valeur que le secret du coffre
  du Supabase mobile, tirée dans un fichier par l'agent et posée par
  Clément, aux deux endroits.
- **`/confidentialite`** : un paragraphe sur le compteur de visites, ce qui
  est haché, pourquoi, et la durée de conservation (les clés un jour, les
  nombres tant que le bento existe), avant le premier comptage en
  production.

### 6.3 L'app

- **La page d'un bento** (`app/u/[pseudo].tsx`, `app/u/[pseudo]/[slug].tsx`)
  appelle `record_bento_visit_app` une fois par affichage d'un bento
  publié, ~~sauf pour son propriétaire, qui lit `bento_visit_count`~~
  **son propriétaire compris depuis le lot 3** : la base ne compte jamais
  pour lui et lui rend son total, une seule règle suffit, « la page compte,
  le profil lit ». Un échec ne se réessaie pas : une visite perdue vaut
  mieux qu'une page qui attend.
- **Le profil** ajoute le compteur à la ligne d'état et la section
  Confidentialité.
- **`src/lib/visits.ts`** (lot 3) : `loadBentoVisits`, ses options React
  Query (`refetchOnMount: 'always'`, aucun réessai, la valeur en cache
  affichée en attendant), `withVisits` pour la ligne d'état et
  `writeShowVisits`. Le libellé, `formatVisits`, vit dans
  `@bento-pop/supabase-mobile/bento`, partagé avec la landing.
- **`src/lib/ready-reminder.ts`**, pur et testé sous `node:test` comme
  `push.ts` : un bento est-il prêt, quelle porte s'ouvre, à quelle heure
  tombe le rappel, faut-il l'annuler.
- **Le branchement** sur `expo-notifications` dans `push-runtime.ts` : un
  canal « Rappels », créé avec les deux autres avant toute demande ; la
  programmation, avec un identifiant stable par bento
  (`ready-bento:<id>`, `ready-bento:draft` pour le brouillon) ; l'annulation
  et la réconciliation au lancement.
- **La mémoire « une fois par bento »** dans `AsyncStorage`, comme l'accord
  éditorial du 17.
- **`PushTarget`** gagne `{ kind: 'ready-bento'; bento: string }`, vérifié
  par `pushTargetFromData` comme les deux autres.

### 6.4 Garde-fous

- **La clé anonyme est publique**, dans chaque copie de l'app : seule, elle
  n'enregistre aucune visite web (D15). Une visite d'app exige une session,
  et une seule compte par compte et par jour : gonfler un compteur demande
  de créer des comptes, ce que Supabase limite par adresse.
- **Le compteur ne fait jamais attendre une page** : l'enregistrement part
  après l'affichage et son échec ne se voit pas.
- **Les versions publiées** : trois tables nouvelles qu'elles ignorent, une
  colonne sur `bentos` qu'elles ne lisent pas, une sur `users` que le
  `select('*')` de la 1.1 reçoit sans s'en servir. La compatibilité se
  prouve avant d'appliquer, comme pour la migration du 18 : les requêtes
  des versions publiées relues dans l'historique, rejouées sur un Supabase
  local remis dans l'état de la production, puis contrôlées en `GET` après
  application.

---

## 7. Stratégie de test et de recette

### 7.1 Tests

- **`ready-reminder.test.ts`** : la règle « prêt » sur tous les états du
  composer, dépublié compris ; l'heure du rappel, nuit, soirée et passage à
  l'heure d'hiver du 25 octobre ; une seule question par bento ; la
  réconciliation.
- **La route de la landing** : robot écarté, préchargement écarté, secret
  transmis, ~~réponse masquée~~ la même image dans tous les cas (lot 2).
- **`check-privileges.ts`** étendu : `anon` ne lit aucune des trois tables,
  n'appelle pas `record_bento_visit_app`, et `record_bento_visit_web` sans
  le secret ne compte rien ; `authenticated` n'écrit pas
  `first_published_at` et n'écrit `show_visits` que chez lui.
- **Un script `check-visits.sql`**, sur le gabarit de `check-push.sql` :
  dédoublonnage du jour, propriétaire écarté, bento non publié écarté,
  compteur masqué, purge du lendemain.

### 7.2 Recette

Au simulateur iPhone 17 Pro et à l'émulateur Pixel 8, sur le Supabase
local et la landing en local :

1. Ouvrir une page depuis La table, Trouver et un lien : une visite, puis
   plus rien le même jour.
2. Ouvrir sa propre page : rien.
3. Ouvrir la page web dans deux navigateurs : deux visites ; la recharger :
   aucune de plus.
4. « 0 visite » sur un bento neuf, dans l'app et sur le web.
5. Couper « Afficher mes visites » : le chiffre disparaît chez les autres,
   reste chez soi, et l'interrupteur dit « Masquées : toi seul les vois. ».
6. Un brouillon prêt, quitté pour un autre onglet : la question, « Oui »,
   la boîte du système, le rappel programmé à la bonne heure ; avancer
   l'horloge du simulateur, la notification arrive, le tap ouvre le
   composer.
7. Même chose depuis l'écran du pseudo, puis par le lien.
8. Publier avant l'heure : le rappel ne vient pas.
9. Lire la base après chaque geste : aucune empreinte en clair, les clés
   effacées le lendemain.

Ce qui demande un vrai téléphone, l'écran verrouillé et la notification
reçue en build de production, va au chantier 29.

---

## 8. Plan de développement

Effort réévalué de M à **L** : le compteur public, son réglage et le web
pèsent plus que le compteur privé du recadrage.

### Lot 1 · La base

La migration de §6.1, `check-visits.sql`, `check-privileges.ts` étendu, la
compatibilité prouvée sur un Supabase local remis dans l'état de la
production.

> **Fait le 23 octobre 2026.** `20261023100000_bento_visits.sql`, appliquée
> sur une base locale neuve, construite depuis les migrations du dépôt : la
> production est au même point, sa dernière migration étant
> `publish_on_validation`, et ses déclencheurs sur `bentos` et `users`
> portent les mêmes noms (relevé en lecture seule).
>
> - **`check-visits.sql` tient 43 contrôles**, et attrape les 18 défauts
>   introduits un à un : le propriétaire qui compte, un brouillon qui
>   compte, le dédoublonnage retiré, le masque ignoré, le propriétaire
>   aveugle, le secret ignoré, le coffre vide qui compte, un droit d'app
>   accordé aux visiteurs, les nombres lisibles, les sels jamais purgés, la
>   première date écrasée à la republication, le déclencheur absent à
>   l'insertion, les brouillons revalidés, la colonne écrivable,
>   `updated_at` laissé suspendu, le hachage sans sel, la purge non
>   programmée, la purge qui efface les nombres. Le droit accordé de trop
>   passait d'abord, la fonction refusant aussi sans session : le
>   contrôle 7d lit désormais les droits eux-mêmes.
> - **`check-privileges.ts`** rejoue la publication des versions publiées,
>   qui pose désormais la date de première publication, et treize contrôles
>   de visites par l'API ; tout est conforme. `check-publication`, `check-push`,
>   `check-editions` et `check-types` restent verts.
> - **Les versions publiées**, relues sur `6426779` : elles lisent `users`
>   en `select('*')` à deux endroits, `state/session.ts:106` et
>   `lib/data-export.ts:18`, qui reçoivent `show_visits` sans le lire ;
>   l'export des données le contient désormais, ce qui est juste. Leurs
>   lectures de `bentos` sont des listes de colonnes, et leur publication,
>   `bento-actions.ts:68`, pose la date de première publication.
>
> **Trois écarts à la spécification**, tous pris dans le sens de §5 :
>
> 1. **Un coffre sans secret répond `55000`**, à part du secret faux
>    (`42501`) : la landing journalisera un comptage pas encore mis en
>    service, sans le confondre avec un secret mal posé.
> 2. **Masquer ses visites revalide les pages web** de ses bentos publiés,
>    par le gabarit de `revalidate_landing_bento` : sans cela, la page
>    statique garderait le chiffre jusqu'à 5 minutes, et §5.4 promet que
>    personne d'autre ne le voit.
> 3. **Le rattrapage suspend `bentos_touch_updated_at`** : sinon les 28
>    bentos en ligne prendraient la date de la migration pour dernière
>    modification.
>
> Le contrôle 12 de `check-push.sql`, qui refusait tout travail planifié
> autre que les deux du chantier 17, admet `visits-purge`, contrôlé par
> `check-visits.sql`.

### Lot 2 · La landing

La route, le composant, la lecture du compteur, la politique de
confidentialité. Recette en local contre le Supabase local.

> **Fait le 23 octobre 2026.** Deux écarts à §6.2, l'un et l'autre dans le
> sens de la spécification :
>
> 1. **Une image d'un pixel, pas un composant client.** La page d'un bento
>    n'expédie aucun JavaScript qui lui soit propre, règle du chantier 1
>    que garde `e2e/smoke.test.ts` : `PublicBentoGrid` lui-même est un
>    composant serveur. Un `<BentoVisits>` aurait tenu dans la marge de
>    poids (376 853 octets contre 382 299 pour la page de référence) mais
>    trahi la règle. L'image se charge à l'ouverture d'un lien comme à une
>    navigation interne, et les robots d'aperçu ne la demandent pas. Le
>    prix : le chiffre affiché est celui du rendu, vieux de 5 minutes au
>    plus, sans la visite en cours (§5.2). Le poids de la page est
>    inchangé, à l'octet près.
> 2. **La dernière adresse de `X-Forwarded-For`.** La première peut venir
>    du visiteur si le proxy ajoute la sienne au lieu de la remplacer : un
>    compteur public se gonflerait en changeant d'en-tête. bento-pop.com
>    pointe sur le VPS sans CDN devant, relevé le 23 octobre : la dernière
>    est celle du proxy de Coolify.
>
> **Tests** : 16 unitaires (`visits.test.ts`), et 4 de plus en e2e, 33
> sur 33 : le compteur, zéro compris, rien quand il est masqué, l'image et
> l'appel qu'elle déclenche, aucun appel pour un robot, un préchargement ou
> une adresse malformée, et le secret absent du HTML. Le bouchon PostgREST
> porte désormais des identifiants de la forme d'un UUID.
>
> **Recette locale**, la landing en développement contre le Supabase local
> et un bento de recette : « 0 visite » à la première ouverture, puis
> « 1 visite » ; rechargée deux fois, 1 en base ; un second visiteur, 2 ;
> un robot, un prérendu et `curl` écartés ; masqué, la ligne d'identité
> s'arrête à la date ; à 375 px, le compteur tient sur la ligne, sans
> débordement. Aucune erreur dans la console ni dans les journaux du
> serveur.

**Livraison anticipée (D8)** : les lots 1 et 2 forment une première PR.
Fusionnée, la migration s'applique en production, le secret est posé dans
le coffre et dans Coolify, la landing est redéployée : le web compte et
affiche dès ce jour, des semaines avant la sortie store.

### Lot 3 · L'app : le compteur

La visite à l'ouverture d'une page, le compteur sur la page et le profil,
la section Confidentialité.

> **Fait le 23 octobre 2026**, sur la branche
> `feat/ux-08-signaux-de-retour-app`, empilée sur celle de la PR #90.
>
> - **La page d'un bento** compte sa visite à chaque affichage,
>   propriétaire compris, la base ne comptant jamais pour lui (§6.3), et
>   ajoute le compteur à sa ligne de date, comme le web. Le modèle de
>   `public-layout.ts` ne compte qu'une ligne : elle rétrécit au besoin, et
>   la hauteur de l'en-tête ne change pas.
> - **Le profil** lit le compteur du bento courant sans compter de visite :
>   « En ligne · publié il y a 3 jours · 5 visites ».
> - **La section Confidentialité**, entre Notifications et Compte, porte
>   « Afficher mes visites ». Éteint, l'interrupteur dit « Masquées : toi
>   seul les vois. » (§5.4), et l'écriture se rend si elle échoue, comme les
>   réglages du chantier 17. Rien sans profil.
> - **Le libellé** passe dans `@bento-pop/supabase-mobile/bento`, que la
>   landing réutilise désormais ; la politique de confidentialité décrit le
>   comptage de l'app.
>
> **Tests** : 9 de plus pour l'app, contre le bouchon PostgREST, dont un
> second affichage qui rappelle la base ; 700 tests sur 700, lint, typage,
> et 33 tests e2e sur 33 pour la landing.
>
> **Recette** au simulateur iPhone 17 Pro, à l'iPhone SE et à l'émulateur
> Pixel 8, avec un dev client compilé contre le Supabase local (clé de
> session `sb-127-auth-token` vérifiée dans le stockage de l'app avant toute
> mesure) :
>
> 1. en visiteur, la page affiche « 4 visites », 3 du web et celle qui vient
>    de compter ; rouverte, la page rappelle la base, deux appels relevés
>    dans les journaux de la passerelle, et la base garde une visite d'app ;
> 2. le propriétaire masque ses visites : la ligne s'arrête à la date, sans
>    séparateur orphelin ;
> 3. côté propriétaire, le profil et sa propre page affichent 5 visites,
>    même masquées, et sa visite ne compte pas ;
> 4. l'interrupteur écrit `show_visits` en base, sur iOS comme sur Android ;
> 5. sur l'iPhone SE, 343 points de large, la ligne de date avec le compteur
>    tient en rétrécissant d'environ 5 % ;
> 6. sur le Pixel 8, page, profil et interrupteur comme sur iOS, « 6
>    visites » après les trois appareils.
>
> Captures dans `.context/screenshots/ux08-lot3-*` du worktree.

### Lot 4 · L'app : le rappel

`ready-reminder.ts`, le canal, les trois portes, la programmation,
l'annulation, le tap.

### Lot 5 · Recette et documents

La recette de §7.2, la DoD point par point, la roadmap, la liste du
chantier 29.

---

## 9. Livraison

- **Deux PR** : lots 1 et 2, puis lots 3 à 5.
- **En production après la première** : la migration, prouvée compatible
  avant ; le secret `bento_visit_secret` dans le coffre du Supabase mobile ;
  `BENTO_VISIT_SECRET` sur la landing, au runtime ; la landing redéployée
  sur Coolify ; une visite contrôlée de bout en bout sur
  bento-pop.com.
- **À la sortie store** : le compteur et le rappel dans l'app.

---

## 10. Definition of Done

- [ ] Une page web de bento publié compte une visite, une seule par
      personne et par jour ; un robot d'aperçu n'en compte aucune
- [ ] Une page ouverte dans l'app compte une visite, une par compte et par
      jour ; le propriétaire n'en compte jamais
- [ ] Le défilement de La table ne compte rien
- [ ] Le compteur se lit sur la page du bento, dans l'app et sur le web, et
      sur le profil, « 0 visite » compris
- [ ] « Afficher mes visites » coupé : personne d'autre ne voit le chiffre,
      ni dans l'app, ni sur le web, ni par l'API ; le propriétaire le voit
- [ ] Aucune empreinte n'est stockée en clair ; les clés et le sel d'un jour
      disparaissent le lendemain
- [ ] La clé anonyme seule n'enregistre aucune visite web
- [ ] Un bento prêt, quitté sans publier, propose le rappel une fois ; le
      lien y mène aussi ; « Oui » programme une notification au premier
      18 h à au moins 12 heures
- [ ] Publier, ou rendre le bento incomplet, annule le rappel ; un bento
      dépublié n'en propose jamais
- [ ] Le tap du rappel ouvre le composer sur ce bento
- [ ] Les versions publiées passent `check-privileges.ts` sans échec, et
      leurs lectures sont identiques avant et après la migration
- [ ] La politique de confidentialité décrit le compteur avant le premier
      comptage en production
- [ ] Tests, typage et lint verts sur l'app, la landing et le package, CI
      verte

---

## 11. Décisions

| # | Décision | Raison |
| --- | --- | --- |
| **D1** | Le rappel ne vise qu'un bento complet, entièrement validé, jamais publié | Choisi le 23 octobre 2026 : « On relance que quand tout est validé. » Un bento dont un item attend relève du 18, qui le publie à la validation |
| **D2** | Une visite, c'est ouvrir la page d'un bento publié, dans l'app ou sur le web, jamais le défilement de La table, jamais le propriétaire dans l'app | Choisi le 23 octobre 2026. Le chiffre sera plus petit que des passages dans le fil, mais il mesure ce qu'il dit |
| **D3** | Le compteur est public : la page du bento, dans l'app et sur le web, et le profil de son propriétaire | Choisi le 23 octobre 2026 |
| **D4** | Pas de notification des visites dans ce chantier | Choisi le 23 octobre 2026. Elle rejoint le 24 ; le 8 se recette sans attendre la clé APNs ni le compte FCM |
| **D5** | Le rappel se propose quand on part sans publier, une fois par bento ; un seul rappel, le premier 18 h à au moins 12 heures | Choisi le 23 octobre 2026. Sur 18 bentos complets sans proposition, 14 ont été publiés dans l'heure : demander plus tôt dérangerait ceux qui publient |
| **D6** | Le web compte sans traceur : une empreinte hachée avec un sel du jour, jamais conservée en clair, une visite par jour ; le compteur dit « visites » | Choisi le 23 octobre 2026. Aucun bandeau, la politique de confidentialité complétée |
| **D7** | Le compteur s'affiche toujours, même à zéro | Choisi le 23 octobre 2026, contre la recommandation d'un seuil à 10 visites |
| **D8** | Le comptage web se branche dès le déploiement ; l'app compte et affiche à la sortie store | Choisi le 23 octobre 2026, comme D11 du 17 : de vrais chiffres des semaines avant la sortie |
| **D9** | « Afficher mes visites », un interrupteur du profil dès ce chantier, allumé par défaut, pour tout le compte | Choisi le 23 octobre 2026. La règle du 15 septembre : chaque réglage de confidentialité part avec sa fonctionnalité. Il rejoindra l'écran du 20 |
| **D10** | Un lien « Me le rappeler demain » sous « Publier mon bento » quand le bento est prêt | Choisi le 23 octobre 2026. iOS n'affiche rien quand l'app passe en arrière-plan : le lien couvre ce départ sans interrompre personne |
| **D11** | Le rappel est une notification locale, programmée par le téléphone | Conséquence de l'architecture, exposée le 23 octobre 2026 : le premier bento d'un compte n'existe pas en base avant sa publication (chantier 9). Ni APNs, ni FCM, ni jeton Expo : tout se recette au simulateur |
| **D12** | Le rappel est transactionnel au sens de §1.4 du 17, sur son propre canal Android, sans interrupteur | Pris par la spécification. Il répond à un geste, « Oui, rappelle-moi », et chaque rappel s'accepte un par un. Le canal laisse Android le couper seul |
| **D13** | Les visites de l'app se dédoublonnent comme celles du web, sur un identifiant haché avec le sel du jour | Pris par la spécification. Personne, pas même la base le lendemain, ne peut dire qui a ouvert quel bento : c'est ce que le chantier 26 demandera |
| **D14** | Le compteur ne s'affiche pas dans La table | Pris par la spécification. La barre réservée par le chantier 2 attend les likes du 22, qui la dessineront avec le compteur s'il le faut |
| **D15** | Une visite web n'entre que par la route de la landing, seule à connaître le secret du coffre | Pris par la spécification. Un compteur public donne envie d'être gonflé, et la clé anonyme est dans chaque copie de l'app |
| **D16** | « Jamais publié » se lit dans `first_published_at`, posée par déclencheur et rattrapée sur `published_at` | Pris par la spécification. Exact pour les 28 bentos en ligne : aucune version publiée ne sait dépublier, et le back-office non plus |

---

## 12. Suivis

- **Après un mois de chiffres web** : combien de bentos restent à
  « 0 visite », pour revoir D7 avec des données.
- **Après la sortie** : mesurer la marche du pseudo et des CGU que le
  chantier 9 a placée au moment de publier, par les comptes de la nouvelle
  version restés sans profil. Si des brouillons prêts y restent, un second
  rappel se discutera avec ce chiffre.
- **La notification des visites**, chantier 24.
- **Le compteur dans La table**, chantier 22.
- **« Afficher mes visites »** rejoint l'écran de confidentialité du 20.
- **Le back-office** pourrait montrer les visites d'un bento sur la fiche
  d'un utilisateur ; non demandé.
