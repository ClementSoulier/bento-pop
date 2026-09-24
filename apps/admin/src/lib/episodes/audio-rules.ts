/**
 * Les règles de cohérence du fichier audio, énoncées une seule fois.
 *
 * Elles sont posées à trois endroits, du plus proche de l'utilisateur au plus sûr :
 * ici pour le formulaire, en contrainte Postgres pour la base, et dans le générateur du
 * flux qui écarte de toute façon un épisode incomplet. La duplication est voulue : un
 * épisode annoncé dans le flux part chez tous les abonnés à la fois.
 *
 * Module sans import : c'est ce qui le rend testable par le lanceur du dépôt, qui ne
 * résout pas les alias `@/`.
 */

export type AudioValues = {
  audio_published_at?: string;
  audio_url?: string;
  audio_bytes?: number;
};

export type AudioProbleme = {
  champ: 'audio_url' | 'audio_bytes';
  message: string;
};

/**
 * Renvoie ce qui empêche d'annoncer l'épisode dans le flux, ou `null` si tout va bien.
 *
 * Un fichier sans date est normal : il arrive souvent avant qu'on sache quand publier.
 * L'inverse ne l'est pas.
 */
export function problemeAudio(values: AudioValues): AudioProbleme | null {
  if (!values.audio_published_at) return null;
  if (!values.audio_url) {
    return { champ: 'audio_url', message: 'Sans fichier audio, pas de date de sortie audio' };
  }
  if (!values.audio_bytes || values.audio_bytes <= 0) {
    return {
      champ: 'audio_bytes',
      message: 'La taille du fichier audio est nécessaire au flux RSS',
    };
  }
  return null;
}
