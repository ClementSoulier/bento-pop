import { useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SectionTitle, SettingSwitch, useToast } from '@/components/primitives';
import { useFollowsEnabled, useFollowsRefresh } from '@/components/follows/use-follows';
import { useSocialLinksEnabled } from '@/components/social-links/use-social-links';
import { writeFollowApproval } from '@/lib/follow-actions';
import { BENTO_MATCHES_QUERY_ROOT } from '@/lib/matches';
import { writeSearchable } from '@/lib/search';
import { writeSocialSetting } from '@/lib/social-actions';
import { SOCIAL_LINKS_ROOT, writeSocialVisible } from '@/lib/social-link-actions';
import { writeShowVisits } from '@/lib/visits';
import { useSession } from '@/state/session';
import { useSocial } from '@/state/social';
import { supabase } from '@/supabase/client';

type Setting =
  | 'show_visits'
  | 'searchable'
  | 'accept_comments'
  | 'accept_likes'
  | 'follow_approval'
  | 'social_visible';

/**
 * La section Confidentialité du profil : « Afficher mes visites » (chantier 8,
 * D9) et « Apparaître dans la recherche » (chantier 20, D5). C'est la règle du
 * 15 septembre, chaque réglage de confidentialité part avec sa fonctionnalité,
 * et ils se retrouvent tous ici (chantier 20, D9) : un écran à part viendra
 * quand les chantiers 22, 23 et 25 ajouteront les leurs. Le 22 y ajoute
 * « Accepter les commentaires » et « Afficher les j'aime » (D14), le 23
 * « Valider mes abonnés » (D3), le 25 « Afficher mes réseaux » (D3) : six
 * interrupteurs, qui referment le chantier 26 (D18 du 25).
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
  const followsOn = useFollowsEnabled();
  const refreshFollows = useFollowsRefresh();
  const socialOn = useSocialLinksEnabled();

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
      } else if (setting === 'accept_comments' || setting === 'accept_likes') {
        await writeSocialSetting(supabase, profile.id, setting, on);
        // Les nombres lus montrent encore l'ancien réglage : relus tout de
        // suite, les barres gardant leur place.
        void useSocial.getState().refreshAll();
      } else if (setting === 'follow_approval') {
        await writeFollowApproval(supabase, profile.id, on);
        // Éteint, la base vient d'accepter les demandes : ses nombres et ses
        // listes changent.
        refreshFollows();
      } else if (setting === 'social_visible') {
        await writeSocialVisible(supabase, profile.id, on);
        void queryClient.invalidateQueries({ queryKey: [SOCIAL_LINKS_ROOT] });
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
      <SectionTitle>Confidentialité</SectionTitle>
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
      <SettingSwitch
        label="Accepter les commentaires"
        description="Sur tous tes bentos."
        value={profile.accept_comments}
        onChange={(on) => void toggle('accept_comments', on)}
        note={
          profile.accept_comments
            ? undefined
            : 'Fermés : ceux déjà écrits sont masqués, et reviennent si tu les rouvres.'
        }
        disabled={busy}
      />
      <SettingSwitch
        label="Afficher les j'aime"
        description="Le cœur et son nombre sur tes bentos."
        value={profile.accept_likes}
        onChange={(on) => void toggle('accept_likes', on)}
        note={profile.accept_likes ? undefined : 'Masqués : personne ne peut aimer tes bentos.'}
        disabled={busy}
      />
      {followsOn ? (
        <SettingSwitch
          label="Valider mes abonnés"
          description="Chaque nouvel abonné attend ton accord."
          value={profile.follow_approval}
          onChange={(on) => void toggle('follow_approval', on)}
          note={
            profile.follow_approval
              ? "Les demandes t'attendent en tête de tes abonnés. L'éteindre les accepte toutes."
              : undefined
          }
          disabled={busy}
        />
      ) : null}
      {socialOn ? (
        <SettingSwitch
          label="Afficher mes réseaux"
          description="Ton Instagram et ton TikTok, sur ta page et sur bento-pop.com."
          value={profile.social_visible}
          onChange={(on) => void toggle('social_visible', on)}
          note={profile.social_visible ? undefined : 'Masqués : ils restent enregistrés, et toi seul les vois.'}
          disabled={busy}
        />
      ) : null}
    </View>
  );
}
