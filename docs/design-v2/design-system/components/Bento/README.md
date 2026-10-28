# Bento

Le plateau de six cases : une grande (Film), deux moyennes (Série, Artiste), trois petites (Chanson, Créateur de contenu, Lieu).

**Le consommateur fournit** : `items` (six objets `{ title, subtitle, credit, image, initial, pending }` ou `null`, dans l'ordre Film, Série, Artiste, Chanson, Créateur de contenu, Lieu) ou `slots` (six `{ category, prompt, item, next }` pour une édition), `mode` (`view`, `edit`), `density` (`feed` par défaut, `compose` un peu plus bas, `mini` pour une vignette, `share` pour l'image partagée), `label`.

- C'est le seul objet de l'écran qui porte le contour encre et l'ombre franche : rien d'autre ne doit lui faire concurrence.
- Une case avec image reçoit le dégradé `media-scrim` et un texte blanc ; sans image, elle prend la couleur de sa catégorie et son initiale géante.
- Le crédit photo (`credit`) est obligatoire quand la licence de l'image le demande ; il reste en 10 px sous le sous-titre.
- En composition, les cases vides montrent un « + » et le libellé ou la question de l'édition ; `next` met en avant la case à remplir maintenant.
