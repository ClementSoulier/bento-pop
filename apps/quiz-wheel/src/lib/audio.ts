/**
 * Web Audio API — sons de tirage générés en synthèse, zéro fichier audio.
 * Tick aigu (square wave qui descend) + Ding final (cluster sinus + hum grave).
 *
 * On lazy-init l'AudioContext au premier appel : Chrome bloque la création
 * tant qu'il n'y a pas eu d'interaction utilisateur (clic / touche).
 */

let audioCtx: AudioContext | null = null;
let primedListener: (() => void) | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Pose un listener one-shot sur le premier geste utilisateur (pointer/touche)
 * pour créer + débloquer l'AudioContext. Indispensable : Chrome interdit la
 * création d'un AudioContext hors d'un user gesture (warning autoplay) et
 * `resume()` est asynchrone — si on instancie l'AudioContext au mount puis
 * qu'on appelle `playTick` dans le call-stack du keydown, le premier tick
 * peut encore être suspendu.
 *
 * Le listener s'enregistre en capture pour s'exécuter avant les handlers
 * React, qui jouent ensuite leurs sons sur un contexte déjà running.
 */
export function primeAudio(): void {
  if (typeof window === 'undefined') return;
  if (audioCtx && audioCtx.state === 'running') return;
  if (primedListener) return;

  const handler = () => {
    const ctx = getCtx();
    if (ctx && ctx.state !== 'suspended' && primedListener) {
      window.removeEventListener('pointerdown', primedListener, true);
      window.removeEventListener('keydown', primedListener, true);
      primedListener = null;
    }
  };
  primedListener = handler;
  window.addEventListener('pointerdown', handler, { capture: true });
  window.addEventListener('keydown', handler, { capture: true });
}

export function playTick(highPitch = false): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(highPitch ? 1600 : 1100, t);
    osc.frequency.exponentialRampToValueAtTime(highPitch ? 600 : 400, t + 0.04);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch {
    /* noop — audio failures must never break the spin */
  }
}

export function playDing(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const peaks = [0.25, 0.12, 0.06];
    [880, 1320, 2640].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const peak = peaks[i] ?? 0.1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.9);
    });
    const hum = ctx.createOscillator();
    const hg = ctx.createGain();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(220, t);
    hg.gain.setValueAtTime(0, t);
    hg.gain.linearRampToValueAtTime(0.08, t + 0.02);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    hum.connect(hg).connect(ctx.destination);
    hum.start(t);
    hum.stop(t + 1.6);
  } catch {
    /* noop */
  }
}
