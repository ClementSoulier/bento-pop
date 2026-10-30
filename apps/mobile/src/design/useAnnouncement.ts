import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Dit un texte qui paraît sans que rien ne le touche : l'erreur d'un champ, un
 * toast, une notification reçue app ouverte (chantier 30, lot 4). Rien ne le
 * lirait sinon, comme le relevait le chantier 11 pour les toasts actuels.
 *
 * iOS le met à la suite de ce que VoiceOver est en train de dire (`queue`),
 * Android le dit aussitôt. Un texte vide ne dit rien ; le même texte n'est
 * redit que s'il change.
 */
export function useAnnouncement(text: string | null | undefined): void {
  useEffect(() => {
    if (!text) return;
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
    } else {
      AccessibilityInfo.announceForAccessibility(text);
    }
  }, [text]);
}
