import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { chatwootSendMessageSchema, parseBody } from "../_shared/validation.ts";

/**
 * Send a message to a Chatwoot conversation.
 * Used by both AI auto-replies and staff manual replies.
 *
 * POST body: { chatwoot_conversation_id, content, tenant_id }
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const parsed = parseBody(chatwootSendMessageSchema, body, corsHeaders);
    if (parsed.response) return parsed.response;

    const { chatwoot_conversation_id, content, tenant_id } = parsed.data;

    // Load Chatwoot config for this tenant
    const { data: config } = await supabase
      .from("ai_config")
      .select("chatwoot_base_url, chatwoot_api_token_encrypted, chatwoot_account_id")
      .eq("tenant_id", tenant_id)
      .single();

    if (!config?.chatwoot_base_url || !config?.chatwoot_api_token_encrypted || !config?.chatwoot_account_id) {
      return new Response(
        JSON.stringify({ error: "Chatwoot not configured for this tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Decrypt API token
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
    const apiToken = encryptionKey
      ? await decryptToken(config.chatwoot_api_token_encrypted, encryptionKey)
      : config.chatwoot_api_token_encrypted; // fallback: stored as plaintext during dev

    // Send message via Chatwoot API
    const chatwootUrl = `${config.chatwoot_base_url}/api/v1/accounts/${config.chatwoot_account_id}/conversations/${chatwoot_conversation_id}/messages`;

    const response = await fetch(chatwootUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_access_token: apiToken,
      },
      body: JSON.stringify({
        content,
        message_type: "outgoing",
        private: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Chatwoot API error:", response.status, errorData);
      return new Response(
        JSON.stringify({ error: "Failed to send message to Chatwoot" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ ok: true, message_id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Chatwoot send message error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Simple AES-GCM decryption for stored tokens.
 * Encryption key is a hex-encoded 256-bit key from ENCRYPTION_KEY secret.
 */
async function decryptToken(encryptedHex: string, keyHex: string): Promise<string> {
  try {
    const encBytes = hexToBytes(encryptedHex);
    // First 12 bytes = IV, rest = ciphertext
    const iv = encBytes.slice(0, 12);
    const ciphertext = encBytes.slice(12);

    const keyBytes = hexToBytes(keyHex);
    const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails, treat as plaintext (dev mode)
    return encryptedHex;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
