import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const tag = typeof body?.tag === 'string' ? body.tag : 'client';
    const at = new Date(body?.at ?? Date.now()).toISOString();
    const payload =
      body?.data !== undefined
        ? (typeof body.data === 'string' ? body.data : JSON.stringify(body.data))
        : '';
    console.log(`[LOG ${at}] [${tag}] ${payload}`);
  } catch (e) {
    console.log('[LOG ERROR] bad /api/log payload', e);
  }
  return new Response(null, { status: 204 });
};
