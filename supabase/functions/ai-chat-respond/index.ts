import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { aiChatRespondSchema, parseBody } from "../_shared/validation.ts";
import { checkMessageSecurity, checkRateLimit, wrapUserMessage, getSecurityPreamble } from "../_shared/ai-security.ts";

/**
 * AI Chat Response Generator
 *
 * Called after an inbound customer message when AI is enabled.
 * Uses RAG search + existing DB tables (services, therapists, bookings)
 * to generate contextual responses and execute booking actions.
 *
 * ALL queries are scoped to a single tenant_id.
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
    const parsed = parseBody(aiChatRespondSchema, body, corsHeaders);
    if (parsed.response) return parsed.response;

    const { conversation_id, message_id, tenant_id } = parsed.data;

    // 1. Load AI config
    const { data: config } = await supabase
      .from("ai_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();

    if (!config || !config.ai_enabled || !config.api_key_encrypted) {
      return new Response(JSON.stringify({ ok: true, skipped: "AI disabled or not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load conversation
    const { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversation_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!conversation || !conversation.ai_enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: "conversation AI disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Load conversation history (last 20 messages)
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("direction, sender_type, sender_name, content, metadata, created_at")
      .eq("conversation_id", conversation_id)
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: true })
      .limit(20);

    // 4. Get the latest customer message
    const { data: latestMsg } = await supabase
      .from("chat_messages")
      .select("content")
      .eq("id", message_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!latestMsg) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4b. Rate limiting — prevent message flooding
    const rateCheck = checkRateLimit(conversation_id);
    if (!rateCheck.allowed) {
      console.warn(`Rate limited conversation ${conversation_id}`);
      return new Response(JSON.stringify({ ok: true, skipped: "rate limited" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4c. Security check — prompt injection detection
    const securityCheck = checkMessageSecurity(latestMsg.content);
    if (!securityCheck.safe) {
      console.warn(`Security block on conversation ${conversation_id}: ${securityCheck.blocked_reason} (risk=${securityCheck.risk_score})`);

      // Store a polite deflection as the AI response
      const deflection = securityCheck.blocked_reason === "Cannot provide other customers' information"
        ? "I'm sorry, I can't share other customers' information. I can only help you with your own bookings and our services. How can I assist you today?"
        : "I'm here to help you with bookings and information about our services. Could you please rephrase your question?";

      await supabase.from("chat_messages").insert({
        tenant_id,
        conversation_id,
        direction: "outbound",
        sender_type: "ai",
        sender_name: "AI Assistant",
        content: deflection,
        content_type: "text",
        metadata: { security_blocked: true, risk_score: securityCheck.risk_score },
      });

      // Send deflection to customer via Sinch
      if (conversation.external_conversation_id) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${supabaseUrl}/functions/v1/sinch-send-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
          body: JSON.stringify({ external_conversation_id: conversation.external_conversation_id, content: deflection, tenant_id }),
        }).catch(() => {});
      }

      return new Response(JSON.stringify({ ok: true, security_blocked: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Decrypt API key
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
    const apiKey = encryptionKey
      ? await decryptToken(config.api_key_encrypted, encryptionKey)
      : config.api_key_encrypted;

    const baseUrl = config.api_base_url || "https://api.openai.com/v1";
    const model = config.model_name || "gpt-4o-mini";
    const embeddingModel = config.embedding_model || "text-embedding-3-small";

    // 6. Load existing shop data (scoped by tenant_id)
    const [servicesResult, therapistsResult, tenantResult] = await Promise.all([
      supabase.from("services").select("id, name, price, duration_minutes, is_active").eq("tenant_id", tenant_id).eq("is_active", true),
      supabase.from("therapists").select("id, name, is_active, therapist_weekly_hours(*)").eq("tenant_id", tenant_id).eq("is_active", true),
      supabase.from("tenants").select("name").eq("id", tenant_id).single(),
    ]);

    const services = servicesResult.data || [];
    const therapists = therapistsResult.data || [];
    const shopName = tenantResult.data?.name || "Our salon";

    // 7. RAG search — embed the customer's message and search knowledge base
    let ragContext = "";
    try {
      const embeddingResp = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input: latestMsg.content, model: embeddingModel }),
      });

      if (embeddingResp.ok) {
        const embData = await embeddingResp.json();
        const queryEmbedding = embData.data?.[0]?.embedding;

        if (queryEmbedding) {
          const { data: kbResults } = await supabase.rpc("search_knowledge_base", {
            query_embedding: JSON.stringify(queryEmbedding),
            p_tenant_id: tenant_id,
            match_threshold: 0.7,
            match_count: 5,
          });

          if (kbResults?.length) {
            ragContext = kbResults
              .map((r: { title: string; chunk_text: string }) => `[${r.title}]: ${r.chunk_text}`)
              .join("\n\n");
          }
        }
      }
    } catch (err) {
      console.error("RAG search failed (non-fatal):", err);
    }

    // 8. Build system prompt with real shop data + security preamble
    const basePrompt = buildSystemPrompt(shopName, services, therapists, ragContext, config.system_prompt_override);
    const systemPrompt = getSecurityPreamble().replace("{shop_name}", shopName) + "\n" + basePrompt;

    // 8b. Analyze conversation for circular patterns — feed to LLM so it can decide to hand off
    const circleAnalysis = analyzeConversationCircles(messages || []);
    const circleAdvisory = circleAnalysis.shouldAdviseHandoff
      ? `\n\nCONVERSATION STATUS ALERT:\n${circleAnalysis.advisory}\nYou MUST call transfer_to_human if you cannot add new value in your next response. Do NOT repeat previous answers.`
      : "";

    // 9. Build conversation messages for the LLM
    // Wrap customer messages in delimiters to resist injection
    const llmMessages = [
      { role: "system", content: systemPrompt + circleAdvisory },
      ...(messages || []).map((m) => ({
        role: m.sender_type === "customer" ? "user" : "assistant",
        content: m.sender_type === "customer" ? wrapUserMessage(m.content) : m.content,
      })),
    ];

    // 10. Call LLM with tools (max 3 iterations for tool calls)
    const tools = getToolDefinitions();
    let finalResponse = "";
    let iterations = 0;

    while (iterations < 3) {
      iterations++;

      const llmResp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: llmMessages,
          tools,
          tool_choice: "auto",
          max_tokens: config.max_tokens || 500,
          temperature: Number(config.temperature) || 0.7,
        }),
      });

      if (!llmResp.ok) {
        const errText = await llmResp.text();
        console.error("LLM API error:", llmResp.status, errText);
        finalResponse = "I'm sorry, I'm having trouble right now. Let me connect you with a team member.";
        // Auto-handoff on AI failure
        await supabase.from("conversations").update({ ai_enabled: false }).eq("id", conversation_id);
        break;
      }

      const llmData = await llmResp.json();
      const choice = llmData.choices?.[0];

      if (!choice) {
        finalResponse = "I apologize, something went wrong. A team member will assist you shortly.";
        await supabase.from("conversations").update({ ai_enabled: false }).eq("id", conversation_id);
        break;
      }

      const assistantMsg = choice.message;

      // If there are tool calls, execute them
      if (assistantMsg.tool_calls?.length) {
        llmMessages.push(assistantMsg);

        for (const toolCall of assistantMsg.tool_calls) {
          // Build booking config from ai_config
          const bookingCfg: BookingConfig = {
            booking_mode: config.booking_mode || "local",
            fresha_partner_token: config.fresha_partner_token_encrypted
              ? (encryptionKey ? await decryptToken(config.fresha_partner_token_encrypted, encryptionKey) : config.fresha_partner_token_encrypted)
              : undefined,
            fresha_location_id: config.fresha_location_id || undefined,
            fresha_api_base_url: config.fresha_api_base_url || "https://partner-api.fresha.com/v1",
          };

          const toolResult = await executeTool(
            supabase,
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments || "{}"),
            tenant_id,
            conversation_id,
            services,
            therapists,
            bookingCfg,
          );

          llmMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Continue loop to get the final text response
        continue;
      }

      // No tool calls — we have the final text response
      finalResponse = assistantMsg.content || "";
      break;
    }

    if (!finalResponse) {
      finalResponse = "I'm here to help! Could you please rephrase your question?";
    }

    // 11. Store AI response in chat_messages
    await supabase.from("chat_messages").insert({
      tenant_id,
      conversation_id,
      direction: "outbound",
      sender_type: "ai",
      sender_name: "AI Assistant",
      content: finalResponse,
      content_type: "text",
      metadata: { model, iterations },
    });

    // 12. Update conversation
    await supabase.from("conversations").update({
      last_message_at: new Date().toISOString(),
      last_message_preview: finalResponse.slice(0, 200),
      updated_at: new Date().toISOString(),
    }).eq("id", conversation_id);

    // 13. Send reply to customer via Sinch
    if (conversation.external_conversation_id) {
      const sinchUrl = `${supabaseUrl}/functions/v1/sinch-send-message`;
      fetch(sinchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          external_conversation_id: conversation.external_conversation_id,
          content: finalResponse,
          tenant_id,
        }),
      }).catch((err) => console.error("Failed to send Sinch reply:", err));
    }

    return new Response(JSON.stringify({ ok: true, response: finalResponse }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI chat respond error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Conversation Circle Detection ──────────────────────────────────
// Analyzes message history to detect when the AI is going in circles,
// then injects an advisory into the system prompt so the LLM decides to hand off.

interface CircleAnalysis {
  shouldAdviseHandoff: boolean;
  advisory: string;
  signals: {
    repeatedQuestions: number;
    similarResponses: number;
    customerRepeats: number;
    toolFailures: number;
    conversationLength: number;
  };
}

interface ChatMessage {
  direction: string;
  sender_type: string;
  sender_name: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

function analyzeConversationCircles(messages: ChatMessage[]): CircleAnalysis {
  const signals = {
    repeatedQuestions: 0,
    similarResponses: 0,
    customerRepeats: 0,
    toolFailures: 0,
    conversationLength: messages.length,
  };

  if (messages.length < 4) {
    return { shouldAdviseHandoff: false, advisory: "", signals };
  }

  // Extract customer messages and AI responses
  const customerMsgs = messages
    .filter((m) => m.sender_type === "customer")
    .map((m) => m.content?.toLowerCase().trim() || "");
  const aiMsgs = messages
    .filter((m) => m.sender_type === "ai")
    .map((m) => m.content?.toLowerCase().trim() || "");

  // Detect customer repeating themselves (similar messages)
  for (let i = 1; i < customerMsgs.length; i++) {
    if (customerMsgs[i].length < 5) continue;
    for (let j = 0; j < i; j++) {
      if (textSimilarity(customerMsgs[i], customerMsgs[j]) > 0.6) {
        signals.customerRepeats++;
      }
    }
  }

  // Detect AI repeating itself (similar responses)
  for (let i = 1; i < aiMsgs.length; i++) {
    if (aiMsgs[i].length < 10) continue;
    for (let j = 0; j < i; j++) {
      if (textSimilarity(aiMsgs[i], aiMsgs[j]) > 0.6) {
        signals.similarResponses++;
      }
    }
  }

  // Detect the AI asking the same question pattern (asking for name, phone, etc. again)
  const questionPatterns = ["what is your name", "your phone", "which service", "what date", "what time", "which day"];
  const aiQuestions: string[] = [];
  for (const msg of aiMsgs) {
    for (const pattern of questionPatterns) {
      if (msg.includes(pattern)) {
        aiQuestions.push(pattern);
      }
    }
  }
  const questionCounts = new Map<string, number>();
  for (const q of aiQuestions) {
    questionCounts.set(q, (questionCounts.get(q) || 0) + 1);
  }
  for (const count of questionCounts.values()) {
    if (count >= 2) signals.repeatedQuestions++;
  }

  // Count tool failures from metadata
  for (const m of messages) {
    if (m.metadata && typeof m.metadata === "object") {
      const meta = m.metadata as Record<string, unknown>;
      if (meta.security_blocked || meta.error) {
        signals.toolFailures++;
      }
    }
  }

  // Build advisory based on signals
  const reasons: string[] = [];

  if (signals.customerRepeats >= 2) {
    reasons.push(`The customer has repeated the same request ${signals.customerRepeats} times — you are not resolving their issue.`);
  }
  if (signals.similarResponses >= 2) {
    reasons.push(`You have given ${signals.similarResponses} similar responses — you are going in circles.`);
  }
  if (signals.repeatedQuestions >= 1) {
    reasons.push(`You have asked the same question ${signals.repeatedQuestions + 1} times — the customer likely already answered.`);
  }
  if (signals.toolFailures >= 2) {
    reasons.push(`There have been ${signals.toolFailures} tool/system failures in this conversation.`);
  }
  if (signals.conversationLength >= 12 && reasons.length === 0) {
    reasons.push("This conversation has been going on for a while without resolution.");
  }

  const shouldAdviseHandoff = reasons.length > 0;
  const advisory = reasons.join("\n");

  return { shouldAdviseHandoff, advisory, signals };
}

/**
 * Simple text similarity using word overlap (Jaccard-like).
 * Returns 0-1 where 1 = identical word sets.
 */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return intersection / Math.max(wordsA.size, wordsB.size);
}

