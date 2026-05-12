import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SHADOWS, TopChip, YellowBg } from '@/components/primitives';
import { popyForPseudo } from '@/lib/popy-avatar';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useBlocked } from '@/state/blocked';
import { supabase } from '@/supabase/client';

type UserHit = {
  id: string;
  pseudo: string;
  displayName: string | null;
};

/**
 * Tab « Trouver » : recherche live d'un user par pseudo (préfixe).
 * Cf. design Claude Design — `SearchScreen` dans `screens.jsx`.
 *
 * Cache : 5 min sur (prefix). Une recherche déjà tapée et retapée plus
 * tard ne refait pas l'aller-retour Supabase.
 */
export default function SearchTab() {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim().toLowerCase(), 300);

  const blocked = useBlocked((s) => s.pseudos);
  const { data: rawResults = [], isFetching: loading, isError, refetch } = useQuery({
    queryKey: ['user-search', debounced],
    enabled: debounced.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<UserHit[]> => {
      const { data } = await supabase
        .from('users')
        .select('id, pseudo, display_name')
        .ilike('pseudo', `${debounced}%`)
        .order('pseudo', { ascending: true })
        .limit(12);
      return (data ?? []).map((u) => ({
        id: u.id,
        pseudo: u.pseudo,
        displayName: u.display_name,
      }));
    },
  });

  const results = rawResults.filter((r) => !blocked.has(r.pseudo.toLowerCase()));

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
            <Text style={{ fontFamily: 'Bungee', fontSize: 14, color: 'rgba(10,10,10,0.4)' }}>
              @
            </Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="pseudo"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ fontSize: 16, fontWeight: '600', flex: 1, paddingVertical: 0 }}
            />
            {loading ? <ActivityIndicator size="small" color="#0a0a0a" /> : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, flex: 1 }}>
          {query.trim().length === 0 ? (
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
            >
              Tape pour chercher
            </Text>
          ) : isError ? (
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
                onPress={() => refetch()}
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
          ) : (
            <FlatList
              data={results}
              keyExtractor={(r) => r.id}
              ListHeaderComponent={
                <Text
                  style={{
                    paddingHorizontal: 4,
                    paddingTop: 12,
                    paddingBottom: 8,
                    fontFamily: 'Bungee',
                    fontSize: 10,
                    letterSpacing: 2,
                    color: 'rgba(10,10,10,0.55)',
                    textTransform: 'uppercase',
                  }}
                >
                  {results.length} résultat{results.length > 1 ? 's' : ''}
                </Text>
              }
              renderItem={({ item, index }) => <Row hit={item} index={index} />}
              contentContainerStyle={{ gap: 10, paddingBottom: 100 }}
            />
          )}
        </View>
      </SafeAreaView>
    </YellowBg>
  );
}

function Row({ hit, index }: { hit: UserHit; index: number }) {
  const popy = popyForPseudo(hit.pseudo);
  return (
    <Pressable
      onPress={() => router.push(`/u/${hit.pseudo}` as const)}
      accessibilityRole="button"
      accessibilityLabel={`Voir le bento de @${hit.pseudo}${hit.displayName ? `, ${hit.displayName}` : ''}`}
      style={[
        {
          backgroundColor: '#ffffff',
          borderWidth: 2.5,
          borderColor: '#0a0a0a',
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
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
        <Text style={{ fontFamily: 'Extenda', fontSize: 16, lineHeight: 16, letterSpacing: 0.6 }}>
          @{hit.pseudo}
        </Text>
        {hit.displayName ? (
          <Text style={{ fontSize: 12, color: 'rgba(10,10,10,0.6)', marginTop: 3 }}>
            {hit.displayName}
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
        >
          Voir
        </Text>
      </View>
    </Pressable>
  );
}
