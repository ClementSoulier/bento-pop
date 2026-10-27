import Image from 'next/image';
import { POPY_ACCENTS, achievementLabel, type ShownAchievement } from '@bento-pop/supabase-mobile/bento';
import { popyImage } from '@/lib/bento/popy';

/**
 * « Succès », chantier 27 (§3, D13) : les médailles d'un compte, comme sous
 * la boîte dans l'app, chacune son Popy dans un cercle à sa couleur et son nom
 * dessous, dans l'ordre du catalogue (D22). Rendu au serveur, sans script ;
 * rien sans succès, et la page ne change pas (D11).
 *
 * Après les crédits, qui restent près des images de la boîte : les succès
 * disent le compte, comme la liste de ses autres bentos qui les suit. Le
 * lecteur d'écran lit chaque médaille comme dans l'app, son nom et ce qu'elle
 * dit (D12).
 */
export function BentoAchievements({ achievements }: { achievements: readonly ShownAchievement[] }) {
  if (achievements.length === 0) return null;
  return (
    <section aria-labelledby="bento-succes" className="mx-auto mt-10 w-full max-w-[420px] lg:max-w-[940px]">
      <h2 id="bento-succes" className="font-display-sm text-[10px] tracking-[0.18em] text-bento-ink/70">
        Succès
      </h2>
      <ul className="mt-3 grid grid-cols-3 gap-x-[10px] gap-y-[14px] rounded-[22px] border-[2.5px] border-bento-ink bg-bento-cream px-4 pb-[14px] pt-4 shadow-stamp sm:grid-cols-4 lg:max-w-[460px]">
        {achievements.map((medal) => (
          <li key={medal.key} className="flex flex-col items-center gap-2 text-center">
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-full border-[2.5px] border-bento-ink shadow-[0_2px_0_var(--bento-ink)]"
              style={{ backgroundColor: POPY_ACCENTS[medal.popy] }}
            >
              <Image src={popyImage(medal.popy)} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
            </span>
            <span aria-hidden className="text-[12px] font-extrabold leading-[1.25] text-bento-ink">
              {medal.title}
            </span>
            <span className="sr-only">{achievementLabel(medal.key)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
