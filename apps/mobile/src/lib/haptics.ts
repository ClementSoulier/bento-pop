import * as Haptics from 'expo-haptics';

/**
 * Retour tactile : celui du parcours de composition, et les cinq du design
 * system v2 (chantier 30, D11), que les écrans adoptent avec leur chantier,
 * du 31 au 34.
 *
 * Une façade plutôt que des appels directs à `expo-haptics`, pour trois
 * raisons :
 *
 *   1. **Les erreurs ne doivent jamais remonter.** L'haptique est un
 *      agrément. Sur un appareil sans moteur, sur simulateur, ou si le
 *      module natif manque parce que la build n'a pas été régénérée,
 *      `impactAsync` rejette. Une promesse rejetée non gérée dans un
 *      gestionnaire de tap est un plantage évitable pour un effet
 *      décoratif.
 *   2. **Le vocabulaire reste celui du produit**, pas celui de la
 *      bibliothèque : « une case s'est remplie », pas
 *      « notificationAsync(Success) ». Le jour où l'on change d'intensité,
 *      il y a un seul endroit à toucher.
 *   3. **Chaque retour a son moment, et pas un de plus.** Au sixième
 *      déclenchement d'une composition, un retour tactile trop présent
 *      devient agaçant.
 *
 * `expo-haptics` est un module natif : l'ajouter impose de régénérer la
 * build de développement et une nouvelle build EAS avant la prochaine
 * soumission au store. Le plugin ajoute aussi la permission `VIBRATE` au
 * manifeste Android.
 */

/** Avale tout échec : l'haptique ne doit jamais casser un tap. */
const safely = (run: () => Promise<void>) => {
  void run().catch(() => {});
};

/** Tap sur une tuile de résultat ou de proposition. Discret. */
export function tapFeedback() {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Une case vient d'être remplie et enregistrée. */
export function slotFilledFeedback() {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Une écriture a échoué. */
export function failureFeedback() {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

// Les cinq retours du design system v2, d'après le README du dossier de la
// refonte (« Mouvement et retours haptiques »).

/** Un onglet, une puce ou un interrupteur change. Le plus léger. */
export function selectionFeedback() {
  safely(() => Haptics.selectionAsync());
}

/** Le cœur, à l'appui. */
export function likeFeedback() {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Un bento publié, un code validé. */
export function successFeedback() {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Une confirmation destructive s'ouvre. */
export function warningFeedback() {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** Un code faux. */
export function errorFeedback() {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
