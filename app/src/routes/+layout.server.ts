// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
  depends('app:user'); // allows precise invalidation after sign-in/out

  // Auth user from Supabase (verified)
  const { data: { user } } = await locals.supabase.auth.getUser();

  if (!user) {
    return { user: null };
  }

  // Pull minimal fields from your public.users row
  const { data: row } = await locals.supabase
    .from('users')
    .select('id, name, rating, hidden_mmr, xp') // add more columns if you need them globally
    .eq('id', user.id)
    .maybeSingle();

  const rawDbName = typeof row?.name === 'string' ? row.name : null;
  const normalizedDbName = rawDbName?.trim() || null;
  const hasDbName = normalizedDbName !== null;
  // Prefer DB name, then Auth metadata, then email local-part
  const fallbackName =
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'Player';

  const name = hasDbName ? normalizedDbName : fallbackName;

  return {
    user: {
      id: user.id,
      email: user.email,
      name,             // <-- DB-backed name now everywhere
      rating: row?.rating ?? null,
      hidden_mmr: row?.hidden_mmr ?? null,
      xp: row?.xp ?? 0, // handy if you want it globally
      requiresUsername: !hasDbName,
    }
  };
};