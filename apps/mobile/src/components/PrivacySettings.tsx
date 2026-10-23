import { useState } from 'react';
import { Text, View } from 'react-native';
import { CONTROL_MAX_FONT_MULTIPLIER } from '@/components/bento/font-scaling';
import { INK_MUTED, SettingSwitch, useToast } from '@/components/primitives';
import { writeShowVisits } from '@/lib/visits';
import { useSession } from '@/state/session';
import { supabase } from '@/supabase/client';

/**
 * La section Confidentialité du profil, chantier 8 (D9).
 *
 * Un seul réglage pour l'instant, « Afficher mes visites » : c'est la règle
 * du 15 septembre, chaque réglage de confidentialité part avec sa
 * fonctionnalité. La section rejoindra l'écran de confidentialité quand le
 * chantier 20 le créera.
 *
 * Rien sans profil : sans pseudo, aucun bento n'est en ligne, et il n'y a
 * aucun compteur à masquer.
 */
export function PrivacySettings() {
  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);
  const [busy, setBusy] = useState(false);
  const showToast = useToast((s) => s.show);

  if (!profile) return null;

  const toggle = async (on: boolean) => {
    if (busy) return;
    const avant = profile;
    // Tout de suite à l'écran, rendu si l'écriture échoue.
    setProfile({ ...profile, show_visits: on });
    setBusy(true);
    try {
      await writeShowVisits(supabase, profile.id, on);
    } catch (e) {
      console.warn('[profil] afficher mes visites', e);
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
        onChange={(on) => void toggle(on)}
        note={profile.show_visits ? undefined : 'Masquées : toi seul les vois.'}
        disabled={busy}
      />
    </View>
  );
}
