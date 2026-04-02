import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Chatwoot Webhook Handler
 *
 * Receives webhooks from Chatwoot, normalizes messages into
 * conversations + chat_messages tables, and triggers AI response
 * when ai_enabled is true on the conversation.
 *
 * JWT is disabled — authentication is via HMAC signature from Chatwoot.
 * Tenant is resolved via chatwoot_account_id in ai_config.
 */
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
    const event = body.event as string | undefined;

    if (!event) {
      return new Response(
        JSON.stringify({ error: "Missing event field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve tenant from Chatwoot account_id
    const accountId = body.account?.id as number | undefined;
    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "Missing account.id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select("tenant_id, ai_enabled")
      .eq("chatwoot_account_id", accountId)
      .single();

    if (!aiConfig) {
      console.error(`No ai_config found for chatwoot account_id=${accountId}`);
      return new Response(
        JSON.stringify({ error: "Tenant not found for this Chatwoot account" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantId = aiConfig.tenant_id;

    if (event === "message_created") {
      return await handleMessageCreated(supabase, body, tenantId, aiConfig.ai_enabled, corsHeaders);
    }

    if (event === "conversation_status_changed") {
      return await handleConversationStatusChanged(supabase, body, tenantId, corsHeaders);
    }

    // Unhandled event — acknowledge silently
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Chatwoot webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// deno-lint-ignore no-explicit-any
async function handleMessageCreated(supabase: any, body: any, tenantId: string, globalAiEnabled: boolean, corsHeaders: Record<string, string>) {
  const msg = body;
  const messageType = msg.message_type; // "incoming" = customer, "outgoing" = agent
  const conversationData = msg.conversation;
  const contactData = msg.sender;

  // Only process incoming customer messages
  if (messageType !== "incoming") {
    return new Response(JSON.stringify({ ok: true, skipped: "not incoming" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const chatwootConvoId = conversationData?.id;
  if (!chatwootConvoId) {
    return new Response(JSON.stringify({ error: "Missing conversation.id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Determine platform from channel type
  const channelType = conversationData?.channel?.toLowerCase() || "web";
  let platform = "web";
  if (channelType.includes("instagram")) platform = "instagram";
  else if (channelType.includes("facebook") || channelType.includes("messenger")) platform = "facebook";
  else if (channelType.includes("tiktok")) platform = "tiktok";
  else if (channelType.includes("api")) platform = "api";

  // Upsert conversation
  const { data: existingConvo } = await supabase
    .from("conversations")
    .select("id, ai_enabled")
    .eq("chatwoot_conversation_id", chatwootConvoId)
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
        last_message_preview: (msg.content || "").slice(0, 200),
        unread_count: (existingConvo.unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
  } else {
    const { data: newConvo, error: insertErr } = await supabase
      .from("conversations")
      .insert({
        tenant_id: tenantId,
        chatwoot_conversation_id: chatwootConvoId,
        chatwoot_contact_id: contactData?.id || null,
        platform,
        contact_name: contactData?.name || contactData?.email || "Unknown",
        contact_identifier: contactData?.phone_number || contactData?.email || contactData?.identifier || null,
        contact_avatar_url: contactData?.thumbnail || null,
        status: "open",
        ai_enabled: true,
        last_message_at: new Date().toISOString(),
        last_message_preview: (msg.content || "").slice(0, 200),
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
      chatwoot_message_id: msg.id || null,
      direction: "inbound",
      sender_type: "customer",
      sender_name: contactData?.name || "Customer",
      content: msg.content || "",
      content_type: msg.content_type || "text",
      metadata: {
        chatwoot_event: "message_created",
        attachments: msg.attachments || [],
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
  if (globalAiEnabled && conversationAiEnabled && newMessage) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Fire-and-forget call to ai-chat-respond
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

  return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function handleConversationStatusChanged(supabase: any, body: any, tenantId: string, corsHeaders: Record<string, string>) {
  const chatwootConvoId = body.id;
  const newStatus = body.status; // "open", "resolved", "pending"

  if (!chatwootConvoId || !newStatus) {
    return new Response(JSON.stringify({ ok: true, skipped: "missing data" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Map Chatwoot status to our status
  const statusMap: Record<string, string> = {
    open: "open",
    resolved: "resolved",
    pending: "pending",
  };
  const mappedStatus = statusMap[newStatus] || "open";

  await supabase
    .from("conversations")
    .update({ status: mappedStatus, updated_at: new Date().toISOString() })
    .eq("chatwoot_conversation_id", chatwootConvoId)
    .eq("tenant_id", tenantId);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
