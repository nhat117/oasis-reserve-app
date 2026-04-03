import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Sinch Conversation API Webhook Handler
 *
 * Receives callbacks from Sinch Conversation API:
 * - MESSAGE_INBOUND: customer messages → normalize into conversations + chat_messages, trigger AI
 * - MESSAGE_DELIVERY: delivery/read receipts → logged (future: update message status)
 * - Other events: acknowledged with 200 OK
 *
 * JWT is disabled — uses optional HMAC-SHA256 signature verification.
 * Tenant is resolved via sinch_app_id in ai_config.
 */

const SINCH_CHANNEL_MAP: Record<string, string> = {
  MESSENGER: "facebook",
  WHATSAPP: "whatsapp",
  SMS: "sms",
  VIBER: "viber",
  VIBERBM: "viber",
  RCS: "rcs",
  INSTAGRAM: "instagram",
  TELEGRAM: "telegram",
};

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
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    const appId = body.app_id as string | undefined;

    if (!appId) {
      return new Response(
        JSON.stringify({ error: "Missing app_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve tenant from Sinch app_id
    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select("tenant_id, ai_enabled, sinch_webhook_secret")
      .eq("sinch_app_id", appId)
      .single();

    if (!aiConfig) {
      console.error(`No ai_config found for Sinch app_id=${appId}`);
      return new Response(
        JSON.stringify({ error: "Tenant not found for this Sinch app" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── HMAC Signature Verification ─────────────────────────────────
    // If webhook secret is configured, verify the x-sinch-webhook-signature header
    if (aiConfig.sinch_webhook_secret) {
      const signature = req.headers.get("x-sinch-webhook-signature") || "";
      const isValid = await verifyHmac(rawBody, aiConfig.sinch_webhook_secret, signature);
      if (!isValid) {
        console.error("Sinch webhook signature verification failed");
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const tenantId = aiConfig.tenant_id;

    // ─── Route by event type ─────────────────────────────────────────
    // Sinch sends different event types: message, message_delivery_report, etc.

    // Delivery/read receipts — acknowledge and log
    if (body.message_delivery_report) {
      const report = body.message_delivery_report;
      console.log(`Delivery report: message=${report.message_id} status=${report.status}`);
      return new Response(JSON.stringify({ ok: true, event: "delivery_report", status: report.status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Event callbacks (typing, opt-in/out, etc.) — acknowledge
    if (!body.message) {
      console.log(`Non-message event received for app_id=${appId}`);
      return new Response(JSON.stringify({ ok: true, event: "non_message" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── MESSAGE_INBOUND processing ──────────────────────────────────
    const message = body.message;

    // Extract message text from contact_message
    const contactMessage = message.contact_message;
    const messageText = contactMessage?.text_message?.text
      || contactMessage?.media_card_message?.caption
      || null;

    // Skip if no text content (media-only messages, etc.)
    if (!messageText?.trim()) {
      return new Response(JSON.stringify({ ok: true, skipped: "no text content" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Sinch channel to platform string
    const sinchChannel = message.channel_identity?.channel || "";
    const platform = SINCH_CHANNEL_MAP[sinchChannel] || "web";

    // Use Sinch conversation_id as external conversation identifier
    const sinchConversationId = message.conversation_id as string;
    const sinchContactId = message.contact_id as string;
    const sinchMessageId = message.id as string;
    const contactIdentity = message.channel_identity?.identity || "";

    const externalConvoId = `sinch_${sinchConversationId}`;

    // Try to get contact name via Sinch metadata or use identity
    const contactName = contactIdentity || "Unknown";

    // Upsert conversation
    const { data: existingConvo } = await supabase
      .from("conversations")
      .select("id, ai_enabled, unread_count")
      .eq("external_conversation_id", externalConvoId)
      .eq("tenant_id", tenantId)
      .single();

    let conversationId: string;
    let conversationAiEnabled: boolean;

    if (existingConvo) {
      conversationId = existingConvo.id;
      conversationAiEnabled = existingConvo.ai_enabled;

      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: messageText.slice(0, 200),
          unread_count: (existingConvo.unread_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    } else {
      const { data: newConvo, error: insertErr } = await supabase
        .from("conversations")
        .insert({
          tenant_id: tenantId,
          external_conversation_id: externalConvoId,
          external_contact_id: sinchContactId,
          platform,
          contact_name: contactName,
          contact_identifier: contactIdentity,
          contact_avatar_url: null,
          status: "open",
          ai_enabled: true,
          last_message_at: new Date().toISOString(),
          last_message_preview: messageText.slice(0, 200),
          unread_count: 1,
        })
        .select("id")
        .single();

      if (insertErr || !newConvo) {
        console.error("Failed to create conversation:", insertErr);
        return new Response(JSON.stringify({ error: "Failed to create conversation" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      conversationId = newConvo.id;
      conversationAiEnabled = true;
    }

    // Insert chat message
    const { data: newMessage, error: msgErr } = await supabase
      .from("chat_messages")
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        external_message_id: sinchMessageId,
        direction: "inbound",
        sender_type: "customer",
        sender_name: contactName,
        content: messageText,
        content_type: "text",
        metadata: {
          sinch_event: "MESSAGE_INBOUND",
          channel: platform,
          sinch_channel: sinchChannel,
          sinch_contact_id: sinchContactId,
          sinch_conversation_id: sinchConversationId,
          channel_identity: contactIdentity,
        },
      })
      .select("id")
      .single();

    if (msgErr) {
      console.error("Failed to insert message:", msgErr);
      return new Response(JSON.stringify({ error: "Failed to insert message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trigger AI response if enabled (both global and per-conversation)
    if (aiConfig.ai_enabled && conversationAiEnabled && newMessage) {
      fetch(`${supabaseUrl}/functions/v1/ai-chat-respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message_id: newMessage.id,
          tenant_id: tenantId,
        }),
      }).catch((err) => console.error("Failed to trigger AI response:", err));
    }

    return new Response(JSON.stringify({
      ok: true,
      conversation_id: conversationId,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sinch webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─── HMAC-SHA256 Signature Verification ─────────────────────────────

async function verifyHmac(body: string, secret: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return computed === signature;
  } catch {
    return false;
  }
}
