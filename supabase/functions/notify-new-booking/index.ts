import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { notifyBookingSchema, parseBody } from "../_shared/validation.ts";

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
    const raw = body.record || body;
    const parsed = parseBody(notifyBookingSchema, raw, corsHeaders);
    if (parsed.response) return parsed.response;
    const booking = parsed.data;
    const tenantId = booking.tenant_id;

    // Get all needed settings including Twilio credentials (scoped to tenant)
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", [
        "notify_sms_enabled",
        "notify_phone",
        "twilio_account_sid",
        "twilio_auth_token",
        "twilio_phone_number",
        "twilio_from_number",
        "whatsapp_enabled",
        "spa_name",
      ]);

    const s: Record<string, string> = {};
    settingsRows?.forEach((r: any) => { s[r.key] = r.value; });

    if (s["notify_sms_enabled"] !== "true") {
      return new Response(
        JSON.stringify({ skipped: true, reason: "New booking SMS notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notifyPhone = s["notify_phone"];
    const accountSid = s["twilio_account_sid"];
    const authToken = s["twilio_auth_token"];
    const fromNumber = s["twilio_phone_number"] || s["twilio_from_number"];
    const whatsappEnabled = s["whatsapp_enabled"] === "true";
    const spaName = s["spa_name"] || "Oasis Reserve";

    if (!notifyPhone || !fromNumber) {
      return new Response(
        JSON.stringify({ error: "Notification phone or Twilio number not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!accountSid || !authToken) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured. Go to Settings > Twilio Configuration." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch service and therapist names (scoped to tenant)
    let serviceName = "";
    let therapistName = "";

    if (booking.service_id) {
      const { data: svc } = await supabase
        .from("services").select("name").eq("id", booking.service_id).eq("tenant_id", tenantId).single();
      serviceName = svc?.name || "";
    }
    if (booking.therapist_id) {
      const { data: thr } = await supabase
        .from("therapists").select("name").eq("id", booking.therapist_id).eq("tenant_id", tenantId).single();
      therapistName = thr?.name || "";
    }

    const message = `[${spaName}] New booking: ${booking.customer_name} - ${serviceName || "N/A"} at ${(booking.start_time || "").slice(0, 5)} on ${booking.booking_date}${therapistName ? ` with ${therapistName}` : ""}. Phone: ${booking.customer_phone || "N/A"}`;

    let phone = notifyPhone.replace(/\s+/g, "");
    if (phone.startsWith("0")) {
      phone = "+61" + phone.slice(1);
    } else if (!phone.startsWith("+")) {
      phone = "+" + phone;
    }

    // Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioAuth = btoa(`${accountSid}:${authToken}`);

    const result: any = {};

    // Send SMS
    const smsResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${twilioAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: fromNumber, Body: message }),
    });

    const smsData = await smsResponse.json();
    result.sms = smsResponse.ok ? { sid: smsData.sid } : { error: smsData };

    // Optionally send WhatsApp
    if (whatsappEnabled) {
      try {
        const waResponse = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${twilioAuth}`,
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
