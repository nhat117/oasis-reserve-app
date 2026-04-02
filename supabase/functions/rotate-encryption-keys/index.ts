import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse } from "../_shared/auth.ts";
import { reEncryptToken, getEncryptionKeys } from "../_shared/crypto.ts";

/**
 * Encryption Key Rotation
 *
 * Re-encrypts all sensitive fields in ai_config from the previous
 * encryption key to the current one.
 *
 * Prerequisites:
 *   1. Generate new key:  openssl rand -hex 32
 *   2. Set both keys:     supabase secrets set ENCRYPTION_KEY="<new>" ENCRYPTION_KEY_PREVIOUS="<old>"
 *   3. Call this function: curl -X POST .../functions/v1/rotate-encryption-keys \
 *        -H "Authorization: Bearer <service-role-key>"
 *   4. After success:     supabase secrets unset ENCRYPTION_KEY_PREVIOUS
 *
 * Auth: service-role key only (not user-callable).
 *
 * PCI-DSS 3.6 — Cryptographic key management procedures.
 */

const SENSITIVE_COLUMNS = [
  "api_key_encrypted",
  "chatwoot_api_token_encrypted",
  "fresha_partner_token_encrypted",
  "elevenlabs_api_key_encrypted",
] as const;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only service-role key can trigger rotation
  const auth = await authenticateRequest(req, corsHeaders);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);
  if (!auth.isServiceRole) {
    return new Response(
      JSON.stringify({ error: "Key rotation requires service-role authentication" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const keys = getEncryptionKeys();
  if (!keys) {
    return new Response(
      JSON.stringify({ error: "ENCRYPTION_KEY not set" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!keys.previous) {
    return new Response(
      JSON.stringify({ error: "ENCRYPTION_KEY_PREVIOUS not set — nothing to rotate from. Set the old key as ENCRYPTION_KEY_PREVIOUS and the new key as ENCRYPTION_KEY." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Load all ai_config rows
    const { data: configs, error: loadErr } = await supabase
      .from("ai_config")
      .select(`id, tenant_id, ${SENSITIVE_COLUMNS.join(", ")}`);

    if (loadErr) throw loadErr;
    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No configs to rotate", rotated: 0, skipped: 0, errors: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let rotated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: Array<{ tenant_id: string; field: string; error: string }> = [];

    for (const config of configs) {
      const updates: Record<string, string> = {};
      let rowChanged = false;

      for (const col of SENSITIVE_COLUMNS) {
        const value = config[col];
        if (!value || typeof value !== "string") continue;

        try {
          const reEncrypted = await reEncryptToken(value, keys.previous!, keys.current);
          if (reEncrypted !== null) {
            updates[col] = reEncrypted;
            rowChanged = true;
          }
        } catch (err) {
          errors++;
          errorDetails.push({
            tenant_id: config.tenant_id,
            field: col,
            error: String(err),
          });
        }
      }

      if (rowChanged) {
        updates.updated_at = new Date().toISOString();
        const { error: updateErr } = await supabase
          .from("ai_config")
          .update(updates)
          .eq("id", config.id);

        if (updateErr) {
          errors++;
          errorDetails.push({
            tenant_id: config.tenant_id,
            field: "update",
            error: String(updateErr),
          });
        } else {
          rotated++;
        }
      } else {
        skipped++;
      }
    }

    // Log rotation event
    console.log(`Key rotation complete: ${rotated} rotated, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({
        ok: errors === 0,
        message: errors === 0
          ? `Rotation complete. You can now run: supabase secrets unset ENCRYPTION_KEY_PREVIOUS`
          : `Rotation completed with errors. Fix the errors before unsetting ENCRYPTION_KEY_PREVIOUS.`,
        total: configs.length,
        rotated,
        skipped,
        errors,
        error_details: errorDetails.length > 0 ? errorDetails : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Key rotation error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
