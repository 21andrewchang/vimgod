import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user) {
    // Optional: respect ?redirect=/some/path
    const to = url.searchParams.get('redirect') ?? '/profile';
    throw redirect(303, to);
  }
  return {};
};