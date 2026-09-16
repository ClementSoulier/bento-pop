import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import { CONTENT_MAX_FONT_MULTIPLIER } from '@/components/bento/font-scaling';
import { INK_MUTED, INK_PLACEHOLDER, SHADOWS, TopChip, YellowBg } from '@/components/primitives';
import { SEARCH_ICON_BOX } from '@/components/search/layout';
import { SearchIcon } from '@/components/TabIcons';
import { bentoRoute } from '@/lib/bento-address';
import { popyForPseudo } from '@/lib/popy-avatar';
import { tapFeedback } from '@/lib/haptics';
import {
  isEmpty,
  isSearchable,
  loadSharedItems,
  matchAccessibilityLabel,
  searchBentos,
  sharedItemAccessibilityLabel,
  sharedItemQuery,
  splitResults,
  type SearchMatch,
  type SharedItem,
} from '@/lib/search';
import { cleanTitle } from '@/lib/text';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useBlocked } from '@/state/blocked';
import { supabase } from '@/supabase/client';

/** Libellés des six cases du bento principal, pour étiqueter un résultat.
 *  Une case d'édition n'y est pas : on affiche alors sa clé, que la
 *  recherche par item ne montre de toute façon pas aujourd'hui. */
const CATEGORY_LABELS: Record<string, string | undefined> = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([k, m]) => [k, m.label]),
);

/**
 * Onglet « Trouver ».
 *
 * Cherche par pseudo **et** par contenu de la boîte, en un seul appel, et ne
 * propose que des bentos publiés. Cf. `docs/UX-06-TROUVER.md`.
 *
 * Ce que cet écran corrige : il ne cherchait que par préfixe de pseudo, et ne
 * filtrait pas les comptes sans bento publié. Au 13 septembre 2026, **46 des
 * 72 comptes**, soit 64 %, étaient proposés et menaient tous à « Bento
 * introuvable ». Le filtre vit maintenant dans la fonction SQL, pas ici :
 * un filtre côté écran se contourne en oubliant de l'appeler.
 *
 * Cache : 5 minutes par requête. Retaper une recherche déjà faite dans la
 * session ne redéclenche aucun aller-retour.
 */
