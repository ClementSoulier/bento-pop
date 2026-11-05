import { hide as hideNativeSplash } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { BrandGround, Logo, Popy, Text } from '@/design';

/**
 * Le lancement côté JavaScript, tant que les polices, la session anonyme et la
 * configuration de l'app ne sont pas là (chantier 31, D11).
 *
 * Sans maquette, il est composé des éléments de l'accueil, sur le même jaune :
 * Popy reste à la place, au centre et à la taille de celle du lancement natif
 * (`assets/splash-icon.png`, 176 points), qui prend ses pois, son logo et son
 * dandinement, sans saut.
 *
 * La légende sert au téléchargement d'une mise à jour à distance. Réutiliser
 * le splash plutôt que dessiner un écran dédié garantit la continuité avec le
 * splash natif qui le précède, et c'est justement ce qu'on veut pendant un
 * rechargement. Pas de barre de progression : `fetchUpdateAsync` ne rapporte
 * aucun avancement, une barre serait un mensonge.
 *
 * Rendu hors de l'arbre de l'app : le thème y est celui par défaut.
 */
type SplashProps = {
  caption?: string;
};

export function Splash({ caption }: SplashProps) {
  return (
    <BrandGround
      onLayout={() => hideNativeSplash()}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <StatusBar style="dark" />
      <View style={{ alignItems: 'center' }}>
        <View style={{ position: 'absolute', bottom: '100%', marginBottom: 28 }}>
          <Logo height={40} />
        </View>
        <Popy mood="content" size={176} wiggle />
        {caption ? (
          <Text
            variant="label-s"
            numberOfLines={1}
            style={{
              position: 'absolute',
              top: '100%',
              marginTop: 20,
              width: 240,
              textAlign: 'center',
            }}
          >
            {caption}
          </Text>
        ) : null}
      </View>
    </BrandGround>
  );
}
