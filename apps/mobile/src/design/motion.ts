/**
 * Le mouvement du design system v2 (chantier 30, D10) : quatre durées, trois
 * courbes, et ce que « réduire les animations » en garde, tirés du dossier de
 * la refonte (`code-source/src/bundle.css`, et le README, « Mouvement et
 * retours haptiques »).
 *
 * Aucun import de `react-native` : les tests lisent ce module sous
 * `node:test`. `useMotion()` le branche sur le réglage du système.
 */

/** Les durées, en millisecondes. */
export const DURATION = {
  /** Un appui. */
  fast: 120,
  /** Un toast, un interrupteur. */
  base: 200,
  /** Une feuille, une case qui arrive. */
  slow: 320,
  /** Les confettis. */
  celebrate: 600,
} as const;

export type Duration = keyof typeof DURATION;

/** Les points de contrôle de chaque courbe, ceux de `cubic-bezier()`. */
export const CURVE = {
  /** Les déplacements. */
  standard: [0.2, 0.8, 0.2, 1],
  /** Ce qui apparaît, avec un léger rebond. */
  pop: [0.34, 1.56, 0.64, 1],
  /** Ce qui part. */
  exit: [0.36, 0, 0.66, -0.56],
} as const;

export type Curve = keyof typeof CURVE;

/** Une animation : sa durée en millisecondes, 0 pour un changement immédiat, et sa courbe. */
export type Timing = { duration: number; curve: Curve };

/** Une apparition ou une disparition : en mouvement (glissée, échelle) ou en fondu. */
export type Transition = Timing & { kind: 'move' | 'fade' };

export type Motion = {
  /** « Réduire les animations » est allumé. */
  reduced: boolean;
  /** Ce qui déplace, agrandit ou tourne en changeant d'état : l'appui, l'interrupteur, le cœur. */
  move(duration: Duration, curve?: Curve): Timing;
  /** Ce qui change de couleur ou d'opacité. */
  fade(duration: Duration): Timing;
  /** Ce qui apparaît : une feuille, une boîte de dialogue, un toast, une case qui tombe. */
  enter(duration: Duration, curve?: Curve): Transition;
  /** Ce qui part. */
  exit(duration: Duration): Transition;
  /** Les confettis d'une célébration. */
  confetti: boolean;
  /** Popy qui se dandine au repos. */
  wiggle: boolean;
  /** Le squelette qui pulse pendant un chargement. */
  pulse: boolean;
  /** Un tour de `Spinner`, en millisecondes. */
  spin: number;
};

const INSTANT: Timing = { duration: 0, curve: 'standard' };
const FADE: Transition = { kind: 'fade', duration: DURATION.fast, curve: 'standard' };

/**
 * Le mouvement, réduit ou non. Réduit, plus de rebond ni de déplacement : les
 * changements d'état sont immédiats, les apparitions et les départs deviennent
 * des fondus de 120 ms, les confettis, le dandinement et la pulsation
 * s'arrêtent, et le `Spinner` ralentit au tiers. Les couleurs et les
 * opacités, qui ne bougent rien, gardent leur durée.
 */
export function motionFor(reduced: boolean): Motion {
  return {
    reduced,
    move: (duration, curve = 'standard') =>
      reduced ? INSTANT : { duration: DURATION[duration], curve },
    fade: (duration) => ({ duration: DURATION[duration], curve: 'standard' }),
    enter: (duration, curve = 'pop') =>
      reduced ? FADE : { kind: 'move', duration: DURATION[duration], curve },
    exit: (duration) =>
      reduced ? FADE : { kind: 'move', duration: DURATION[duration], curve: 'exit' },
    confetti: !reduced,
    wiggle: !reduced,
    pulse: !reduced,
    spin: reduced ? 2400 : 800,
  };
}