export default function SearchTab() {
  const [query, setQuery] = useState('');
  // 300 ms, inchangé : c'est la durée qui laisse finir un mot sans donner
  // l'impression d'attendre.
  const debounced = useDebouncedValue(query.trim(), 300);
  const enabled = isSearchable(debounced);

  const blocked = useBlocked((s) => s.pseudos);
  const {
    data: rows = [],
    isFetching: loading,
    isError,
    refetch,
  } = useQuery({
    // La clé porte la chaîne brute : c'est elle que le SQL reçoit, et la
    // mettre en minuscules ici ferait diverger le cache de la requête.
    queryKey: ['search', debounced],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => searchBentos(supabase, debounced),
  });

  // Le découpage et le filtre des bloqués sont testés dans `lib/search.ts`.
  // `blocked` change quand on bloque quelqu'un depuis sa page : la
  // dépendance le fait disparaître des résultats sans refaire la requête.
  const { accounts, viaItems } = useMemo(
    () => splitResults(rows, blocked),
    [rows, blocked],
  );

  /**
   * Les items présents dans au moins deux bentos publiés.
   *
   * Le bloc n'est pas décoratif : ce sont exactement les onze recherches qui
   * ramènent plus d'une personne. Avec 26 bentos publiés, une barre nue est
   * inutilisable, personne ne devine quoi taper.
   *
   * Cache long : la liste bouge à la vitesse des publications, pas à celle
   * de l'utilisateur. Aucune erreur n'est remontée à l'écran, un bloc de
   * suggestions absent n'est pas une panne de la recherche.
   */
  const { data: suggestions = [] } = useQuery({
    queryKey: ['shared-items'],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: () => loadSharedItems(supabase),
  });

  const onPickSuggestion = (item: SharedItem) => {
    tapFeedback();
    // On remplit la barre au lieu de sauter aux résultats : voir le texte
    // apparaître enseigne le geste, et laisse la possibilité de le modifier.
    // `sharedItemQuery` et non `item.title` : la barre doit porter ce que la
    // puce affiche, et surtout pas sa forme tronquée, qui ne trouverait rien.
    setQuery(sharedItemQuery(item));
  };

  const sections = useMemo(
    () =>
      [
        { title: 'Comptes', data: accounts },
        { title: 'Dans les bentos', data: viaItems },
      ].filter((s) => s.data.length > 0),
    [accounts, viaItems],
  );

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingTop: 8 }}>
          <TopChip label="RECHERCHE" />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {/* Sans plafond, à la plus grande taille système le titre déborde
              de l'écran et se rogne en « TROUV ». Le défaut est systémique,
              20 usages d'Extenda dans l'app n'ont pas de plafond, plus
              `TopChip` : c'est du ressort du chantier 11, mais on ne laisse
              pas un titre cassé sur l'écran qu'on livre. */}
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: 'Extenda',
              fontSize: 28,
              lineHeight: 26,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
            maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
          >
            {'Trouve un\nbento.'}
          </Text>
        </View>

        {/* Le « @ » peint en dur a disparu : la barre prend aussi des titres,
            et l'annoncer comme un pseudo serait faux. Il reste dans les
            résultats, où il désigne bien un compte. */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <View
            style={[
              {
                backgroundColor: '#ffffff',
                borderWidth: 3,
                borderColor: '#0a0a0a',
                borderRadius: 14,
                paddingVertical: 11,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              },
              SHADOWS.stamp,
            ]}
          >
            {/* L'icône de la barre d'onglets, et non l'emoji 🔍 : même dessin sur les
                deux plateformes, et rien que VoiceOver lise à voix haute. */}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={SEARCH_ICON_BOX}
            >
              <SearchIcon size={18} color={INK_PLACEHOLDER} />
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="pseudo, film, série, artiste…"
              placeholderTextColor={INK_PLACEHOLDER}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Chercher un pseudo ou un titre"
              // Sans plafond, à la plus grande taille système le texte saisi
              // pousse la loupe hors de la barre et déborde en hauteur.
              maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
              style={{ fontSize: 16, fontWeight: '600', flex: 1, paddingVertical: 0 }}
            />
            {loading ? <ActivityIndicator size="small" color="#0a0a0a" /> : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, flex: 1 }}>
          {/* Les branches sans liste défilent aussi : à la plus grande taille
              système, le bloc de suggestions dépasse la hauteur de l'écran et
              devenait inatteignable. La `SectionList` défile déjà. */}
          {!enabled ? (
            <Scroll>
              <Suggestions items={suggestions} onPick={onPickSuggestion} />
            </Scroll>
          ) : isError ? (
            <SearchError onRetry={() => refetch()} />
          ) : !loading && isEmpty({ accounts, viaItems }) ? (
            <Scroll>
              <NoResult query={debounced} items={suggestions} onPick={onPickSuggestion} />
            </Scroll>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(m) => m.bentoId}
              renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
              renderItem={({ item, index }) => <Row match={item} index={index} />}
              contentContainerStyle={{ paddingBottom: 100 }}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled={false}
              // Deux sections courtes : recycler coûterait plus que de tout
              // garder monté, et `removeClippedSubviews` rogne les ombres.
              removeClippedSubviews={false}
            />
          )}
        </View>
      </SafeAreaView>
    </YellowBg>
  );
}

/**
 * Bloc d'accueil : les items qu'on retrouve dans plusieurs bentos.
 *
 * **Pas d'images.** 106 des 137 items posés en ont une, et douze vignettes se
 * téléchargeraient à chaque entrée dans l'onglet, alors que les résultats ne
 * s'affichent qu'après un geste délibéré. C'est un écart assumé avec les
 * chantiers 2 et 3, où l'image est le contenu ; ici elle serait un décor
 * payé par tout le monde. « Trouver » est le seul écran de l'app dont
 * l'ouverture ne télécharge rien.
 *
 * Le bloc est additif : à moins de deux suggestions il ne se rend pas, et
 * l'on retombe sur l'indication de départ.
 */
