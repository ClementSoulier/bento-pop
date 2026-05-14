'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Cropper, { type Area } from 'react-easy-crop';
import { createClient } from '@/lib/supabase/browser';
import { cropToBlob_v2, type CropOptions } from '@/lib/image-crop';
import { clsx } from '@/lib/clsx';

type Size = 'sm' | 'md';

type PhotoUploaderProps = {
  /** URL actuelle (pour l'aperçu) */
  currentUrl: string | null;
  /** Bucket Supabase Storage cible */
  bucket: string;
  /** Préfixe de chemin (ex: "guests/", "team/") — peut être vide */
  pathPrefix?: string;
  /** Callback quand un upload réussit, avec l'URL publique. */
  onUploaded: (url: string) => void;
  /** Format de sortie. Default 'jpeg' pour préserver le comportement Team
      historique. Passer 'webp' pour les nouveaux usages (≈ 30 % plus léger). */
  outputFormat?: 'jpeg' | 'webp';
  /** Taille du carré final en pixels. Default 600 (webp) ou 800 (jpeg). */
  targetSize?: number;
  /** Texte fil d'Ariane affiché dans la modale (default 'Cropping carré'). */
  modalLabel?: string;
  /** Tailles 'sm' (compact pour useFieldArray) ou 'md' (default). */
  size?: Size;
};

const PREVIEW_CLASSES: Record<Size, string> = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
};

/**
 * Bouton « Téléverser une photo » qui ouvre une modale de crop carré
 * (react-easy-crop) puis upload le résultat dans Supabase Storage et renvoie
 * l'URL publique.
 *
 * Ne gère PAS la suppression du fichier précédent : les anciens fichiers
 * deviennent orphelins dans le bucket. Cleanup manuel possible via le
 * Dashboard Supabase ou un script à venir.
 */
export function PhotoUploader({
  currentUrl,
  bucket,
  pathPrefix = '',
  onUploaded,
  outputFormat = 'jpeg',
  targetSize,
  modalLabel = 'Photo · cropping carré',
  size = 'md',
}: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  // Cleanup de l'object URL quand on quitte
  useEffect(() => {
    return () => {
      if (imageSrc?.startsWith('blob:')) URL.revokeObjectURL(imageSrc);
    };
  }, [imageSrc]);

  const onFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permet de re-piquer le même fichier
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choisis une image (jpg, png, webp, …).');
      return;
    }
    /* Limite à 30 Mo : c'est le plafond mémoire raisonnable pour charger
       l'image dans un canvas côté navigateur sans freeze. Au-delà, certains
       téléphones plantent l'onglet. La photo finale est toujours
       drastiquement plus légère (cropToBlob_v2 sort ~30-50 KB en WebP 600px),
       donc cette limite ne protège PAS le bucket — uniquement le navigateur. */
    if (file.size > 30 * 1024 * 1024) {
      setError('Image trop lourde pour être traitée par le navigateur (max 30 Mo). Compresse-la côté téléphone avant.');
      return;
    }
    setError(null);
    setImageSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setOpen(true);
  };

  const onConfirm = async () => {
    if (!imageSrc || !croppedArea) return;
    setPending(true);
    setError(null);
    try {
      const cropOptions: CropOptions = { format: outputFormat };
      if (targetSize) cropOptions.targetSize = targetSize;
      const { blob, extension, contentType } = await cropToBlob_v2(
        imageSrc,
        croppedArea,
        cropOptions,
      );
      const supabase = createClient();
      const path = `${pathPrefix}${crypto.randomUUID()}.${extension}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);
      onUploaded(publicUrl);
      setOpen(false);
      if (imageSrc.startsWith('blob:')) URL.revokeObjectURL(imageSrc);
      setImageSrc(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur upload';
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onFilePicked}
      />
      <div className="flex items-center gap-3">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt="Aperçu photo"
            className={clsx(
              'rounded-admin-input border border-admin-border object-cover',
              PREVIEW_CLASSES[size],
            )}
          />
        ) : (
          <div
            className={clsx(
              'grid place-items-center rounded-admin-input border border-dashed border-admin-border bg-admin-surface-2 text-[10px] uppercase tracking-[0.15em] text-admin-muted',
              PREVIEW_CLASSES[size],
            )}
          >
            Aucune
          </div>
        )}
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          {currentUrl ? 'Remplacer' : 'Téléverser'}
        </button>
      </div>
      {error && !open ? <p className="mt-2 text-[12px] text-bento-red">{error}</p> : null}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="admin-modal-overlay" />
          <Dialog.Content
            className="admin-modal-content"
            style={{ width: 'min(640px, calc(100vw - 32px))' }}
          >
            <header className="flex items-center gap-3 border-b border-admin-border px-6 py-5">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-admin-muted">
                  {modalLabel}
                </div>
                <Dialog.Title className="font-display text-[22px] leading-none">
                  Recadrer la photo
                </Dialog.Title>
              </div>
            </header>

            <div className="relative h-[420px] bg-admin-ink">
              {imageSrc ? (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="rect"
                  showGrid
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  objectFit="contain"
                  zoomSpeed={0.6}
                />
              ) : null}
            </div>

            <div className="flex items-center gap-4 border-t border-admin-border bg-admin-surface-2 px-6 py-4">
              <label className="flex flex-1 items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-admin-muted">
                  Zoom
                </span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-admin-ink"
                />
              </label>
              {error ? <span className="text-[11px] text-bento-red">{error}</span> : null}
              <button
                type="button"
                className="admin-btn"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Annuler
              </button>
              <button
                type="button"
                className={clsx('admin-btn admin-btn-primary', pending && 'opacity-70')}
                onClick={onConfirm}
                disabled={pending}
              >
                {pending ? 'Téléversement…' : 'Recadrer & téléverser'}
              </button>
            </div>
            <Dialog.Description className="sr-only">
              Sélectionne la zone carrée à utiliser comme photo.
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
