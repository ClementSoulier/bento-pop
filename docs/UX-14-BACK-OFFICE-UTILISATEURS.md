# UX-14 · Back-office : utilisateurs, suppression, bentos éditoriaux

> Spécification du chantier 14 de [`MON-BENTO-POP-UX-ROADMAP.md`](./MON-BENTO-POP-UX-ROADMAP.md).
> Rédigée le 12 septembre 2026, à partir du code de `apps/admin`, du schéma
> mobile, et de mesures faites sur la base de production le même jour.

---

## 1. Intention

Le back-office sait modérer le catalogue et mettre des bentos en avant. Il ne
sait rien faire des **personnes**. Trois besoins en découlent, de nature très
différente, et c'est ce mélange qui rend le chantier long :

1. **voir** qui utilise l'app, avec de quoi juger ;
2. **supprimer** un compte, avec une trace exploitable et conforme ;
3. **publier** le bento d'un créateur rencontré hors de l'app.

Les deux premiers sont de l'exploitation courante. Le troisième est un sujet
éditorial qui touche au modèle d'identité, et c'est lui qui commande la
structure de ce chantier.

---

## 2. Objectif et critères de succès

| # | Critère | Mesure |
|---|---|---|
| C1 | L'équipe voit la liste des comptes et l'entonnoir d'usage | Écran, sans requête SQL manuelle |
| C2 | Un compte se supprime en deux clics, avec motif obligatoire | Recette |
| C3 | La suppression ne laisse **aucun orphelin** | Comptage avant / après |
| C4 | Le registre de suppression tient 12 mois et pas plus | Test de la purge |
| C5 | Un pseudo se corrige sans SQL, en respectant les règles existantes | Recette, y compris les cas refusés |
| C6 | Un bento de créateur se compose et apparaît dans le fil | Capture du fil |
| C7 | Un profil éditorial **ne crée aucun compte d'authentification** | Comptage `auth.users` avant / après |
| C8 | Les profils éditoriaux sont distinguables, dans l'app et dans les compteurs | Capture + écran d'admin |
| C9 | Dernière visite, plateforme et version remontent | Écran, sur un appareil à jour |
| C10 | Aucune régression sur l'app mobile | Tests + recette |

---

## 3. Périmètre

**Dans le périmètre.** `apps/admin` (nouvel espace « Utilisateurs »), une
migration sur le projet Supabase mobile, et une instrumentation légère de
`apps/mobile`.

**Hors périmètre, et pourquoi.**

- La **revendication d'un compte éditorial** par le créateur. Tranché : on
  part du principe que non (décision D2). Le jour où ce sera le sujet, ce
  sera un chantier à part, avec une vraie authentification par email.
- Le **modèle brouillon / publié** (chantier 5). L'admin publiera en posant
  `published_at`, comme l'app aujourd'hui.
- La **modération des signalements**, déjà couverte par `/reports`.
- Toute **statistique historisée** : on stocke un état courant, pas une série
  temporelle. Cf. D6.

---

## 4. Ce que disent le code et la base

Mesures du 12 septembre 2026 sur `ggjgktbcqumfxrixcdyx`, en service-role.

### 4.1 L'entonnoir réel, et 36 orphelins

| | Nombre | Part des installations |
|---|---|---|
| Comptes `auth.users` (tous anonymes) | **106** | 100 % |
| Profils `public.users` (pseudo choisi) | **70** | 66 % |
| Bentos commencés | 56 | 53 % |
| Bentos publiés | **26** | **25 %** |

**Un tiers des installations n'atteint jamais le choix du pseudo** : 36 comptes
d'authentification n'ont pas de profil. Ce n'est pas un défaut de données,
c'est l'entonnoir, et personne ne le voyait. L'écran doit le montrer, c'est
sans doute son apport le plus immédiat.

Ces 36 orphelins expliquent aussi l'écart entre le compteur du tableau de bord
Supabase et la réalité des utilisateurs. Trois d'entre eux au plus viennent de
la recette du chantier 3.

### 4.2 `last_sign_in_at` ne dit rien de la dernière visite

C'était le candidat évident pour « dernière connexion ». Il ne marche pas, et
la base le prouve :

```
last_sign_in_at renseigné            : 106 / 106
écart médian création → dernière connexion : 0,0 s
comptes où l'écart dépasse 1 h       : 0 / 106
```