// ─── System Prompt Builder ───────────────────────────────────────────

interface Service { id: string; name: string; price: number; duration_minutes: number }
// A day can now have zero, one, or several independent shift blocks (a
// split shift) instead of one row with its own break window — the break
// is just the gap between two blocks, never stored. Mirrors
// src/lib/weeklyScheduleLogic.ts's WeeklyShiftBlock on the frontend; this
// Deno edge function can't import from src/lib, so it's duplicated here
// the same way this file already duplicates formatMinutesHHMM.
interface WeeklyShiftBlock { day_of_week: number; start_minute: number; end_minute: number }
interface Therapist { id: string; name: string; therapist_weekly_hours: WeeklyShiftBlock[] }

function getDayBlocks(therapist: Therapist, dayOfWeek: number): WeeklyShiftBlock[] {
  return (therapist.therapist_weekly_hours || []).filter((r) => r.day_of_week === dayOfWeek);
}

function fitsInAnyBlock(startMins: number, endMins: number, blocks: WeeklyShiftBlock[]): boolean {
  return blocks.some((b) => startMins >= b.start_minute && endMins <= b.end_minute);
}

function formatMinutesHHMM(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function describeWeeklyHours(therapist: Therapist): string {
  const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const blocks = therapist.therapist_weekly_hours || [];
  if (blocks.length === 0) return "no working days set";
  return [...blocks]
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_minute - b.start_minute)
    .map((r) => `${dayNames[r.day_of_week]} ${formatMinutesHHMM(r.start_minute)}-${formatMinutesHHMM(r.end_minute)}`)
    .join(", ");
}

