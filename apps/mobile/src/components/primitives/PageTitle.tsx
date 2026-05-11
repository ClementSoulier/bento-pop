import { Text, View } from 'react-native';

type PageTitleProps = {
  /** Petit label tout-caps au-dessus du titre. */
  kicker?: string;
  title: string;
  /** Sous-titre / lead optionnel sous le titre. */
  sub?: string;
};

/**
 * En-tête de section : kicker (eyebrow) + titre display + sub.
 * Cf. design Claude Design — `PageTitle` dans `screens.jsx`.
 */
export function PageTitle({ kicker, title, sub }: PageTitleProps) {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
      {kicker ? (
        <Text
          style={{
            fontFamily: 'Bungee',
            fontSize: 11,
            letterSpacing: 2,
            color: 'rgba(10,10,10,0.55)',
            marginBottom: 6,
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: 'Extenda',
          fontSize: 30,
          lineHeight: 28,
          letterSpacing: -0.3,
          color: '#0a0a0a',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {sub ? (
        <Text
          style={{
            marginTop: 6,
            fontSize: 13,
            color: 'rgba(10,10,10,0.7)',
            lineHeight: 18,
          }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}
