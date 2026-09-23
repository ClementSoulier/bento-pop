import { after, NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAuthorizedPushCall } from '@/lib/push/auth';
import { notifyItemModerated } from '@/lib/push/pipeline';
import { createPushRuntime } from '@/lib/push/runtime';

/**
 * Un item proposé vient d'être validé, fusionné ou refusé. Appelée par le
 * déclencheur `items_notify_moderation` du projet mobile, via `pg_net`.
 * Chantier 17, §6.1.
 *
 * Répond 202 dès l'événement reconnu, puis envoie après la réponse : `pg_net`
 * abandonne au bout de 3 secondes, et un envoi lent ne doit pas se lire comme
 * un échec. Ce qui se passe ensuite se lit dans le contrôle de santé et dans
 * les journaux du conteneur, préfixés `[push]`.
 */

export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  type: z.literal('item_moderated'),
  item_id: z.string().uuid(),
  status: z.enum(['validated', 'merged', 'rejected']),
});

export async function POST(req: NextRequest) {
  const expected = process.env.PUSH_WEBHOOK_TOKEN;
  if (!expected) {
    // Variable absente : la route reste fermée plutôt qu'ouverte à tous.
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
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unexpected event' }, { status: 400 });
  }

  const runtime = createPushRuntime();
  if (!runtime) {
    return NextResponse.json({ error: 'Mobile Supabase not configured' }, { status: 503 });
  }

  const event = { itemId: parsed.data.item_id, status: parsed.data.status };
  after(async () => {
    try {
      const outcome = await notifyItemModerated(event, runtime);
      console.info('[push] item_moderated', event.itemId, event.status, JSON.stringify(outcome));
    } catch (error) {
      console.error('[push] item_moderated', event.itemId, 'échec', error);
      await runtime.store
        .noteError(`NotifyFailed : ${error instanceof Error ? error.message : String(error)}`, runtime.now())
        .catch(() => undefined);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
