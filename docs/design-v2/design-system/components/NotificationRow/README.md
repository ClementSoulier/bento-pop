# NotificationRow

Une ligne de « Quoi de neuf ? ».

**Le consommateur fournit** : `kind` (`follow`, `comment`, `like`, `validated`, `refused`, `edition`, `achievement`), `mood` et `color` pour un avatar ou un succès, `time`, et le texte en enfants (pseudos en `<b>`).

- Le texte dit qui a fait quoi, avec les pseudos en gras ; l'heure suit en `text-tertiary`.
