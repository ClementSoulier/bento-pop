import { after, NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAuthorizedPushCall } from '@/lib/push/auth';
import { runTick } from '@/lib/push/pipeline';
import { createPushRuntime } from '@/lib/push/runtime';
import { noteTick } from '@/lib/push/store';

/**
 * Le battement du travail planifié : `pg_cron` appelle `push_tick()` toutes
 * les 5 minutes (D10), qui poste ici via `pg_net`. Chantier 17, §6.1.
 *
 * Répond 202 dès l'appel reconnu, sans rien attendre : `pg_net` abandonne au
 * bout de 3 secondes, et un appel abandonné perd le travail prévu après la
 * réponse. Mesuré en recette le 23 septembre 2026 : une route lente de 3
 * secondes, battement noté, annonce jamais faite.
 *
 * Après la réponse : le battement se note d'abord, c'est la preuve lue par le
 * contrôle de santé que toute la chaîne tourne ; puis l'annonce des éditions
 * et la relecture des accusés.
 */

export const dynamic = 'force-dynamic';

const tickSchema = z.object({ type: z.literal('tick') });

export async function POST(req: NextRequest) {
  const expected = process.env.PUSH_WEBHOOK_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'Push disabled' }, { status: 503 });
  }
  if (!isAuthorizedPushCall(req.headers.get('authorization'), expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!tickSchema.safeParse(body).success) {
    return NextResponse.json({ error: 'Unexpected event' }, { status: 400 });
  }

  const runtime = createPushRuntime();
  if (!runtime) {
    return NextResponse.json({ error: 'Mobile Supabase not configured' }, { status: 503 });
  }

  after(async () => {
    try {
      await noteTick(runtime.db, runtime.now());
    } catch (error) {
      // La carte le montrera : le battement vieillit et passe « En panne ».
      console.error('[push] tick', 'battement non noté', error);
    }
    const outcome = await runTick(runtime);
    console.info('[push] tick', JSON.stringify(outcome));
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
