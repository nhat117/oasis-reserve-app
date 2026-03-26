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

    // Use AI to translate missing keys
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const langName = lang === "en" ? "English" : lang === "vi" ? "Vietnamese" : lang;
    const prompt = `Translate the following UI text keys to ${langName}. Return a JSON object mapping each key to its translation. Keep it natural and concise for a spa booking app UI. Keys:\n${JSON.stringify(missing)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
      throw new Error(`AI error: ${aiResp.status}`);
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
