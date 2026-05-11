import { Redirect } from 'expo-router';
import { useSession } from '@/state/session';

/**
 * Point d'entrée : si le user a déjà un pseudo (= compte créé), on l'envoie
 * sur le composer. Sinon, on lance l'onboarding.
 */
export default function Index() {
  const profile = useSession((s) => s.profile);
  return profile ? <Redirect href="/(tabs)/compose" /> : <Redirect href="/onboarding/splash" />;
}
