import type { CSSProperties } from 'react';
import NextImage from 'next/image';
import { isOptimizableImage } from '@/lib/images';

type CommonProps = {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  'aria-hidden'?: boolean;
  /** Désactive le lazy-loading (images au-dessus de la ligne de flottaison). */
  priority?: boolean;
};

type SmartImageProps = CommonProps &
  (
    | {
        /** Remplit le parent, qui DOIT être positionné (`relative`). */
        fill: true;
        /** Indice de largeur rendue, requis par Next pour choisir la variante. */
        sizes: string;
        width?: never;
        height?: never;
      }
    | {
        fill?: false;
        sizes?: never;
        /** Dimensions intrinsèques en px (conteneurs de taille fixe). */
        width: number;
        height: number;
      }
  );

/**
 * Image distante servie via l'optimiseur `next/image` quand c'est possible.
 *
 * Pourquoi ce composant plutôt que `next/image` en direct :
 *
 * 1. **Egress.** Un `<img src="https://<projet>.supabase.co/…">` fait taper
 *    Supabase par chaque visiteur, en taille d'origine. Via `next/image`, le
 *    serveur Next récupère l'original une seule fois, le redimensionne, le
 *    convertit en WebP et le sert depuis son cache disque. C'est ce qui a
 *    fait sauter le quota d'egress du plan gratuit (5,5 Go/mois).
 * 2. **Robustesse.** `next/image` lève une erreur runtime si l'hôte n'est pas
 *    déclaré dans `remotePatterns`, ce qui casse la page entière. Or certaines
 *    URLs sont saisies librement dans le BO (`cover_url` d'une mention) et
 *    peuvent pointer n'importe où. On teste donc l'hôte et on retombe sur un
 *    `<img>` classique si besoin.
 */
export function SmartImage(props: SmartImageProps) {
  const { src, alt, className, style, title, priority = false } = props;
  const ariaHidden = props['aria-hidden'];

  if (!isOptimizableImage(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        title={title}
        aria-hidden={ariaHidden}
        loading={priority ? 'eager' : 'lazy'}
        {...(props.fill ? {} : { width: props.width, height: props.height })}
      />
    );
  }

  const shared = {
    src,
    alt,
    className,
    style,
    title,
    'aria-hidden': ariaHidden,
    priority,
  };

  return props.fill ? (
    <NextImage {...shared} fill sizes={props.sizes} />
  ) : (
    <NextImage {...shared} width={props.width} height={props.height} />
  );
}
