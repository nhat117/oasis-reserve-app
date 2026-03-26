import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get settings
    const { data: phoneSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "twilio_from_number")
      .single();

    const { data: whatsappSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "whatsapp_enabled")
      .single();

    const fromNumber = phoneSetting?.value;
    const whatsappEnabled = whatsappSetting?.value === "true";

    if (!fromNumber) {
      return new Response(
        JSON.stringify({ error: "Twilio phone number not configured. Set 'twilio_from_number' in app settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find bookings happening in the next hour
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const today = now.toISOString().split("T")[0];

    const currentTime = now.toTimeString().slice(0, 8);
    const futureTime = oneHourLater.toTimeString().slice(0, 8);

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, services(name), therapists(name)")
      .eq("booking_date", today)
      .eq("status", "confirmed")
      .gte("start_time", currentTime)
      .lte("start_time", futureTime);

    if (error) throw error;

    const results: any[] = [];

    for (const booking of bookings || []) {
      if (!booking.customer_phone) continue;

      // Format phone number (add +84 for Vietnamese numbers)
      let phone = booking.customer_phone.replace(/\s+/g, "");
      if (phone.startsWith("0")) {
        phone = "+84" + phone.slice(1);
      } else if (!phone.startsWith("+")) {
        phone = "+84" + phone;
      }

      const serviceName = (booking as any).services?.name || "";
      const therapistName = (booking as any).therapists?.name || "";
      const message = `Royal Head Spa nhắc lịch: Bạn có lịch hẹn "${serviceName}" lúc ${booking.start_time.slice(0, 5)} hôm nay với ${therapistName}. Hẹn gặp bạn!`;

      try {
        // Send SMS
        const smsResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: phone,
            From: fromNumber,
            Body: message,
          }),
        });

        const smsData = await smsResponse.json();
        const result: any = { booking_id: booking.id, phone, sms: smsResponse.ok ? smsData.sid : smsData };

        // Send WhatsApp if enabled
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
