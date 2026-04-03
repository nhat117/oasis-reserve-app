import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Validate & activate a license key for a tenant.
 *
 * POST { key: "XXXX-XXXX-XXXX-XXXX" }
 *
 * - Checks the key exists in license_keys table
 * - Verifies it hasn't been activated by another tenant
 * - Activates it for the caller's tenant
 * - Stores the key in app_settings as ai_license_key
 *
 * Returns { valid: true, features: [...] } or { valid: false, reason: "..." }
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ valid: false, reason: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (!user) {
      console.error("[validate-upgrade-key] Auth failed:", authError?.message);
      return new Response(JSON.stringify({ valid: false, reason: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get caller's tenant
    const { data: userRole } = await adminClient
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!userRole?.tenant_id) {
      return new Response(JSON.stringify({ valid: false, reason: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = userRole.tenant_id;
    const { key } = await req.json();

    if (!key || typeof key !== "string" || key.trim().length < 8) {
      return new Response(JSON.stringify({ valid: false, reason: "Invalid key format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedKey = key.trim().toUpperCase();

    // Look up the key
    const { data: licenseKey } = await adminClient
      .from("license_keys")
      .select("*")
      .eq("key", normalizedKey)
      .single();

    if (!licenseKey) {
      return new Response(JSON.stringify({ valid: false, reason: "Key not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!licenseKey.is_active) {
      return new Response(JSON.stringify({ valid: false, reason: "Key is deactivated" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (licenseKey.expires_at && new Date(licenseKey.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, reason: "Key has expired" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already activated by a different tenant
    if (licenseKey.tenant_id && licenseKey.tenant_id !== tenantId) {
      return new Response(JSON.stringify({ valid: false, reason: "Key already activated by another account" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Activate the key for this tenant
    if (!licenseKey.tenant_id) {
      await adminClient
        .from("license_keys")
        .update({ tenant_id: tenantId, activated_at: new Date().toISOString() })
        .eq("id", licenseKey.id);
    }

    // Store in app_settings so the frontend can check quickly
    await adminClient
      .from("app_settings")
      .upsert(
        { key: "ai_license_key", value: normalizedKey, tenant_id: tenantId },
        { onConflict: "key,tenant_id" }
      );

    // Audit log
    await adminClient.from("activity_logs").insert({
      user_id: user.id,
      action: "license_key_activated",
      details: { key_id: licenseKey.id, features: licenseKey.features },
      tenant_id: tenantId,
    });

    return new Response(
      JSON.stringify({ valid: true, features: licenseKey.features }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("License validation error:", err);
    return new Response(
      JSON.stringify({ valid: false, reason: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
