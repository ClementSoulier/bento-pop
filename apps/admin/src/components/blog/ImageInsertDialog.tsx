'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { uploadBlogImage, type UploadedImage } from '@/lib/blog/image-upload';
import { clsx } from '@/lib/clsx';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (image: UploadedImage & { alt: string; caption: string }) => void;
};

/**
 * Choix d'une image, texte alternatif obligatoire et légende facultative, puis envoi
 * dans le bucket du blog et insertion dans l'article.
 */
export function ImageInsertDialog({ open, onOpenChange, onInsert }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setAlt('');
      setCaption('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onConfirm = async () => {
    if (!file) {
      setError('Choisis une image.');
      return;
    }
    if (!alt.trim()) {
      setError('Décris l’image en quelques mots : c’est ce que lisent les lecteurs d’écran et Google.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const uploaded = await uploadBlogImage(file);
      onInsert({ ...uploaded, alt: alt.trim(), caption: caption.trim() });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="admin-modal-overlay" />
        <Dialog.Content className="admin-modal-content">
          <header className="border-b border-admin-border px-6 py-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-admin-muted">
              Article · image
            </div>
            <Dialog.Title className="font-display text-[22px] leading-none">
              Insérer une image
            </Dialog.Title>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="sr-only"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                e.target.value = '';
                setError(null);
                setFile(picked);
              }}
            />
            <button
              type="button"
              className="grid min-h-[160px] w-full place-items-center overflow-hidden rounded-admin-input border border-dashed border-admin-border bg-admin-surface-2 text-[12px] text-admin-muted"
              onClick={() => inputRef.current?.click()}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="max-h-[260px] w-auto object-contain" />
              ) : (
                'Choisir une image (jpg, png, webp)'
              )}
            </button>
            {file?.type === 'image/gif' ? (
              <p className="text-[11px] text-admin-muted">
                Un GIF animé devient une image fixe : pour une animation, préfère une vidéo YouTube.
              </p>
            ) : null}
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                Texte alternatif (obligatoire)
              </span>
              <input
                className="admin-input"
                value={alt}
                maxLength={200}
                placeholder="Ex. Dark Hifus sur le stand Bento Pop de la Japan Expo"
                onChange={(e) => setAlt(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
                Légende (facultative, affichée sous l’image)
              </span>
              <input
                className="admin-input"
                value={caption}
                maxLength={300}
                placeholder="Ex. Photo : Elda"
                onChange={(e) => setCaption(e.target.value)}
              />
            </label>
            {error ? <p className="text-[12px] text-bento-red">{error}</p> : null}
          </div>
          <footer className="flex items-center justify-end gap-2 border-t border-admin-border bg-admin-surface-2 px-6 py-4">
            <button
              type="button"
              className="admin-btn"
              onClick={() => onOpenChange(false)}
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
              {pending ? 'Envoi…' : 'Insérer'}
            </button>
          </footer>
          <Dialog.Description className="sr-only">
            Choisis une image, décris-la, puis insère-la dans l’article.
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
