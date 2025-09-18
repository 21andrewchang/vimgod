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

// Function to create user in database
export const createUser = async (user: User, hiddenMmr: number, rating: number) => {
	// Ensure we have a valid user session
	const { data: { session }, error: sessionError } = await supabase.auth.getSession();
	
	if (sessionError) {
		console.error('Session error:', sessionError);
		throw sessionError;
	}
	
	if (!session || !session.user) {
		console.error('No active session found');
		throw new Error('No active session found');
	}
	
	// Verify the user ID matches the session
	if (session.user.id !== user.id) {
		console.error('User ID mismatch:', { sessionUserId: session.user.id, providedUserId: user.id });
		throw new Error('User ID mismatch');
	}
	
	console.log('Creating user with session:', { userId: user.id, sessionUserId: session.user.id });
	
	const { data, error } = await supabase
		.from('users')
		.insert({
			id: user.id,
			hidden_mmr: hiddenMmr,
			rating: rating,
			created_at: new Date().toISOString()
		})
		.select();

	if (error) {
		console.error('Error creating user:', error);
		throw error;
	}

	return data;
};

// Listen for auth changes
supabase.auth.onAuthStateChange(async (event, session) => {
	user.set(session?.user ?? null);
	loading.set(false);
	
	// Handle new user sign up
	if (event === 'SIGNED_IN' && session?.user) {
		// Check if this is a new user by looking at the created_at timestamp
		const userCreatedAt = new Date(session.user.created_at);
		const now = new Date();
		const isNewUser = (now.getTime() - userCreatedAt.getTime()) < 5000; // Within 5 seconds
		
		if (isNewUser) {
			// Add a small delay to ensure auth state is fully established
			setTimeout(async () => {
				try {
					// For new users, set default values
					// These will be updated after their first match
					await createUser(session.user, 1500, 1500);
				} catch (error) {
					console.error('Failed to create user on sign up:', error);
				}
			}, 1000); // 1 second delay
		}
	}
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
