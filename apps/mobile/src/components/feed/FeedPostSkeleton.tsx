import { View } from 'react-native';
import { BentoBoxSkeleton, SKELETON_BONE } from '@/components/bento/BentoBoxSkeleton';
import { HEADER_GAP, POST_GAP } from './layout';

type FeedPostSkeletonProps = {
  sideInset: number;
  scale: number;
};

/**
 * Squelette d'un post, affiché pendant le premier chargement du fil.
 *
 * Un `ActivityIndicator` centré fait sauter la hauteur de l'écran à l'arrivée
 * des données et n'annonce rien de ce qui va s'afficher. Le squelette occupe
 * exactement la place du post à venir.
 *
 * La boîte vient de `BentoBoxSkeleton`, partagé avec la page publique : ses
 * proportions sont celles de `BentoGrid`, par construction.
 */
export function FeedPostSkeleton({ sideInset, scale }: FeedPostSkeletonProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ marginHorizontal: sideInset, marginBottom: POST_GAP }}
    >
      {/* Étiquette d'identité */}
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#ffffff',
          borderWidth: 2.5,
          borderColor: '#0a0a0a',
          borderRadius: 14,
          paddingLeft: 8,
          paddingRight: 16,
          paddingVertical: 8,
          transform: [{ rotate: '-1.5deg' }],
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: SKELETON_BONE }} />
        <View style={{ gap: 6 }}>
          <View
            style={{ width: 108, height: 12, borderRadius: 4, backgroundColor: SKELETON_BONE }}
          />
          <View style={{ width: 68, height: 8, borderRadius: 4, backgroundColor: SKELETON_BONE }} />
        </View>
      </View>

      <View style={{ marginTop: HEADER_GAP }}>
        <BentoBoxSkeleton scale={scale} />
      </View>
    </View>
  );
}
