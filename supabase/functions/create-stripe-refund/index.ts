import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Verify caller is authenticated admin/employee
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin/employee role via user_roles and get tenant_id
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id)
      .in("role", ["admin", "employee"])
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = userRole.tenant_id;

    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: "Missing booking_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get booking with payment info (scoped to tenant)
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, payment_status, payment_provider, payment_intent_id, total_amount")
      .eq("id", booking_id)
      .eq("tenant_id", tenantId)
      .single();

    if (bookingErr || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (booking.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ error: `Cannot refund: payment status is '${booking.payment_status}'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (booking.payment_provider !== "stripe") {
      return new Response(
        JSON.stringify({ error: "Only Stripe payments can be refunded online" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!booking.payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "No payment intent found for this booking" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Stripe secret key (scoped to tenant)
    const { data: secretRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "stripe_secret_key")
      .eq("tenant_id", tenantId)
      .single();

    const stripeSecretKey = secretRow?.value;
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Stripe Refunds API
    const refundResponse = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        payment_intent: booking.payment_intent_id,
      }),
    });

    const refundData = await refundResponse.json();

    if (!refundResponse.ok) {
      console.error("Stripe refund error:", refundData);
      return new Response(
        JSON.stringify({
          error: refundData.error?.message || "Failed to process refund",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update booking payment status
    await supabase
      .from("bookings")
      .update({ payment_status: "refunded" })
      .eq("id", booking_id);

    console.log(`Booking ${booking_id} refunded (Stripe refund: ${refundData.id})`);

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refundData.id,
        amount: refundData.amount / 100,
        status: refundData.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Refund error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
