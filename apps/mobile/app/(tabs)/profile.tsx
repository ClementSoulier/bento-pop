import { Image, Platform, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { POPY_CHOICES } from '@/lib/popy-avatar';
import {
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  fontScaleFor,
} from '@/components/bento/font-scaling';
import { INK_MUTED, SHADOWS, StampButton, YellowBg } from '@/components/primitives';
import { TAB_BAR_BASE_INSET, tabBarHeight } from '@/components/tab-bar';
import { AccountScreen, SettingsButton } from '../u/[pseudo]';

/**
 * L'onglet Profil, chantier 21 (D3) : sa propre page, telle que les autres la
 * voient, `AccountScreen`, avec « Réglages » dans la barre du haut. Les
 * réglages que l'onglet portait sous l'identité ont leur écran,
 * `app/settings.tsx`.
 *
 * Avant sa première publication, le compte n'a pas encore de pseudo
 * (chantier 9) : l'onglet garde l'état d'avant, « Pas encore publié » et de
 * quoi reprendre son bento, avec les réglages.
 */
export default function ProfileTab() {
  const pseudo = useSession((s) => s.profile?.pseudo);
  const insets = useSafeAreaInsets();
  // La même hauteur que `app/(tabs)/_layout.tsx` donne à la barre d'onglets :
  // la page tient au-dessus d'elle.
  const tabBar = tabBarHeight(
    insets.bottom,
    Platform.OS === 'ios' ? TAB_BAR_BASE_INSET.ios : TAB_BAR_BASE_INSET.android,
  );

  if (pseudo) {
    return <AccountScreen pseudo={pseudo} slug={null} mode="tab" tabBarHeight={tabBar} />;
  }
  return <BeforeFirstPublication />;
}

/**
 * Un compte sans pseudo : rien n'est en ligne, et il n'y a pas encore de page
 * à montrer. Le Popy content, et non celui que tirerait un pseudo vide, le
 * diable, que l'onglet montrait jusqu'ici à chaque nouveau venu.
 *
 * Les textes appliquent eux-mêmes la taille système, comme la page du
 * compte, cf. `app/u/[pseudo].tsx`.
 */
function BeforeFirstPublication() {
  const popy = POPY_CHOICES[0];
  const { fontScale } = useWindowDimensions();
  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={{ height: 44, paddingTop: 8, paddingHorizontal: 16, flexDirection: 'row' }}>
          <SettingsButton />
        </View>
        <View style={{ alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 }}>
          <View
            style={[
              {
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: '#ffffff',
                borderWidth: 4,
                borderColor: '#0a0a0a',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              },
              SHADOWS.stampLg,
            ]}
          >
            {popy ? (
              <Image source={popy.source} style={{ width: 110, height: 110 }} resizeMode="contain" />
            ) : null}
          </View>

          <Text
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
            style={{
              fontFamily: 'Extenda',
              fontSize: 36 * fontScaleFor(fontScale, TITLE_MAX_FONT_MULTIPLIER),
              letterSpacing: 1,
              marginTop: 20,
              textTransform: 'uppercase',
            }}
          >
            @…
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
            style={{
              fontFamily: 'Bungee',
              fontSize: 9 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
              letterSpacing: 1,
              marginTop: 10,
              color: INK_MUTED,
              textTransform: 'uppercase',
            }}
          >
            Pas encore publié
          </Text>

          <View style={{ marginTop: 32, width: '100%' }}>
            <StampButton wide variant="primary" onPress={() => router.push('/(tabs)/compose')}>
              Reprendre mon bento
            </StampButton>
          </View>
        </View>
      </SafeAreaView>
    </YellowBg>
  );
}