Avec l'anonymous sign-in, la session est persistée et rafraîchie sans nouvelle
connexion : `last_sign_in_at` vaut la **date de création du compte**, pour tout
le monde. Aucune exception sur 106 comptes.

Une vraie date de dernière visite doit donc être écrite par l'app. Cf. §7.

### 4.3 Un compte d'authentification exige un email, vérifié

La question décisive du besoin 3 : peut-on créer un profil sans compte
d'authentification ? Réponse de l'API, testée :

```
POST /auth/v1/admin/users  {}
→ 400 validation_failed
  "Cannot create a user without either an email or phone"
```

Donc, pour un créateur invité, soit on invente un email, soit on découple.
**Un email inventé polluerait précisément le compteur qu'on veut garder
propre**, et créerait un compte dont personne ne veut. On découple.

### 4.4 Découpler coûte étonnamment peu

`public.users.id` référence `auth.users(id) on delete cascade`, et
**17 politiques RLS** comparent une colonne à `auth.uid()`. Réécrire cette
comparaison serait une opération à cœur ouvert sur l'identité.

Ce n'est pas nécessaire. Il suffit de **retirer la clé étrangère** en gardant
l'invariant qui fait marcher les politiques : pour un membre, `users.id` reste
égal à son `auth.uid()`, ce que la policy `users_insert_own` impose déjà
(`with check (id = (select auth.uid()))`). Un profil éditorial reçoit un UUID
aléatoire, qui ne correspondra jamais à un `auth.uid()`, donc :

- **aucune politique n'est modifiée** ;
- un profil éditorial est lisible par tous (`users_read_all` est `using(true)`)
  et modifiable seulement en service-role, ce qui est exactement voulu ;
- les trois clés étrangères qui pointent vers `public.users(id)`
  (`bentos.user_id`, `reports.reporter_id`, `items.submitted_by`) continuent de
  fonctionner sans changement.

Ce qu'on perd : la cascade automatique depuis `auth.users`. C'est assumé, et
plutôt souhaitable, parce que la suppression doit désormais passer par un
chemin qui enregistre un motif (§5.3).

### 4.5 La suppression actuelle laisse un orphelin, par conception

`deleteOwnAccount` supprime la ligne `public.users` et laisse `auth.users`
intacte, ce que la migration `20260511120000` assume en toutes lettres. C'est
défendable pour un compte anonyme sans donnée personnelle, mais ça explique
une partie des 36 orphelins, et l'admin ne doit pas reproduire ce
comportement : `auth.admin.deleteUser` supprime les deux.

### 4.7 L'accès au back-office, et pourquoi il manquait

Le BO ne pouvait pas être lancé en local : `NEXT_PUBLIC_SUPABASE_URL` pointait
sur `kshnckyoitebczuvhoyj.supabase.co`, une référence de projet hébergé qui ne
résout plus dans aucun DNS. Le projet landing et admin est en réalité
**auto-hébergé** sur le VPS, derrière `https://supabase.bento-pop.com`.

Aucune protection particulière : c'est le Kong standard de Supabase, qui
répond « No API key found in request » sans clé. La clé service-role du
fichier local déclarait `ref = kshnckyoitebczuvhoyj` dans sa charge utile,
donc appartenait à l'ancien projet, et Kong la rejetait.

C'est le troisième écart entre l'environnement local et la production croisé
en une journée, après `.supabase.com` au lieu de `.co` et cette URL. Cf. §13.

### 4.6 Un défaut trouvé en chemin

`apps/admin/.env` portait `MOBILE_SUPABASE_URL=https://….supabase.**com**`, au
lieu de `.co`. Le client mobile du BO ne pouvait donc joindre personne, et la
page `/bentos` était muette en local. Corrigé. **À vérifier sur Coolify** : si
la même faute y est, la mise en avant des bentos ne fonctionne pas non plus en
production.

---

## 5. Design

### 5.1 L'écran « Utilisateurs »

Une entrée de navigation, une liste, et surtout un bandeau d'entonnoir en
tête, parce que c'est le chiffre qu'on regarde en premier :

```
106 installations · 70 pseudos choisis (66 %) · 56 bentos commencés · 26 publiés (25 %)
```

La liste montre, par ligne : pseudo et nom affiché, date d'inscription,
dernière visite, plateforme et version, état du bento (aucun, n cases, publié),
et une pastille pour les profils éditoriaux.

