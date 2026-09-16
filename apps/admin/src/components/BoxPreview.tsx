import type { CSSProperties } from 'react';
import { boxPlacements, boxRowHeights } from '@bento-pop/supabase-mobile/bento';

/**
 * La boîte bento, à la géométrie réelle, pour prévisualiser une édition.
 *
 * **Ce n'est pas un sixième dessin de la boîte.** Rangées, hauteurs, largeurs
 * et rotations viennent de `boxPlacements(n)`, la même table que l'app, la
 * page web et l'aperçu de lien : la disposition ne peut donc pas diverger.
 * Seule l'apparence des cases vides est propre au back-office, et elle sert à
 * dire ce que l'app dira, pas à imiter un rendu.
 *
 * Ce qu'elle montre et qu'aucun autre rendu ne montre : **le verdict de
 * chaque intitulé**. Une case dont le texte ne tient pas est cerclée de
 * rouge, une case serrée d'orange. C'est la raison d'être de l'écran : refuser
 * un intitulé trop long avant qu'une édition sorte, quand plus personne ne
 * peut la corriger sans casser les bentos déjà composés.
 */

/** Largeur de rendu, en pixels. La boîte fait 361 points de large. */
const LARGEUR = 300;
const U = LARGEUR / 361;
const u = (n: number) => `${(n * U).toFixed(2)}px`;

export type PreviewCase = {
  prompt: string;
  stamp: string;
  /** `false` : l'intitulé sera coupé. */
  fits: boolean;
  /** `true` : il tient, mais risque la coupe sur un petit écran. */
  tight: boolean;
};

export function BoxPreview({ cases }: { cases: readonly PreviewCase[] }) {
  const places = boxPlacements(cases.length);
  const hauteurs = boxRowHeights(cases.length);

  if (places.length === 0) {
    return (
      <div className="admin-card p-6 text-[13px] text-admin-muted" style={{ width: LARGEUR }}>
        De 2 à 6 cases, pas {cases.length}. La boîte n’a pas de dessin pour ce nombre.
      </div>
    );
  }

  return (
    <div
      style={{
        width: LARGEUR,
        height: u(512),
        background: '#fbf3de',
        border: `${u(5)} solid #0a0a0a`,
        borderRadius: u(28),
        padding: u(14),
        display: 'flex',
        flexDirection: 'column',
        gap: u(10),
        boxShadow: `0 ${u(8)} 0 #0a0a0a`,
        boxSizing: 'border-box',
      }}
    >
      {hauteurs.map((hauteur, rang) => (
        <div key={rang} style={{ display: 'flex', gap: u(10), height: u(hauteur) }}>
          {places
            .filter((place) => place.row === rang + 1)
            .map((place) => {
              const item = cases[place.index];
              if (!item) return null;
              const bordure = !item.fits ? '#e63946' : item.tight ? '#f59331' : 'rgba(10,10,10,0.45)';
              const style: CSSProperties = {
                flex: 1,
                minWidth: 0,
                background: '#fff4d8',
                border: `${u(2)} dashed ${bordure}`,
                borderRadius: u(18),
                transform: `rotate(${place.rotate / 2}deg)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: u(6),
                padding: u(8),
                boxSizing: 'border-box',
                overflow: 'hidden',
              };
              return (
                <div key={place.index} style={style}>
                  <span
                    style={{
                      fontFamily: 'var(--font-bungee), system-ui, sans-serif',
                      fontSize: u(9),
                      letterSpacing: u(1),
                      background: '#0a0a0a',
                      color: '#fbf3de',
                      padding: `${u(3)} ${u(6)}`,
                      borderRadius: u(6),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.stamp || '—'}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-bungee), system-ui, sans-serif',
                      fontSize: u(10),
                      lineHeight: 1.32,
                      letterSpacing: u(1.2),
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      color: item.fits ? 'rgba(10,10,10,0.62)' : '#e63946',
                      // Deux lignes puis coupe : exactement ce que fait la case
                      // vide de l'app, `tile-title.ts:47-53`.
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.prompt || '…'}
                  </span>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}
