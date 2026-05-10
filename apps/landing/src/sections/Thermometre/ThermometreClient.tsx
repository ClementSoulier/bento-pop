'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { VoteCounts, VoteWeek } from '@/lib/content/schemas';
import { castVote } from '@/lib/votes/actions';
import { formatVoteCount } from '@/lib/format/number';
import { VoteOption } from './VoteOption';

type Props = {
  week: VoteWeek;
  initialCounts: VoteCounts;
  closingNote: string;
};

const STORAGE_KEY_PREFIX = 'bp_vote_';

export function ThermometreClient({ week, initialCounts, closingNote }: Props) {
  const [voted, setVoted] = useState<string | null>(null);
  const [counts, setCounts] = useState<VoteCounts>(initialCounts);
  const [pending, startTransition] = useTransition();

  // Restaure le vote local pour cette semaine (soft-check uniquement —
  // le serveur reste l'autorité via la contrainte unique sur (week_id, anon_id)).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + week.id);
      if (saved) setVoted(saved);
    } catch {
      // localStorage indisponible — pas grave.
    }
  }, [week.id]);

  const total = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );

  const cast = (optionId: string) => {
    if (voted || pending) return;
    // Optimistic update : on incrémente immédiatement le compteur local.
    setCounts((prev) => ({ ...prev, [optionId]: (prev[optionId] ?? 0) + 1 }));
    setVoted(optionId);
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + week.id, optionId);
    } catch {
      // ignore
    }
    startTransition(async () => {
      const result = await castVote(week.id, optionId);
      if (result.ok) {
        // Sync avec les compteurs serveur (l'optimisme peut diverger).
        setCounts(result.counts);
      }
      // En cas d'erreur server, on garde l'optimisme — le user a au moins
      // l'illusion d'avoir voté ; un refresh remettra la vérité.
    });
  };

  return (
    <div
      className="mx-auto max-w-[760px] rounded-[28px] border-[5px] border-bento-cream bg-bento-cream px-10 pb-8 pt-9 text-bento-ink"
      style={{ boxShadow: '0 10px 0 var(--bento-red), 0 20px 40px rgba(0,0,0,0.4)' }}
    >
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border-[3px] border-bento-ink bg-bento-red px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-bento-cream shadow-stamp">
        ● {week.weekTag}
      </span>
      <h3 className="font-display mb-7 text-[clamp(24px,3vw,32px)] leading-[1.05]">
        {week.question}
      </h3>
      <div className="mb-5 flex flex-col gap-3">
        {week.options.map((opt, i) => {
          const c = counts[opt.id] ?? 0;
          const pct = total > 0 ? (c / total) * 100 : 0;
          return (
            <VoteOption
              key={opt.id}
              option={opt}
              index={i}
              pct={pct}
              isMine={voted === opt.id}
              hasVoted={voted !== null}
              disabled={voted !== null || pending}
              onClick={() => cast(opt.id)}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.1em] text-bento-ink/60">
        <span>
          {formatVoteCount(total)} votes · {closingNote}
        </span>
      </div>
    </div>
  );
}
