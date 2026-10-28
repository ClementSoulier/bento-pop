# Chip

Une puce cliquable : choisir une édition, filtrer, relancer une recherche suggérée.

**Le consommateur fournit** : le libellé, `selected`, `variant` (`filter`, `add` pour une édition pas encore commencée, `suggestion` avec `count`), `icon`.

- Les éditions défilent horizontalement sous le titre de Compose (`.mbp-chip-row`) : « Mon bento » choisi, les éditions commencées en `filter`, les autres en `add`.
- Les suggestions de Trouver (`suggestion`) affichent le nombre de bentos qui les contiennent.
