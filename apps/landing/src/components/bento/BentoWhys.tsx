import type { BentoWhys as Whys } from '@/lib/bento/map';
import { creditLabel } from '@/lib/bento/others';
import { cleanTitle } from '@/lib/bento/text';
import type { PublicCase } from './cases';

/**
 * « Pourquoi ces choix », chantier 12 (§5.4, D4) : le pourquoi de chaque
 * case expliquée, comme sous la boîte dans l'app. Rendu au serveur, sans
 * script ; rien tant qu'aucune case n'est expliquée, et la page ne change pas.
 *
 * Après « Compose le tien », pour la raison qui place les crédits après lui :
 * six lignes sous la boîte repousseraient le seul bouton de la page hors de
 * l'écran d'un téléphone. « Signaler ce bento », en bas de page, couvre aussi
 * les pourquoi.
 */
export function BentoWhys({ cases, whys }: { cases: readonly PublicCase[]; whys: Whys }) {
  const lines = cases
    .map((meta) => {
      const body = whys[meta.key];
      if (!meta.tile || !body) return null;
      return { key: meta.key, label: creditLabel(meta), title: cleanTitle(meta.tile.title), body };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (lines.length === 0) return null;

  return (
    <section aria-labelledby="bento-pourquoi" className="mx-auto mt-10 w-full max-w-[420px] lg:max-w-[940px]">
      <h2 id="bento-pourquoi" className="font-display-sm text-[10px] tracking-[0.18em] text-bento-ink/70">
        Pourquoi ces choix
      </h2>
      <dl className="mt-3 space-y-4 rounded-[22px] border-[2.5px] border-bento-ink bg-bento-cream px-4 py-4 shadow-stamp lg:max-w-[460px]">
        {lines.map(({ key, label, title, body }) => (
          <div key={key}>
            <dt className="text-[15px] leading-[1.4] text-bento-ink">
              <span className="font-display-sm mr-2 text-[10px] tracking-[0.12em] text-bento-ink/70">
                {label}
              </span>
              <span className="font-semibold">{title}</span>
            </dt>
            <dd className="mt-1 text-[15px] leading-[1.45] text-bento-ink">« {body} »</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
