import { useState } from 'react';
import { Image, View } from 'react-native';
import { CataloguePage, Specimen } from '@/components/dev/CataloguePage';
import {
  Bento,
  BentoTile,
  Button,
  Progress,
  Tag,
  Text,
  ThemeProvider,
  popyImage,
  useTheme,
  type BentoSlot,
  type BentoTileItem,
} from '@/design';

/** Une image du bundle, le temps du catalogue : la Popy « content » en guise d'affiche. */
const IMAGE = Image.resolveAssetSource(popyImage('content')).uri;

const ITEMS: Record<string, BentoTileItem> = {
  ponyo: { title: 'Ponyo' },
  office: { title: 'The Office' },
  zimmer: {
    title: 'Hans Zimmer',
    subtitle: 'compositeur de films',
    credit: 'Photo : ColliderVideo · Uploader',
    imageUrl: IMAGE,
  },
  dragon: {
    title: 'How To Train Your Dragon',
    subtitle: 'John Powell',
    credit: 'Photo : DreamWorks',
    imageUrl: IMAGE,
  },
  squeezie: {
    title: 'Squeezie',
    subtitle: 'vidéaste web français',
    credit: 'Photo : Zack Nani',
    imageUrl: IMAGE,
  },
  pontNeuf: { title: 'Le Pont Neuf' },
};

const MAIN: readonly Pick<BentoSlot, 'key' | 'category' | 'label' | 'stamp'>[] = [
  { key: 'film', category: 'film', label: 'Film', stamp: 'FILM' },
  { key: 'series', category: 'series', label: 'Série', stamp: 'SÉRIE' },
  { key: 'artist', category: 'artist', label: 'Artiste', stamp: 'ARTISTE' },
  { key: 'track', category: 'track', label: 'Chanson', stamp: 'SON' },
  { key: 'creator', category: 'creator', label: 'Créateur de contenu', stamp: 'CRÉA' },
  { key: 'place', category: 'place', label: 'Lieu', stamp: 'LIEU' },
];

const main = (items: readonly (BentoTileItem | null)[], next?: string): BentoSlot[] =>
  MAIN.map((slot, index) => ({ ...slot, item: items[index] ?? null, next: slot.key === next }));

const FULL = main([
  ITEMS.ponyo!,
  ITEMS.office!,
  ITEMS.zimmer!,
  ITEMS.dragon!,
  ITEMS.squeezie!,
  ITEMS.pontNeuf!,
]);

const QUESTIONS: readonly Pick<BentoSlot, 'key' | 'category' | 'label' | 'stamp' | 'question'>[] = [
  {
    key: 'q1',
    category: 'film',
    label: 'Le film que tu reverrais ce soir',
    stamp: 'FILM',
    question: true,
  },
  {
    key: 'q2',
    category: 'series',
    label: 'La série que tu caches',
    stamp: 'SÉRIE',
    question: true,
  },
  { key: 'q3', category: 'track', label: 'Le son de ton été', stamp: 'SON', question: true },
  { key: 'q4', category: 'place', label: 'Ton voyage rêvé', stamp: 'LIEU', question: true },
  { key: 'q5', category: 'artist', label: "Ton idole d'ado", stamp: 'ARTISTE', question: true },
  { key: 'q6', category: 'film', label: 'Ton film doudou', stamp: 'FILM', question: true },
];

const edition = (count: number, items: readonly (BentoTileItem | null)[] = []): BentoSlot[] =>
  QUESTIONS.slice(0, count).map((slot, index) => ({ ...slot, item: items[index] ?? null }));

/** Des titres qui ont posé un problème : des accents, des mots longs, des idéogrammes. */
const TOUGH: BentoTileItem[] = [
  { title: 'À bout de souffle' },
  { title: 'Été indien' },
  { title: 'Le Mont-Saint-Michel' },
  { title: 'HugoDécrypte (média)' },
  { title: 'Megalovania X Megalovania' },
  { title: '浦沢直樹' },
];

/** La largeur de l'image partagée, et l'échelle qui la fait tenir dans la page. */
const SHARE_WIDTH = 960;
const SHARE_SCALE = 0.36;

/**
 * Le catalogue, page du bento (chantiers 31 et 32) : la puce, les segments, le
 * plateau vide d'illustration, ses cases remplies, en attente, à remplir, les
 * questions d'une édition, les dispositions de 2 à 5 cases, l'image partagée.
 * Les images sont des Popys, le temps du catalogue. Sur `?only=`, une seule.
 */