function buildSystemPrompt(
  shopName: string,
  services: Service[],
  therapists: Therapist[],
  ragContext: string,
  customOverride: string | null,
): string {
  const servicesList = services
    .map((s) => `- ${s.name}: $${s.price} (${s.duration_minutes} min) [id: ${s.id}]`)
    .join("\n");

  const therapistsList = therapists
    .map((t) => `- ${t.name} (${describeWeeklyHours(t)}) [id: ${t.id}]`)
    .join("\n");

  const base = customOverride || `You are ${shopName}'s friendly AI booking assistant.`;

  return `${base}

You help customers with:
- Answering questions about services, pricing, and availability
- Booking appointments
- Providing business information (hours, location, policies)

AVAILABLE SERVICES:
${servicesList || "No services configured yet."}

AVAILABLE THERAPISTS/STAFF:
${therapistsList || "No therapists configured yet."}

${ragContext ? `ADDITIONAL BUSINESS INFO:\n${ragContext}\n` : ""}
RULES:
1. Always be polite and helpful. Match the customer's language (if they write in Vietnamese, reply in Vietnamese).
2. When a customer wants to book, collect: service, preferred date, preferred time, their name, and phone number.
3. Always use check_availability before confirming a booking.
4. If you cannot help or the customer asks for a human, use the transfer_to_human tool.
5. Never make up information not present in the data above. If unsure, offer to connect with staff.
6. Keep responses concise — 2-3 sentences max unless explaining something detailed.
7. Format prices with $ symbol. Durations in minutes.
8. When listing available slots, show max 5-6 options to avoid overwhelming the customer.
9. You are restricted to this shop's data only. Do not reference other businesses.

AUTO-HANDOFF RULES (critical — prevents going in circles):
10. If you are about to repeat an answer you already gave, call transfer_to_human instead.
11. If the customer seems frustrated, angry, or upset, call transfer_to_human with the reason.
12. If you have failed to resolve the customer's request after 2 attempts, call transfer_to_human.
13. If the customer's request is outside your capabilities (complaints, refunds, complex changes), call transfer_to_human immediately — do not attempt to handle it.
14. If you see a CONVERSATION STATUS ALERT in your instructions, follow it strictly.`;
}