**Les comptes sans profil apparaissent aussi**, dans un onglet à part
« Installations sans pseudo ». On n'en connaît que l'identifiant et la date de
création, mais les compter est tout l'intérêt, et les supprimer en lot est le
premier ménage à faire.

Tri par défaut : dernière visite décroissante, en repli sur la date
d'inscription tant que la télémétrie n'a rien remonté. Recherche par pseudo.
Filtres : éditorial, publié, sans bento.

**Les colonnes vides sont dites, pas masquées.** Tant que l'app instrumentée
n'est pas déployée, plateforme et version sont vides pour tout le monde. La
colonne affiche « inconnu » et l'en-tête porte une note expliquant depuis
quelle version l'information remonte. Une colonne vide sans explication passe
pour un bug.

### 5.2 Modifier un utilisateur

Deux champs seulement : **pseudo** et **nom affiché**. Ce sont les deux demandes
prévisibles, un pseudo insultant et une coquille.

La modification passe par les **mêmes règles que l'app**, et la base les
applique toutes les trois, y compris au service-role. Vérifié en production :

| Règle | Origine | Refus observé |
|---|---|---|
| Format `^[A-Za-z0-9_.]{3,20}$` | contrainte `pseudo_format` | `23514`, « violates check constraint "pseudo_format" » |
| Unicité insensible à la casse | index `users_pseudo_lower_idx` | `23505` |
| Motifs de modération | **trigger** `users_pseudo_block_check`, en `security definer` | `23514`, « Pseudo non autorisé. » |

Le troisième point corrige une erreur de la première rédaction de cette spec,
qui affirmait que les motifs bloqués « ne sont pas une contrainte » et
devaient être revérifiés côté admin. C'est faux : un trigger les applique
depuis la migration `20260511130000`, et un service-role n'échappe pas aux
triggers. **Le back-office ne peut donc pas poser un pseudo que l'app
refuserait**, même par erreur de code, et il n'a rien à réimplémenter.

Ce qu'il doit faire, en revanche, c'est **traduire** ces refus. Les deux
causes de refus de pseudo partagent le code `23514` et ne se distinguent que
par le message : les confondre afficherait « format invalide » sur un pseudo
parfaitement bien formé mais interdit. Un contrôle de forme immédiat côté
client complète le dispositif, pour répondre sans aller-retour sur le cas le
plus courant.

Changer un pseudo change l'URL publique `/u/<pseudo>`. L'écran le dit avant de
valider.

### 5.3 Supprimer, et le registre

Deux cas, un seul geste :

- **membre** : `auth.admin.deleteUser(id)`, qui supprime le compte
  d'authentification. Le profil ne cascade plus (§4.4), donc l'admin supprime
  aussi la ligne `public.users`, ce qui cascade sur `bentos` et `bento_items` ;
- **profil éditorial** : pas de compte d'authentification, on supprime la ligne
  `public.users` et c'est tout.

Motif **obligatoire**, choisi dans une courte liste plus un champ libre :
compte de test, demande de l'utilisateur, contenu inapproprié, doublon, autre.

**Le registre garde le minimum.** L'identifiant supprimé, le motif, l'email de
l'administrateur, la date. **Ni pseudo, ni nom affiché** : ce sont des données
personnelles, et les conserver après une suppression demandée irait contre le
geste. Purge automatique à **12 mois**.

Conséquence acceptée, et il faut l'écrire : sans le pseudo, une demande de
support du type « mon compte @machin a disparu » ne se recoupe pas avec le
registre. C'est le prix du minimum, et c'est le choix retenu. Le précédent
inverse existe dans le code (`reports.target_pseudo` est copié « pour la trace
même si user supprimé ») ; on ne le suit pas ici.

Un écran de confirmation récapitule ce qui va disparaître : le bento, ses
cases, et le fait que la page publique `/u/<pseudo>` deviendra un 404.

### 5.4 Composer un bento éditorial

Un formulaire en une page :

1. **pseudo** et **nom affiché**, avec les mêmes règles qu'en §5.2 ;
2. **six cases**, chacune cherchée dans le catalogue avec la recherche
   existante (`search_items`), plus la possibilité de créer l'item à la volée
   comme le fait déjà le BO catalogue ;
