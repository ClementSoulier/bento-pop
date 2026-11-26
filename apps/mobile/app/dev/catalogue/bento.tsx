import { View } from 'react-native';
import { CataloguePage, Specimen } from '@/components/dev/CataloguePage';
import { Bento, BentoTile, Text, ThemeProvider, useTheme } from '@/design';

/**
 * Le catalogue, page du bento (chantier 31, D3) : son seul état vide de
 * composition, sur fond clair et sur fond sombre. Le chantier 32 y ajoute ses
 * cases remplies et ses autres densités.
 */
export default function BentoCatalogue() {
  return (
    <CataloguePage title="Bento">
      <Specimen name="Bento">
        <View style={{ width: 370, maxWidth: '100%' }}>
          <Bento />
        </View>
      </Specimen>
      <Specimen name="Bento, sombre">
        <ThemeProvider scheme="dark">
          <DarkPanel />
        </ThemeProvider>
      </Specimen>
      <Specimen name="BentoTile">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ width: 220 }}>
            <BentoTile category="artist" size="l" />
          </View>
          <View style={{ width: 120 }}>
            <BentoTile category="creator" size="s" />
          </View>
        </View>
      </Specimen>
    </CataloguePage>
  );
}

function DarkPanel() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 370,
        maxWidth: '100%',
        padding: 12,
        borderRadius: 16,
        backgroundColor: colors['bg-app'],
        gap: 8,
      }}
    >
      <Text variant="footnote" color="text-secondary">
        Le sombre ne sert qu'au catalogue, tant qu'il n'est pas décliné.
      </Text>
      <Bento />
    </View>
  );
}
