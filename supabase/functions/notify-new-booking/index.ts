import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();

    // Support both direct call and database webhook payload
    const booking = body.record || body;

    if (!booking?.id || !booking?.customer_name) {
      return new Response(
        JSON.stringify({ error: "Invalid booking data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if new booking SMS notifications are enabled
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "notify_sms_enabled",
        "notify_phone",
        "twilio_from_number",
        "whatsapp_enabled",
        "spa_name",
      ]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s: any) => { settingsMap[s.key] = s.value; });

    if (settingsMap["notify_sms_enabled"] !== "true") {
      return new Response(
        JSON.stringify({ skipped: true, reason: "New booking SMS notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notifyPhone = settingsMap["notify_phone"];
    const fromNumber = settingsMap["twilio_from_number"];
    const whatsappEnabled = settingsMap["whatsapp_enabled"] === "true";
    const spaName = settingsMap["spa_name"] || "Oasis Reserve";

    if (!notifyPhone || !fromNumber) {
      return new Response(
        JSON.stringify({ error: "Notification phone or Twilio number not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    // Fetch service and therapist names
    let serviceName = "";
    let therapistName = "";

    if (booking.service_id) {
      const { data: svc } = await supabase
        .from("services").select("name").eq("id", booking.service_id).single();
      serviceName = svc?.name || "";
    }
    if (booking.therapist_id) {
      const { data: thr } = await supabase
        .from("therapists").select("name").eq("id", booking.therapist_id).single();
      therapistName = thr?.name || "";
    }

    const message = `[${spaName}] Lich hen moi: ${booking.customer_name} - ${serviceName || "N/A"} luc ${(booking.start_time || "").slice(0, 5)} ngay ${booking.booking_date}${therapistName ? ` voi ${therapistName}` : ""}. SĐT: ${booking.customer_phone || "N/A"}`;

    let phone = notifyPhone.replace(/\s+/g, "");
    if (phone.startsWith("0")) {
      phone = "+61" + phone.slice(1);
    } else if (!phone.startsWith("+")) {
      phone = "+" + phone;
    }

    const result: any = {};

    // Send SMS
    const smsResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: fromNumber, Body: message }),
    });

    const smsData = await smsResponse.json();
    result.sms = smsResponse.ok ? { sid: smsData.sid } : { error: smsData };

    // Optionally send WhatsApp
    if (whatsappEnabled) {
      try {
        const waResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: `whatsapp:${phone}`,
            From: `whatsapp:${fromNumber}`,
            Body: message,
          }),
        });
        const waData = await waResponse.json();
        result.whatsapp = waResponse.ok ? { sid: waData.sid } : { error: waData };
      } catch (waErr) {
        result.whatsapp_error = String(waErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Notify new booking error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
