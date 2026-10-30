import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CataloguePage, Specimen } from '@/components/dev/CataloguePage';
import {
  AppIcon,
  Avatar,
  BrandGround,
  Display,
  Logo,
  Popy,
  Sticker,
  Text,
  type Mood,
} from '@/design';

const MOODS: Mood[] = [
  'content',
  'bisou',
  'intello',
  'gene',
  'surpris',
  'enerve',
  'malade',
  'diable',
];

/**
 * Le catalogue, page de la marque (chantier 30, lot 3) : chaque composant dans
 * les états de son aperçu, aux mesures de `preview.html`.
 */
export default function Marque() {
  return (
    <CataloguePage title="Marque">
      <Specimen name="Popy">
        <Row gap={18}>
          {MOODS.map((mood) => (
            <View key={mood} style={{ alignItems: 'center', gap: 6 }}>
              <Popy mood={mood} size={88} />
              <Text variant="footnote" color="text-secondary">
                {mood}
              </Text>
            </View>
          ))}
        </Row>
      </Specimen>
      <Specimen name="Avatar">
        <Row gap={16}>
          <Avatar mood="gene" color="shiso" size="xl" />
          <Avatar mood="content" color="yolk" size="lg" />
          <Avatar mood="surpris" color="ramune" size="md" />
          <Avatar mood="bisou" color="sakura" size="md" />
          <Avatar mood="intello" color="wasabi" size="sm" />
          <Avatar mood="content" color="thon" size="xs" />
        </Row>
      </Specimen>
      <Specimen name="Logo">
        <Row gap={32}>
          <Logo height={30} />
          <Logo height={44} />
          <BrandGround radius={16} style={{ padding: 16 }}>
            <Logo height={40} />
          </BrandGround>
        </Row>
      </Specimen>
      <Specimen name="AppIcon">
        <Row gap={20}>
          <AppIcon size={84} />
          <AppIcon size={60} />
          <AppIcon size={40} />
          <AppIcon size={24} />
        </Row>
      </Specimen>
      <Specimen name="Sticker">
        <BrandGround
          radius={16}
          style={{ padding: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}
        >
          <Sticker label="L’app companion" />
          <Sticker label="Film préféré" tone="rice" tilt={5} />
          <Sticker label="Nouveau" tone="yolk" tilt={-2} />
        </BrandGround>
      </Specimen>
      <Specimen name="Display">
        <BrandGround radius={16} style={{ width: 360, maxWidth: '100%', padding: 24, gap: 14 }}>
          <Display size="xl" text="Compose ton bento" outline="pop culture." />
          <Display size="m" text="On revient vite" />
        </BrandGround>
      </Specimen>
    </CataloguePage>
  );
}

/** Une rangée de l'aperçu, centrée, à la ligne s'il le faut. */
function Row({ gap, children }: { gap: number; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap }}>
      {children}
    </View>
  );
}
