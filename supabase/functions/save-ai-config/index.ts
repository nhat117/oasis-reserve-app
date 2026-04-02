import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse } from "../_shared/auth.ts";

/**
 * Save AI Config — Server-side API key encryption
 *
 * Receives AI config from the frontend, encrypts any API keys
 * server-side using ENCRYPTION_KEY before storing in the database.
 *
 * PCI-DSS 3.4 — Render sensitive data unreadable in storage.
 * SOC2 CC6.6 — Encryption of data at rest.
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const tenantId = body.tenant_id;

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: require authenticated admin with tenant access
    const auth = await authenticateRequest(req, corsHeaders, { requireTenant: true, tenantId });
    if (!auth.ok) return authErrorResponse(auth, corsHeaders);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build payload — encrypt sensitive fields
    const sensitiveFields = [
      "api_key_encrypted",
      "chatwoot_api_token_encrypted",
      "fresha_partner_token_encrypted",
      "elevenlabs_api_key_encrypted",
    ];

    const payload: Record<string, unknown> = {};
    const allowedFields = [
      "tenant_id", "ai_enabled", "api_base_url", "model_name", "embedding_model",
      "system_prompt_override", "max_tokens", "temperature", "handoff_keywords",
      "auto_handoff_on_negative_sentiment", "chatwoot_base_url", "chatwoot_account_id",
      "booking_mode", "fresha_location_id", "fresha_api_base_url",
      "handoff_notify_email", "handoff_notify_sms", "voice_agent_enabled",
      "elevenlabs_voice_id", "elevenlabs_model_id", "voice_greeting", "voice_language",
      "updated_at",
      ...sensitiveFields,
    ];

    for (const key of allowedFields) {
      if (key in body && body[key] !== undefined) {
        payload[key] = body[key];
      }
    }

    // Encrypt sensitive fields if ENCRYPTION_KEY is available
    for (const field of sensitiveFields) {
      if (payload[field] && typeof payload[field] === "string") {
        const rawValue = (payload[field] as string).trim();
        if (rawValue) {
          if (encryptionKey) {
            payload[field] = await encryptToken(rawValue, encryptionKey);
          } else {
            console.warn(`ENCRYPTION_KEY not set — storing ${field} as plaintext (NOT recommended for production)`);
          }
        }
      }
    }

    // Upsert
    const configId = body.config_id;
    if (configId) {
      const { error } = await supabase.from("ai_config").update(payload).eq("id", configId).eq("tenant_id", tenantId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("ai_config").insert(payload);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("save-ai-config error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─── Encryption ────────────────────────────────────────────────────

async function encryptToken(plaintext: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Prepend IV to ciphertext and hex-encode
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToHex(combined);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
