import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createAdminSchema, parseBody } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await callerClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json();
    const parsed = parseBody(createAdminSchema, rawBody, corsHeaders);
    if (parsed.response) return parsed.response;
    const { email, password, role } = parsed.data;
    const assignRole = role === "employee" ? "employee" : "admin";

    // Create user with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's tenant_id so the new user is in the same tenant
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", caller.id)
      .single();

    const callerTenantId = callerRole?.tenant_id;

    // Assign role with tenant
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role: assignRole, tenant_id: callerTenantId });

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send welcome email via Resend
    try {
      // Get spa name for this tenant
      const { data: spaNameSetting } = await adminClient
        .from("app_settings").select("value")
        .eq("key", "spa_name")
        .eq("tenant_id", callerTenantId)
        .single();
      const spaName = spaNameSetting?.value || 'Oasis Reserve';

      const loginUrl = `${req.headers.get('origin') || ''}/admin/login`
      const welcomeHtml = `
<div style="background-color:#ffffff;font-family:'Be Vietnam Pro',Arial,sans-serif">
  <div style="padding:20px 25px;max-width:520px;margin:0 auto">
    <div style="background-color:hsl(30,35%,28%);border-radius:12px 12px 0 0;padding:24px;text-align:center">
      <h1 style="font-size:22px;font-weight:bold;color:#ffffff;margin:0">🌿 Welcome, Admin!</h1>
    </div>
    <p style="font-size:16px;color:hsl(25,30%,12%);margin:20px 0 8px">Hello,</p>
    <p style="font-size:14px;color:hsl(25,15%,45%);line-height:1.6;margin:0 0 16px">An admin account has been created for you at <strong>${spaName}</strong>.</p>
    <div style="background-color:hsl(35,30%,95%);border-radius:8px;padding:16px;margin:0 0 20px">
      <p style="font-size:14px;color:hsl(25,30%,12%);margin:4px 0;line-height:1.6">📧 <strong>Email:</strong> ${email}</p>
    </div>
    <p style="font-size:14px;color:hsl(25,15%,45%);line-height:1.6;margin:0 0 16px">You can now sign in to the admin dashboard to manage bookings, services, and settings.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${loginUrl}" style="background-color:hsl(30,35%,28%);color:#ffffff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;display:inline-block">Sign In to Dashboard</a>
    </div>
    <p style="font-size:14px;color:hsl(25,15%,45%);line-height:1.6;margin:0 0 16px">If you did not expect this email, please ignore it or contact the team.</p>
    <hr style="border-color:hsl(35,20%,85%);margin:20px 0" />
    <p style="font-size:12px;color:hsl(25,15%,45%);margin:0">Best regards, ${spaName}</p>
  </div>
</div>`
      await adminClient.functions.invoke('send-email-resend', {
        body: {
          to: email,
          subject: 'Your admin account has been created – ${spaName}',
          html: welcomeHtml,
        },
      });
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id, role: assignRole }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
