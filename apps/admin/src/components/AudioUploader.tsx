'use client';

import { useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/browser';
import { STORAGE_CACHE_CONTROL } from '@/lib/storage';

type AudioUploaderProps = {
  /** URL actuelle du fichier, pour l'aperçu. */
  currentUrl: string;
  /** Taille actuelle en octets, telle qu'elle partira dans le flux. */
  currentBytes: number;
  /** Appelé après un envoi réussi, avec tout ce que le flux RSS doit connaître. */
  onUploaded: (info: {
    url: string;
    bytes: number;
    mime: string;
    durationSeconds: number | null;
  }) => void;
  disabled?: boolean;
};

const BUCKET = 'episode-audio';
/* Le bucket refuse au-delà ; on le dit avant l'envoi plutôt qu'après. */
const TAILLE_MAX = 200 * 1024 * 1024;

function formatTaille(octets: number): string {
  if (!octets) return '—';
  return `${(octets / 1_000_000).toFixed(1)} Mo`;
}

/**
 * Dépose le fichier audio d'un épisode et renvoie ce que le flux RSS réclame :
 * l'adresse, la taille exacte en octets et la durée.
 *
 * Pas de traitement : contrairement aux images, le fichier part tel quel. Il a déjà été
 * monté, normalisé et contrôlé en amont ; le retoucher ici ne ferait que dégrader.
 *
 * La taille est relevée sur le fichier envoyé, jamais saisie à la main : la balise
 * `<enclosure>` l'annonce aux applis d'écoute, et une valeur fausse fait échouer le
 * téléchargement chez certaines d'entre elles.
 *
 * Le fichier précédent n'est pas supprimé : une adresse déjà publiée peut encore être
 * demandée par une appli qui n'a pas relu le flux.
 */
export function AudioUploader({
  currentUrl,
  currentBytes,
  onUploaded,
  disabled = false,
}: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Lit la durée dans le navigateur, sans télécharger le fichier deux fois. */
  const lireDuree = (file: File): Promise<number | null> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      const finir = (valeur: number | null) => {
        URL.revokeObjectURL(url);
        resolve(valeur);
      };
      audio.addEventListener('loadedmetadata', () =>
        finir(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null),
      );
      audio.addEventListener('error', () => finir(null));
      audio.src = url;
    });

  const onSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setError('Ce fichier n’est pas un audio.');
      return;
    }
    if (file.size > TAILLE_MAX) {
      setError(`Fichier trop lourd (${formatTaille(file.size)}), le maximum est 200 Mo.`);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const durationSeconds = await lireDuree(file);
      const extension = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      const path = `${crypto.randomUUID()}.${extension}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        cacheControl: STORAGE_CACHE_CONTROL,
        upsert: false,
      });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onUploaded({ url: publicUrl, bytes: file.size, mime: file.type, durationSeconds });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || pending}
          className="rounded-admin-input border border-admin-border bg-admin-surface-2 px-3 py-1.5 text-[12px] text-admin-ink-2 hover:bg-admin-surface-3 disabled:opacity-50"
        >
          {pending ? 'Envoi…' : currentUrl ? 'Remplacer le fichier' : 'Déposer le fichier audio'}
        </button>
        <span className="text-[12px] text-admin-ink-3">
          {currentUrl ? formatTaille(currentBytes) : 'aucun fichier'}
        </span>
      </div>
      {currentUrl ? (
        <audio controls preload="none" src={currentUrl} className="h-8 w-full max-w-md" />
      ) : null}
      {error ? <p className="text-[12px] text-bento-red">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/aac,.mp3,.m4a"
        onChange={onSelect}
        className="hidden"
      />
    </div>
  );
}
