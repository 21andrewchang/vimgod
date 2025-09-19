import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
            supabase: SupabaseClient;
            user: User | null;
        }
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
