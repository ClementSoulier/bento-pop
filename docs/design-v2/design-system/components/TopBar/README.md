# TopBar

La barre du haut d'un écran, en trois versions : en ligne, grand titre, marque.

**Le consommateur fournit** : `variant` (`inline`, `large`, `brand`), `title`, `eyebrow` (petit texte au-dessus du grand titre, ex. le pseudo), `subtitle` (grand titre seulement), `back` ou `close` pour l'action de gauche, `actions` (liste de `{ icon, label, badge }` pour des boutons-icônes, `{ kind: 'pill', label, icon }` pour un bouton texte, `{ label }` pour un lien texte), `border` quand le contenu défile dessous, des enfants posés sous la barre.

- `large` pour une racine d'onglet ou le début d'un parcours ; `inline` pour un écran poussé qui défile ; `brand` pour La table uniquement.
- Deux actions à droite au plus. Une troisième passe dans le menu `dots-three`.
- Chaque bouton-icône a un `label` (« Réglages », « Options pour @lea.cine »).
