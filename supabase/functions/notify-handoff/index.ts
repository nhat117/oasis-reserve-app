import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Handoff Notification Service
 *
 * Called when AI transfers a conversation to a human.
 * Sends alerts via:
 * - Email (Resend)
 * - SMS (Twilio)
 * - In-app (stores handoff_events row for dashboard alerts)
 *
 * All settings are tenant-scoped.
 */

interface HandoffPayload {
  conversation_id: string;
  tenant_id: string;
  reason: string;
  customer_name?: string;
  customer_message?: string;
  source?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: HandoffPayload = await req.json();
    const { conversation_id, tenant_id, reason, customer_name, customer_message, source } = body;

    if (!tenant_id || !reason) {
      return new Response(JSON.stringify({ error: "tenant_id and reason required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifiedVia: string[] = ["in_app"]; // Always log in-app

    // Load AI config for notification preferences
    const { data: config } = await supabase
      .from("ai_config")
      .select("handoff_notify_email, handoff_notify_sms")
      .eq("tenant_id", tenant_id)
      .single();

    // Load tenant info + Twilio/Resend settings
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenant_id)
      .single();

    const shopName = tenant?.name || "Your Salon";

    // ─── Email Notification via Resend ─────────────────────────────
    if (config?.handoff_notify_email) {
      try {
        const { data: settingsRows } = await supabase
          .from("app_settings")
          .select("key, value")
          .eq("tenant_id", tenant_id)
          .in("key", ["resend_api_key", "resend_from_email", "spa_name"]);

        const s: Record<string, string> = {};
        settingsRows?.forEach((r: { key: string; value: string }) => {
          s[r.key] = r.value;
        });

        if (s["resend_api_key"]) {
          const senderEmail = s["resend_from_email"] || "onboarding@resend.dev";
          const senderName = s["spa_name"] || shopName;

          const html = buildHandoffEmailHtml({
            shopName: senderName,
            reason,
            customerName: customer_name,
            customerMessage: customer_message,
            conversationId: conversation_id,
          });

          const emailResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${s["resend_api_key"]}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${senderName} <${senderEmail}>`,
              to: [config.handoff_notify_email],
              subject: `[${senderName}] Customer needs human assistance`,
              html,
            }),
          });

          if (emailResp.ok) {
            notifiedVia.push("email");
          } else {
            console.error("Resend error:", await emailResp.text());
          }
        }
      } catch (emailErr) {
        console.error("Email notification failed:", emailErr);
      }
    }

    // ─── SMS Notification via Twilio ───────────────────────────────
    if (config?.handoff_notify_sms) {
      try {
        const { data: settingsRows } = await supabase
          .from("app_settings")
          .select("key, value")
          .eq("tenant_id", tenant_id)
          .in("key", [
            "twilio_account_sid",
            "twilio_auth_token",
            "twilio_phone_number",
            "twilio_from_number",
            "notify_phone",
          ]);

        const s: Record<string, string> = {};
        settingsRows?.forEach((r: { key: string; value: string }) => {
          s[r.key] = r.value;
        });

        const accountSid = s["twilio_account_sid"];
        const authToken = s["twilio_auth_token"];
        const fromNumber = s["twilio_phone_number"] || s["twilio_from_number"];
        let notifyPhone = s["notify_phone"];

        if (accountSid && authToken && fromNumber && notifyPhone) {
          notifyPhone = notifyPhone.replace(/\s+/g, "");
          if (notifyPhone.startsWith("0")) {
            notifyPhone = "+61" + notifyPhone.slice(1);
          } else if (!notifyPhone.startsWith("+")) {
            notifyPhone = "+" + notifyPhone;
          }

          const smsMessage = `[${shopName}] AI handoff: ${customer_name || "Customer"} needs help. Reason: ${reason}`;

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
          const smsResp = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: notifyPhone,
              From: fromNumber,
              Body: smsMessage,
            }),
          });

          if (smsResp.ok) {
            notifiedVia.push("sms");
          } else {
            console.error("Twilio SMS error:", await smsResp.text());
          }
        }
      } catch (smsErr) {
        console.error("SMS notification failed:", smsErr);
      }
    }

    // ─── Log handoff event ─────────────────────────────────────────
    await supabase.from("handoff_events").insert({
      tenant_id,
      conversation_id: conversation_id || null,
      reason,
      source: source || "ai_decision",
      notified_via: notifiedVia,
      metadata: {
        customer_name: customer_name || null,
        customer_message: customer_message || null,
      },
    });

    return new Response(
      JSON.stringify({ ok: true, notified_via: notifiedVia }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Handoff notification error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─── Email Template ─────────────────────────────────────────────────

function buildHandoffEmailHtml(params: {
  shopName: string;
  reason: string;
  customerName?: string;
  customerMessage?: string;
  conversationId?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
    <h2 style="margin: 0 0 8px; color: #991B1B; font-size: 16px;">Customer Needs Human Assistance</h2>
    <p style="margin: 0; color: #7F1D1D; font-size: 14px;">The AI assistant has transferred a conversation to your team.</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr>
      <td style="padding: 8px 0; color: #6B7280; width: 120px;">Shop</td>
      <td style="padding: 8px 0; font-weight: 600;">${params.shopName}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6B7280;">Customer</td>
      <td style="padding: 8px 0; font-weight: 600;">${params.customerName || "Unknown"}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #6B7280;">Reason</td>
      <td style="padding: 8px 0;">${params.reason}</td>
    </tr>
    ${params.customerMessage ? `
    <tr>
      <td style="padding: 8px 0; color: #6B7280; vertical-align: top;">Last Message</td>
      <td style="padding: 8px 0; background: #F9FAFB; border-radius: 4px; padding: 8px;">${params.customerMessage}</td>
    </tr>` : ""}
  </table>

  <p style="margin-top: 16px; font-size: 13px; color: #9CA3AF;">
    Please open your dashboard to respond to the customer.
    ${params.conversationId ? `Conversation ID: ${params.conversationId}` : ""}
  </p>
</body>
</html>`;
}