export default function BentoCatalogue() {
  return (
    <CataloguePage title="Bento">
      <Specimen name="Tag">
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {MAIN.map((slot) => (
              <Tag key={slot.key} category={slot.category} />
            ))}
            <Tag category={null} label="JEU" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {MAIN.map((slot) => (
              <Tag key={slot.key} category={slot.category} variant="surface" icon />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {MAIN.map((slot) => (
              <Tag key={slot.key} category={slot.category} variant="plain" />
            ))}
          </View>
        </View>
      </Specimen>
      <Specimen name="Progress">
        <View style={{ width: 370, maxWidth: '100%', gap: 10 }}>
          <Progress value={0} />
          <Progress value={1} />
          <Progress value={6} />
          <Progress value={2} total={3} />
        </View>
      </Specimen>
      <Specimen name="Bento">
        <Plate>
          <Bento />
        </Plate>
      </Specimen>
      <Specimen name="Bento, complet">
        <Plate>
          <Bento slots={FULL} onSlotPress={() => {}} />
        </Plate>
      </Specimen>
      <Specimen name="Bento, en attente">
        <Plate>
          <Bento
            slots={main(
              [null, null, null, null, null, { ...ITEMS.pontNeuf!, pending: true }],
              'film',
            )}
            onSlotPress={() => {}}
          />
        </Plate>
      </Specimen>
      <Specimen name="Bento, chute">
        <Falling />
      </Specimen>
      <Specimen name="Bento, titres difficiles">
        <Plate>
          <Bento slots={main(TOUGH)} onSlotPress={() => {}} />
        </Plate>
      </Specimen>
      <Specimen name="Bento, repli neutre">
        <Plate>
          <Bento
            slots={[
              {
                key: 'a',
                category: null,
                label: 'Ton jeu de chevet',
                question: true,
                stamp: 'JEU',
                next: true,
              },
              {
                key: 'b',
                category: null,
                label: 'Le livre prêté',
                question: true,
                stamp: 'LIVRE',
                item: { title: 'Dune' },
              },
              { key: 'c', category: 'film', label: 'Film', stamp: 'FILM', item: ITEMS.ponyo },
            ]}
            onSlotPress={() => {}}
          />
        </Plate>
      </Specimen>
      <Specimen name="Édition, à composer">
        <Plate>
          <Bento
            slots={edition(6).map((slot, index) => ({ ...slot, next: index === 0 }))}
            onSlotPress={() => {}}
          />
        </Plate>
      </Specimen>
      <Specimen name="Édition, remplie">
        <Plate>
          <Bento
            slots={edition(6, [
              ITEMS.ponyo!,
              ITEMS.office!,
              ITEMS.dragon!,
              ITEMS.pontNeuf!,
              ITEMS.zimmer!,
              { ...ITEMS.squeezie!, pending: true },
            ])}
            onSlotPress={() => {}}
          />
        </Plate>
      </Specimen>
      {[2, 3, 4, 5].map((count) => (
        <Specimen key={count} name={`Édition, ${count} cases`}>
          <Plate>
            <Bento
              slots={edition(count, [ITEMS.ponyo!, null, ITEMS.pontNeuf!, null, ITEMS.zimmer!])}
              onSlotPress={() => {}}
            />
          </Plate>
        </Specimen>
      ))}
      <Specimen name="Bento, image partagée">
        <SharePlate />
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
          <View style={{ width: 220 }}>
            <BentoTile category="artist" size="l" item={ITEMS.zimmer} />
          </View>
          <View style={{ width: 220 }}>
            <BentoTile category="series" size="l" item={ITEMS.office} />
          </View>
          <View style={{ width: 150 }}>
            <BentoTile category="place" size="s" item={{ ...ITEMS.pontNeuf!, pending: true }} />
          </View>
        </View>
      </Specimen>
    </CataloguePage>
  );
}

function Plate({ children }: { children: React.ReactNode }) {
  return <View style={{ width: 370, maxWidth: '100%' }}>{children}</View>;
}

/** Une case qui arrive : le bouton rejoue sa chute, ou son fondu quand le mouvement est réduit. */
function Falling() {
  const [seq, setSeq] = useState(0);
  return (
    <Plate>
      <View style={{ gap: 12 }}>
        <Bento slots={FULL} dropped={{ caseKey: 'series', seq }} onSlotPress={() => {}} />
        <Button variant="secondary" label="Rejouer la chute" onPress={() => setSeq((n) => n + 1)} />
      </View>
    </Plate>
  );
}

/** L'image partagée se dessine en pixels de story, réduite ici pour tenir dans la page. */
function SharePlate() {
  const { palette } = useTheme();
  const height = 1042 * SHARE_SCALE + 8;
  return (
    <View
      style={{ width: SHARE_WIDTH * SHARE_SCALE + 8, height, backgroundColor: palette['yolk-500'] }}
    >
      <View
        style={{
          width: SHARE_WIDTH,
          transform: [{ scale: SHARE_SCALE }],
          transformOrigin: 'left top',
        }}
      >
        <Bento slots={FULL} density="share" mode="view" width={SHARE_WIDTH} />
      </View>
    </View>
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
      <Bento slots={FULL} />
    </View>
  );
}
