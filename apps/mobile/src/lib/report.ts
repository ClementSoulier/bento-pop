import { supabase } from '@/supabase/client';

export type ReportInput = {
  targetKind: 'bento' | 'pseudo';
  targetPseudo: string;
  targetBentoId?: string;
  reason?: string;
};

/**
 * Crée un signalement UGC. Le `reporter_id` est récupéré côté server via
 * `auth.uid()` mais Supabase nous force à le passer en colonne — on le
 * lit depuis la session ici.
 *
 * Pas de lecture client : la modération se fait depuis le BO admin via
 * service-role (RLS bloque toute lecture client).
 */
export async function submitReport(input: ReportInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_kind: input.targetKind,
    target_pseudo: input.targetPseudo,
    target_bento_id: input.targetBentoId ?? null,
    reason: input.reason ?? null,
  });

  if (error) throw new Error(`Signalement échoué : ${error.message}`);
}
