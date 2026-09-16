import { Redirect } from 'expo-router';
import { useDraft } from '@/state/draft';
import { useSession } from '@/state/session';

/**
 * Point d'entrée.
 *
 * ─── Chantier 9 : le pseudo recule, les règles ne bougent pas ────────────
 *
 * Avant, « pas de profil » menait à l'accueil et l'accueil menait au pseudo :
 * on exigeait un identifiant unique, avec vérification réseau, avant que
 * quiconque ait vu une case remplie. Mesuré : 34 comptes sur 61, soit 56 %,
 * portent un pseudo et n'ont jamais rien publié.
 *
 * Désormais, un compte sans profil qui a **déjà accepté les règles sur cet
 * appareil** va droit au composer : il compose, et le pseudo lui est demandé
 * au moment de publier. Les règles, elles, restent avant toute contribution
 * publique, ce qu'exige la Guideline 1.2 de l'App Store.
 *
 *   - profil complet → composer ;
 *   - profil sans `terms_accepted_at` → gate CGU, pour les comptes d'avant ;
 *   - pas de profil mais règles acceptées ici → composer, en brouillon ;
 *   - rien du tout → accueil.
 *
 * Tant que la relecture du brouillon n'a pas fini, on ne décide rien : sans
 * cette attente, l'accueil s'afficherait une fraction de seconde à quelqu'un
 * qui a déjà accepté les règles et composé la moitié de sa boîte.
 */
export default function Index() {
  const profile = useSession((s) => s.profile);
  const draftHydrated = useDraft((s) => s.hydrated);
  const termsAcceptedAt = useDraft((s) => s.termsAcceptedAt);

  if (profile) {
    if (!profile.terms_accepted_at) return <Redirect href="/onboarding/terms" />;
    return <Redirect href="/(tabs)/compose" />;
  }

  if (!draftHydrated) return null;
  if (termsAcceptedAt) return <Redirect href="/(tabs)/compose" />;
  return <Redirect href="/onboarding/splash" />;
}
