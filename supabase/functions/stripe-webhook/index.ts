import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

// No CORS needed for webhooks — Stripe calls directly
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.text();

    // Verify Stripe webhook signature if secret is configured
    const sigHeader = req.headers.get("stripe-signature");
    const { data: webhookSecretSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "stripe_webhook_secret")
      .single();

    const webhookSecret = webhookSecretSetting?.value;

    if (!webhookSecret) {
      console.error("Stripe webhook secret not configured — rejecting request");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!sigHeader) {
      console.error("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const verified = await verifyStripeSignature(body, sigHeader, webhookSecret);
    if (!verified) {
      console.error("Stripe webhook signature verification failed");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);
    const eventType = event.type;
    console.log("Stripe webhook event:", eventType);

    if (eventType === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;

      if (bookingId) {
        await supabase.from("bookings").update({
          payment_status: "paid",
          payment_intent_id: session.payment_intent || session.id,
        }).eq("id", bookingId);

        console.log(`Booking ${bookingId} marked as paid`);
      }
    } else if (eventType === "checkout.session.expired") {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;

      if (bookingId) {
        await supabase.from("bookings").update({
          payment_status: "failed",
        }).eq("id", bookingId);

        console.log(`Booking ${bookingId} payment expired`);
      }
    } else if (eventType === "charge.refunded") {
      const charge = event.data.object;
      const paymentIntentId = charge.payment_intent;

      if (paymentIntentId) {
        await supabase.from("bookings").update({
          payment_status: "refunded",
        }).eq("payment_intent_id", paymentIntentId);

        console.log(`Payment ${paymentIntentId} refunded`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/**
 * Verify Stripe webhook signature using HMAC-SHA256.
 * Stripe signs with: timestamp + "." + payload
 * Header format: t=timestamp,v1=signature
 */
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  tolerance = 300 // 5 minutes
): Promise<boolean> {
  try {
    const parts: Record<string, string> = {};
    for (const item of sigHeader.split(",")) {
      const [key, value] = item.split("=");
      parts[key] = value;
    }

    const timestamp = parts["t"];
    const signature = parts["v1"];
    if (!timestamp || !signature) return false;

    // Check timestamp tolerance (prevent replay attacks)
    const ts = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > tolerance) return false;

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (expected.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}