// ─── Tool Definitions ────────────────────────────────────────────────

function getToolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "get_services",
        description: "Get the list of available services with prices and durations for this shop",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "get_therapists",
        description: "Get the list of available therapists/staff with their working hours for this shop",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "check_availability",
        description: "Check available appointment slots for a service on a specific date at this shop",
        parameters: {
          type: "object",
          properties: {
            service_id: { type: "string", description: "UUID of the service" },
            date: { type: "string", description: "Date in YYYY-MM-DD format" },
            therapist_id: { type: "string", description: "Optional: specific therapist UUID. Omit for any available." },
          },
          required: ["service_id", "date"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_booking",
        description: "Create a confirmed booking appointment at this shop",
        parameters: {
          type: "object",
          properties: {
            service_id: { type: "string", description: "UUID of the service" },
            date: { type: "string", description: "Date in YYYY-MM-DD format" },
            time: { type: "string", description: "Start time in HH:MM format" },
            customer_name: { type: "string", description: "Customer's full name" },
            customer_phone: { type: "string", description: "Customer's phone number" },
            customer_email: { type: "string", description: "Optional customer email" },
            therapist_id: { type: "string", description: "Optional: specific therapist UUID. Omit for auto-assign." },
          },
          required: ["service_id", "date", "time", "customer_name", "customer_phone"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "transfer_to_human",
        description: "Transfer the conversation to a human staff member. Use when: (1) customer requests a human, (2) you cannot resolve the issue after 2 attempts, (3) customer is frustrated or upset, (4) you are about to repeat a previous answer, (5) request is outside your capabilities (complaints, refunds, complex changes)",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Why the transfer is needed" },
          },
          required: ["reason"],
        },
      },
    },
  ];
}

