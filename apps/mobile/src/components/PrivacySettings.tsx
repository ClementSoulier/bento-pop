import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { CONTROL_MAX_FONT_MULTIPLIER } from '@/components/bento/font-scaling';
import { INK_MUTED, SettingSwitch, useToast } from '@/components/primitives';
import { BENTO_MATCHES_QUERY_ROOT } from '@/lib/matches';
import { writeSearchable } from '@/lib/search';
import { writeShowVisits } from '@/lib/visits';
import { useSession } from '@/state/session';
import { supabase } from '@/supabase/client';

type Setting = 'show_visits' | 'searchable';

/**
 * La section Confidentialité du profil : « Afficher mes visites » (chantier 8,
 * D9) et « Apparaître dans la recherche » (chantier 20, D5). C'est la règle du
 * 15 septembre, chaque réglage de confidentialité part avec sa fonctionnalité,
 * et ils se retrouvent tous ici (chantier 20, D9) : un écran à part viendra
 * quand les chantiers 22, 23 et 25 ajouteront les leurs.
 *
 * Rien sans profil : sans pseudo, aucun bento n'est en ligne, et il n'y a
 * rien à masquer ni à retirer de la recherche.
 */
export function PrivacySettings() {
  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);
  const [busy, setBusy] = useState(false);
  const showToast = useToast((s) => s.show);
  const queryClient = useQueryClient();

  if (!profile) return null;

  const toggle = async (setting: Setting, on: boolean) => {
    if (busy) return;
    const avant = profile;
    // Tout de suite à l'écran, rendu si l'écriture échoue.
    setProfile({ ...profile, [setting]: on });
    setBusy(true);
    try {
      if (setting === 'show_visits') {
        await writeShowVisits(supabase, profile.id, on);
      } else {
        await writeSearchable(supabase, profile.id, on);
        // Les matchs en cache, valables 5 minutes, le montreraient encore sur
        // cet appareil : ils se redemandent à la prochaine page ouverte.
        void queryClient.invalidateQueries({ queryKey: [BENTO_MATCHES_QUERY_ROOT] });
      }
    } catch (e) {
      console.warn(`[profil] ${setting}`, e);
      setProfile(avant);
      showToast("Le réglage n'a pas été enregistré. Réessaie.", { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: 24, gap: 8 }}>
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
        style={{
          fontFamily: 'Bungee',
          fontSize: 10,
          letterSpacing: 2,
          color: INK_MUTED,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        Confidentialité
      </Text>
      <SettingSwitch
        label="Afficher mes visites"
        description="Les autres voient combien de fois ton bento a été ouvert."
        value={profile.show_visits}
        onChange={(on) => void toggle('show_visits', on)}
        note={profile.show_visits ? undefined : 'Masquées : toi seul les vois.'}
        disabled={busy}
      />
      <SettingSwitch
        label="Apparaître dans la recherche"
        description="On te trouve dans « Trouver » et parmi ceux qui ont les mêmes goûts."
        value={profile.searchable}
        onChange={(on) => void toggle('searchable', on)}
        note={
          profile.searchable
            ? undefined
            : 'Retiré de la recherche : ta page reste ouverte à qui a le lien.'
        }
        disabled={busy}
      />
    </View>
  );
}
