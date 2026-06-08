/**
 * Conversion d'une zone de crop (en pixels source) vers un Blob carré
 * downscalé à `targetSize`. Garde le canvas en mémoire locale, ne touche
 * jamais le DOM rendu.
 *
 * Utilisé après `react-easy-crop` qui nous donne `croppedAreaPixels`.
 */
export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropOutput = {
  blob: Blob;
  /* Extension de fichier correspondante ('jpg' ou 'webp'). */
  extension: 'jpg' | 'webp';
  /* MIME utilisé pour Storage upload. */
  contentType: string;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

async function cropToBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  outWidth: number,
  outHeight: number,
  mime: 'image/jpeg' | 'image/webp',
  quality: number,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context indisponible');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outWidth,
    outHeight,
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob a renvoyé null'))),
      mime,
      quality,
    );
  });
}

export type CropOptions = {
  format?: 'jpeg' | 'webp';
  /* Plus grande dimension finale en pixels (= largeur). Default 800 pour JPEG
     (legacy team), conseillé 600 pour WebP (assez pour avatars/covers). */
  targetSize?: number;
  /* Ratio largeur/hauteur du rendu. Default 1 (carré). Ex: 16/9 pour une
     miniature paysage. La hauteur finale = round(targetSize / aspect). */
  aspect?: number;
  /* 0..1. Default 0.9 pour JPEG, 0.82 pour WebP (équivalent visuel ≈ JPEG 0.92
     mais plus léger). */
  quality?: number;
};

/**
 * Helper unifié — crop carré + encodage selon le format demandé.
 * Default WebP 600px / 0.82 quality (sweet spot poids/qualité pour des miniatures).
 */
export async function cropToBlob_v2(
  imageSrc: string,
  pixelCrop: PixelCrop,
  options: CropOptions = {},
): Promise<CropOutput> {
  const format = options.format ?? 'webp';
  const targetSize = options.targetSize ?? (format === 'webp' ? 600 : 800);
  const aspect = options.aspect ?? 1;
  const quality = options.quality ?? (format === 'webp' ? 0.82 : 0.9);
  const mime = format === 'webp' ? 'image/webp' : 'image/jpeg';
  const outHeight = Math.round(targetSize / aspect);
  const blob = await cropToBlob(imageSrc, pixelCrop, targetSize, outHeight, mime, quality);
  return {
    blob,
    extension: format === 'webp' ? 'webp' : 'jpg',
    contentType: mime,
  };
}

/**
 * Helper legacy — JPEG uniquement. Conservé pour la section Team qui pousse
 * encore des JPEG dans le bucket team-photos. Nouveau code → cropToBlob_v2.
 */
export async function cropToJpegBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  targetSize = 800,
  quality = 0.9,
): Promise<Blob> {
  return cropToBlob(imageSrc, pixelCrop, targetSize, targetSize, 'image/jpeg', quality);
}
