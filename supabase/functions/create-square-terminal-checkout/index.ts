import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth: require admin or employee
  const authHeader = req.headers.get("authorization");
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

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get caller's tenant_id
  const { data: callerRole } = await supabase
    .from("user_roles").select("tenant_id").eq("user_id", caller.id).single();
  const tenantId = callerRole?.tenant_id;

  try {
    const body = await req.json();
    const booking_id = typeof body.booking_id === 'string' ? body.booking_id : undefined;
    const sale_id = typeof body.sale_id === 'string' ? body.sale_id : undefined;
    const amount = typeof body.amount === 'number' ? body.amount : NaN;
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : undefined;

    // UUID validation regex
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

    // Get Square credentials from app_settings (scoped to tenant)
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

    const checkoutResponse = await fetch(`${baseUrl}/v2/terminals/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-01-18",
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        checkout: {
          amount_money: {
            amount: amountInCents,
            currency: "AUD",
          },
          device_options: {
            device_id: locationId,
            skip_receipt_screen: false,
            tip_settings: {
              allow_tipping: true,
            },
          },
          reference_id: booking_id || sale_id || undefined,
          note: note || "Payment",
        },
      }),
    });

    const checkoutData = await checkoutResponse.json();

    if (!checkoutResponse.ok) {
      console.error("Square API error:", checkoutData);
      return new Response(
        JSON.stringify({ error: "Failed to create terminal checkout" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const terminalCheckout = checkoutData.checkout;

    if (booking_id) {
      await supabase.from("bookings").update({
        payment_status: "pending",
        payment_provider: "square",
        payment_intent_id: terminalCheckout.id,
        total_amount: amount,
      }).eq("id", booking_id);
    }

    if (sale_id) {
      await supabase.from("sales").update({
        payment_provider: "square",
        external_payment_id: terminalCheckout.id,
      }).eq("id", sale_id);
    }

    return new Response(
      JSON.stringify({
        checkout_id: terminalCheckout.id,
        status: terminalCheckout.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Create Square terminal checkout error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
