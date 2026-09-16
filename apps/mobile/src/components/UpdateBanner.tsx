import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStatus } from '@/state/app-status';
import { useIsOffline } from '@/lib/use-is-offline';
import { openStore } from '@/lib/open-store';
import { CONTROL_MAX_FONT_MULTIPLIER } from '@/components/bento/font-scaling';

/**
 * Invitation DOUCE à mettre à jour depuis le store.
 *
 * À ne pas confondre avec `ForceUpdateScreen` : celui-là remplace toute
 * l'app et n'offre aucune sortie, il se déclenche sur `min_version`. Ici on
 * s'appuie sur `latest_version`, l'app reste utilisable, et « Plus tard »
 * mémorise le refus pour cette version.
 *
 * Le choix du bandeau plutôt que d'une feuille modale est délibéré : le
 * blocage dur existe déjà pour les cas où il faut vraiment forcer, donc le
 * cas facultatif n'a pas à s'imposer au lancement.
 *
 * Trois raisons de ne rien afficher, en plus de « pas de mise à jour » :
 *  - hors ligne, parce qu'envoyer quelqu'un sur le store sans connexion ne
 *    mène nulle part ;
 *  - hors des onglets. Interrompre l'onboarding pour envoyer sur le store
 *    est absurde chez quelqu'un qui vient d'installer, et c'est l'endroit du
 *    tunnel où l'on perd déjà le plus de monde (105 installs → 69 pseudos).
 *    Ça écarte aussi la modale de recherche, où le bandeau flotterait par
 *    dessus la saisie ;
 *  - `zIndex` 999, sous `OfflineBanner` qui occupe la même place en 1000.
 *    La règle du hors-ligne rend la superposition impossible, celle-ci est
 *    la ceinture.
 */
export function UpdateBanner() {
  const offerUpdate = useAppStatus((s) => s.offerUpdate);
  const dismissUpdate = useAppStatus((s) => s.dismissUpdate);
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  const inTabs = segments[0] === '(tabs)';
  if (!offerUpdate || offline || !inTabs) return null;

  return (
    <View style={[styles.wrap, { top: insets.top }]}>
      <View style={styles.row}>
        <Text
          style={styles.label}
          numberOfLines={1}
          maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
        >
          Nouvelle version dispo
        </Text>
        <Pressable
          onPress={openStore}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Mettre à jour Mon Bento Pop sur le store"
          style={styles.cta}
        >
          <Text
            style={styles.ctaLabel}
            numberOfLines={1}
            maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
          >
            Mettre à jour
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void dismissUpdate();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Plus tard, masquer cette invitation"
          style={styles.close}
        >
          {/* Une croix dans une cible de 24 pt, pas un texte à lire. */}
          <Text allowFontScaling={false} style={styles.closeLabel}>
            ✕
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // `top` est posé à l'inset, pas à 0 avec un padding : peindre l'encre
    // derrière la barre d'état donnait une heure noire sur fond noir. Le
    // bandeau se pose SOUS la barre d'état, qui garde son fond jaune.
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: '#0a0a0a',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 12,
    gap: 12,
  },
  label: {
    flex: 1,
    fontFamily: 'Bungee',
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#fbbf24',
    textTransform: 'uppercase',
  },
  cta: {
    backgroundColor: '#fbbf24',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  ctaLabel: {
    fontFamily: 'Bungee',
    fontSize: 10,
    letterSpacing: 1,
    color: '#0a0a0a',
    textTransform: 'uppercase',
  },
  close: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    fontFamily: 'Fredoka',
    fontSize: 16,
    lineHeight: 18,
    color: '#fbf3de',
  },
});
