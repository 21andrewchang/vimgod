import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { browser } from '$app/environment';

export const user = writable<User | null>(null);
export const loading = writable(true);

// Initialize auth state
supabase.auth.getSession().then(({ data: { session } }) => {
	user.set(session?.user ?? null);
	loading.set(false);
});

supabase.auth.onAuthStateChange((_event, session) => {
	user.set(session?.user ?? null);
	loading.set(false);
});

export const setInitialRank = async (hiddenMmr: number, rating: number) => {
	const { data: { session }, error: sessionError } = await supabase.auth.getSession();
	if (sessionError) throw sessionError;

	const uid = session?.user?.id;
	if (!uid) throw new Error('No active session found');

	const { data, error } = await supabase
		.from('users')
		.update({ hidden_mmr: hiddenMmr, rating: rating })
		.eq('id', uid)
		.is('hidden_mmr', null)
		.is('rating', null)
		.select('id');

	if (error) throw error;

	return { updated: Array.isArray(data) ? data.length : 0 };
};

export const applyRatingDelta = async (delta: number) => {
	const { data: { session }, error: sessionError } = await supabase.auth.getSession();
	if (sessionError) throw sessionError;

	const uid = session?.user?.id;
	// console.log('uid', uid);
	if (!uid) throw new Error('No active session found');

	// 1) Read current rating
	const { data: current, error: readErr } = await supabase
		.from('users')
		.select('rating')
		.eq('id', uid)
		.single();
	if (readErr) throw readErr;

	// console.log('current', current);

	const prev = current?.rating ?? 0;
	const next = Math.max(0, Math.min(3000, prev + Math.round(delta))); // clamp + round

	// 2) Persist new rating
	const { data: updated, error: upErr } = await supabase
		.from('users')
		.update({ rating: next })
		.eq('id', uid)
		.select('rating')
		.single();
	if (upErr) throw upErr;


	return updated.rating as number;
};

export const increaseXp = async (delta: number) => {
	const { data: { session }, error: sessionError } = await supabase.auth.getSession();
	if (sessionError) throw sessionError;

	const uid = session?.user?.id;
	if (!uid) throw new Error('No active session found');

	const { data: current, error: readErr } = await supabase
		.from('users')
		.select('xp')
		.eq('id', uid)
		.single();
	if (readErr) throw readErr;

	const prev = current?.xp ?? 0;
	const next = prev + delta;

	const { data: updated, error: upErr } = await supabase
		.from('users')
		.update({ xp: next })
		.eq('id', uid)
		.select('xp')
		.single();
	if (upErr) throw upErr;

	return updated.xp as number;
}

// Google sign in function
export const signInWithGoogle = async () => {
	const redirectTo = browser ? `${window.location.origin}/auth/callback?next=/profile` : undefined;
	const { error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: { redirectTo }
	});

	if (error) {
		console.error('Error signing in with Google:', error);
		throw error;
	}
};

// Sign out function
export const signOut = async () => {
	const { error } = await supabase.auth.signOut();

	if (error) {
		console.error('Error signing out:', error);
		throw error;
	}
};
