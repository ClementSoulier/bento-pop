import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, type PantryColor } from '../brand/Avatar';
import type { Mood } from '../brand/popy-images';
import { Icon } from '../Icon';
import { Badge } from '../overlays/Badge';
import { PopShadow } from '../PopShadow';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { timingConfig, useMotion } from '../useMotion';
import { TABS, tabAccessibilityLabel, type TabKey } from './tab-items';

export type { TabKey };

export type TabBarProps = {
  active?: TabKey;
  /** Les onglets montrés, dans l'ordre du design : les cinq par défaut. */
  tabs?: readonly TabKey[];
  /** Le nombre de nouveautés, en pastille sur Notifs. */
  notifs?: number;
  /** La Popy et la teinte de la personne, pour l'onglet Profil. */
  mood?: Mood;
  color?: PantryColor;
  onSelect?: (tab: TabKey) => void;
};

/**
 * Les onglets (chantier 30, famille de la structure), toujours dans l'ordre
 * du design et libellés : Compose au centre dans sa pastille jaune sur son
 * ombre, l'onglet courant en icône pleine et en libellé gras, Profil en
 * avatar, cerclé quand il est courant. Branchée sur la navigation au chantier
 * 31, qui retire Notifs quand sa zone est coupée (D2 du 31).
 *
 * Chaque onglet s'annonce comme avant, « La table, onglet 1 sur 5 », bouton
 * sélectionné quand il est courant.
 */
export function TabBar({
  active = 'compose',
  tabs = TABS.map((tab) => tab.key),
  notifs = 0,
  mood = 'content',
  color = 'yolk',
  onSelect,
}: TabBarProps) {
  const { colors, border, size } = useTheme();
  const insets = useSafeAreaInsets();
  const shown = TABS.filter((tab) => tabs.includes(tab.key));
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors['tabbar-bg'],
        borderTopWidth: border.hairline,
        borderTopColor: colors['border-subtle'],
        paddingBottom: insets.bottom,
      }}
    >
      {shown.map((tab, index) => {
        const on = tab.key === active;
        const label = tabAccessibilityLabel(tab.key, index + 1, shown.length, notifs);
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect?.(tab.key)}
            style={{
              flex: 1,
              height: size.tabbar,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <View style={{ height: 28, alignItems: 'center', justifyContent: 'center' }}>
              {tab.key === 'compose' ? (
                <ComposePill on={on} />
              ) : tab.key === 'profil' ? (
                <Me on={on} mood={mood} color={color} />
              ) : tab.icon ? (
                <Icon
                  name={tab.icon}
                  size={26}
                  weight={on ? 'fill' : 'bold'}
                  color={on ? 'text-primary' : 'text-secondary'}
                />
              ) : null}
              {tab.key === 'notifs' && notifs > 0 ? (
                <Badge count={notifs} style={{ position: 'absolute', top: -5, left: 12 }} />
              ) : null}
            </View>
            <Text
              variant="tab-label"
              weight={on ? 600 : undefined}
              color={on || tab.key === 'compose' ? 'text-primary' : 'text-secondary'}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** La pastille de Compose, qui se penche et grandit un peu quand l'onglet est courant. */
function ComposePill({ on }: { on: boolean }) {
  const { colors, border } = useTheme();
  const motion = useMotion();
  const lean = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    lean.value = withTiming(on ? 1 : 0, timingConfig(motion.move('fast', 'pop')));
  }, [on, lean, motion]);
  const pose = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-4 * lean.value}deg` }, { scale: 1 + 0.04 * lean.value }],
  }));
  return (
    <Animated.View style={pose}>
      <PopShadow level="pop-sm" radius={12}>
        <View
          style={{
            width: 46,
            height: 32,
            borderRadius: 12,
            borderWidth: border.ink,
            borderColor: colors.ink,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={22} color="on-accent" />
        </View>
      </PopShadow>
    </Animated.View>
  );
}

/** L'avatar de la personne ; courant, un anneau de 2 à 2 de distance. */
function Me({ on, mood, color }: { on: boolean; mood: Mood; color: PantryColor }) {
  const { colors } = useTheme();
  return (
    <View>
      {on ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: 17,
            borderWidth: 2,
            borderColor: colors['text-primary'],
          }}
        />
      ) : null}
      <Avatar mood={mood} color={color} size={26} />
    </View>
  );
}
