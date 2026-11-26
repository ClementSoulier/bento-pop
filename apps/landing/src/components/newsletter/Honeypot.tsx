import { HONEYPOT_FIELD } from '@/lib/newsletter/form';

/**
 * Champ piège : hors de l'écran, hors du parcours au clavier et caché aux
 * lecteurs d'écran. Seul un robot qui remplit tout le remplit.
 */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Ne pas remplir
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
