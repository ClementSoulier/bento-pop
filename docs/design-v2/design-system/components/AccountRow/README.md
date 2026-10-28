# AccountRow

Un compte dans une liste : abonnés, recherche, mêmes goûts, demandes.

**Le consommateur fournit** : `handle`, `name`, `detail` (et `detailCategory` pour sa puce), `mood`, `color`, `actions` (liste de `{ label, variant }`, petits boutons) ou `trailing` (`chevron`, `none`).

- Les actions restent sur la ligne, à droite : « Accepter » (`primary`) et « Refuser », ou « Retirer », ou « Voir ».
