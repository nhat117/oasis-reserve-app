import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkoutSchema, parseBody } from "../_shared/validation.ts";
import { checkRateLimitDb, rateLimitResponse } from "../_shared/rate-limit.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Rate limit: 5 checkout attempts per minute per IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimitDb(supabase, `checkout:${clientIp}`, 5, 60);
  if (!rl.allowed) return rateLimitResponse(rl.retry_after, corsHeaders);

  try {
    const rawBody = await req.json();
    const parsed = parseBody(checkoutSchema, rawBody, corsHeaders);
    if (parsed.response) return parsed.response;
    const { booking_id, service_name, total_amount, customer_email, customer_name, success_url, cancel_url } = parsed.data;

    // Validate booking exists and get tenant_id from the booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, service_id, payment_status, tenant_id")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = booking.tenant_id;

    if (booking.payment_status === "paid") {
      return new Response(
        JSON.stringify({ error: "Booking already paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify amount matches the service price (scoped to tenant)
    const { data: service } = await supabase
      .from("services")
      .select("price, name")
      .eq("id", booking.service_id)
      .eq("tenant_id", tenantId)
      .single();

    if (service) {
      if (total_amount < service.price * 0.99) {
        return new Response(
          JSON.stringify({ error: "Invalid amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get Stripe secret key from app_settings (scoped to tenant)
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", ["stripe_secret_key", "spa_name", "stripe_payment_enabled"]);

    const s: Record<string, string> = {};
    settingsRows?.forEach((r: any) => { s[r.key] = r.value; });

    if (s["stripe_payment_enabled"] !== "true") {
      return new Response(
        JSON.stringify({ error: "Online payment is not enabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeSecretKey = s["stripe_secret_key"];
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Payment not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const spaName = s["spa_name"] || "Oasis Reserve";
    const amountInCents = Math.round(total_amount * 100);

    // Create Stripe Checkout Session
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "payment_method_types[0]": "card",
        "mode": "payment",
        "line_items[0][price_data][currency]": "aud",
        "line_items[0][price_data][product_data][name]": service_name || "Booking",
        "line_items[0][price_data][product_data][description]": `${spaName} - Booking`,
        "line_items[0][price_data][unit_amount]": String(amountInCents),
        "line_items[0][quantity]": "1",
        "success_url": `${success_url}?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking_id}`,
        "cancel_url": `${cancel_url}?booking_id=${booking_id}`,
        "metadata[booking_id]": booking_id,
        ...(customer_email ? { "customer_email": customer_email } : {}),
      }),
    });

    const sessionData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error("Stripe API error:", sessionData);
      return new Response(
        JSON.stringify({ error: "Failed to create checkout session" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update booking with payment info
    await supabase.from("bookings").update({
      payment_status: "pending",
      payment_provider: "stripe",
      payment_intent_id: sessionData.id,
      total_amount: total_amount,
    }).eq("id", booking_id);

    return new Response(
      JSON.stringify({ url: sessionData.url, session_id: sessionData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Create Stripe checkout error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