// ─── Tool Executor ───────────────────────────────────────────────────

interface BookingConfig {
  booking_mode: string; // 'local' | 'fresha'
  fresha_partner_token?: string;
  fresha_location_id?: string;
  fresha_api_base_url?: string;
}

// deno-lint-ignore no-explicit-any
async function executeTool(
  supabase: any,
  toolName: string,
  args: Record<string, unknown>,
  tenantId: string,
  conversationId: string,
  services: Service[],
  therapists: Therapist[],
  bookingConfig?: BookingConfig,
): Promise<unknown> {
  switch (toolName) {
    case "get_services":
      return { services: services.map((s) => ({ id: s.id, name: s.name, price: s.price, duration_minutes: s.duration_minutes })) };

    case "get_therapists":
      return {
        therapists: therapists.map((t) => ({
          id: t.id, name: t.name,
          weekly_hours: describeWeeklyHours(t),
        })),
      };

    case "check_availability":
      return await toolCheckAvailability(supabase, args, tenantId, services, therapists);

    case "create_booking":
      if (bookingConfig?.booking_mode === "fresha" && bookingConfig.fresha_partner_token) {
        return await toolCreateBookingFresha(args, services, therapists, bookingConfig);
      }
      return await toolCreateBooking(supabase, args, tenantId, services, therapists);

    case "transfer_to_human": {
      await supabase.from("conversations").update({
        ai_enabled: false,
        updated_at: new Date().toISOString(),
      }).eq("id", conversationId).eq("tenant_id", tenantId);

      // Fire handoff notification (email + SMS + in-app) — non-blocking
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/notify-handoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          tenant_id: tenantId,
          reason: (args.reason as string) || "Customer requested human assistance",
          source: "ai_transfer_tool",
        }),
      }).catch((err) => console.error("Handoff notification failed:", err));

      return { transferred: true, message: "Conversation transferred to staff. A team member will respond shortly." };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

const BUFFER_MINUTES = 15;

