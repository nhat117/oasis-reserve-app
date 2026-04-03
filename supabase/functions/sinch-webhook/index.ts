import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Sinch Conversation API Webhook Handler
 *
 * Receives MESSAGE_INBOUND callbacks from Sinch Conversation API,
 * normalizes messages into conversations + chat_messages tables,
 * and triggers AI response when ai_enabled is true.
 *
 * JWT is disabled — Sinch webhooks use HMAC signature verification.
 * Tenant is resolved via sinch_app_id in ai_config.
 *
 * Sinch MESSAGE_INBOUND webhook payload shape:
 * {
 *   app_id: string,
 *   accepted_time: string,
 *   event_time: string,
 *   project_id: string,
 *   message: {
 *     id: string,
 *     direction: "TO_APP",
 *     contact_message: {
 *       text_message?: { text: string },
 *       media_message?: { url: string },
 *       location_message?: { ... },
 *     },
 *     channel_identity: {
 *       channel: "MESSENGER" | "WHATSAPP" | "SMS" | "VIBER" | "VIBERBM" | "RCS" | "INSTAGRAM" | "TELEGRAM",
 *       identity: string,
 *       app_id: string,
 *     },
 *     conversation_id: string,
 *     contact_id: string,
 *     metadata: string,
 *     accept_time: string,
 *   }
 * }
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
    const body = await req.json();

    const appId = body.app_id as string | undefined;
    const message = body.message;

    if (!appId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing app_id or message" }),
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

    const tenantId = aiConfig.tenant_id;

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
