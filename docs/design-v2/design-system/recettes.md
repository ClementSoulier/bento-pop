# Recettes d'écrans

Chaque recette est un écran complet de 402 × 874 pt, écrit pour un plan de travail de canevas Design (`.dc.html`). Les composants viennent de `window.MonBentoPop` ; la mise en page reste du HTML simple avec des piles flex. Les listes de données (cases, actions, statistiques) sont rendues par `renderVals()` et passées avec `{{ … }}`.

## En-tête commun d'un plan de travail

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Nom de l'écran</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="ds/monbentopop/tokens.css">
<link rel="stylesheet" href="ds/monbentopop/components/bundle.css">
<script src="ds/monbentopop/components/bundle.js"></script>
</head>
```

Le corps commence toujours par un cadre de la taille de l'écran, puis `Screen` :

```html
<x-dc>
<helmet><style>body{margin:0}</style></helmet>
<div style="width: 402px; height: 874px; overflow: hidden; position: relative;">
  <x-import component-from-global-scope="MonBentoPop.Screen">
    … l'écran …
  </x-import>
</div>
</x-dc>
```

`Screen` réserve la zone sûre du haut (62 pt) : n'y dessine ni heure ni batterie. Pour le thème sombre : `theme="dark"`. Pour un moment de marque : `tone="brand"`.

## Racine d'onglet

```html
<x-import component-from-global-scope="MonBentoPop.TopBar" variant="large" title="Quoi de neuf ?" actions="{{actions}}"></x-import>
<div class="mbp-stack" style="--stack-gap: 0px;">
  <div class="mbp-eyebrow" style="padding: 6px 16px 2px;">Plus tôt</div>
  <x-import component-from-global-scope="MonBentoPop.NotificationRow" kind="like" time="il y a 46 min">4 personnes ont aimé ton bento</x-import>
</div>
<x-import component-from-global-scope="MonBentoPop.TabBar" active="notifs" mood="gene" color="shiso"></x-import>
```

`renderVals()` renvoie `{ actions: [{ kind: 'pill', icon: 'bell', label: 'Notifications' }] }`. La barre d'onglets se pose en dernier : elle est collée en bas. Pour La table : `TopBar variant="brand"` puis `Tabs items="Tout le monde|Abonnements" value="0"`.

## Le bento

```html
<x-import component-from-global-scope="MonBentoPop.Bento" items="{{bento}}"></x-import>
<x-import component-from-global-scope="MonBentoPop.ActionBar" likes="4" comments="2"></x-import>
```

`bento` est une liste de six objets dans l'ordre Film, Série, Artiste, Chanson, Créateur de contenu, Lieu : `{ title, subtitle, credit, image }` ou `null` pour une case vide. Sans `image`, la case prend sa couleur et son initiale géante. `pending: true` ajoute le sablier « en attente de validation ». En composition : `mode="edit" density="compose"`, et `slots` à la place de `items` pour une édition (`{ category, prompt, item, next }` par case, `next: true` sur la case à remplir maintenant).

## Écran poussé avec grand titre

```html
<x-import component-from-global-scope="MonBentoPop.TopBar" variant="large" back="true" title="Réglages"></x-import>
<div class="mbp-stack" style="--stack-gap: 24px; padding: 8px 16px 0;">
  <x-import component-from-global-scope="MonBentoPop.List" header="Notifications" footer="Réglé sur ce téléphone.">
    <x-import component-from-global-scope="MonBentoPop.ListRow" icon="check-circle" title="Mes items" subtitle="Quand l’équipe valide ou refuse ce que tu proposes." trailing="switch" checked="true"></x-import>
  </x-import>
</div>
```

Quand l'écran a défilé, la barre passe en version en ligne avec filet : `TopBar back="true" title="Réglages" border="true"`.

## Parcours (un champ, une action)

```html
<x-import component-from-global-scope="MonBentoPop.TopBar" back="true"></x-import>
<div class="mbp-stack" style="--stack-gap: 16px; padding: 0 16px;">
  <x-import component-from-global-scope="MonBentoPop.Popy" mood="intello" size="88" tilt="-4"></x-import>
  <h1 class="title-1" style="margin: 0;">Garde ton compte</h1>
  <p class="body-l" style="margin: 0;">Ajoute ton adresse email…</p>
  <x-import component-from-global-scope="MonBentoPop.TextField" label="Adresse email" placeholder="ton@adresse.fr" helper="Elle n’est jamais affichée."></x-import>
  <x-import component-from-global-scope="MonBentoPop.Button" block="true" disabled="true">Recevoir un code</x-import>
