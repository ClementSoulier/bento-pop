import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CataloguePage, Specimen } from '@/components/dev/CataloguePage';
import {
  BrandGround,
  Display,
  Popy,
  Screen,
  SectionHeader,
  Steps,
  TabBar,
  Tabs,
  ThemeProvider,
  TopBar,
  useTheme,
} from '@/design';

/**
 * Le catalogue, page de la structure (chantier 30, lot 3) : chaque composant
 * dans les états de son aperçu, aux mesures de `preview.html`.
 */
export default function Structure() {
  return (
    <CataloguePage title="Structure">
      <Specimen name="TopBar" bleed>
        <Box height={96}>
          <TopBar variant="large" eyebrow="@theo.pixel" title="Mon bento" />
        </Box>
        <Box height={60}>
          <TopBar
            onBack={() => {}}
            title="@lea.cine"
            border
            actions={[{ icon: 'dots-three', label: 'Options pour @lea.cine' }]}
          />
        </Box>
        <Box height={60}>
          <TopBar variant="brand" />
        </Box>
        <Box height={96}>
          <TopBar
            variant="large"
            title="Quoi de neuf ?"
            actions={[{ kind: 'pill', icon: 'bell', label: 'Notifications' }]}
          />
        </Box>
      </Specimen>
      <Specimen name="TabBar" bleed>
        <Box height={92} end>
          <TabBar active="compose" mood="gene" color="shiso" />
        </Box>
        <ThemeProvider scheme="dark">
          <Box height={92} end>
            <TabBar active="notifs" notifs={7} mood="gene" color="shiso" />
          </Box>
        </ThemeProvider>
      </Specimen>
      <Specimen name="Tabs" bleed>
        <Box height={46}>
          <Tabs items={['Tout le monde', 'Abonnements']} value={0} />
        </Box>
        <Box height={46}>
          <Tabs
            items={[
              { label: 'Abonnés', count: 4 },
              { label: 'Abonnements', count: 2 },
            ]}
            value={1}
            fill
          />
        </Box>
      </Specimen>
      <Specimen name="Steps">
        <View style={{ width: 360, maxWidth: '100%' }}>
          <Steps count={3} index={0} />
        </View>
        <BrandGround radius={12} style={{ width: 360, maxWidth: '100%', padding: 12 }}>
          <Steps count={3} index={2} color="text-on-brand" />
        </BrandGround>
      </Specimen>
      <Specimen name="SectionHeader">
        <View style={{ width: 370, maxWidth: '100%' }}>
          <SectionHeader title="Pourquoi ces choix" action="Tout voir" />
        </View>
      </Specimen>
      <Specimen name="Screen" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        <Mini>
          <Screen>
            <TopBar variant="large" title="Mon bento" />
            <View style={{ flex: 1 }} />
            <TabBar active="compose" mood="gene" color="shiso" />
          </Screen>
        </Mini>
        <Mini>
          <Screen theme="dark">
            <TopBar variant="brand" />
            <Tabs items={['Tout le monde', 'Abonnements']} />
            <View style={{ flex: 1 }} />
            <TabBar active="table" notifs={7} />
          </Screen>
        </Mini>
        <Mini>
          <Screen tone="brand">
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                padding: 28,
              }}
            >
              <Popy mood="malade" size={184} />
              <Display size="l" text="On revient vite" align="center" />
            </View>
          </Screen>
        </Mini>
      </Specimen>
    </CataloguePage>
  );
}

/**
 * Le cadre d'un aperçu : 402 de large, bord fin, coins de 16. Sa hauteur est
 * celle de l'aperçu, au moins : à 130 et 200 %, il grandit avec ce qu'il porte.
 */
function Box({ height, end, children }: { height: number; end?: boolean; children: ReactNode }) {
  const { colors, border } = useTheme();
  return (
    <View
      style={{
        width: 402,
        maxWidth: '100%',
        minHeight: height,
        overflow: 'hidden',
        borderRadius: 16,
        borderWidth: border.hairline,
        borderColor: colors['border-subtle'],
        backgroundColor: colors['bg-app'],
        justifyContent: end ? 'flex-end' : 'flex-start',
      }}
    >
      {children}
    </View>
  );
}

/** Un écran de 402 sur 874 réduit de moitié, comme les vignettes de l'aperçu. */
function Mini({ children }: { children: ReactNode }) {
  const { colors, border } = useTheme();
  return (
    <View
      style={{
        width: 201,
        height: 437,
        overflow: 'hidden',
        borderRadius: 16,
        borderWidth: border.hairline,
        borderColor: colors['border-subtle'],
      }}
    >
      <View
        style={{
          width: 402,
          height: 874,
          transform: [{ translateX: -100.5 }, { translateY: -218.5 }, { scale: 0.5 }],
        }}
      >
        {children}
      </View>
    </View>
  );
}
