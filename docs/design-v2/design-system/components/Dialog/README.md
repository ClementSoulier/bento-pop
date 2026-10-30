# Dialog

La boîte de confirmation, en sticker, avec Popy.

**Le consommateur fournit** : `title` (la question), `message` (la conséquence en une phrase), `mood`, `actions` (liste de `{ label, variant }` : l'action qui engage d'abord, « Annuler » en dernier).

- Réservée aux décisions qui coûtent : supprimer, retirer, bloquer, se déconnecter.
- L'action destructive est `danger` ; une action réversible reste `primary`.
