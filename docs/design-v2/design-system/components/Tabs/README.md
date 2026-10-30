# Tabs

Des onglets texte soulignés pour basculer entre deux ou trois vues d'une même liste.

**Le consommateur fournit** : `items` (`"Tout le monde|Abonnements"` ou une liste de `{ label, count }`), `value` (index de l'onglet actif), `fill` pour répartir sur toute la largeur.

- La table : « Tout le monde » / « Abonnements ». Abonnés : « Abonnés 4 » / « Abonnements 2 » en `fill`.
- Trois onglets au plus ; au-delà, c'est une `Chip` de filtre.
