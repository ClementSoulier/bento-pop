import type { Metadata } from 'next';
import { Eyebrow } from '@/components/Eyebrow';
import { StampLink } from '@/components/StampButton';
import { BentoCallToAction, BentoPageShell } from '@/components/bento/BentoPageShell';

export const metadata: Metadata = {
  title: 'Bento introuvable',
  description: "Aucun bento publié à cette adresse.",
  robots: { index: false, follow: true },
};

/**
 * 404 du segment `/u/[pseudo]`.
 *
 * Différente du 404 global : le visiteur arrive d'un lien partagé, il ne
 * cherchait ni une émission ni un podcast. On l'oriente donc vers l'app
 * plutôt que vers le catalogue du média.
 *
 * Rendue par `notFound()`, elle renvoie bien un vrai code 404. C'est ce qui
 * distingue ce cas de celui d'un bento simplement pas encore publié, qui
 * répond 200 avec son propre écran.
 */
export default function BentoNotFound() {
  return (
    <BentoPageShell>
      <div className="mx-auto max-w-[560px] py-10 text-center">
        <Eyebrow>Erreur 404</Eyebrow>
        <h1 className="font-display mt-4 text-[clamp(34px,8vw,64px)] leading-none text-bento-ink">
          Bento introuvable
        </h1>
        <p className="mt-6 text-[16px] leading-[1.55] text-bento-ink/75">
          Aucun bento publié à cette adresse. Le pseudo n&apos;existe pas, ou son
          bento a été supprimé.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <StampLink href="/">Retour à l&apos;accueil</StampLink>
        </div>
        <div className="mt-10 text-left">
          <BentoCallToAction
            heading="Compose ton bento"
            blurb="Ton film, ta série, ton artiste, ta chanson, ton créateur et ton lieu. Six cases, une carte de visite culturelle."
          />
        </div>
      </div>
    </BentoPageShell>
  );
}