3. **publier** ou garder en brouillon ;
4. **mettre en avant**, réutilisant `is_featured` et `featured_order` déjà
   gérés par `/bentos`.

L'ordre compte : on crée d'abord le profil, ce qui donne l'identifiant, puis le
bento, puis les cases. Une création interrompue laisse un profil sans bento,
visible et supprimable depuis la liste.

### 5.5 Le signe distinctif

Un bento éditorial apparaît dans le fil comme les autres, c'est le but. Mais il
faut dire que la personne ne l'a pas composé dans l'app, sans quoi on lui
attribue une action qu'elle n'a pas faite.

`FeedPost` porte déjà un concept d'étiquette, conçu au chantier 2 pour ne pas
être un booléen : `FEATURED_RIBBON` est une valeur, et « un nouveau type sera
une valeur, pas une branche de plus dans le composant ». On ajoute donc une
étiquette **« Invité »**, dans une autre couleur. Un bento peut être les deux,
invité et coup de cœur : dans ce cas « Invité » l'emporte, parce que c'est
l'information que le lecteur n'a aucun autre moyen de déduire.

Côté page publique `/u/<pseudo>`, même mention.

### 5.6 Ce que « nombre d'utilisateurs » veut dire

Trois nombres différents circulent, et les confondre fait prendre de mauvaises
décisions. L'écran les nomme :

- **installations** : lignes de `auth.users`, 106 aujourd'hui ;
- **inscrits** : profils `public.users` de type membre, 70 ;
- **auteurs publiés** : profils membres avec un bento publié, 26.

Les profils éditoriaux ne comptent dans **aucun** des trois. Ils ont leur
propre compteur.

---

## 6. Contrat de données

Une seule migration, `20260913000000_admin_users.sql`, à appliquer à la main
dans l'éditeur SQL du projet mobile.

### 6.1 Découpler l'identité, et marquer les profils éditoriaux

```sql
-- 1. Le type de profil.
alter table public.users
  add column if not exists kind text not null default 'member'
    check (kind in ('member', 'editorial'));

-- 2. Retirer la clé étrangère vers auth.users.
--
-- L'invariant qui fait marcher les 17 politiques RLS est conservé : pour un
-- membre, `id` reste égal à son `auth.uid()`, ce que `users_insert_own`
-- impose déjà. Un profil éditorial reçoit un UUID aléatoire, qui ne peut
-- correspondre à aucun `auth.uid()`. Aucune politique n'est donc modifiée.
--
-- Ce qu'on perd : la cascade depuis auth.users. Assumé, la suppression doit
-- désormais passer par un chemin qui enregistre un motif.
alter table public.users drop constraint if exists users_id_fkey;

-- 3. Un profil éditorial n'a pas de compte, donc pas de CGU acceptées.
--    La contrainte dit l'invariant au lieu de le laisser à la convention.
alter table public.users
  add constraint users_editorial_has_no_terms
    check (kind = 'member' or terms_accepted_at is null);
```

### 6.2 Télémétrie

```sql
alter table public.users
  add column if not exists last_seen_at timestamptz,
  add column if not exists platform text check (platform in ('ios', 'android')),
  add column if not exists app_version text;

-- Le tri par défaut de la liste d'admin.
create index if not exists users_last_seen_idx
  on public.users (last_seen_at desc nulls last);
```

Trois colonnes sur `users`, et pas une table d'historique : on veut l'**état
courant** du parc, pas sa trajectoire. Une série temporelle serait un autre
sujet, avec sa rétention et son volume. Cf. D6.

`platform` est contraint plutôt que libre : c'est une valeur fermée, et une
faute de frappe côté client casserait silencieusement les filtres.

### 6.3 Le registre de suppression

```sql
create table if not exists public.user_deletions (
  id uuid primary key default gen_random_uuid(),
  -- L'identifiant du profil supprimé. Pseudonyme : sans la ligne `users`,
  -- il ne désigne plus personne. Volontairement seul, cf. §5.3.
  deleted_user_id uuid not null,
  kind text not null check (kind in ('member', 'editorial')),
  reason text not null check (char_length(reason) between 1 and 500),
  deleted_by text not null,            -- email de l'administrateur
  deleted_at timestamptz not null default now()
);

create index if not exists user_deletions_deleted_at_idx
  on public.user_deletions (deleted_at);

alter table public.user_deletions enable row level security;
-- Aucune policy : la table n'est accessible qu'en service-role. Un registre
-- de suppression lisible par les clients serait une fuite en soi.

comment on table public.user_deletions is
  'Registre RGPD des suppressions de compte. Contenu volontairement minimal : '
  'ni pseudo ni nom affiché, ce sont des données personnelles et les garder '
  'irait contre la suppression demandée. Purge à 12 mois.';
```

