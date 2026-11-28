'use client';

import { createClient } from '@/lib/supabase/browser';
import { STORAGE_CACHE_CONTROL } from '@/lib/storage';

export const BLOG_BUCKET = 'blog-media';

/** Largeur maximale d'une image d'article : la colonne de lecture fait 720 px, 2x compris. */
export const BLOG_IMAGE_MAX_WIDTH = 1600;

export type UploadedImage = { url: string; width: number; height: number };

/**
 * Redimensionne une image dans le navigateur (WebP, 1600 px de large au plus) puis la
 * dépose dans `blog-media/images/`. Le réencodage retire aussi les métadonnées EXIF
 * (position GPS d'une photo de téléphone, par exemple).
 *
 * Un GIF animé perd son animation : l'éditeur le signale avant l'envoi.
 */
export async function uploadBlogImage(file: File): Promise<UploadedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Choisis une image (jpg, png, webp…).');
  if (file.size > 30 * 1024 * 1024) {
    throw new Error('Image trop lourde pour le navigateur (30 Mo au plus).');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, BLOG_IMAGE_MAX_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible dans ce navigateur.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new Error('Conversion de l’image impossible.');

  const supabase = createClient();
  const path = `images/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(BLOG_BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: STORAGE_CACHE_CONTROL,
    upsert: false,
  });
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabase.storage.from(BLOG_BUCKET).getPublicUrl(path);
  return { url: publicUrl, width, height };
}
