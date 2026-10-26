import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { supabase } from '@/supabase/client';
import { keptEmail } from './account';

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

  // 2. Les bentos, au pluriel depuis le chantier 16.
  //
  // `maybeSingle()` rendait UN bento, et c'était juste tant qu'un compte n'en
  // avait qu'un. À partir du deuxième, cette lecture aurait levé un 406 et
  // l'export d'une personne aurait échoué, ou pire, aurait omis une partie de
  // ses données : sur un export au titre de l'article 20 du RGPD, c'est la
  // seule chose qu'on ne peut pas se permettre.
  const { data: bentos } = await supabase
    .from('bentos')
    .select(
      `id, slug, is_primary, is_featured, featured_order, published_at, created_at, updated_at,
       bento_items (
         category_id, added_at,
         items ( id, title, subtitle, year, image_url, external_source, external_id, metadata )
       )`,
    )
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  // 3. Ses anciens pseudos, chantier 21 (D16) : la table n'a pas d'accès
  // client, la fonction ne rend que ceux du compte connecté.
  const { data: pseudoHistory } = await supabase.rpc('my_pseudo_history');

  // 4. L'adresse qui garde le compte, chantier 28 (D14), lue dans la session :
  // elle vit dans `auth.users`, que le client ne lit pas autrement.
  const { data: auth } = await supabase.auth.getSession();
  // 5. Ses commentaires, ses likes et ses blocages, chantier 22 (D21), et
  // ses pourquoi, chantier 12 (D13), masqués compris : la fonction ne rend
  // que les siens.
  const { data: social } = await supabase.rpc('my_social_export');

  const payload = {
    exported_at: new Date().toISOString(),
    // 2 : la clé `bento`, scalaire, devient `bentos`, un tableau. Un lecteur
    // de l'ancien format le verrait sinon comme un export sans bento. La clé
    // `pseudo_history`, ajoutée au chantier 21, ni `account`, au chantier 28,
    // ni `comments`, `likes` et `blocked_accounts`, au chantier 22, ni
    // `whys`, au chantier 12, ne changent rien pour lui.
    schema_version: 2,
    profile,
    account: { email: keptEmail(auth.session?.user) },
    bentos: bentos ?? [],
    pseudo_history: pseudoHistory ?? [],
    comments: social?.comments ?? [],
    likes: social?.likes ?? [],
    blocked_accounts: social?.blocks ?? [],
    whys: social?.whys ?? [],
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

  // Native : écrit en cache puis Sharing.shareAsync.
  //
  // Expo SDK 54+ : `FileSystem.cacheDirectory` + `writeAsStringAsync` ont
  // disparu de l'API principale au profit de l'API objet `File` / `Paths`
  // (l'ancienne survit sous `expo-file-system/legacy`, mais elle est en
  // sursis, autant écrire la nouvelle tout de suite). `write` est
  // synchrone dans cette API.
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(json);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Partage non disponible sur ce device');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Exporter mes données Bento Pop',
  });
}