</div>
```

Le bouton reste `disabled` tant que le champ n'est pas valide. Pour un code : `CodeField value="" focused="true"`, puis les liens `Button variant="tertiary" size="md"` (« Renvoyer le code dans 57 s » en `disabled`, « Changer d’adresse »).

## Feuille

```html
<x-import component-from-global-scope="MonBentoPop.Sheet" height="full" eyebrow="Case" eyebrow-category="artiste" title="Artiste">
  <x-import component-from-global-scope="MonBentoPop.SearchField" placeholder="Cherche un artiste…" focused="true"></x-import>
  <div class="mbp-eyebrow">Au menu</div>
  <x-import component-from-global-scope="MonBentoPop.ItemGrid" items="{{items}}" category="artiste"></x-import>
</x-import>
```

La feuille se pose après le contenu de l'écran : elle apporte son voile. `height="large"` pour les commentaires, `"auto"` pour une feuille courte. Une action collée en bas se met dans `SheetFooter`.

## Demande, choix, confirmation

```html
<x-import component-from-global-scope="MonBentoPop.AskSheet" mood="content" title="On te prévient quand une édition sort ?" message="Une notification par semaine, le jeudi à 18 h." primary="Oui" secondary="Non merci"></x-import>

<x-import component-from-global-scope="MonBentoPop.ActionSheet" title="Options pour @lea.cine" actions="{{options}}"></x-import>

<x-import component-from-global-scope="MonBentoPop.Dialog" mood="gene" title="Supprimer mon compte ?" message="Toutes tes données seront effacées définitivement." actions="{{confirm}}"></x-import>
```

`options` : `[{ label: 'Signaler ce bento', icon: 'flag' }, { label: 'Bloquer @lea.cine', icon: 'prohibit', tone: 'danger' }]`. `confirm` : `[{ label: 'Supprimer', variant: 'danger' }, { label: 'Annuler', variant: 'secondary' }]` ; l'action qui engage vient en premier, « Annuler » en dernier.

## Retours

```html
<x-import component-from-global-scope="MonBentoPop.Toast" message="Compte gardé" icon="check-circle"></x-import>
<x-import component-from-global-scope="MonBentoPop.Toast" message="Créateur de contenu : Squeezie" action="Annuler" icon="arrows-clockwise"></x-import>
<x-import component-from-global-scope="MonBentoPop.Banner" tone="offline"></x-import>
<x-import component-from-global-scope="MonBentoPop.InAppNotice" title="Proposition validée" message="« Ponyo » est au catalogue : ta case est en ligne."></x-import>
```

Le toast se pose 8 pt au-dessus de la barre d'onglets (`offset="98"`, réglage par défaut) ; sans barre d'onglets, `offset="46"`. Il ne couvre jamais la barre du haut ni le bouton retour.

## Moment de marque

```html
<x-import component-from-global-scope="MonBentoPop.Screen" tone="brand">
  <div class="mbp-stack" style="--stack-gap: 16px; flex: 1; padding: 0 28px; justify-content: center; align-items: center; text-align: center;">
    <x-import component-from-global-scope="MonBentoPop.Popy" mood="malade" size="184" wiggle="true"></x-import>
    <x-import component-from-global-scope="MonBentoPop.Display" size="l" align="center">On revient vite</x-import>
    <p class="body-l" style="margin: 0;">Mon Bento Pop est en maintenance, on revient dans quelques minutes.</p>
  </div>
</x-import>
```

Sur fond jaune, le bouton principal est `variant="on-brand"`.

## Dans le code

Le même écran en React, hors canevas :

```js
const M = window.MonBentoPop, h = React.createElement;
h(M.Screen, null,
  h(M.TopBar, { variant: 'large', eyebrow: '@theo.pixel', title: 'Mon bento' }),
  h('div', { className: 'mbp-stack', style: { padding: '0 16px', '--stack-gap': '14px' } },
    h(M.Progress, { value: 2 }),
    h(M.Bento, { items: bento, mode: 'edit', density: 'compose' }),
    h(M.Button, { block: true }, 'Compléter (4 restants)')),
  h(M.TabBar, { active: 'compose', mood: 'gene', color: 'shiso' }));
```
