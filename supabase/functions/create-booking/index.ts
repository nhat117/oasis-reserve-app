import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createBookingSchema, parseBody } from "../_shared/validation.ts";
import { checkRateLimitDb, rateLimitResponse } from "../_shared/rate-limit.ts";

async function verifyTurnstile(token: string, remoteIp: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.error("[create-booking] TURNSTILE_SECRET_KEY not configured — rejecting");
    return false;
  }
  const body = new URLSearchParams({ secret, response: token, remoteip: remoteIp });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  return data.success === true;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Rate limit per IP: max 5 booking attempts per 10 minutes
    const ipLimit = await checkRateLimitDb(serviceClient, `create-booking:ip:${clientIp}`, 5, 600);
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retry_after, corsHeaders);

    const rawBody = await req.json();
    const parsed = parseBody(createBookingSchema, rawBody, corsHeaders);
    if (parsed.response) return parsed.response;
    const data = parsed.data;

    // Rate limit per contact identity: max 5 bookings per day, catches
    // flooding attempts that rotate name/email/phone per submission but
    // reuse the same IP, and vice versa.
    const identityKey = `create-booking:contact:${data.customer_email.toLowerCase()}:${data.customer_phone.replace(/\D/g, "")}`;
    const identityLimit = await checkRateLimitDb(serviceClient, identityKey, 5, 86400);
    if (!identityLimit.allowed) return rateLimitResponse(identityLimit.retry_after, corsHeaders);

    const verified = await verifyTurnstile(data.turnstile_token, clientIp);
    if (!verified) {
      return new Response(JSON.stringify({ error: "Verification failed. Please try again." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data.therapist_id) {
      return new Response(JSON.stringify({ error: "No therapist assigned" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error } = await serviceClient
      .from("bookings")
      .insert({
        service_id: data.service_id,
        therapist_id: data.therapist_id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        booking_date: data.booking_date,
        start_time: data.start_time,
        end_time: data.end_time,
        status: "confirmed",
        notes: data.notes || null,
        ...(data.tenant_id ? { tenant_id: data.tenant_id } : {}),
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return new Response(JSON.stringify({ error: "This time slot was just booked. Please pick another." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("[create-booking] insert error:", error.message);
      return new Response(JSON.stringify({ error: "Could not create booking. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (data.services && data.services.length > 0) {
      const { error: servicesError } = await serviceClient.from("booking_services").insert(
        data.services.map((s, i) => ({
          booking_id: inserted.id,
          service_id: s.id,
          service_name: s.name,
          duration_minutes: s.duration_minutes,
          price: s.price,
          is_primary: i === 0,
          ...(data.tenant_id ? { tenant_id: data.tenant_id } : {}),
        })),
      );
      if (servicesError) console.error("[create-booking] booking_services insert error:", servicesError.message);

      const { error: notifError } = await serviceClient.from("notifications").insert({
        tenant_id: data.tenant_id || null,
        type: "new_booking",
        title: "Lịch hẹn mới!",
        body: `${data.customer_name} — ${data.combined_service_name || data.services.map((s) => s.name).join(" + ")} — ${data.booking_date} ${data.start_time.slice(0, 5)}`,
        booking_id: inserted.id,
      });
      if (notifError) console.error("[create-booking] notifications insert error:", notifError.message);
    }

    return new Response(JSON.stringify({ success: true, booking_id: inserted.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[create-booking] unexpected error:", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
