import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import { YellowBg } from '@/components/primitives';

/**
 * Splash custom affiché pendant le chargement des fonts + de la session
 * anonymous. Remplace le `<View backgroundColor=yellow />` vide de P1.
 *
 * Animation : logo en fade-in léger depuis 80 % d'opacité + scale 0.95,
 * Popy qui « bob » verticalement de quelques pixels avec une rotation
 * douce. Loop indéfini — l'écran reste tant que `init()` n'a pas terminé.
 */
export function Splash() {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });

  return (
    <YellowBg>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <Image source={logo} style={{ width: 220, height: 60 }} resizeMode="contain" />
        <Animated.Image
          source={popyContent}
          style={{
            width: 180,
            height: 180,
            transform: [{ translateY }, { rotate }],
          }}
          resizeMode="contain"
        />
      </View>
    </YellowBg>
  );
}
