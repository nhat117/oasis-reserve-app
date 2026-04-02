import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse } from "../_shared/auth.ts";

/**
 * Voice Agent — ElevenLabs TTS + OpenAI LLM + Twilio Telephony
 *
 * Handles inbound Twilio voice calls:
 * 1. Twilio sends webhook → this function generates TwiML
 * 2. Customer speech → Twilio STT (built-in <Gather>) → text
 * 3. Text → OpenAI LLM (same API key from ai_config) → response text
 * 4. Response text → ElevenLabs TTS → audio URL
 * 5. TwiML <Play> streams audio back to caller
 *
 * Voice selection: configured per tenant in ai_config.elevenlabs_voice_id
 *
 * Endpoints:
 * - POST /voice-agent?action=greeting&tenant_id=xxx  → Initial greeting TwiML
 * - POST /voice-agent?action=respond&tenant_id=xxx   → Process speech + respond
 * - POST /voice-agent?action=tts&tenant_id=xxx       → Generate TTS audio (returns audio/mpeg)
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "greeting";
  const tenantId = url.searchParams.get("tenant_id");

  // Validate tenant_id is a UUID
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>System error. Goodbye.</Say><Hangup/></Response>',
      { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
    );
  }

  // Auth: accept Twilio webhook signatures OR service-role key OR authenticated user
  const auth = await authenticateRequest(req, corsHeaders, {
    requireTenant: false,
    tenantId: tenantId,
    allowTwilioWebhook: true,
  });
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Load AI + voice config
    const { data: config } = await supabase
      .from("ai_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (!config || !config.voice_agent_enabled) {
      return new Response(twiml("<Say>Voice assistant is not available. Please call back later.</Say><Hangup/>"), {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
    const apiKey = encryptionKey
      ? await decryptToken(config.api_key_encrypted, encryptionKey)
      : config.api_key_encrypted;
    const elevenLabsKey = config.elevenlabs_api_key_encrypted
      ? (encryptionKey ? await decryptToken(config.elevenlabs_api_key_encrypted, encryptionKey) : config.elevenlabs_api_key_encrypted)
      : null;

    const baseUrl = config.api_base_url || "https://api.openai.com/v1";
    const model = config.model_name || "gpt-4o-mini";
    const voiceId = config.elevenlabs_voice_id || "EXAVITQu4vr4xnSDxMaL"; // Sarah
    const elevenLabsModel = config.elevenlabs_model_id || "eleven_multilingual_v2";
    const greeting = config.voice_greeting || "Hello! Thank you for calling. How can I help you today?";
    const voiceLang = config.voice_language || "en";
    const functionUrl = `${supabaseUrl}/functions/v1/voice-agent`;

    switch (action) {
      // ─── Greeting: Initial TwiML with ElevenLabs TTS ─────────
      case "greeting": {
        if (elevenLabsKey) {
          // Use ElevenLabs for greeting TTS
          const ttsUrl = `${functionUrl}?action=tts&tenant_id=${tenantId}&text=${encodeURIComponent(greeting)}`;
          return new Response(
            twiml(`
              <Play>${ttsUrl}</Play>
              <Gather input="speech" action="${functionUrl}?action=respond&amp;tenant_id=${tenantId}" speechTimeout="3" language="${voiceLang}">
                <Say></Say>
              </Gather>
              <Say>I didn't hear anything. Goodbye!</Say>
              <Hangup/>
            `),
            { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
          );
        }
        // Fallback: Twilio built-in TTS
        return new Response(
          twiml(`
            <Gather input="speech" action="${functionUrl}?action=respond&amp;tenant_id=${tenantId}" speechTimeout="3" language="${voiceLang}">
              <Say>${escapeXml(greeting)}</Say>
            </Gather>
            <Say>I didn't hear anything. Goodbye!</Say>
            <Hangup/>
          `),
          { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
        );
      }

      // ─── Respond: STT result → LLM → TTS → TwiML ────────────
      case "respond": {
        // Parse Twilio's form data (SpeechResult from <Gather>)
        const formData = await req.formData().catch(() => null);
        const speechResult = formData?.get("SpeechResult")?.toString() || "";
        const callSid = formData?.get("CallSid")?.toString() || "";

        if (!speechResult.trim()) {
          return new Response(
            twiml(`
              <Gather input="speech" action="${functionUrl}?action=respond&amp;tenant_id=${tenantId}" speechTimeout="3" language="${voiceLang}">
                <Say>I didn't catch that. Could you please repeat?</Say>
              </Gather>
              <Say>Goodbye!</Say>
              <Hangup/>
            `),
            { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
          );
        }

        // Load shop data for context
        const [servicesResult, tenantResult] = await Promise.all([
          supabase.from("services").select("name, price, duration_minutes").eq("tenant_id", tenantId).eq("is_active", true),
          supabase.from("tenants").select("name").eq("id", tenantId).single(),
        ]);

        const shopName = tenantResult.data?.name || "our salon";
        const services = servicesResult.data || [];
        const servicesList = services.map((s) => `${s.name}: $${s.price} (${s.duration_minutes}min)`).join(", ");

        // Load conversation history from call (stored in metadata)
        const historyKey = `voice_call_${callSid}`;
        const { data: historyRow } = await supabase
          .from("handoff_events")
          .select("metadata")
          .eq("tenant_id", tenantId)
          .eq("reason", historyKey)
          .single();

        const prevMessages: Array<{ role: string; content: string }> = historyRow?.metadata?.messages || [];

        // Build LLM messages
        const systemPrompt = `You are ${shopName}'s friendly voice assistant answering a phone call.
Keep responses SHORT (1-2 sentences max) — this will be spoken aloud.
Services: ${servicesList || "Ask staff for details."}
If you cannot help, say you'll transfer them to a team member.
Never use markdown, lists, or formatting — speak naturally.
Language: ${voiceLang === "vi" ? "Vietnamese" : "English"}`;

        const llmMessages = [
          { role: "system", content: systemPrompt },
          ...prevMessages,
          { role: "user", content: speechResult },
        ];

        // Call LLM (same OpenAI-compatible API from ai_config)
        const llmResp = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: llmMessages,
            max_tokens: 150, // Short for voice
            temperature: 0.7,
          }),
        });

        let responseText = "I'm having trouble right now. Let me transfer you to a team member.";
        let shouldTransfer = false;

        if (llmResp.ok) {
          const llmData = await llmResp.json();
          responseText = llmData.choices?.[0]?.message?.content || responseText;

          // Detect if LLM wants to transfer
          const transferPhrases = ["transfer you", "connect you", "team member will", "staff will"];
          shouldTransfer = transferPhrases.some((p) => responseText.toLowerCase().includes(p));
        } else {
          shouldTransfer = true;
        }

        // Save conversation history
        const updatedMessages = [...prevMessages, { role: "user", content: speechResult }, { role: "assistant", content: responseText }];
        // Set TTL: voice call PII expires after 7 days (SOC2 PI1.1)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        if (historyRow) {
          await supabase
            .from("handoff_events")
            .update({ metadata: { messages: updatedMessages }, expires_at: expiresAt })
            .eq("tenant_id", tenantId)
            .eq("reason", historyKey);
        } else {
          await supabase.from("handoff_events").insert({
            tenant_id: tenantId,
            reason: historyKey,
            source: "voice_call",
            metadata: { messages: updatedMessages },
            expires_at: expiresAt,
          });
        }

        // Build TwiML response
        if (shouldTransfer) {
          // Notify staff and hang up politely
          fetch(`${supabaseUrl}/functions/v1/notify-handoff`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              tenant_id: tenantId,
              reason: `Voice call handoff: ${responseText}`,
              customer_message: speechResult,
              source: "voice_agent",
            }),
          }).catch(() => {});

          if (elevenLabsKey) {
            const ttsUrl = `${functionUrl}?action=tts&tenant_id=${tenantId}&text=${encodeURIComponent(responseText)}`;
            return new Response(
              twiml(`<Play>${ttsUrl}</Play><Say>Transferring you now. Please hold.</Say><Hangup/>`),
              { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
            );
          }
          return new Response(
            twiml(`<Say>${escapeXml(responseText)}</Say><Say>Transferring you now. Please hold.</Say><Hangup/>`),
            { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
          );
        }

        // Continue conversation
        if (elevenLabsKey) {
          const ttsUrl = `${functionUrl}?action=tts&tenant_id=${tenantId}&text=${encodeURIComponent(responseText)}`;
          return new Response(
            twiml(`
              <Play>${ttsUrl}</Play>
              <Gather input="speech" action="${functionUrl}?action=respond&amp;tenant_id=${tenantId}" speechTimeout="3" language="${voiceLang}">
                <Say></Say>
              </Gather>
              <Say>Goodbye!</Say>
              <Hangup/>
            `),
            { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
          );
        }

        return new Response(
          twiml(`
            <Gather input="speech" action="${functionUrl}?action=respond&amp;tenant_id=${tenantId}" speechTimeout="3" language="${voiceLang}">
              <Say>${escapeXml(responseText)}</Say>
            </Gather>
            <Say>Goodbye!</Say>
            <Hangup/>
          `),
          { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
        );
      }

      // ─── TTS: ElevenLabs Text-to-Speech ──────────────────────
      case "tts": {
        let text = url.searchParams.get("text") || "Hello";
        // Cap text length to prevent abuse of ElevenLabs API quota
        if (text.length > 500) {
          text = text.slice(0, 500);
        }

        if (!elevenLabsKey) {
          return new Response("ElevenLabs not configured", { status: 400 });
        }

        const ttsResp = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": elevenLabsKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text,
              model_id: elevenLabsModel,
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.0,
                use_speaker_boost: true,
              },
            }),
          },
        );

        if (!ttsResp.ok) {
          console.error("ElevenLabs TTS error:", ttsResp.status, await ttsResp.text());
          return new Response("TTS error", { status: 500 });
        }

        // Stream audio directly back
        return new Response(ttsResp.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      default:
        return new Response(twiml("<Say>Unknown action.</Say><Hangup/>"), {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
    }
  } catch (err) {
    console.error("Voice agent error:", err);
    return new Response(
      twiml("<Say>An error occurred. Please try again later.</Say><Hangup/>"),
      { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
    );
  }
});

// ─── Helpers ────────────────────────────────────────────────────────

function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function decryptToken(encryptedHex: string, keyHex: string): Promise<string> {
  // If value doesn't look like hex ciphertext, treat as plaintext (backwards compat)
  if (!/^[0-9a-f]{48,}$/i.test(encryptedHex)) {
    return encryptedHex;
  }
  const encBytes = hexToBytes(encryptedHex);
  const iv = encBytes.slice(0, 12);
  const ciphertext = encBytes.slice(12);
  const keyBytes = hexToBytes(keyHex);
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
  // NOTE: if decryption fails, let the error propagate — never send ciphertext to third-party APIs
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