// deno-lint-ignore no-explicit-any
async function toolCheckAvailability(
  supabase: any,
  args: Record<string, unknown>,
  tenantId: string,
  services: Service[],
  therapists: Therapist[],
) {
  const serviceId = args.service_id as string;
  const dateStr = args.date as string;
  const specificTherapistId = args.therapist_id as string | undefined;

  const service = services.find((s) => s.id === serviceId);
  if (!service) return { error: "Service not found" };

  // Validate date format
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return { error: "Invalid date format. Use YYYY-MM-DD." };

  const date = new Date(dateStr + "T00:00:00");
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

  // Check shop holidays
  const { data: holidays } = await supabase
    .from("shop_holidays")
    .select("early_close_hour")
    .eq("tenant_id", tenantId)
    .eq("holiday_date", dateStr);

  const isFullHoliday = holidays?.some((h: { early_close_hour: number | null }) => h.early_close_hour === null);
  if (isFullHoliday) return { available_slots: [], message: "The shop is closed on this date (holiday)." };

  const earlyCloseHour = holidays?.[0]?.early_close_hour || null;

  // Check therapist unavailability for this date
  const { data: unavailList } = await supabase
    .from("therapist_unavailability")
    .select("therapist_id")
    .eq("tenant_id", tenantId)
    .eq("unavailable_date", dateStr);

  const unavailableIds = new Set((unavailList || []).map((u: { therapist_id: string }) => u.therapist_id));

  // Get existing bookings for this date
  const { data: existingBookings } = await supabase
    .from("bookings")
    .select("therapist_id, start_time, end_time, status")
    .eq("tenant_id", tenantId)
    .eq("booking_date", dateStr)
    .neq("status", "cancelled");

  const duration = service.duration_minutes;

  // Filter therapists by the specific one if requested
  const candidateTherapists = specificTherapistId
    ? therapists.filter((t) => t.id === specificTherapistId)
    : therapists;

  const workingTherapists = candidateTherapists.filter(
    (t) => getDayBlocks(t, dayOfWeek).length > 0 && !unavailableIds.has(t.id),
  );

  if (workingTherapists.length === 0) {
    return { available_slots: [], message: "No therapists available on this date." };
  }

  const allBlocks = workingTherapists.flatMap((t) => getDayBlocks(t, dayOfWeek));
  const minStartMin = Math.min(...allBlocks.map((b) => b.start_minute));
  const rawMaxEndMin = Math.max(...allBlocks.map((b) => b.end_minute));
  const maxEndMin = earlyCloseHour ? Math.min(rawMaxEndMin, earlyCloseHour * 60) : rawMaxEndMin;

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const slots: { time: string; available_therapists: number }[] = [];

  for (let slotStartMin = minStartMin; slotStartMin < maxEndMin; slotStartMin += 30) {
    const slotEndMin = slotStartMin + duration;

    if (slotEndMin > maxEndMin) continue;

    // Skip past times if today
    if (isToday) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (slotStartMin <= nowMin) continue;
    }

    const timeStr = formatMinutesHHMM(slotStartMin);

    // Count how many therapists can handle this slot
    let availCount = 0;
    for (const t of workingTherapists) {
      const dayBlocks = getDayBlocks(t, dayOfWeek);
      if (!fitsInAnyBlock(slotStartMin, slotEndMin, dayBlocks)) continue;

      // Check booking conflicts
      const hasConflict = (existingBookings || []).some((b: { therapist_id: string; start_time: string; end_time: string }) => {
        if (b.therapist_id !== t.id) return false;
        const bParts = b.start_time.split(":");
        const bStartMin = parseInt(bParts[0]) * 60 + parseInt(bParts[1]);
        const beParts = b.end_time.split(":");
        const bEndMin = parseInt(beParts[0]) * 60 + parseInt(beParts[1]);
        return slotStartMin < bEndMin + BUFFER_MINUTES && slotEndMin > bStartMin - BUFFER_MINUTES;
      });

      if (!hasConflict) availCount++;
    }

    if (availCount > 0) {
      slots.push({ time: timeStr, available_therapists: availCount });
    }
  }

  return {
    service: service.name,
    date: dateStr,
    duration_minutes: duration,
    available_slots: slots.slice(0, 10), // Limit to 10 slots for context window
    total_slots: slots.length,
  };
}

