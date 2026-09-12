import * as Haptics from 'expo-haptics';

/**
 * Retour tactile du parcours de composition.
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
 *   3. **Trois usages, et pas un de plus.** Au sixième déclenchement d'une
 *      composition, un retour tactile trop présent devient agaçant.
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
