/**
 * Ce que le lecteur d'écran doit dire quand l'écran change tout seul.
 *
 * Relevé au chantier 11 : rien dans l'app n'appelait `announceForAccessibility`
 * ni ne posait de région vivante. Choisir un item ferme la modale et affiche
 * « FILM : INCEPTION · ANNULER » en silence ; la perte de connexion pose un
 * bandeau rouge que VoiceOver ne lit pas davantage. Les deux sont pourtant des
 * changements d'état, et le second conditionne ce que l'app peut faire.
 *
 * Les textes annoncés sont construits ici, en fonctions pures testées ; l'appel à
 * `AccessibilityInfo.announceForAccessibility` reste dans les écrans, ce module
 * devant rester chargeable sous `node:test`, sans `react-native`.
 */

/**
 * Ce qu'annonce un toast.
 *
 * Le message est déjà une phrase, en capitales à l'écran seulement : il est
 * annoncé tel qu'il est écrit. L'action, quand il y en a une, est nommée à la
 * suite : sinon rien ne dit qu'un bouton « Annuler » vient d'apparaître, et il
 * disparaît au bout de cinq secondes.
 */
export function toastAnnouncement(message: string, actionLabel?: string | null): string {
  const text = message.trim();
  if (!text) return '';
  return actionLabel ? `${text}. Action disponible : ${actionLabel}.` : text;
}

/** Ce qu'annonce le passage hors ligne, et le retour. */
export function connectionAnnouncement(offline: boolean): string {
  return offline ? 'Pas de connexion' : 'Connexion rétablie';
}