// deno-lint-ignore no-explicit-any
async function toolCreateBooking(
  supabase: any,
  args: Record<string, unknown>,
  tenantId: string,
  services: Service[],
  therapists: Therapist[],
) {
  const serviceId = args.service_id as string;
  const dateStr = args.date as string;
  const timeStr = args.time as string;
  const customerName = args.customer_name as string;
  const customerPhone = args.customer_phone as string;
  const customerEmail = (args.customer_email as string) || "";
  const specificTherapistId = args.therapist_id as string | undefined;

  const service = services.find((s) => s.id === serviceId);
  if (!service) return { error: "Service not found" };

  // Validate time format
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return { error: "Invalid time format. Use HH:MM." };

  // Calculate end time
  const [startH, startM] = timeStr.split(":").map(Number);
  const endTotalMin = startH * 60 + startM + service.duration_minutes;
  const endH = Math.floor(endTotalMin / 60);
  const endM = endTotalMin % 60;
  const endTimeStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  // Determine therapist (specific or round-robin) — a specific request is
  // validated against the same day-blocks/unavailability/conflict checks as
  // round-robin, never assigned blindly, or the AI could book a customer
  // with a therapist who is unavailable that day (e.g. "book me with Hannah
  // on Wednesday" when Hannah doesn't work Wednesdays).
  let therapistId: string;

  const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
  const dow = dayOfWeek === 0 ? 7 : dayOfWeek;
  const slotStartMin = startH * 60 + startM;

  const { data: unavailList } = await supabase
    .from("therapist_unavailability")
    .select("therapist_id")
    .eq("tenant_id", tenantId)
    .eq("unavailable_date", dateStr);
  const unavailableIds = new Set((unavailList || []).map((u: { therapist_id: string }) => u.therapist_id));

  if (specificTherapistId) {
    const requested = therapists.find((t) => t.id === specificTherapistId);
    if (!requested) return { error: "Therapist not found." };
    if (unavailableIds.has(requested.id)) {
      return { error: `${requested.name} is not available on ${dateStr}. Please choose a different time or therapist.` };
    }
    if (!fitsInAnyBlock(slotStartMin, endTotalMin, getDayBlocks(requested, dow))) {
      return { error: `${requested.name} does not work at this time on ${dateStr}. Please choose a different time or therapist.` };
    }

    const { data: dayBookings } = await supabase
      .from("bookings")
      .select("therapist_id, start_time, end_time")
      .eq("tenant_id", tenantId)
      .eq("booking_date", dateStr)
      .neq("status", "cancelled");
    const hasConflict = (dayBookings || []).some((b: { therapist_id: string; start_time: string; end_time: string }) => {
      if (b.therapist_id !== requested.id) return false;
      const bParts = b.start_time.split(":");
      const bStartMin = parseInt(bParts[0]) * 60 + parseInt(bParts[1]);
      const beParts = b.end_time.split(":");
      const bEndMin = parseInt(beParts[0]) * 60 + parseInt(beParts[1]);
      return slotStartMin < bEndMin + BUFFER_MINUTES && endTotalMin > bStartMin - BUFFER_MINUTES;
    });
    if (hasConflict) {
      return { error: `${requested.name} is already booked at this time. Please choose a different time or therapist.` };
    }

    therapistId = requested.id;
  } else {
    // Round-robin: pick therapist with fewest bookings today
    const { data: todayBookings } = await supabase
      .from("bookings")
      .select("therapist_id")
      .eq("tenant_id", tenantId)
      .eq("booking_date", dateStr)
      .neq("status", "cancelled");

    const bookingCounts: Record<string, number> = {};
    (todayBookings || []).forEach((b: { therapist_id: string }) => {
      bookingCounts[b.therapist_id] = (bookingCounts[b.therapist_id] || 0) + 1;
    });

    const available = therapists
      .filter((t) => fitsInAnyBlock(slotStartMin, endTotalMin, getDayBlocks(t, dow)) && !unavailableIds.has(t.id))
      .sort((a, b) => (bookingCounts[a.id] || 0) - (bookingCounts[b.id] || 0));

    if (available.length === 0) {
      return { error: "No therapists available for this time slot. Please choose a different time." };
    }

    therapistId = available[0].id;
  }

  const therapistName = therapists.find((t) => t.id === therapistId)?.name || "Staff";

  // Create the booking
  const bookingId = crypto.randomUUID();
  const { error: insertErr } = await supabase.from("bookings").insert({
    id: bookingId,
    tenant_id: tenantId,
    service_id: serviceId,
    therapist_id: therapistId,
    customer_name: customerName.trim(),
    customer_phone: customerPhone.trim(),
    customer_email: customerEmail.trim() || null,
    booking_date: dateStr,
    start_time: timeStr + ":00",
    end_time: endTimeStr + ":00",
    status: "confirmed",
    notes: "Booked via AI chat assistant",
  });

  if (insertErr) {
    console.error("Failed to create booking:", insertErr);
    return { error: "Failed to create booking. Please try again or contact staff." };
  }

  // notify-new-booking (SMS/email/push) now fires automatically via a DB
  // trigger on bookings INSERT (notify_new_booking_trigger, migration
  // 20260723000000) — calling it here too would double-send.

  return {
    success: true,
    booking_id: bookingId,
    service: service.name,
    date: dateStr,
    time: timeStr,
    end_time: endTimeStr,
    therapist: therapistName,
    customer_name: customerName,
    message: `Booking confirmed! ${service.name} on ${dateStr} at ${timeStr} with ${therapistName}.`,
  };
}

