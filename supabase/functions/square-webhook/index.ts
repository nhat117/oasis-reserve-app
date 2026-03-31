import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.text();

    // Verify Square webhook signature if configured
    const signatureHeader = req.headers.get("x-square-hmacsha256-signature");
    const { data: squareWebhookSecret } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "square_webhook_secret")
      .single();

    if (!squareWebhookSecret?.value) {
      console.error("Square webhook secret not configured — rejecting request");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!signatureHeader) {
      console.error("Missing x-square-hmacsha256-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const notificationUrl = `${supabaseUrl}/functions/v1/square-webhook`;
    const verified = await verifySquareSignature(
      body,
      signatureHeader,
      squareWebhookSecret.value,
      notificationUrl
    );
    if (!verified) {
      console.error("Square webhook signature verification failed");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);
    const eventType = event.type;
    console.log("Square webhook event:", eventType);

    if (eventType === "terminal.checkout.updated") {
      const checkout = event.data?.object?.checkout;
      if (!checkout) return new Response(JSON.stringify({ received: true }), { status: 200 });

      const checkoutId = checkout.id;
      const status = checkout.status;

      if (status === "COMPLETED") {
        await supabase.from("bookings").update({
          payment_status: "paid",
        }).eq("payment_intent_id", checkoutId);

        await supabase.from("sales").update({
          payment_provider: "square",
        }).eq("external_payment_id", checkoutId);

        console.log(`Square checkout ${checkoutId} completed`);
      } else if (status === "CANCELED") {
        await supabase.from("bookings").update({
          payment_status: "failed",
        }).eq("payment_intent_id", checkoutId);

        console.log(`Square checkout ${checkoutId} canceled`);
      }
    } else if (eventType === "payment.updated") {
      const payment = event.data?.object?.payment;
      if (!payment) return new Response(JSON.stringify({ received: true }), { status: 200 });

      if (payment.status === "COMPLETED" && payment.reference_id) {
        await supabase.from("bookings").update({
          payment_status: "paid",
          payment_provider: "square",
        }).eq("id", payment.reference_id);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Square webhook error:", err);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/**
 * Verify Square webhook signature.
 * Square signs: notificationUrl + body, using HMAC-SHA256 with the webhook signature key.
 * The result is base64-encoded.
 */
async function verifySquareSignature(
  body: string,
  signature: string,
  signatureKey: string,
  notificationUrl: string
): Promise<boolean> {
  try {
    const payload = notificationUrl + body;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(signatureKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

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
