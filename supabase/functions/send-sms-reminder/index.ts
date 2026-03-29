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

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

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

    // Get settings
    const { data: phoneSetting } = await supabase
      .from("app_settings").select("value").eq("key", "twilio_from_number").single();
    const { data: whatsappSetting } = await supabase
      .from("app_settings").select("value").eq("key", "whatsapp_enabled").single();

    const fromNumber = phoneSetting?.value;
    const whatsappEnabled = whatsappSetting?.value === "true";

    if (!fromNumber) {
      return new Response(
        JSON.stringify({ error: "Twilio phone number not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get reminder intervals
    const { data: interval1Setting } = await supabase
      .from("app_settings").select("value").eq("key", "reminder_1st_hours").single();
    const { data: interval2Setting } = await supabase
      .from("app_settings").select("value").eq("key", "reminder_2nd_hours").single();

    const reminder1Hours = parseInt(interval1Setting?.value || "24");
    const reminder2Hours = parseInt(interval2Setting?.value || "1");

    const now = new Date();
    const results: any[] = [];

    for (const hoursAhead of [reminder1Hours, reminder2Hours]) {
      if (hoursAhead <= 0) continue;

      const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
      const targetDate = targetTime.toISOString().split("T")[0];
      const targetHour = targetTime.getUTCHours().toString().padStart(2, "0");
      const targetMinute = targetTime.getUTCMinutes().toString().padStart(2, "0");
      
      const windowStart = `${targetHour}:${targetMinute}:00`;
      const windowEndTime = new Date(targetTime.getTime() + 30 * 60 * 1000);
      const windowEndHour = windowEndTime.getUTCHours().toString().padStart(2, "0");
      const windowEndMinute = windowEndTime.getUTCMinutes().toString().padStart(2, "0");
      const windowEnd = `${windowEndHour}:${windowEndMinute}:00`;

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
          phone = "+84" + phone.slice(1);
        } else if (!phone.startsWith("+")) {
          phone = "+84" + phone;
        }

        const serviceName = (booking as any).services?.name || "";
        const therapistName = (booking as any).therapists?.name || "";
        const message = `Royal Head Spa nhắc lịch: Bạn có lịch hẹn "${serviceName}" lúc ${booking.start_time.slice(0, 5)} ngày ${booking.booking_date} với ${therapistName}. Hẹn gặp bạn!`;

        try {
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
          const result: any = { booking_id: booking.id, phone, sms: smsResponse.ok ? smsData.sid : smsData };

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
