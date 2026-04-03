/**
 * Edge function: rotate-key
 *
 * Rotates an API key in app_settings with a grace period for in-flight requests.
 * Only accessible by authenticated admin users.
 *
 * POST /functions/v1/rotate-key
 * Body: { key_name: string, new_value: string, grace_hours?: number }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimitDb, rateLimitResponse } from "../_shared/rate-limit.ts";
import { z } from "npm:zod@3";

const rotateKeySchema = z.object({
  key_name: z.enum([
    "stripe_secret_key",
    "stripe_webhook_secret",
    "square_access_token",
    "square_webhook_secret",
    "openai_api_key",
    "resend_api_key",
    "twilio_auth_token",
  ]),
  new_value: z.string().min(1, "New key value required").max(500),
  grace_hours: z.number().int().min(1).max(168).optional(), // max 7 days
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller is authenticated
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Create user-scoped client to check role
  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Verify admin role
  const { data: isAdmin } = await supabaseUser.rpc("has_role", { role_name: "admin" });
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: "Forbidden: admin role required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Service-role client for privileged operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Rate limit: 3 rotation attempts per hour per user
  const rl = await checkRateLimitDb(supabase, `rotate:${user.id}`, 3, 3600);
  if (!rl.allowed) return rateLimitResponse(rl.retry_after, corsHeaders);

  try {
    const body = await req.json();
    const parsed = rotateKeySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.errors.map(e => e.message).join(", ") }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { key_name, new_value, grace_hours } = parsed.data;

    // Get caller's tenant
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!roleRow?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Tenant not found for user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Perform rotation
    const { data: result, error: rpcError } = await supabase.rpc("rotate_api_key", {
      p_tenant_id: roleRow.tenant_id,
      p_key_name: key_name,
      p_new_value: new_value,
      p_rotated_by: user.id,
      p_grace_hours: grace_hours ?? 24,
    });

    if (rpcError) {
      console.error("[rotate-key] RPC error:", rpcError);
      return new Response(
        JSON.stringify({ error: "Failed to rotate key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        key_name: result.key_name,
        new_version: result.new_version,
        grace_expires_at: result.grace_expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[rotate-key] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
