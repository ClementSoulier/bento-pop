/**
 * Conversion d'une zone de crop (en pixels source) vers un Blob JPEG carré
 * downscalé à `targetSize` (par défaut 800px). Garde le canvas en mémoire
 * locale, ne touche jamais le DOM rendu.
 *
 * Utilisé après `react-easy-crop` qui nous donne `croppedAreaPixels`.
 */
export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
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

export async function cropToJpegBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  targetSize = 800,
  quality = 0.9,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
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
    targetSize,
    targetSize,
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob a renvoyé null'))),
      'image/jpeg',
      quality,
    );
  });
}
