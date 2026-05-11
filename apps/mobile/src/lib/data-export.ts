import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { supabase } from '@/supabase/client';

/**
 * Export RGPD : dump l'intégralité des données de l'utilisateur en JSON
 * et le propose au partage natif (Files, Drive, AirDrop, etc.).
 *
 * Article 20 RGPD : droit à la portabilité — l'utilisateur peut récupérer
 * ses données dans un format structuré, couramment utilisé et lisible.
 *
 * Sur web : `navigator.share` si dispo, sinon download direct via blob URL.
 */
export async function exportUserData(userId: string): Promise<void> {
  // 1. Profil
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  // 2. Bento (avec items)
  const { data: bento } = await supabase
    .from('bentos')
    .select(
      `id, is_featured, featured_order, published_at, created_at, updated_at,
       bento_items (
         category_id, added_at,
         items ( id, title, subtitle, year, image_url, external_source, external_id, metadata )
       )`,
    )
    .eq('user_id', userId)
    .maybeSingle();

  const payload = {
    exported_at: new Date().toISOString(),
    schema_version: 1,
    profile,
    bento,
  };

  const fileName = `bento-pop-export-${(profile?.pseudo ?? 'user').toLowerCase()}-${
    new Date().toISOString().slice(0, 10)
  }.json`;
  const json = JSON.stringify(payload, null, 2);

  if (Platform.OS === 'web') {
    // Web : download via blob URL
    const w = typeof window !== 'undefined' ? window : null;
    if (!w) throw new Error('Window non disponible');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = w.document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Native : écrit en cache puis Sharing.shareAsync
  const tmpUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(tmpUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Partage non disponible sur ce device');
  }
  await Sharing.shareAsync(tmpUri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Exporter mes données Bento Pop',
  });
}
