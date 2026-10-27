import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SheetAction } from '@/components/social/ActionSheet';
import { useToast } from '@/components/primitives';
import { followingFeedQueryKey } from '@/lib/feed';
import {
  FOLLOW_LIST_ROOT,
  FOLLOW_SUMMARY_ROOT,
  fetchFollowSummary,
  followSummaryKey,
  setFollow,
} from '@/lib/follow-actions';
import {
  expectedStatus,
  followButton,
  followErrorMessage,
  withFollowStatus,
  type FollowButtonModel,
  type FollowSummary,
} from '@/lib/follows';
import { useAppStatus } from '@/state/app-status';
import { useSession } from '@/state/session';
import { supabase } from '@/supabase/client';

/**
 * Les crochets du chantier 23 : l'interrupteur, qui lit, les nombres d'un
 * compte et le bouton « Suivre ». Les règles vivent dans la base ; ces
 * crochets tiennent l'écran à jour, la réponse prévue d'abord.
 */

/** L'interrupteur (D22), allumé tant que la configuration n'a pas répondu. */
export function useFollowsEnabled(): boolean {
  return useAppStatus((s) => s.config?.followsEnabled ?? true);
}

/** Qui lit : son compte, et s'il a un profil, sans lequel on ne suit pas (D4). */
export function useViewer(): { viewerId: string | null; hasProfile: boolean } {
  const viewerId = useSession((s) => s.user?.id ?? null);
  const hasProfile = useSession((s) => s.profile !== null);
  return { viewerId, hasProfile };
}

/**
 * Les nombres d'un compte, lus avec la session : le lien de qui lit en
 * dépend, et ses demandes ne sont rendues qu'à lui (D9). `null` quand la base
 * a coupé les abonnements, `undefined` tant qu'elle n'a pas répondu.
 */
export function useFollowSummary(userId: string | null) {
  const enabled = useFollowsEnabled();
  const { viewerId } = useViewer();
  return useQuery({
    queryKey: followSummaryKey(userId ?? '', viewerId),
    queryFn: () => fetchFollowSummary(supabase, userId ?? ''),
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
  });
}

/** Ce que tout geste d'abonnement fait relire : les nombres, les listes et le fil. */
export function useFollowsRefresh(): () => void {
  const queryClient = useQueryClient();
  const { viewerId } = useViewer();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [FOLLOW_SUMMARY_ROOT] });
    void queryClient.invalidateQueries({ queryKey: [FOLLOW_LIST_ROOT] });
    void queryClient.invalidateQueries({ queryKey: followingFeedQueryKey(viewerId) });
  };
}

const NO_SUMMARY: FollowSummary = {
  followers: 0,
  following: 0,
  requests: null,
  myStatus: null,
  approval: false,
};

export type FollowButtonState = {
  model: FollowButtonModel;
  onPress: () => void;
  busy: boolean;
  sheet: { visible: boolean; title: string; actions: SheetAction[]; onClose: () => void };
};

/**
 * Le bouton « Suivre » de la page d'un compte (D5). Un tap suit, la réponse
 * prévue tout de suite à l'écran, rendue avec un toast si la base refuse ;
 * « Abonné » et « Demandé » ouvrent la feuille d'actions.
 */
export function useFollowButton(userId: string, pseudo: string): FollowButtonState {
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const { viewerId } = useViewer();
  const refresh = useFollowsRefresh();
  const { data } = useFollowSummary(userId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = followSummaryKey(userId, viewerId);
  const summary = data ?? NO_SUMMARY;
  const model = followButton(summary.myStatus, pseudo);

  const write = async (on: boolean) => {
    if (busy || !userId) return;
    const before = summary;
    queryClient.setQueryData<FollowSummary | null>(
      key,
      withFollowStatus(before, on ? expectedStatus(before) : null),
    );
    setBusy(true);
    try {
      const kept = await setFollow(supabase, userId, on);
      queryClient.setQueryData<FollowSummary | null>(key, withFollowStatus(before, kept));
      if (kept === 'pending') showToast(`Demande envoyée à @${pseudo}`, { variant: 'neutral' });
    } catch (e) {
      console.warn('[abonnements] suivre', e);
      queryClient.setQueryData<FollowSummary | null>(key, before);
      showToast(followErrorMessage(e), { variant: 'danger' });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return {
    model,
    busy,
    onPress: () => {
      if (model.action === 'follow') void write(true);
      else setSheetOpen(true);
    },
    sheet: {
      visible: sheetOpen,
      title: `@${pseudo}`,
      actions: [
        {
          label: summary.myStatus === 'pending' ? 'Annuler la demande' : `Ne plus suivre @${pseudo}`,
          destructive: true,
          onPress: () => void write(false),
        },
      ],
      onClose: () => setSheetOpen(false),
    },
  };
}
