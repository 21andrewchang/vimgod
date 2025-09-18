import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export const user = writable<User | null>(null);
export const loading = writable(true);

// Initialize auth state
supabase.auth.getSession().then(({ data: { session } }) => {
	user.set(session?.user ?? null);
	loading.set(false);
});

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
	user.set(session?.user ?? null);
	loading.set(false);
});

// Google sign in function
export const signInWithGoogle = async () => {
	const { error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: `${window.location.origin}/profile`
		}
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
