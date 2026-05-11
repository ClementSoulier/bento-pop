import { View } from 'react-native';

type PaginationProps = {
  /** Nombre total de points. */
  total: number;
  /** Index actif (0-based). */
  active: number;
};

/**
 * Pagination dots façon onboarding : le dot actif est un trait long, les
 * autres sont des cercles. Couleur ink active, ink/25 inactive.
 *
 * Cf. design Claude Design — utilisé dans SplashScreen + MechanicsScreen.
 */
export function Pagination({ total, active }: PaginationProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === active;
        return (
          <View
            key={i}
            style={{
              width: isActive ? 22 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isActive ? '#0a0a0a' : 'rgba(10,10,10,0.25)',
            }}
          />
        );
      })}
    </View>
  );
}
