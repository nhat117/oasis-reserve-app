import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import webpush from "npm:web-push@3.6.7";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Sends a Web Push notification to every registered device for a tenant
 * (or a single user_id, for a targeted push). This is the delivery half of
 * the push feature — src/lib/pushNotifications.ts + push-sw.js handle
 * requesting permission and registering the subscription that gets stored
 * in push_subscriptions; this function is what actually reaches the device.
 *
 * Requires two Supabase secrets (generate once with `npx web-push generate-vapid-keys`):
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 * VAPID_PUBLIC_KEY must also be set as VITE_VAPID_PUBLIC_KEY in the frontend
 * build env — the browser needs it to create a subscription that matches
 * the key pair this function signs with.
 */

interface PushPayload {
  tenant_id: string;
  user_id?: string; // omit to notify every registered device for the tenant
  title: string;
  body: string;
  url?: string; // relative path to open/focus when the notification is clicked
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("[send-push-notification] Missing VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY secrets");
    return new Response(
      JSON.stringify({ error: "Push notifications not configured (missing VAPID keys)" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  webpush.setVapidDetails("mailto:support@example.com", vapidPublicKey, vapidPrivateKey);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: PushPayload = await req.json();
    const { tenant_id, user_id, title, body: message, url } = body;

    if (!tenant_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: "tenant_id, title, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let query = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth_key").eq("tenant_id", tenant_id);
    if (user_id) query = query.eq("user_id", user_id);
    const { data: subscriptions, error: fetchErr } = await query;

    if (fetchErr) {
      console.error("[send-push-notification] Failed to load subscriptions:", fetchErr);
      return new Response(
        JSON.stringify({ error: "Failed to load push subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[send-push-notification] No registered devices for tenant ${tenant_id}${user_id ? ` (user ${user_id})` : ""}`);
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: "No registered devices" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = JSON.stringify({ title, body: message, url: url || "/admin" });

    let sent = 0;
    let failed = 0;
    const staleSubscriptionIds: string[] = [];

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
        );
        sent++;
      } catch (err) {
        failed++;
        const statusCode = (err as { statusCode?: number }).statusCode;
        console.error(`[send-push-notification] Delivery failed for subscription ${sub.id} (status ${statusCode}):`, err);
        // 404/410 = the browser has unsubscribed or the subscription expired — clean it up.
        if (statusCode === 404 || statusCode === 410) staleSubscriptionIds.push(sub.id);
      }
    }));

    if (staleSubscriptionIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", staleSubscriptionIds);
      console.log(`[send-push-notification] Removed ${staleSubscriptionIds.length} stale subscription(s)`);
    }

    console.log(`[send-push-notification] tenant=${tenant_id} sent=${sent} failed=${failed} total=${subscriptions.length}`);

    return new Response(
      JSON.stringify({ sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-push-notification] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
