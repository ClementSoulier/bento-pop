# Blog de bento-pop.com

Spécification du blog de la landing et de son édition dans le back-office. Arbitrée le 26/11/2026.

## 1. Objectif

Publier des articles sur `bento-pop.com/blog` (actus, dossiers, critiques, coulisses), rédigés par la team dans le back-office `admin.bento-pop.com`, sans passer par un développeur.

Le blog suit le modèle déjà en place pour les émissions et les podcasts : des tables `landing_*` dans le Supabase de la landing, une section d'édition dans `apps/admin`, des pages publiques dans `apps/landing` qui lisent en anonyme, et une purge du cache de la landing à chaque enregistrement.

## 2. Décisions

| N° | Décision |
| --- | --- |
| D1 | **Éditeur visuel Tiptap** (MIT, 0 €), version épinglée 3.32.2, dans l'admin seulement. Le contenu est stocké en JSON (format ProseMirror), jamais en HTML. |
| D2 | La landing **rend le JSON avec ses propres composants React**, sans `dangerouslySetInnerHTML` ni dépendance Tiptap. Un nœud ou une marque inconnus sont ignorés ; un lien n'est rendu que s'il pointe en `http(s)`, `mailto` ou en relatif. |
| D3 | Contenus autorisés : paragraphes, titres H2 et H3, gras, italique, souligné, barré, liens, listes à puces et numérotées, citations, séparateurs, images (texte alternatif et légende), vidéos YouTube. Pas de bloc de code, pas de tableau, pas de H1 (le titre de l'article l'occupe). Le serveur de l'admin refuse un document qui sort de cette liste. |
| D4 | **Catégories gérées au BO** : une catégorie par article (facultative), table `landing_blog_categories`, page `/blog/categorie/[slug]`. Une catégorie sans article publié n'apparaît ni dans les filtres ni au sitemap. |
| D5 | **Auteurs pris dans la Team** (`landing_team`), un ou plusieurs par article, comme les animateurs des épisodes (table de liaison `landing_blog_post_authors`). Facultatifs depuis le 26/11 (D18) : sans auteur, l'article est signé « Bento Pop ». |
| D6 | **Statuts** brouillon et publié, plus la **publication programmée** des épisodes : un article publié dont la date est future reste invisible jusqu'à cette date. |
| D7 | **Épisodes liés** : un article peut citer des émissions et des podcasts, affichés en cartes en bas d'article. Une seule table `landing_blog_post_episodes` à deux clés étrangères, dont exactement une est remplie. Un épisode supprimé disparaît de l'article (cascade). |
| D8 | **Images** dans un bucket public `blog-media` : couverture recadrée en 16:9 (WebP, 1600 px) et images d'article redimensionnées à 1600 px de large au plus, avec leurs dimensions mémorisées dans le document. La landing les sert par `next/image` (egress, cf. `SmartImage`). |
| D9 | **Pages publiques** : `/blog` (liste, rendu à chaque requête comme `/emissions`), `/blog/categorie/[slug]`, `/blog/[slug]` (ISR d'une heure, purgée par le BO), `/blog/feed.xml` (RSS 2.0, chapô seul et lien vers l'article). |
| D10 | **Navigation** : lien « Blog » entre Podcasts et Invités ; bloc « Derniers articles » (3) sur la home, entre Agenda et Le Thermomètre (fond jaune entre une section crème et une noire, l'alternance reste intacte), masqué s'il n'y a aucun article. |
| D11 | **SEO** : `BlogPosting` et `BreadcrumbList` en JSON-LD, Open Graph `article`, titre et description SEO surchargeables, sitemap, lien `alternate` vers le flux RSS. |
| D12 | **Aperçu d'un brouillon** : le BO fabrique un lien signé (HMAC sur `REVALIDATE_TOKEN`, déjà partagé par les deux apps, valable 24 h) vers `/blog/apercu/[id]` sur la landing, qui lit l'article par la clé de service et le sert en `noindex`. Aucune nouvelle variable d'environnement. |
| D13 | Le temps de lecture et le nombre de mots sont **calculés par l'admin à l'enregistrement** et stockés, pour que les listes n'aient pas à charger le contenu. |
| D14 | Changer le slug d'un article purge l'ancienne et la nouvelle adresse. L'ancienne répond ensuite 404 (pas de redirection en V1). |
| D15 | **Résultats du Thermomètre** (arbitré le 26/11/2026) : quand un sondage se clôt, ses résultats sont publiés sur le blog **tout seuls**, sans relecture. Seulement pour les sondages clos à partir de la mise en ligne : rien de rétroactif. |
| D16 | Un sondage se clôt de deux façons dans le BO : « Archiver », ou « Publier » un autre sondage, qui retire le statut « en cours » au précédent. Les deux publient l'article. Rien n'est publié pour un sondage **sans vote**, ni deux fois pour le même sondage (le bloc garde l'identifiant de la semaine). Un échec de publication ne défait pas la clôture : le BO l'affiche. |
| D17 | **Bloc « Sondage » figé** : question, options et votes copiés dans les attributs du bloc au moment de la clôture. Ils ne bougent plus, même si des votes arrivent encore (l'enregistrement d'un vote ne vérifie pas que le sondage est en cours) ou si le sondage est supprimé (ses votes partent en cascade). Le bouton « Sondage » de l'éditeur insère aussi ce bloc dans n'importe quel article, avec les chiffres lus à l'ouverture de la page. Pourcentages entiers arrondis pour totaliser 100. |
| D18 | L'article de résultats est signé « Bento Pop » (aucun auteur), titré « Résultats du Thermomètre : <question> », rangé dans la catégorie **Le Thermomètre** (`/blog/categorie/thermometre`, créée à la première clôture), et renvoie vers la nouvelle question sur la home. La team peut le retoucher ensuite dans le BO. |
| D19 | Côté site, un sondage archivé n'était visible nulle part : la home ne charge que le sondage en cours. Les articles de résultats sont désormais sa seule trace publique. |

## 3. Données

Migration `supabase/migrations/20261126000000_landing_blog.sql`, à jouer dans le Studio de `supabase.bento-pop.com` (base landing et back-office, **pas** « My Bento Pop »).

- `landing_blog_categories` : `slug` unique, `name`, `description`, `display_order`. Lecture anonyme, écriture admin.
- `landing_blog_posts` : `slug` unique, `title`, `excerpt` (chapô), `content` (jsonb), `cover_url`, `cover_alt`, `category_id` (mis à null si la catégorie est supprimée), `status`, `published_at`, `seo_title`, `seo_description`, `reading_minutes`, `word_count`. Lecture anonyme des articles publiés, tout pour les admins.
- `landing_blog_post_authors` : `(post_id, team_member_id)`, `display_order`.
- `landing_blog_post_episodes` : `post_id`, `show_episode_id` ou `podcast_episode_id`, `display_order`.
- Bucket `blog-media`, public en lecture, écriture admin.

## 4. Lots

1. **Base** : migration, types partagés (`packages/supabase`).
2. **Back-office** : entrée « Blog » de la barre latérale, liste des articles, page d'édition plein écran (Tiptap, couverture, auteurs, catégorie, épisodes liés, SEO, aperçu), gestion des catégories.
3. **Pages publiques** : rendu du document, `/blog`, `/blog/categorie/[slug]`, `/blog/[slug]`, aperçu signé.
4. **Diffusion** : nav, bloc de la home, flux RSS, sitemap, purge du cache.
5. **Recette** : lint, typage, tests, builds, migration éprouvée sur une base locale, BO et landing recettés en local.

## 5. Hors V1

Commentaires, newsletter des articles, redirections d'anciens slugs, tags libres, recherche plein texte, envoi en notification push, contenu complet dans le flux RSS, versions et historique des articles.

## 6. Mise en service

1. Jouer la migration dans le Studio de `supabase.bento-pop.com`.
2. Fusionner : la landing se redéploie seule, le back-office se redéploie à la main dans Coolify (app `x559qot53kth79ini2as0c87`).
3. Rien à poser dans Coolify : `REVALIDATE_TOKEN`, `LANDING_URL` et `SUPABASE_SERVICE_ROLE_KEY` existent déjà des deux côtés.

## 7. Recette du 26/11/2026

Sur le Supabase local de la landing (`supabase start` à la racine, image Postgres 17.6.1.167), BO sur `localhost:3101` et landing sur `localhost:3201`, avec une **vraie session admin de test** (utilisateur créé par l'API admin du GoTrue local, lien magique vérifié) : la RLS et le Storage ont été éprouvés pour de vrai, sans bouchon d'authentification.

Vérifié :

- Migration : tables, contraintes (`content` doit être un document, un épisode lié vise une seule cible), catégorie supprimée qui laisse l'article sans catégorie, RLS (anonyme : publiés seulement et aucune écriture ; admin : tout ; connecté non admin : refusé), bucket `blog-media` (envoi admin accepté, anonyme refusé, lecture publique).
- BO : création de catégorie (slug suivi du nom), article rédigé dans l'éditeur (gras, intertitre, lien interne, liste, citation, vidéo), catégorie, deux auteurs dans l'ordre, une émission et un podcast liés, publication, passage en brouillon, aperçu signé, liste avec l'état « Programmé ».
- Landing : `/blog`, filtres de catégorie avec compteurs, catégorie vide en `noindex`, article (fil d'Ariane, signature, temps de lecture, vidéo youtube-nocookie, épisodes liés, JSON-LD `BlogPosting`, Open Graph `article`, lien RSS), article programmé et brouillon invisibles (404, absents du flux et du sitemap), bloc de la home, `/blog/feed.xml`, sitemap, `robots.txt`, purge du cache (`POST /api/revalidate` 200), vue téléphone sans débordement, nœud inconnu et lien `javascript:` ignorés au rendu.

Défauts trouvés et corrigés pendant la recette :

1. Document neuf sans paragraphe : l'éditeur restait sans curseur ni texte d'aide.
2. ProseMirror crée ses attributs sans prototype : React refusait de les passer à l'action serveur. Le document repasse par JSON avant l'envoi.
3. Un lien s'étendait au texte tapé juste après lui (autolien de Tiptap) : autolien désactivé.
4. La signature affichait le rôle (`nick`, « Le Captain ») au lieu du pseudo (`name`, « Dark Hifus »).
5. Préexistant : `SmartImage` envoyait à `next/image` une adresse `http` d'un hôte connu, que `remotePatterns` (https seul) refuse, et la page entière tombait. Elle passe désormais par le `<img>` simple.
6. Préexistant : l'intro d'un `SectionHead` aligné à gauche restait centrée (`mx-auto` l'emportait sur `mx-0`), aussi sur `/emissions` et `/podcasts`.

Non vérifié : l'envoi d'une image choisie dans le sélecteur de fichiers (le panneau de test ne sait pas choisir un fichier). Le redimensionnement dans le navigateur reste à essayer à la main ; la règle de Storage qu'il utilise est, elle, vérifiée.

## 8. Recette des résultats du Thermomètre (26/11/2026)

Même montage qu'au §7 (Supabase local, vraie session admin, BO et landing en local). Deux sondages de test : S47 en cours avec 47 votes (30, 12, 5), S48 sans vote.

- « Publier » S48 clôt S47 et publie aussitôt « Résultats du Thermomètre : Le meilleur Zelda de tous les temps ? » : catégorie Le Thermomètre créée, aucun auteur, chapô « Vous avez été 47 personnes à répondre. « Breath of the Wild » l’emporte avec 64 % des votes. », instantané des votes dans le bloc.
- Landing : bloc rendu aux couleurs du Thermomètre (64, 25 et 11 %, gagnant en rouge, date d'arrêt), signature « Par Bento Pop », lien vers la nouvelle question.
- « Archiver » S48 (zéro vote) : aucun article. S47 rouvert puis archivé de nouveau : aucun doublon.
- Bouton « Sondage » de l'éditeur : résultats de S47 insérés dans un article écrit à la main, enregistré sans auteur, accepté par le serveur ; l'article automatique se rouvre dans l'éditeur avec son bloc.
