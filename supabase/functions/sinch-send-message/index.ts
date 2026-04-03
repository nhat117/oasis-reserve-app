import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sinchSendMessageSchema, parseBody } from "../_shared/validation.ts";

/**
 * Send a message to a contact via Sinch Conversation API.
 * Used by both AI auto-replies and staff manual replies.
 *
 * POST body: { external_conversation_id, content, tenant_id }
 *
 * Uses Sinch Conversation API:
 * POST https://{region}.conversation.api.sinch.com/v1/projects/{project_id}/messages:send
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
    const parsed = parseBody(sinchSendMessageSchema, body, corsHeaders);
    if (parsed.response) return parsed.response;

    const { external_conversation_id, content, tenant_id } = parsed.data;

    // Load Sinch config for this tenant
    const { data: config } = await supabase
      .from("ai_config")
      .select("sinch_project_id, sinch_app_id, sinch_client_id, sinch_client_secret_encrypted, sinch_region")
      .eq("tenant_id", tenant_id)
      .single();

    if (!config?.sinch_project_id || !config?.sinch_app_id || !config?.sinch_client_secret_encrypted) {
      return new Response(
        JSON.stringify({ error: "Sinch not configured for this tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Decrypt client secret
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
    const clientSecret = encryptionKey
      ? await decryptToken(config.sinch_client_secret_encrypted, encryptionKey)
      : config.sinch_client_secret_encrypted;

    // Look up the Sinch contact_id (external_contact_id) from the conversation
    const { data: convo } = await supabase
      .from("conversations")
      .select("external_contact_id")
      .eq("external_conversation_id", external_conversation_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!convo?.external_contact_id) {
      return new Response(
        JSON.stringify({ error: "Conversation or contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sinchContactId = convo.external_contact_id;
    const region = config.sinch_region || "us";

    // Get OAuth2 token from Sinch
    const tokenResp = await fetch("https://auth.sinch.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${config.sinch_client_id}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error("Sinch OAuth error:", tokenResp.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with Sinch" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;

    // Send message via Sinch Conversation API
    const sinchUrl = `https://${region}.conversation.api.sinch.com/v1/projects/${config.sinch_project_id}/messages:send`;

    const response = await fetch(sinchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        app_id: config.sinch_app_id,
        recipient: {
          contact_id: sinchContactId,
        },
        message: {
          text_message: {
            text: content,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Sinch API error:", response.status, errorData);
      return new Response(
        JSON.stringify({ error: "Failed to send message via Sinch" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ ok: true, message_id: data.message_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Sinch send message error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Simple AES-GCM decryption for stored tokens.
 */
async function decryptToken(encryptedHex: string, keyHex: string): Promise<string> {
  try {
    const encBytes = hexToBytes(encryptedHex);
    const iv = encBytes.slice(0, 12);
    const ciphertext = encBytes.slice(12);
    const keyBytes = hexToBytes(keyHex);
    const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
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