**La purge.** Une fonction et un appel, plutôt qu'une tâche planifiée : le
projet n'a pas d'ordonnanceur, et la purge peut se faire à l'ouverture de
l'écran d'admin, ce qui suffit largement pour une table qui grossit de
quelques lignes par mois.

```sql
create or replace function public.purge_user_deletions()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.user_deletions
    where deleted_at < now() - interval '12 months'
    returning 1
  )
  select count(*)::int from gone;
$$;
```

### 6.4 Ce que l'admin lit

Le nombre d'installations vient de `auth.users`, qui n'est pas exposé par
PostgREST. Il se lit par l'API d'administration
(`GET /auth/v1/admin/users`), paginée par 200. À 106 comptes c'est un appel ;
le code doit tout de même paginer, sans quoi le compteur se figera
silencieusement à 200.

---

## 7. Instrumentation mobile

Trois valeurs, écrites par l'app sur son propre profil.

**Quand.** Au démarrage, une fois, après que le profil est chargé. Pas à chaque
retour au premier plan : ça multiplierait les écritures pour une précision dont
personne n'a besoin. Une visite par lancement est la bonne granularité.

**Quoi.**

```ts
await supabase.from('users').update({
  last_seen_at: new Date().toISOString(),
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
  app_version: Constants.expoConfig?.version ?? null,
}).eq('id', userId);
```

**Comment, sans casser quoi que ce soit.** L'écriture est **silencieuse et non
bloquante** : elle part sans être attendue et son échec est avalé. Une
télémétrie qui empêche l'app de démarrer serait un très mauvais échange. La
policy `users_update_own` couvre déjà ce cas, aucune règle à ajouter.

**Ce que ça implique, et qu'il faut assumer.** Les colonnes resteront vides
tant que la version instrumentée n'est pas installée, et se rempliront au
rythme des mises à jour. Sur les 70 profils actuels, l'écran affichera
« inconnu » pendant des semaines. C'est accepté (§5.1), à condition que
l'écran l'explique.

---

## 8. Sécurité

- `MOBILE_SUPABASE_SERVICE_ROLE_KEY` est une variable de **runtime**, jamais de
  build, et ne doit jamais être préfixée `NEXT_PUBLIC_`. Le client mobile du BO
  est déjà protégé par un import `server-only`.
- Toutes les opérations de ce chantier passent par des **Server Actions**, et
  chacune commence par `requireAdmin()`. Une route qui supprime un compte sans
  ce garde-fou serait exploitable par quiconque devine son chemin.
- La suppression est **irréversible et sans corbeille**. La confirmation est
  donc explicite et récapitule ce qui disparaît.
- `user_deletions` n'a aucune policy : service-role uniquement.
- Le formulaire éditorial écrit dans `users` et `bentos` avec le service-role,
  donc **hors RLS**. Les règles de pseudo doivent être revérifiées côté
  serveur, cf. §5.2 : la base garantit le format et l'unicité, pas la liste de
  motifs bloqués.

---

## 9. Stratégie de test et QA

### 9.1 Tests automatiques

Le BO admin n'a pas de tests aujourd'hui. Ce chantier n'en installe pas la
culture à lui seul, mais il apporte des fonctions pures qui méritent de
l'être, et qui sont exactement celles qui font mal quand elles se trompent :

- **validation du pseudo** : format, longueur, unicité insensible à la casse,
  motifs bloqués. Les cas limites viennent du code existant, `_` étant un
  joker `ilike` (cf. `pseudo.ts`) ;
- **calcul de l'entonnoir** : les trois nombres du §5.6 à partir d'un jeu de
  profils, y compris avec des profils éditoriaux qui ne doivent compter nulle
  part ;
- **fenêtre de purge** : une ligne à 11 mois reste, à 13 mois part.

Côté mobile, l'écriture de télémétrie doit être testée pour **ne jamais
lever**, même si la requête échoue.

