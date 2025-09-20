import { supabase } from '$lib/supabaseClient';

export type SubmitMatchPayload = {
	match_id: string;
	player_id: string;
	created_at?: string;
	avg_spm?: number;
	efficiency?: number;
	most_used?: string;
	undos?: number;
	apm?: number;
	reaction_time?: number;
	start_elo?: number;
	end_elo?: number;
	lp_delta?: number;
};

export type SubmitMatchResult = {
	match: Record<string, unknown> | null;
	new_elo: number | null;
};

export const submitMatch = async (payload: SubmitMatchPayload): Promise<SubmitMatchResult> => {
	const { data, error } = await supabase.functions.invoke('submitMatch', {
		body: payload,
	});

	if (error) {
		throw error;
	}

	return {
		match: (data as Record<string, unknown> | undefined)?.match ?? null,
		new_elo: (data as Record<string, unknown> | undefined)?.new_elo ?? null,
	};
};
