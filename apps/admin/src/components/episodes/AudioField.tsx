'use client';

import { AudioUploader } from '@/components/AudioUploader';
import { Field } from '@/components/Modal';

type AudioFieldProps = {
  audioUrl: string;
  audioBytes: number;
  audioPublishedAt: string;
  episodeType: 'full' | 'trailer' | 'bonus';
  explicit: boolean;
  /** Renseigne la durée si elle manque encore : l'envoi du fichier la connaît. */
  durationSeconds: number | null;
  onChange: (patch: {
    audio_url?: string;
    audio_bytes?: number;
    audio_mime?: string;
    audio_published_at?: string;
    duration_seconds?: number;
    episode_type?: 'full' | 'trailer' | 'bonus';
    explicit?: boolean;
  }) => void;
  errors?: Partial<Record<'audio_url' | 'audio_bytes' | 'audio_published_at', string>>;
};

/**
 * Le bloc « podcast » du formulaire : le fichier écoutable et sa date de sortie.
 *
 * Ces deux informations décident à elles seules de l'entrée dans le flux RSS. Tant que la
 * date est vide, l'épisode reste invisible des plateformes, quel que soit son statut sur
 * le site : un épisode peut donc être publié sur bento-pop.com bien avant de sortir en
 * podcast, ce qui est justement le cas des émissions.
 */
export function AudioField({
  audioUrl,
  audioBytes,
  audioPublishedAt,
  episodeType,
  explicit,
  durationSeconds,
  onChange,
  errors = {},
}: AudioFieldProps) {
  return (
    <>
      <Field
        full
        label="Fichier audio du podcast"
        hint="Déposé tel quel, sans retraitement. La taille et la durée sont relevées automatiquement."
        error={errors.audio_url ?? errors.audio_bytes}
      >
        <AudioUploader
          currentUrl={audioUrl}
          currentBytes={audioBytes}
          onUploaded={({ url, bytes, mime, durationSeconds: lue }) =>
            onChange({
              audio_url: url,
              audio_bytes: bytes,
              audio_mime: mime,
              ...(lue && !durationSeconds ? { duration_seconds: lue } : {}),
            })
          }
        />
      </Field>
      <Field
        label="Sortie audio (flux RSS)"
        hint="Le mardi. Vide → l'épisode n'apparaît pas dans le flux."
        error={errors.audio_published_at}
      >
        <input
          className="admin-input"
          type="datetime-local"
          step={1}
          value={audioPublishedAt}
          onChange={(e) => onChange({ audio_published_at: e.target.value })}
        />
      </Field>
      <Field label="Type d'épisode">
        <select
          className="admin-input"
          value={episodeType}
          onChange={(e) =>
            onChange({ episode_type: e.target.value as 'full' | 'trailer' | 'bonus' })
          }
        >
          <option value="full">Épisode complet</option>
          <option value="trailer">Bande-annonce</option>
          <option value="bonus">Bonus</option>
        </select>
      </Field>
      <Field label="Contenu explicite">
        <label className="flex items-center gap-2 text-[13px] text-admin-ink-2">
          <input
            type="checkbox"
            checked={explicit}
            onChange={(e) => onChange({ explicit: e.target.checked })}
          />
          Signaler l’épisode comme explicite
        </label>
      </Field>
    </>
  );
}
