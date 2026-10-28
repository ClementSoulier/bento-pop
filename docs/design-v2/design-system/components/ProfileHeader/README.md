# ProfileHeader

L'en-tête d'un profil : avatar, pseudo, nom et date, réseaux, statistiques, puis les deux boutons.

**Le consommateur fournit** : `handle`, `name`, `meta` (« publié le 28 sept. 2026 »), `mood`, `color`, `socials` (`"instagram|tiktok"`), `stats` (liste de `{ value, label, link }`), et en enfants deux `Button` `size="md"`.

- Statistiques : abonnés (lien), visites (si la personne les affiche), mêmes goûts (lien).
- Son profil : « Modifier » en `secondary`, « Partager » en `primary`. Le profil d'un autre : « S’abonner » en `primary`, ou « Abonné » / « Demandé » en `secondary` ; « Compose le tien » en `primary` quand on n'a pas encore publié.