### 9.2 Recette manuelle

- [ ] La liste s'affiche, les trois compteurs correspondent aux mesures du §4.1.
- [ ] L'onglet des installations sans pseudo montre bien 36 lignes.
- [ ] Renommer un pseudo : accepté, puis refusé sur un doublon à la casse près,
      un format invalide, un motif bloqué.
- [ ] Supprimer un compte de test : `auth.users` et `public.users` diminuent
      **tous les deux** de 1, le bento disparaît du fil, `/u/<pseudo>` rend 404.
- [ ] Le registre porte une ligne, sans pseudo.
- [ ] Créer un profil éditorial : `auth.users` **n'augmente pas** (C7).
- [ ] Le bento éditorial apparaît dans le fil avec l'étiquette « Invité ».
- [ ] Sur une app instrumentée, la dernière visite et la plateforme remontent.
- [ ] Le fil, la page publique et le composer de l'app **ne changent pas** pour
      un membre : la migration ne doit rien casser (C10).

### 9.3 Le contrôle qui compte avant tout

La migration retire une clé étrangère sur la table d'identité. **Avant et
après, comparer les comptages** de `auth.users`, `public.users`, `bentos` et
`bento_items`, et rejouer un parcours complet de l'app mobile. Si une policy
avait dépendu de cette clé sans qu'on l'ait vu, c'est là que ça se verra.

---

## 10. Plan de développement

### Lot 0 · La migration ✅

`20260913000000_admin_users.sql` : `kind`, retrait de la clé étrangère,
colonnes de télémétrie, `user_deletions`, purge. Appliquée le 12 septembre
2026, vérifiée par deux scripts.

**Deux défauts trouvés par la vérification, pas par la relecture.**

`users.id` n'avait aucune valeur par défaut, parce qu'il venait toujours de
`auth.uid()`. La première insertion d'un profil éditorial est donc partie sur
un `23502`. Corrigé par `default gen_random_uuid()`, sans risque pour les
membres : le défaut ne s'applique que si la colonne est omise, et un client
qui l'omettrait obtiendrait un UUID aussitôt rejeté par `users_insert_own`.

**Plus grave, `purge_user_deletions` était appelable avec la clé anonyme.**
`revoke all on function … from public` ne suffit pas : Supabase accorde
`execute` aux rôles `anon` et `authenticated` par des privilèges par défaut,
et ces droits survivent au revoke sur `public`. N'importe qui pouvait donc
vider le registre en appelant une fonction `security definer`. Il faut
révoquer nommément sur les deux rôles. Le registre était vide et la fenêtre
n'a duré que le temps de la vérification, mais c'est le genre de trou qu'une
relecture ne voit pas.

**Deux scripts plutôt qu'un.** `check-admin-users.mjs` couvre le schéma, les
comptages et les lectures sous RLS. Il ne prouve rien sur les écritures, et
c'est justement là que le retrait d'une clé étrangère sur la table d'identité
pouvait faire mal. `check-write-path.mjs` rejoue donc le premier lancement de
l'app avec une vraie session anonyme : inscription, création du profil,
tentative de création au nom d'autrui (refusée, 403), création du bento,
écriture de la télémétrie. Il supprime ensuite le compte des deux côtés et
vérifie que les compteurs sont revenus.

Résultat : 20 contrôles au vert d'un côté, 8 de l'autre, comptages identiques
à la référence.

### Lot 1 · La liste et l'entonnoir ✅

Écran en lecture seule : compteurs, liste, onglet des installations sans
pseudo, recherche, tri, filtres.

**Une régression du lot 0, trouvée en lisant le code existant.**
`deleteUserAccount` existait déjà dans les actions de `/bentos` et
s'appuyait sur la cascade `auth.users → public.users`, que le lot 0 venait de
retirer. Il supprimait donc le compte d'authentification en laissant le
profil, son bento et ses cases : un bento visible dans le fil, rattaché à
quelqu'un qui n'existe plus. Ma spécification disait « l'admin ne doit pas
reproduire ce comportement » sans avoir vérifié qu'une suppression admin
existait déjà.

Corrigé par `lib/mobile-users.ts`, partagé entre les deux écrans parce qu'une
suppression dupliquée est bien pire qu'un autre code dupliqué. Le profil est
supprimé **en premier** : c'est lui qui porte la cascade vers `bentos`, donc
une interruption laisse au pire un compte d'authentification orphelin,
invisible et sans donnée, plutôt qu'un bento orphelin visible de tous.

