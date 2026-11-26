import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, useTheme } from '@/design';
import { openStore } from '@/lib/open-store';
import { useIsOffline } from '@/lib/use-is-offline';
import { useAppStatus } from '@/state/app-status';

/**
 * L'invitation douce à mettre à jour depuis le store (chantier 31, D8) : le
 * `Banner` du design, en tête des racines d'onglets, dans le flux. Posé par
 * `app/(tabs)/_layout.tsx` au-dessus des onglets, il pousse l'écran, en-tête
 * compris, au lieu de le recouvrir, et se lit le premier.
 *
 * À ne pas confondre avec la mise à jour requise (`AppBlocker`), qui remplace
 * toute l'app sur `min_version` : ici, `latest_version`, l'app reste
 * utilisable, et la croix retient le refus pour cette version.
 *
 * Rien hors connexion, parce qu'envoyer quelqu'un sur le store sans connexion
 * ne mène nulle part ; rien hors des onglets, qui le portent : ni l'accueil,
 * où l'on perd déjà le plus de monde, ni la recherche d'une case, qu'il
 * recouvrait.
 */
export function UpdateNotice() {
  const offerUpdate = useAppStatus((s) => s.offerUpdate);
  const dismissUpdate = useAppStatus((s) => s.dismissUpdate);
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  if (!offerUpdate || offline) return null;
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors['bg-app'] }}>
      <Banner
        tone="update"
        title="Nouvelle version dispo"
        action="Mettre à jour"
        onAction={openStore}
        onClose={() => {
          void dismissUpdate();
        }}
      />
    </View>
  );
}
