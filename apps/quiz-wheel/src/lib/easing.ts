/**
 * Easing du tirage : démarre rapide, ralentit fortement vers la fin.
 * `t` ∈ [0, 1] = progression vers la cible.
 */
export function easeOut(t: number, exponent = 2.6): number {
  return 1 - Math.pow(1 - t, exponent);
}

/**
 * Précalcule les intervalles de tick (ms) pour un tirage de durée totale donnée.
 * Borné à 400 steps par sécurité.
 */
export function buildTickPlan(
  totalMs: number,
  fastInterval = 70,
  slowInterval = 520,
): number[] {
  const steps: number[] = [];
  let acc = 0;
  while (acc < totalMs && steps.length < 400) {
    const p = acc / totalMs;
    const interval = fastInterval + (slowInterval - fastInterval) * easeOut(p);
    steps.push(interval);
    acc += interval;
  }
  return steps;
}
