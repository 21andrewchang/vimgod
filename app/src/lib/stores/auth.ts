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

    return { updated: Array.isArray(data) ? data.length : 0};
};

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
