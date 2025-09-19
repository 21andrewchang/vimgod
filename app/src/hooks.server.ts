// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY, // (same as anon key; new name)
    {
      cookies: {
        // read all incoming cookies
        getAll: () => event.cookies.getAll(),

        // write any cookies Supabase wants to set/update/delete
        setAll: (cookies) => {
          for (const { name, value, options } of cookies) {
            // SvelteKit requires path to be explicit
            event.cookies.set(name, value, { ...options, path: '/' });
          }
        }
      }
    }
  );

  const { data: { session } } = await event.locals.supabase.auth.getSession();
  event.locals.user = session?.user ?? null;

  return resolve(event);
};