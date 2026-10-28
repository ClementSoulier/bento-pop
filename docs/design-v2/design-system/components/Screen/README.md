# Screen

Le cadre d'un écran de maquette (iPhone 17 Pro, 402 × 874 pt) : fond, thème et zone sûre du haut.

**Le consommateur fournit** : les enfants (barre du haut, contenu, barre d'onglets, calques), `theme` (`light`, `dark`), `tone` (`app`, `surface`, `sunken`, `brand`), `safeTop={false}` pour peindre sous la barre d'état.

- La zone sûre du haut reste vide : ni heure ni batterie dessinées.
- `tone="brand"` pose le jaune signature et le motif pois : réservé aux moments de marque.
- Les calques (`Sheet`, `Dialog`, `Toast`, `TabBar`) se placent par rapport à `Screen` : mets-les en derniers enfants.
