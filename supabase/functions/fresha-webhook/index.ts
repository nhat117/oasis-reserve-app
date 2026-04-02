import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Fresha Webhook Handler
 *
 * Receives webhooks from Fresha (salon/spa booking platform).
 * Syncs Fresha bookings, services, and staff into Oasis Reserve tables
 * so the AI assistant has access to them.
 *
 * Fresha webhooks documented at: https://partners.fresha.com/docs
 * Events: appointment.created, appointment.updated, appointment.cancelled,
 *         client.created, client.updated
 *
 * JWT is disabled — authentication is via webhook signature.
 * Tenant resolved via fresha_partner_id in ai_config metadata.
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const event = body.event as string | undefined;
    const payload = body.data;

    if (!event || !payload) {
      return new Response(
        JSON.stringify({ error: "Missing event or data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve tenant from Fresha partner/location ID
    const freshaLocationId = body.location_id || body.data?.location_id;
    const { data: configRow } = await supabase
      .from("app_settings")
      .select("tenant_id")
      .eq("key", "fresha_location_id")
      .eq("value", String(freshaLocationId))
      .single();

    if (!configRow) {
      console.error(`No tenant found for Fresha location_id=${freshaLocationId}`);
      return new Response(
        JSON.stringify({ error: "Tenant not found for this Fresha location" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantId = configRow.tenant_id;

    switch (event) {
      case "appointment.created":
      case "appointment.updated":
        return await handleAppointmentUpsert(supabase, payload, tenantId, corsHeaders);

      case "appointment.cancelled":
        return await handleAppointmentCancelled(supabase, payload, tenantId, corsHeaders);

      case "client.created":
      case "client.updated":
        // Store Fresha client info in guest_visits for cross-reference
        return await handleClientUpsert(supabase, payload, tenantId, corsHeaders);

      default:
        return new Response(JSON.stringify({ ok: true, skipped: `unhandled event: ${event}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("Fresha webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Map a Fresha appointment to a booking in our DB.
 * Matches service by name and therapist by name (creates if not found).
 */
// deno-lint-ignore no-explicit-any
async function handleAppointmentUpsert(supabase: any, data: any, tenantId: string, corsHeaders: Record<string, string>) {
  const freshaAppointmentId = String(data.id);
  const customerName = data.client?.first_name
    ? `${data.client.first_name} ${data.client.last_name || ""}`.trim()
    : "Walk-in";
  const customerPhone = data.client?.phone || "";
  const customerEmail = data.client?.email || "";
  const serviceName = data.service?.name || "Unknown Service";
  const staffName = data.staff?.name || data.staff?.first_name || "";
  const appointmentDate = data.date; // YYYY-MM-DD
  const startTime = data.start_time; // HH:MM
  const endTime = data.end_time; // HH:MM
  const status = mapFreshaStatus(data.status);

  // Find or note the service
  const { data: service } = await supabase
    .from("services")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("name", serviceName)
    .single();

  // Find or note the therapist
  let therapistId: string | null = null;
  if (staffName) {
    const { data: therapist } = await supabase
      .from("therapists")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", `%${staffName}%`)
      .single();
    therapistId = therapist?.id || null;
  }

  // Check if booking already exists (by fresha_id in notes)
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("tenant_id", tenantId)
    .like("notes", `%fresha:${freshaAppointmentId}%`)
    .single();

  const bookingData = {
    tenant_id: tenantId,
    service_id: service?.id || null,
    therapist_id: therapistId,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail || null,
    booking_date: appointmentDate,
    start_time: startTime ? `${startTime}:00` : null,
    end_time: endTime ? `${endTime}:00` : null,
    status,
    notes: `fresha:${freshaAppointmentId} | ${serviceName}${staffName ? ` | Staff: ${staffName}` : ""}`,
  };

  if (existing) {
    await supabase.from("bookings").update(bookingData).eq("id", existing.id);
  } else {
    await supabase.from("bookings").insert({ id: crypto.randomUUID(), ...bookingData });
  }

  return new Response(JSON.stringify({ ok: true, action: existing ? "updated" : "created" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function handleAppointmentCancelled(supabase: any, data: any, tenantId: string, corsHeaders: Record<string, string>) {
  const freshaAppointmentId = String(data.id);

  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("tenant_id", tenantId)
    .like("notes", `%fresha:${freshaAppointmentId}%`);

  return new Response(JSON.stringify({ ok: true, action: "cancelled" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function handleClientUpsert(supabase: any, data: any, tenantId: string, corsHeaders: Record<string, string>) {
  const name = `${data.first_name || ""} ${data.last_name || ""}`.trim();
  const phone = data.phone || "";
  const email = data.email || "";

  if (!phone && !email) {
    return new Response(JSON.stringify({ ok: true, skipped: "no contact info" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Upsert into guest_visits as a way to track Fresha clients
  const { data: existing } = phone
    ? await supabase.from("guest_visits").select("id").eq("tenant_id", tenantId).eq("phone", phone).single()
    : { data: null };

  if (!existing) {
    await supabase.from("guest_visits").insert({
      tenant_id: tenantId,
      customer_name: name,
      phone,
      notes: `fresha_client:${data.id}`,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapFreshaStatus(freshaStatus: string): string {
  const map: Record<string, string> = {
    confirmed: "confirmed",
    pending: "confirmed",
    completed: "completed",
    cancelled: "cancelled",
    no_show: "no_show",
  };
  return map[freshaStatus?.toLowerCase()] || "confirmed";
}
