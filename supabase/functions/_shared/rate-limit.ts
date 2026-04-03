/**
 * Database-backed rate limiter for edge functions.
 *
 * Uses Postgres check_rate_limit() function for atomic, cold-start-safe limiting.
 *
 * Usage:
 *   const rl = await checkRateLimitDb(supabase, `booking:${ip}`, 5, 60);
 *   if (!rl.allowed) return new Response('Too many requests', { status: 429, headers: { 'Retry-After': String(rl.retry_after) } });
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retry_after: number;
}

/**
 * Check rate limit using the database.
 *
 * @param supabase  - Service-role Supabase client
 * @param key       - Unique key, e.g. "booking:<ip>", "auth:<email>", "ai:<conv_id>"
 * @param maxTokens - Max requests allowed per window (default 10)
 * @param windowSec - Window duration in seconds (default 60)
 */
export async function checkRateLimitDb(
  supabase: SupabaseClient,
  key: string,
  maxTokens = 10,
  windowSec = 60,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_tokens: maxTokens,
    p_window_sec: windowSec,
  });

  if (error) {
    // Fail-open on DB error to avoid blocking legitimate traffic,
    // but log so we can investigate
    console.error("[RateLimit] DB error, failing open:", error.message);
    return { allowed: true, remaining: maxTokens, retry_after: 0 };
  }

  return {
    allowed: data.allowed,
    remaining: data.remaining,
    retry_after: data.retry_after,
  };
}

/**
 * Build a 429 Too Many Requests response with standard headers.
 */
export function rateLimitResponse(
  retryAfter: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}
