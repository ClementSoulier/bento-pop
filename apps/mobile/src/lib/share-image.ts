import { Platform } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { shareBento, type ShareOutcome } from './share';

/**
 * Partage le bento sous forme d'image PNG capturée (story Instagram-friendly).
 *
 * - **Native** : `captureRef` rend la View en PNG dans un fichier temporaire,
 *   puis `expo-sharing.shareAsync(uri)` ouvre le sheet de partage natif
 *   (Photos, Instagram, Messages, etc.).
 * - **Web** : on reste sur le partage URL classique (`shareBento`) — la
 *   capture via view-shot n'est pas fiable cross-browser, on évitera des
 *   surprises. L'utilisateur peut toujours faire un screenshot manuel.
 *
 * En cas d'erreur (permission refusée, view non rendue, etc.), fallback
 * automatique sur le partage URL pour ne JAMAIS laisser l'utilisateur sans
 * solution.
 */
export async function shareBentoImage(
  pseudo: string,
  ref: RefObject<View | null>,
): Promise<ShareOutcome> {
  if (Platform.OS === 'web' || !ref.current) {
    return shareBento(pseudo);
  }

  try {
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: `@${pseudo} · Bento Pop`,
      });
      return 'shared';
    }
    // Pas de sheet de partage dispo (rare : Android sans aucune app de share)
    return shareBento(pseudo);
  } catch {
    // Capture échouée → fallback URL share, l'utilisateur n'est jamais bloqué
    return shareBento(pseudo);
  }
}