**Le BO admin a maintenant des tests.** `pnpm turbo run test` les ramasse
automatiquement, la CI les exécutait déjà. 16 tests sur l'entonnoir, le tri,
le repli sur la date d'inscription quand la télémétrie est vide, et la
recherche insensible aux accents.

`scripts/check-user-funnel.ts` vérifie la couche de données contre la vraie
base. Les tests unitaires ne voient pas la **forme des réponses PostgREST** :
le comptage des cases passe par `bento_items(count)`, dont l'agrégat arrive
en `[{ count: n }]`, et un changement de forme donnerait zéro case partout
sans qu'aucune requête n'échoue. L'écran étant derrière une authentification,
c'est aussi la seule façon d'en contrôler les chiffres sans session
d'administration. 13 contrôles au vert, entonnoir conforme aux mesures du
§4.1.

**Recette visuelle faite** une fois l'accès admin obtenu (cf. §4.7) : les
quatre compteurs affichent 106 / 70 / 56 / 26, l'onglet des installations sans
pseudo en liste bien 36, et les colonnes de télémétrie affichent « inconnu »
sous leur encart d'explication.

### Lot 2 · Modifier ✅

Pseudo et nom affiché, dans une boîte de dialogue depuis la liste. 14 tests
s'ajoutent aux 16 du lot 1.

L'écran prévient qu'un changement de pseudo change l'adresse publique et que
l'ancienne renverra une page introuvable.

Vérifié contre la production sur le compte de recette, renommé puis remis en
place : les trois refus reviennent avec leur bonne traduction, le renommage
aboutit, et le nombre de profils est inchangé.

**Recette visuelle faite** : le refus d'un motif bloqué s'affiche en français
dans la boîte de dialogue, l'avertissement sur le changement d'adresse
publique apparaît dès que le pseudo change, et une modification acceptée
referme la boîte en mettant la ligne à jour. La normalisation du nom affiché
se voit de bout en bout, « &nbsp;&nbsp;Compte&nbsp;&nbsp;&nbsp;de recette&nbsp;&nbsp; » ressortant
« Compte de recette » en base.

### Lot 3 · Supprimer ✅

Suppression des deux cas, motif obligatoire, registre, purge, confirmation
récapitulative. 6 tests s'ajoutent, 36 au total.

**Le registre et la suppression sont atomiques**, par une fonction plpgsql
(`20260913100000_admin_delete_user.sql`). Les enchaîner en deux appels
PostgREST laissait deux fenêtres d'incohérence : une trace pour quelqu'un qui
existe toujours, ou un compte effacé sans trace, soit exactement ce que le
registre doit empêcher. Un `select … for update` verrouille la ligne, pour que
deux administrateurs supprimant le même profil n'écrivent pas deux entrées.

**La suppression a quitté l'écran des bentos.** Elle y existait déjà, derrière
un `window.confirm` et **sans motif**. Deux chemins destructifs dont un sans
trace annulaient l'intérêt du registre. Le bouton est devenu un lien vers la
liste des utilisateurs, filtrée sur le pseudo.

**Les orphelins ne sont pas inscrits au registre**, et c'est délibéré : sans
profil, il n'y a jamais eu ni pseudo, ni nom, ni bento, ni CGU acceptées.
Aucune donnée personnelle à consigner. Un garde-fou serveur refuse malgré tout
la suppression en lot si un identifiant porte un profil : l'écran ne le
proposera jamais, mais une action irréversible ne doit pas dépendre de la
justesse de son appelant.

**Un conflit vu en recette, et signalé dans l'écran.** Purger les orphelins
« pour faire propre » détruit la seule trace de ce que l'onboarding perd : ces
36 lignes *sont* le compteur d'installations, et les effacer ferait passer
l'entonnoir à 100 % de pseudos choisis. Le nettoyage et la mesure sont en
opposition directe. L'écran le dit en rouge avant le clic, et le mécanisme a
donc été vérifié sur un orphelin créé pour l'occasion plutôt qu'en supprimant
les 36.

**Recette réelle, de bout en bout.** Le compte `recetteuxt_pop` du chantier 3
a été supprimé par l'écran, ce qui était son cas d'usage exact :

