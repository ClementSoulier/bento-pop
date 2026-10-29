import { router, type Href } from 'expo-router';
import { Pressable } from 'react-native';
import { CataloguePage } from '@/components/dev/CataloguePage';
import { Icon, Text, useTheme } from '@/design';

const PAGES: { href: Href; title: string; detail: string }[] = [
  {
    href: '/dev/catalogue/fondations',
    title: 'Fondations',
    detail: 'Icônes, ombres, mouvement, haptique',
  },
  {
    href: '/dev/catalogue/structure',
    title: 'Structure',
    detail: 'Screen, TopBar, TabBar, Tabs, Steps, SectionHeader',
  },
  { href: '/dev/catalogue/actions', title: 'Actions', detail: 'Button, IconButton, Chip' },
  {
    href: '/dev/catalogue/marque',
    title: 'Marque',
    detail: 'Popy, Avatar, Logo, AppIcon, Sticker, Display',
  },
];

/**
 * Le catalogue du design system v2 (chantier 30, D12), ouvert par
 * `bentopop://dev/catalogue` : une page par famille, comme le dossier de la
 * refonte. Les listes, la saisie, les calques et les retours y entrent au
 * lot 4.
 */
export default function Catalogue() {
  const { colors, space, border } = useTheme();
  return (
    <CataloguePage title="Catalogue">
      {PAGES.map((page) => (
        <Pressable
          key={page.title}
          accessibilityRole="button"
          accessibilityLabel={`${page.title} : ${page.detail}`}
          onPress={() => router.push(page.href)}
          style={{
            marginHorizontal: space[4],
            padding: space[4],
            gap: space[1],
            borderRadius: 20,
            borderWidth: border.hairline,
            borderColor: colors['border-subtle'],
            backgroundColor: colors['bg-surface'],
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text variant="label-l" style={{ flex: 1 }}>
            {page.title}
            {'\n'}
            <Text variant="footnote" color="text-secondary">
              {page.detail}
            </Text>
          </Text>
          <Icon name="caret-right" size={20} color="text-secondary" />
        </Pressable>
      ))}
    </CataloguePage>
  );
}
