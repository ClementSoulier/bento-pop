import { Platform } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { shareBento, type ShareOutcome } from './share';

/**
 * Précharge les URLs distantes pour qu'elles soient présentes au moment du
 * `captureRef`. Sans ça, la capture peut snapshot une image avant la fin de
 * son téléchargement → case vide dans le PNG partagé.
 *
 * **Le `prefetch` doit venir d'`expo-image`, pas de React Native.** Depuis
 * que `Tile` rend ses visuels avec `expo-image`, les deux bibliothèques ont
 * des caches distincts : `Image.prefetch` de RN remplirait un cache que le
 * composant ne lit jamais, et la fonction ne préchargerait plus rien tout
 * en continuant à réussir silencieusement.
 *
 * `cachePolicy` explicite pour coller à celle du composant (le défaut de
 * `prefetch` est `'disk'`, celui de `Tile` est `'memory-disk'`).
 *
 * Un `prefetch` par URL plutôt qu'un seul appel sur le tableau : la forme
 * tableau résout `false` dès le premier échec, sans attendre les autres, ce
 * qui ferait capturer trop tôt à cause d'une seule URL morte. Timeout de 3s
 * par image pour ne pas bloquer le partage si une source est down (rare,
 * mais arrive avec Wikipedia et OSM).
 */
async function preloadImages(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map((url) =>
      Promise.race([
        Image.prefetch(url, 'memory-disk'),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]).catch(() => {
        // Échec silencieux : on capture quand même, mieux vaut une case
        // vide qu'un partage qui plante.
      }),
    ),
  );
}

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
  imageUrls: string[] = [],
): Promise<ShareOutcome> {
  if (Platform.OS === 'web' || !ref.current) {
    return shareBento(pseudo);
  }

  try {
    // 1. Précharger les images distantes pour qu'elles soient présentes
    //    dans le PNG capturé (sinon race : captureRef peut snapshot avant
    //    que les Image aient fini leur download).
    if (imageUrls.length > 0) {
      await preloadImages(imageUrls);
    }
    // 2. Petit délai pour laisser le layout/paint final se faire (police
    //    Extenda offscreen + nouvelles images chargées). Cf. fix
    //    `top: -10000` → `opacity: 0` pour ShareImage.
    await new Promise((resolve) => setTimeout(resolve, 80));
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
