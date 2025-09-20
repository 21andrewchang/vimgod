import { serve } from "https://deno.land/std@0.213.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6?dts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const matchPayloadSchema = z.object({
  match_id: z.string().uuid(),
  player_id: z.string().uuid(),
  created_at: z
    .string()
    .datetime({ offset: true })
    .optional(),
  avg_spm: z.number().finite().optional(),
  efficiency: z.number().finite().optional(),
  most_used: z.string().max(128).optional(),
  undos: z.number().int().optional(),
  apm: z.number().finite().optional(),
  reaction_time: z.number().finite().optional(),
  start_elo: z.number().finite().optional(),
  end_elo: z.number().finite().optional(),
  lp_delta: z.number().finite().optional(),
});

function jsonResponse(body: Record<string, unknown>, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers ?? {});
  corsHeaders["Access-Control-Allow-Origin"] && headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
  headers.set("Content-Type", "application/json");
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer", "").trim();
  if (!token) {
    return jsonResponse({ error: "Invalid Authorization header" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch (_error) {
    return jsonResponse({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = matchPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: "Payload validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase environment variables");
    return jsonResponse({ error: "Server configuration error" }, { status: 500 });
  }

  const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
  if (authError) {
    console.error("Failed to fetch user", authError);
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authData.user?.id;
  if (!userId) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  if (userId !== parsed.data.player_id) {
    return jsonResponse({ error: "Player ID does not match authenticated user" }, { status: 403 });
  }

  const { data, error } = await supabaseClient.rpc("submit_match_with_elo", {
    match_payload: parsed.data,
  });

  if (error) {
    console.error("submit_match_with_elo failed", error);
    return jsonResponse({ error: "Failed to record match" }, { status: 500 });
  }

  if (!data) {
    return jsonResponse({ error: "No data returned from submit_match_with_elo" }, { status: 500 });
  }

  const matchRecord = (data as Record<string, unknown>).match ?? (data as Record<string, unknown>).match_history ?? data;
  const newElo = (data as Record<string, unknown>).new_elo ?? (data as Record<string, unknown>).elo ?? null;

  return jsonResponse({
    match: matchRecord,
    new_elo: newElo,
  });
});
