import { useEffect } from 'react';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { keptEmail } from '@/lib/account';
import { offerKeepAccount } from '@/lib/keep-offer';
import { useSession } from '@/state/session';

/**
 * Ce que l'écran doit suivre de la session, chantier 28. Monté une fois, à
 * côté de `PushResponder`, dans `app/_layout.tsx`.
 *
 *   - **une session perdue** (D6) : un compte gardé dont la session a été
 *     refusée mène à « Reconnecte-toi », même en plein usage ;
 *   - **la session attendue** (D5) : l'app s'est ouverte sur l'accueil, faute
 *     de session à temps ; le compte arrive, l'entrée de l'app décide à
 *     nouveau. Seulement depuis l'accueil, que seul un appareil sans profil
 *     voit : les règles, elles, se montrent aussi à un compte d'avant ;
 *   - **la feuille « Garde ton bento »** (D4), une fois, pour un compte qui a
 *     publié avant la nouvelle version, à son passage sur le composer.
 */
export function AccountResponder() {
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const pathname = usePathname();
  const lost = useSession((s) => s.lostAccount);
  const profile = useSession((s) => s.profile);
  const user = useSession((s) => s.user);

  useEffect(() => {
    if (!navigationReady || !lost) return;
    if (pathname !== '/account/reconnect') router.replace('/account/reconnect');
  }, [navigationReady, lost, pathname]);

  useEffect(() => {
    if (!navigationReady || !profile) return;
    if (pathname === '/onboarding/splash' || pathname === '/onboarding/mechanics') router.replace('/');
  }, [navigationReady, profile, pathname]);

  useEffect(() => {
    if (!navigationReady || !profile || !user || pathname !== '/compose') return;
    void offerKeepAccount({ userId: user.id, kept: keptEmail(user) !== null, thenEditorial: false });
  }, [navigationReady, profile, user, pathname]);

  return null;
}
