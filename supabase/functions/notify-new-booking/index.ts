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

    // Get all needed settings including Twilio and Resend credentials (scoped to tenant)
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", [
        "notify_sms_enabled",
        "notify_phone",
        "notify_email_enabled",
        "notify_email",
        "notify_push_enabled",
        "twilio_account_sid",
        "twilio_auth_token",
        "twilio_phone_number",
        "twilio_from_number",
        "whatsapp_enabled",
        "resend_api_key",
        "resend_from_email",
        "spa_name",
      ]);

    const s: Record<string, string> = {};
    settingsRows?.forEach((r: any) => { s[r.key] = r.value; });

    const spaName = s["spa_name"] || "Oasis Reserve";
    const smsEnabled = s["notify_sms_enabled"] === "true";
    const emailEnabled = s["notify_email_enabled"] === "true";
    // Push defaults to on — unlike SMS/email it has no credentials to configure,
    // it just needs at least one registered device (push_subscriptions row).
    const pushEnabled = s["notify_push_enabled"] !== "false";

    if (!smsEnabled && !emailEnabled && !pushEnabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "New booking notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const startTime = (booking.start_time || "").slice(0, 5);
    const message = `[${spaName}] New booking: ${booking.customer_name} - ${serviceName || "N/A"} at ${startTime} on ${booking.booking_date}${therapistName ? ` with ${therapistName}` : ""}. Phone: ${booking.customer_phone || "N/A"}`;

    const result: any = {};

    // Shared by the Email toggle and the Push toggle (push notifications are
    // also emailed to the same notify_email address, per owner request —
    // sent once even if both toggles are on, never twice).
    const sendOwnerEmail = async () => {
      const notifyEmail = s["notify_email"];
      const resendApiKey = s["resend_api_key"];

      if (!notifyEmail) return { error: "Notification email not configured" };
      if (!resendApiKey) return { error: "Resend API key not configured. Go to Settings > Email." };

      const senderEmail = s["resend_from_email"] || "onboarding@resend.dev";
      const html = `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2 style="margin: 0 0 12px;">New booking received</h2>
          <p style="margin: 0 0 4px;"><strong>Customer:</strong> ${booking.customer_name}</p>
          ${booking.customer_phone ? `<p style="margin: 0 0 4px;"><strong>Phone:</strong> ${booking.customer_phone}</p>` : ""}
          <p style="margin: 0 0 4px;"><strong>Service:</strong> ${serviceName || "N/A"}</p>
          ${therapistName ? `<p style="margin: 0 0 4px;"><strong>Staff:</strong> ${therapistName}</p>` : ""}
          <p style="margin: 0 0 4px;"><strong>Date:</strong> ${booking.booking_date}</p>
          <p style="margin: 0 0 4px;"><strong>Time:</strong> ${startTime}</p>
        </div>
      `;

      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${spaName} <${senderEmail}>`,
            to: [notifyEmail],
            subject: `New booking: ${booking.customer_name} on ${booking.booking_date}`,
            html,
          }),
        });
        const resendData = await resendResponse.json();
        return resendResponse.ok ? { id: resendData.id } : { error: resendData };
      } catch (emailErr) {
        return { error: String(emailErr) };
      }
    };

    // --- SMS / WhatsApp via Twilio ---
    if (smsEnabled) {
      const notifyPhone = s["notify_phone"];
      const accountSid = s["twilio_account_sid"];
      const authToken = s["twilio_auth_token"];
      const fromNumber = s["twilio_phone_number"] || s["twilio_from_number"];
      const whatsappEnabled = s["whatsapp_enabled"] === "true";

      if (!notifyPhone || !fromNumber) {
        result.sms = { error: "Notification phone or Twilio number not configured" };
      } else if (!accountSid || !authToken) {
        result.sms = { error: "Twilio credentials not configured. Go to Settings > Twilio Configuration." };
      } else {
        let phone = notifyPhone.replace(/\s+/g, "");
        if (phone.startsWith("0")) {
          phone = "+61" + phone.slice(1);
        } else if (!phone.startsWith("+")) {
          phone = "+" + phone;
        }

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const twilioAuth = btoa(`${accountSid}:${authToken}`);

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
      }
    }

    // --- Email via Resend ---
    if (emailEnabled) {
      result.email = await sendOwnerEmail();
    }

    // --- Push notification (device push, e.g. to staff phones) ---
    if (pushEnabled) {
      try {
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            title: `New booking — ${spaName}`,
            body: `${booking.customer_name} — ${serviceName || "N/A"} at ${startTime}${therapistName ? ` with ${therapistName}` : ""}`,
            url: "/admin",
          }),
        });
        const pushData = await pushResponse.json();
        result.push = pushResponse.ok ? pushData : { error: pushData };
        if (!pushResponse.ok) console.error("[notify-new-booking] Push delivery failed:", pushData);
      } catch (pushErr) {
        result.push_error = String(pushErr);
        console.error("[notify-new-booking] Push delivery threw:", pushErr);
      }

      // Push notifications are also emailed to the owner's notify_email —
      // but only if the Email toggle above didn't already send one, so a
      // tenant with both toggles on gets exactly one email, not two.
      if (!emailEnabled) {
        result.push_email = await sendOwnerEmail();
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
