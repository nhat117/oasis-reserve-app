import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth: allow service_role key (for cron) or admin/employee user
  const authHeader = req.headers.get("authorization");
  const isServiceRole = authHeader === `Bearer ${supabaseKey}`;

  if (!isServiceRole) {
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await callerClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    const { data: isEmployee } = await callerClient.rpc("has_role", { _user_id: caller.id, _role: "employee" });
    if (!isAdmin && !isEmployee) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check if SMS reminders are enabled
    const { data: enabledSetting } = await supabase
      .from("app_settings").select("value").eq("key", "reminder_sms_enabled").single();

    if (enabledSetting?.value !== "true") {
      return new Response(
        JSON.stringify({ skipped: true, reason: "SMS reminders disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Twilio credentials from app_settings (configured in admin UI)
    const { data: twilioSettings } = await supabase
      .from("app_settings").select("key, value")
      .in("key", ["twilio_account_sid", "twilio_auth_token", "twilio_phone_number", "twilio_from_number", "whatsapp_enabled"]);

    const settings: Record<string, string> = {};
    twilioSettings?.forEach((r: any) => { settings[r.key] = r.value; });

    const accountSid = settings.twilio_account_sid;
    const authToken = settings.twilio_auth_token;
    const fromNumber = settings.twilio_phone_number || settings.twilio_from_number;
    const whatsappEnabled = settings.whatsapp_enabled === "true";

    if (!accountSid || !authToken) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured. Go to Settings > Twilio Configuration." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!fromNumber) {
      return new Response(
        JSON.stringify({ error: "Twilio phone number not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get reminder intervals and shop timezone
    const { data: reminderSettings } = await supabase
      .from("app_settings").select("key, value")
      .in("key", ["reminder_1st_hours", "reminder_2nd_hours", "shop_timezone"]);

    const reminderMap: Record<string, string> = {};
    reminderSettings?.forEach((r: any) => { reminderMap[r.key] = r.value; });

    const reminder1Hours = parseInt(reminderMap.reminder_1st_hours || "24");
    const reminder2Hours = parseInt(reminderMap.reminder_2nd_hours || "1");
    const shopTimezone = reminderMap.shop_timezone || "Australia/Melbourne";

    // Helper: format a Date in the shop's local timezone
    const toLocalDate = (d: Date): string =>
      d.toLocaleDateString("en-CA", { timeZone: shopTimezone }); // YYYY-MM-DD

    const formatLocalTime = (d: Date): string => {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: shopTimezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
      const h = parts.find(p => p.type === "hour")?.value || "00";
      const m = parts.find(p => p.type === "minute")?.value || "00";
      return `${h}:${m}`;
    };

    // Twilio API base URL
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioAuth = btoa(`${accountSid}:${authToken}`);

    const now = new Date();
    const results: any[] = [];

    for (const hoursAhead of [reminder1Hours, reminder2Hours]) {
      if (hoursAhead <= 0) continue;

      const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
      const targetDate = toLocalDate(targetTime);

      // Find bookings within a 30-min window around the target time (in shop local time)
      const windowStart = formatLocalTime(targetTime) + ":00";
      const windowEndTime = new Date(targetTime.getTime() + 30 * 60 * 1000);
      const windowEnd = formatLocalTime(windowEndTime) + ":00";

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("*, services(name), therapists(name)")
        .eq("booking_date", targetDate)
        .eq("status", "confirmed")
        .gte("start_time", windowStart)
        .lt("start_time", windowEnd);

      if (error) {
        console.error("Failed to fetch bookings", error);
        continue;
      }

      for (const booking of bookings || []) {
        if (!booking.customer_phone) continue;

        let phone = booking.customer_phone.replace(/\s+/g, "");
        if (phone.startsWith("0")) {
          phone = "+61" + phone.slice(1);
        } else if (!phone.startsWith("+")) {
          phone = "+61" + phone;
        }

        const serviceName = (booking as any).services?.name || "";
        const therapistName = (booking as any).therapists?.name || "";
        const message = `Oasis Reserve reminder: You have a "${serviceName}" appointment at ${booking.start_time.slice(0, 5)} on ${booking.booking_date} with ${therapistName}. See you soon!`;

        try {
          // Send SMS via Twilio API directly
          const smsResponse = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              Authorization: `Basic ${twilioAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: phone, From: fromNumber, Body: message }),
          });

          const smsData = await smsResponse.json();
          const result: any = { booking_id: booking.id, phone, sms: smsResponse.ok ? smsData.sid : smsData };

          // WhatsApp (if enabled)
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
              result.whatsapp = waResponse.ok ? waData.sid : waData;
            } catch (waErr) {
              result.whatsapp_error = String(waErr);
            }
          }

          results.push(result);
        } catch (err) {
          results.push({ booking_id: booking.id, phone, error: String(err) });
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("SMS reminder error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