function Suggestions({
  items,
  onPick,
  hint = 'On retrouve souvent',
}: {
  items: readonly SharedItem[];
  onPick: (item: SharedItem) => void;
  hint?: string;
}) {
  if (items.length < 2) return <Hint>Tape pour chercher</Hint>;
  return (
    <View>
      <Hint>{hint}</Hint>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          paddingHorizontal: 4,
          paddingTop: 12,
        }}
      >
        {items.map((item) => (
          <Chip key={item.id} item={item} onPress={() => onPick(item)} />
        ))}
      </View>
    </View>
  );
}

/**
 * Longueur maximale d'un titre dans une puce.
 *
 * Sans elle, « Le Seigneur des anneaux : La Communauté de l'anneau », 51
 * caractères, occupe une rangée entière et se fait rogner à l'endroit exact
 * où il devenait informatif. Mesuré à l'écran sur iPhone 17 Pro : au-delà de
 * 28 caractères la puce cesse d'être une puce. La troncature de `cleanTitle`
 * coupe à la frontière de mot, donc « Le Seigneur des anneaux :… ».
 */
const CHIP_TITLE_MAX = 28;

function Chip({ item, onPress }: { item: SharedItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sharedItemAccessibilityLabel(item)}
      style={[
        {
          backgroundColor: '#ffffff',
          borderWidth: 2.5,
          borderColor: '#0a0a0a',
          borderRadius: 999,
          paddingHorizontal: 14,
          // 44 pt de haut au total, la cible tactile minimale, quitte à
          // dépasser la hauteur du texte.
          minHeight: 44,
          justifyContent: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          maxWidth: '100%',
        },
        SHADOWS.stamp,
      ]}
    >
      <Text
        style={{ fontSize: 13, fontWeight: '600', flexShrink: 1 }}
        numberOfLines={1}
        maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
      >
        {cleanTitle(item.title, CHIP_TITLE_MAX)}
      </Text>
      <Text
        style={{
          fontFamily: 'Bungee',
          fontSize: 10,
          letterSpacing: 0.5,
          color: INK_MUTED,
        }}
        maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
      >
        {item.picks}
      </Text>
    </Pressable>
  );
}

/**
 * Zéro résultat.
 *
 * L'écran n'en avait pas : une liste vide affichait « 0 résultats » et du
 * jaune. Celui-ci cite ce qui a été cherché, dit quoi essayer, et redonne les
 * suggestions, qui redeviennent utiles précisément là.
 */
function NoResult({
  query,
  items,
  onPick,
}: {
  query: string;
  items: readonly SharedItem[];
  onPick: (item: SharedItem) => void;
}) {
  return (
    <View style={{ paddingTop: 12 }}>
      <Text
        style={{
          paddingHorizontal: 4,
          fontFamily: 'Extenda',
          fontSize: 20,
          letterSpacing: 0.5,
        }}
        // Trois lignes et un plafond : à la plus grande taille système, deux
        // lignes sans plafond rognaient la requête elle-même, c'est-à-dire la
        // seule information que cet écran apporte.
        numberOfLines={3}
        maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
      >
        {`Rien pour « ${query} ».`}
      </Text>
      <Text
        style={{
          paddingHorizontal: 4,
          paddingTop: 8,
          fontSize: 13,
          lineHeight: 19,
          color: 'rgba(10,10,10,0.65)',
        }}
        maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
      >
        Essaie un titre de film, une série, un artiste, ou le pseudo de quelqu'un.
      </Text>
      <View style={{ paddingTop: 12 }}>
        <Suggestions items={items} onPick={onPick} hint="Ou pioche ici" />
      </View>
    </View>
  );
}

function Scroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function Hint({ children }: { children: string }) {
  return (
    <Text
      style={{
        paddingHorizontal: 4,
        paddingTop: 12,
        fontFamily: 'Bungee',
        fontSize: 10,
        letterSpacing: 2,
        color: INK_MUTED,
        textTransform: 'uppercase',
      }}
      maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
    >
      {children}
    </Text>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        paddingHorizontal: 4,
        paddingTop: 16,
        paddingBottom: 8,
        fontFamily: 'Bungee',
        fontSize: 10,
        letterSpacing: 2,
        color: INK_MUTED,
        textTransform: 'uppercase',
      }}
      maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
    >
      {title}
    </Text>
  );
}

function SearchError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 }}>
      <Text
        style={{
          fontSize: 13,
          color: 'rgba(10,10,10,0.65)',
          textAlign: 'center',
          lineHeight: 19,
        }}
        maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
      >
        Recherche indisponible. Vérifie ta connexion.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Réessayer la recherche"
        style={{
          marginTop: 12,
          backgroundColor: '#0a0a0a',
          borderRadius: 999,
          paddingVertical: 8,
          paddingHorizontal: 18,
        }}
      >
        <Text
          style={{
            fontFamily: 'Bungee',
            fontSize: 11,
            letterSpacing: 1,
            color: '#fbbf24',
            textTransform: 'uppercase',
          }}
          maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
        >
          Réessayer
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Ligne de résultat.
 *
 * La mention de l'item est **gratuite au pixel** : l'avatar fait 44 pt, la
 * colonne de texte 16 + 3 + 15 = 34 pt. La raison du résultat se loge dans la
 * place déjà vide sous le pseudo, la ligne reste à 64 pt. C'est ce qui a
 * écarté la vignette de l'item, qui aurait coûté une seconde image par ligne
 * et un octet d'egress, pour montrer ce que l'utilisateur vient de taper.
 *
 * `display_name` est nul pour les 72 comptes de la production au
 * 13 septembre 2026. Le jour où le chantier 10 le remplira, la colonne
 * passera à 52 pt et la ligne à 72 : prévu, à revérifier ce jour-là.
 */
function Row({ match, index }: { match: SearchMatch; index: number }) {
  const popy = popyForPseudo(match.pseudo);
  return (
    <Pressable
      // L'adresse du bento trouvé, et non celle du compte : deux bentos
      // d'une même personne sont deux résultats, à deux adresses.
      onPress={() => router.push(bentoRoute(match.pseudo, match.slug, match.isPrimary))}
      accessibilityRole="button"
      accessibilityLabel={matchAccessibilityLabel(match)}
      style={[
        {
          backgroundColor: '#ffffff',
          borderWidth: 2.5,
          borderColor: '#0a0a0a',
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          transform: [{ rotate: `${[-0.4, 0.3, -0.2, 0.4][index % 4] ?? 0}deg` }],
        },
        SHADOWS.stamp,
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#fbf3de',
          borderWidth: 2,
          borderColor: '#0a0a0a',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Image source={popy.source} style={{ width: 40, height: 40 }} resizeMode="contain" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontFamily: 'Extenda', fontSize: 16, lineHeight: 16, letterSpacing: 0.6 }}
          numberOfLines={1}
          maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
        >
          @{match.pseudo}
        </Text>
        {match.displayName ? (
          <Text
            style={{ fontSize: 12, color: 'rgba(10,10,10,0.6)', marginTop: 3 }}
            numberOfLines={1}
            maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
          >
            {match.displayName}
          </Text>
        ) : null}
        {match.item ? (
          <Text
            style={{ fontSize: 12, color: 'rgba(10,10,10,0.6)', marginTop: 3 }}
            numberOfLines={1}
            maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
          >
            <Text style={{ fontWeight: '700' }}>
              {CATEGORY_LABELS[match.item.category] ?? match.item.category}
            </Text>
            {` · ${cleanTitle(match.item.title)}`}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          backgroundColor: '#0a0a0a',
          borderWidth: 2,
          borderColor: '#0a0a0a',
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 5,
        }}
      >
        <Text
          style={{
            fontFamily: 'Bungee',
            fontSize: 10,
            letterSpacing: 1,
            color: '#fbbf24',
            textTransform: 'uppercase',
          }}
          maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
        >
          Voir
        </Text>
      </View>
    </Pressable>
  );
}
