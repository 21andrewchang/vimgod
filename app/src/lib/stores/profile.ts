import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { user } from '$lib/stores/auth';

type Profile = {
	id: string | null;
	rating: number | null;
	xp: number | null;
	hidden_mmr: number | null;
	loading: boolean;
};
export const profile = writable<Profile>({
	id: null, rating: null, xp: null, hidden_mmr: null, loading: true
});

export async function refreshProfile() {
	const uid = getUserId();
	if (!uid) {
		profile.set({ id: null, rating: null, xp: null, hidden_mmr: null, loading: false });
		return;
	}
	const { data, error } = await supabase
		.from('users')
		.select('id,rating,xp,hidden_mmr')
		.eq('id', uid)
		.single();

	if (error) {
		console.error('refreshProfile failed', error);
		profile.update(p => ({ ...p, loading: false }));
		return;
	}
	profile.set({ ...data, loading: false });
}

function getUserId(): string | null {
	let uid: string | null = null;
	const unsub = user.subscribe(u => { uid = u?.id ?? null; });
	unsub();
	return uid;
}

// Convenience setter when you already know the new rating locally (e.g. after match write)
export function setRatingOptimistic(next: number) {
	profile.update(p => ({ ...p, rating: next }));
}
