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
    .select('id, name, xp') // add more columns if you need them globally
    .eq('id', user.id)
    .maybeSingle();

  // Prefer DB name, then Auth metadata, then email local-part
  const name =
    row?.name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'Player';

  return {
    user: {
      id: user.id,
      email: user.email,
      name,             // <-- DB-backed name now everywhere
      xp: row?.xp ?? 0, // handy if you want it globally
    }
  };
};