// ─── Fresha Booking via Partner API ──────────────────────────────────

async function toolCreateBookingFresha(
  args: Record<string, unknown>,
  services: Service[],
  therapists: Therapist[],
  bookingConfig: BookingConfig,
) {
  const serviceId = args.service_id as string;
  const dateStr = args.date as string;
  const timeStr = args.time as string;
  const customerName = args.customer_name as string;
  const customerPhone = args.customer_phone as string;
  const customerEmail = (args.customer_email as string) || "";
  const specificTherapistId = args.therapist_id as string | undefined;

  const service = services.find((s) => s.id === serviceId);
  if (!service) return { error: "Service not found" };

  if (!/^\d{2}:\d{2}$/.test(timeStr)) return { error: "Invalid time format. Use HH:MM." };

  const baseUrl = bookingConfig.fresha_api_base_url || "https://partner-api.fresha.com/v1";
  const token = bookingConfig.fresha_partner_token;
  const locationId = bookingConfig.fresha_location_id;

  if (!token || !locationId) {
    return { error: "Fresha not configured. Missing partner token or location ID." };
  }

  // Find therapist name for Fresha (Fresha uses staff names/IDs)
  const therapistName = specificTherapistId
    ? therapists.find((t) => t.id === specificTherapistId)?.name
    : null;

  try {
    // Step 1: Create or find client in Fresha
    const clientResp = await fetch(`${baseUrl}/locations/${locationId}/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        first_name: customerName.split(" ")[0],
        last_name: customerName.split(" ").slice(1).join(" ") || "",
        phone: customerPhone,
        email: customerEmail || undefined,
      }),
    });

    let clientId: string | null = null;
    if (clientResp.ok) {
      const clientData = await clientResp.json();
      clientId = clientData.id || clientData.data?.id;
    } else {
      // Client might already exist — search
      const searchResp = await fetch(
        `${baseUrl}/locations/${locationId}/clients?phone=${encodeURIComponent(customerPhone)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const clients = searchData.data || searchData;
        if (Array.isArray(clients) && clients.length > 0) {
          clientId = clients[0].id;
        }
      }
    }

    // Step 2: Create appointment in Fresha
    const appointmentBody: Record<string, unknown> = {
      date: dateStr,
      start_time: timeStr,
      service_name: service.name,
      duration: service.duration_minutes,
      client_id: clientId,
      notes: `Booked via AI chat assistant`,
    };

    if (therapistName) {
      appointmentBody.staff_name = therapistName;
    }

    const appointmentResp = await fetch(`${baseUrl}/locations/${locationId}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(appointmentBody),
    });

    if (!appointmentResp.ok) {
      const errText = await appointmentResp.text();
      console.error("Fresha appointment creation error:", appointmentResp.status, errText);
      return {
        error: "Failed to create booking in Fresha. Please try again or contact staff.",
        details: errText,
      };
    }

    const appointmentData = await appointmentResp.json();
    const appointment = appointmentData.data || appointmentData;

    return {
      success: true,
      booking_mode: "fresha",
      fresha_appointment_id: appointment.id,
      service: service.name,
      date: dateStr,
      time: timeStr,
      therapist: therapistName || "Auto-assigned",
      customer_name: customerName,
      message: `Booking confirmed in Fresha! ${service.name} on ${dateStr} at ${timeStr}${therapistName ? ` with ${therapistName}` : ""}.`,
    };
  } catch (err) {
    console.error("Fresha booking error:", err);
    return { error: "Failed to connect to Fresha. Please try again or contact staff." };
  }
}

// ─── Crypto Helpers ──────────────────────────────────────────────────

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
