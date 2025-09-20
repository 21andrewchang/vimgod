// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
    const supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) =>
          event.cookies.set(name, value, { ...options, path: '/' })
        )
      }
    });
  
    event.locals.supabase = supabase;
  
    // ✅ verified user (contacts Auth)
    const { data: { user }, error } = await supabase.auth.getUser();
    event.locals.user = error ? null : user ?? null;  

  return resolve(event);
};