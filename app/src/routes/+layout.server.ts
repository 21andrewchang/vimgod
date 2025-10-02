// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
  depends('app:user');

  const { data: { user } } = await locals.supabase.auth.getUser();

  if (!user) {
    return { user: null };
  }

  const { data: row } = await locals.supabase
    .from('users')
    .select('id, name, rating, hidden_mmr, hidden_mmr_rd, hidden_mmr_sigma, xp')
    .eq('id', user.id)
    .maybeSingle();

  const rawDbName = typeof row?.name === 'string' ? row.name : null;
  const normalizedDbName = rawDbName?.trim() || null;
  const hasDbName = normalizedDbName !== null;
  const fallbackName =
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'Player';

  const name = hasDbName ? normalizedDbName : fallbackName;

  return {
    user: {
      id: user.id,
      email: user.email,
      name,
      rating: row?.rating ?? null,
      hidden_mmr: row?.hidden_mmr ?? null,
      hidden_mmr_rd: row?.hidden_mmr_rd ?? null,
      hidden_mmr_sigma: row?.hidden_mmr_sigma ?? null,
      xp: row?.xp ?? 0,
      requiresUsername: !hasDbName,
    }
  };
};