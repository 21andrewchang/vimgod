import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { user } from '$lib/stores/auth';

const PLACEMENT_GOAL = 5;
const PLACEMENT_SAMPLE_LIMIT = 25;

type Profile = {
	id: string | null;
	rating: number | null;
	xp: number | null;
	hidden_mmr: number | null;
	placements: number;
	loading: boolean;
};

const initialProfile: Profile = {
	id: null,
	rating: null,
	xp: null,
	hidden_mmr: null,
	placements: 0,
	loading: true
};

export const profile = writable<Profile>(initialProfile);

export async function refreshProfile() {
	const uid = getUserId();
	if (!uid) {
		profile.set({ ...initialProfile, loading: false });
		return;
	}
	const { data, error } = await supabase
		.from('users')
		.select('id,rating,xp,hidden_mmr')
		.eq('id', uid)
		.single();

	if (error) {
		console.error('refreshProfile failed', error);
		profile.update((p) => ({ ...p, loading: false }));
		return;
	}

	let placementMatches = 0;
	const { data: placementRows, error: placementError } = await supabase
		.from('match_history')
		.select('is_dodge, end_elo')
		.eq('player_id', uid)
		.order('created_at', { ascending: true })
		.limit(PLACEMENT_SAMPLE_LIMIT);

	if (placementError) {
		console.error('refreshProfile placements failed', placementError);
	} else if (Array.isArray(placementRows)) {
		placementMatches = placementRows.filter((row) => row?.end_elo === null && row?.is_dodge !== true).length;
	}

	profile.set({ ...data, placements: Math.min(PLACEMENT_GOAL, placementMatches), loading: false });
}

function getUserId(): string | null {
	let uid: string | null = null;
	const unsub = user.subscribe(u => { uid = u?.id ?? null; });
	unsub();
	return uid;
}

// Convenience setter when you already know the new rating locally (e.g. after match write)
export function setRatingOptimistic(next: number) {
	profile.update((p) => ({ ...p, rating: next }));
}