| | Avant | Après |
|---|---|---|
| `auth.users` | 106 | 105 |
| `users` | 70 | 69 |
| `bentos` | 56 | 55 |
| `bento_items` | 282 | **276** |
| `user_deletions` | 0 | 1 |

L'arithmétique de la cascade tombe juste : six cases retirées pour un bento
6/6. Le compte d'authentification répond 404, le profil a disparu, et
l'entrée de registre porte le type, le motif composé
(« Compte de test : recette du chantier 3, bento non publié »), l'email de
l'administrateur et la date, **sans pseudo ni nom affiché**.

### Lot 4 · Le bento éditorial

Formulaire, création profil puis bento puis cases, publication, mise en avant.

### Lot 5 · L'étiquette « Invité »

Côté mobile et côté page publique. Livrable avec la prochaine version.

### Lot 6 · Télémétrie

Écriture côté app, colonnes remplies côté admin. Part avec la même version
mobile que le lot 5, et que l'haptique du chantier 3.

### Lot 7 · Recette et DoD

---

## 11. Definition of Done

Les dix critères du §2, avec la preuve en face, plus :

- `pnpm lint`, `pnpm typecheck` et les tests passent, CI verte ;
- la migration est appliquée en production et le fichier est commité ;
- les comptages d'avant et d'après sont publiés ;
- le ménage est fait : compte de recette du chantier 3 et 36 orphelins ;
- la roadmap est à jour.

**C9 ne sera vérifiable qu'après une livraison mobile.** Il est donc attendu
qu'il reste partiel à la fusion, comme l'haptique du chantier 3, et qu'il se
ferme avec la même version.

---

## 12. Décisions tranchées

| # | Décision | Raison |
|---|---|---|
| D1 | Profils éditoriaux **sans compte d'authentification** | Un compte exige un email (vérifié, 400), et un email inventé polluerait le compteur qu'on veut garder propre |
| D2 | Pas de revendication ultérieure par le créateur | Choix produit assumé. La rouvrir demandera une vraie authentification, donc un chantier à part |
| D3 | Retirer la clé étrangère plutôt que réécrire les politiques | 17 politiques comparent à `auth.uid()`. L'invariant `id == auth.uid()` pour les membres les laisse toutes intactes |
| D4 | `last_sign_in_at` écarté comme date de visite | Écart médian de 0,0 s avec la création, 0 compte sur 106 au-delà d'une heure |
| D5 | Télémétrie écrite par l'app, silencieuse et non bloquante | Une télémétrie qui empêche de démarrer est un très mauvais échange |
| D6 | État courant, pas d'historique | Une série temporelle est un autre sujet, avec sa rétention et son volume |
| D7 | Registre sans pseudo ni nom affiché | Les garder après une suppression demandée irait contre le geste. Le prix est de ne plus pouvoir recouper une demande de support |
| D8 | Purge à l'ouverture de l'écran, pas de tâche planifiée | Pas d'ordonnanceur dans le projet, et quelques lignes par mois |
| D9 | Trois compteurs nommés plutôt qu'un « nombre d'utilisateurs » | Les confondre fait prendre de mauvaises décisions ; 106, 70 et 26 racontent trois choses différentes |
| D10 | « Invité » l'emporte sur « Coup de cœur » | C'est l'information que le lecteur ne peut déduire d'aucune autre manière |
| D11 | Modification limitée au pseudo et au nom affiché | Les deux seules demandes prévisibles ; tout le reste est du contenu, qui a déjà ses écrans |

---

## 13. Suivis générés par ce chantier

**Vérifier `MOBILE_SUPABASE_URL` sur Coolify.** La valeur locale portait
`.supabase.com` au lieu de `.co`. Si la faute est aussi en production, la mise
en avant des bentos ne fonctionne pas.

**36 installations sans pseudo, soit un tiers.** Ce chantier les rend
visibles ; comprendre pourquoi l'onboarding perd un tiers des gens est un
sujet produit à part entière, et sans doute le plus rentable de la roadmap.

**`deleteOwnAccount` côté app laisse toujours un orphelin.** L'admin ne
reproduira pas ce comportement, mais l'app le fait encore. À aligner, sans
doute au chantier 5.

**Le BO admin n'a aucun test.** Ce chantier en apporte pour ses fonctions
pures. Généraliser est un sujet à soi.
