# Button

Le bouton, en pilule, libellé en Fredoka.

**Le consommateur fournit** : le libellé (enfant ou `label`), `variant`, `size` (`lg` 52, `md` 44, `sm` 32 avec zone tactile de 44), `icon` / `iconRight` (nom Phosphor), `block` pour la pleine largeur, `loading`, `disabled`.

- `primary` : l'action principale de l'écran, jaune avec contour et ombre encre. Une seule par écran.
- `secondary` : les autres actions (Modifier, Abonné, Partager sur le profil d'un autre).
- `outline` : une action secondaire posée sur une surface déjà creusée.
- `tertiary` : lien texte souligné (Plus tard, J'ai déjà un compte, Me le rappeler demain) ; `tertiary-danger` pour une sortie destructive (Le supprimer et continuer).
- `danger` : l'action destructive d'une confirmation (Supprimer, Bloquer).
- `on-brand` : l'action principale sur fond jaune (Commencer, Mettre à jour).
- Un libellé de plus de 34 caractères passe sur deux lignes au lieu d'être coupé.
