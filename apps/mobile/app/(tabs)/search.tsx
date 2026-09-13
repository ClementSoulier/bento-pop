import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import { SHADOWS, TopChip, YellowBg } from '@/components/primitives';
import { popyForPseudo } from '@/lib/popy-avatar';
import {
  isSearchable,
  matchAccessibilityLabel,
  searchBentos,
  splitResults,
  type SearchMatch,
} from '@/lib/search';
import { cleanTitle } from '@/lib/text';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useBlocked } from '@/state/blocked';
import { supabase } from '@/supabase/client';

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
          <Text
            style={{
              fontFamily: 'Extenda',
              fontSize: 28,
              lineHeight: 26,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
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
            <Text style={{ fontSize: 16, color: 'rgba(10,10,10,0.4)' }}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="pseudo, film, série, artiste…"
              placeholderTextColor="rgba(10,10,10,0.4)"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Chercher un pseudo ou un titre"
              style={{ fontSize: 16, fontWeight: '600', flex: 1, paddingVertical: 0 }}
            />
            {loading ? <ActivityIndicator size="small" color="#0a0a0a" /> : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, flex: 1 }}>
          {!enabled ? (
            <Hint>Tape pour chercher</Hint>
          ) : isError ? (
            <SearchError onRetry={() => refetch()} />
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

function Hint({ children }: { children: string }) {
  return (
    <Text
      style={{
        paddingHorizontal: 4,
        paddingTop: 12,
        fontFamily: 'Bungee',
        fontSize: 10,
        letterSpacing: 2,
        color: 'rgba(10,10,10,0.55)',
        textTransform: 'uppercase',
      }}
      maxFontSizeMultiplier={1.4}
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
        color: 'rgba(10,10,10,0.55)',
        textTransform: 'uppercase',
      }}
      maxFontSizeMultiplier={1.4}
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
      onPress={() => router.push(`/u/${match.pseudo}` as const)}
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
        >
          @{match.pseudo}
        </Text>
        {match.displayName ? (
          <Text
            style={{ fontSize: 12, color: 'rgba(10,10,10,0.6)', marginTop: 3 }}
            numberOfLines={1}
          >
            {match.displayName}
          </Text>
        ) : null}
        {match.item ? (
          <Text
            style={{ fontSize: 12, color: 'rgba(10,10,10,0.6)', marginTop: 3 }}
            numberOfLines={1}
          >
            <Text style={{ fontWeight: '700' }}>
              {CATEGORY_META[match.item.category].label}
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
          maxFontSizeMultiplier={1.4}
        >
          Voir
        </Text>
      </View>
    </Pressable>
  );
}
