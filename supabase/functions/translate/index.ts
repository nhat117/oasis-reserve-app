import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keys, lang } = await req.json();
    if (!keys || !lang || !Array.isArray(keys)) {
      return new Response(JSON.stringify({ error: "keys (array) and lang (string) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first
    const { data: cached } = await supabase
      .from("translations")
      .select("key, value")
      .eq("lang", lang)
      .in("key", keys);

    const cachedMap: Record<string, string> = {};
    (cached || []).forEach((r: any) => { cachedMap[r.key] = r.value; });

    const missing = keys.filter((k: string) => !cachedMap[k]);

    if (missing.length === 0) {
      return new Response(JSON.stringify({ translations: cachedMap }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get OpenAI settings from app_settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["openai_api_key", "openai_base_url", "openai_model"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((r: any) => { settingsMap[r.key] = r.value; });

    const apiKey = settingsMap["openai_api_key"];
    const baseUrl = settingsMap["openai_base_url"] || "https://api.openai.com/v1";
    const model = settingsMap["openai_model"] || "gpt-4o-mini";

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured. Set it in Admin Settings." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langName = lang === "en" ? "English" : lang === "vi" ? "Vietnamese" : lang;
    const prompt = `Translate the following Vietnamese UI text strings to ${langName}. Return a JSON object mapping each original Vietnamese string to its ${langName} translation. Keep it natural and concise for a spa booking app UI. Strings to translate:\n${JSON.stringify(missing)}`;

    const aiResp = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a translator. Return ONLY a valid JSON object mapping each input string to its translation. No markdown, no explanation." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("OpenAI error:", aiResp.status, errText);
      throw new Error(`OpenAI error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    let translatedText = aiData.choices?.[0]?.message?.content || "{}";
    // Clean markdown wrapping if present
    translatedText = translatedText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let translated: Record<string, string> = {};
    try { translated = JSON.parse(translatedText); } catch { translated = {}; }

    // Cache translations
    const rows = Object.entries(translated).map(([key, value]) => ({
      lang, key, value: String(value),
    }));
    if (rows.length > 0) {
      await supabase.from("translations").upsert(rows, { onConflict: "lang,key" });
    }

    // Merge cached + new
    const result = { ...cachedMap, ...translated };
    return new Response(JSON.stringify({ translations: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
