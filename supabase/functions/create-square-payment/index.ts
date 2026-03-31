import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Create a Square payment using a card nonce from the Web Payments SDK.
 * Used for: in-browser card entry, Apple Pay, Google Pay (contactless).
 *
 * POST body: { source_nonce, amount, booking_id?, sale_id?, note?, customer_name? }
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth: optional — required for admin sales, not for public booking payments
  const authHeader = req.headers.get("authorization");
  let tenantId: string | undefined;

  if (authHeader) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (caller) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
      const { data: callerRole } = await supabaseAdmin
        .from("user_roles").select("tenant_id").eq("user_id", caller.id).single();
      tenantId = callerRole?.tenant_id;
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const source_nonce = typeof body.source_nonce === "string" ? body.source_nonce.trim() : "";
    const amount = typeof body.amount === "number" ? body.amount : NaN;
    const booking_id = typeof body.booking_id === "string" ? body.booking_id : undefined;
    const sale_id = typeof body.sale_id === "string" ? body.sale_id : undefined;
    const note = typeof body.note === "string" ? body.note.slice(0, 500) : "Payment";
    const customer_name = typeof body.customer_name === "string" ? body.customer_name.slice(0, 200) : undefined;

    // Validation
    if (!source_nonce || source_nonce.length < 10) {
      return new Response(
        JSON.stringify({ error: "Invalid payment token (source_nonce)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (booking_id && !uuidRegex.test(booking_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid booking_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (sale_id && !uuidRegex.test(sale_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid sale_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!amount || amount <= 0 || amount > 100000) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Square credentials
    const query = supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["square_access_token", "square_location_id", "square_environment"]);
    if (tenantId) query.eq("tenant_id", tenantId);
    const { data: settingsRows } = await query;

    const s: Record<string, string> = {};
    settingsRows?.forEach((r: any) => { s[r.key] = r.value; });

    const accessToken = s["square_access_token"];
    const locationId = s["square_location_id"];
    const environment = s["square_environment"] || "sandbox";

    if (!accessToken || !locationId) {
      return new Response(
        JSON.stringify({ error: "Square not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = environment === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";

    const amountInCents = Math.round(amount * 100);

    // Create payment via Square Payments API
    const paymentResponse = await fetch(`${baseUrl}/v2/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-01-18",
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        source_id: source_nonce,
        amount_money: {
          amount: amountInCents,
          currency: "AUD",
        },
        location_id: locationId,
        reference_id: booking_id || sale_id || undefined,
        note: note,
        autocomplete: true,
      }),
    });

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error("Square Payments API error:", JSON.stringify(paymentData));
      const errorDetail = paymentData.errors?.[0]?.detail || "Payment failed";
      return new Response(
        JSON.stringify({ error: errorDetail }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payment = paymentData.payment;

    // Update booking/sale records
    if (booking_id) {
      await supabase.from("bookings").update({
        payment_status: "paid",
        payment_provider: "square",
        payment_intent_id: payment.id,
        total_amount: amount,
      }).eq("id", booking_id);
    }

    if (sale_id) {
      await supabase.from("sales").update({
        payment_provider: "square",
        external_payment_id: payment.id,
      }).eq("id", sale_id);
    }

    return new Response(
      JSON.stringify({
        payment_id: payment.id,
        status: payment.status,
        receipt_url: payment.receipt_url,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Create Square payment error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
