import { Redirect } from 'expo-router';
import { useSession } from '@/state/session';

/**
 * Point d'entrée :
 *   - pas de profil → onboarding splash (le user n'a pas encore de compte)
 *   - profil sans `terms_accepted_at` → gate CGU (App Store Guideline 1.2)
 *   - profil complet → composer
 */
export default function Index() {
  const profile = useSession((s) => s.profile);
  if (!profile) return <Redirect href="/onboarding/splash" />;
  if (!profile.terms_accepted_at) return <Redirect href="/onboarding/terms" />;
  return <Redirect href="/(tabs)/compose" />;
}
