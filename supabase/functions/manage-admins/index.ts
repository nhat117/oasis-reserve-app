import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimitDb, rateLimitResponse } from "../_shared/rate-limit.ts";

async function auditLog(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  details: Record<string, unknown>,
  tenantId: string | null,
) {
  try {
    await adminClient.from("activity_logs").insert({
      user_id: userId,
      action,
      details,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    });
  } catch (e) {
    console.error("[audit] Failed to log:", action, e);
  }
}

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

    // Verify caller is admin or employee
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
    const { data: isEmployee } = await callerClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "employee",
    });

    if (!isAdmin && !isEmployee) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Rate limit: 20 admin management requests per minute per user
    const rl = await checkRateLimitDb(adminClient, `manage-admins:${caller.id}`, 20, 60);
    if (!rl.allowed) return rateLimitResponse(rl.retry_after, corsHeaders);

    // Get caller's tenant_id for scoping
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", caller.id)
      .single();
    const tenantId = callerRole?.tenant_id;

    if (req.method === "GET") {
      // List all admin/employee users scoped to this tenant
      const query = adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "employee"]);
      if (tenantId) query.eq("tenant_id", tenantId);
      const { data: roles, error: rolesError } = await query;

      if (rolesError) {
        return new Response(JSON.stringify({ error: rolesError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduplicate: one entry per user, pick highest role (admin > employee)
      const userRoleMap = new Map<string, string>();
      for (const r of roles || []) {
        const existing = userRoleMap.get(r.user_id);
        if (!existing || r.role === "admin") {
          userRoleMap.set(r.user_id, r.role);
        }
      }

      const admins = [];
      for (const [userId, role] of userRoleMap) {
        const { data: { user } } = await adminClient.auth.admin.getUserById(userId);
        if (user) {
          admins.push({
            id: user.id,
            email: user.email,
            role,
            created_at: user.created_at,
            is_current: user.id === caller.id,
          });
        }
      }

      return new Response(JSON.stringify({ admins, caller_role: isAdmin ? 'admin' : 'employee' }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      // Only admins can delete
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { user_id } = await req.json();
      if (!user_id || typeof user_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
        return new Response(JSON.stringify({ error: "Valid user_id (UUID) required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify target user belongs to caller's tenant
      if (tenantId) {
        const { data: targetRole } = await adminClient
          .from("user_roles").select("tenant_id").eq("user_id", user_id).single();
        if (!targetRole || targetRole.tenant_id !== tenantId) {
          return new Response(JSON.stringify({ error: "Access denied" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Get target email for audit log before deletion
      const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(user_id);

      const { error: roleError } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("tenant_id", tenantId);

      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await auditLog(adminClient, caller.id, "admin_delete_user", {
        deleted_user_id: user_id,
        deleted_email: targetUser?.email ?? "unknown",
      }, tenantId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      // Only admins can update passwords
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { user_id, password } = await req.json();
      if (!user_id || typeof user_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
        return new Response(JSON.stringify({ error: "Valid user_id (UUID) required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!password || password.length < 6) {
        return new Response(JSON.stringify({ error: "Password (min 6 chars) required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify target user belongs to caller's tenant
      if (tenantId) {
        const { data: targetRole } = await adminClient
          .from("user_roles").select("tenant_id").eq("user_id", user_id).single();
        if (!targetRole || targetRole.tenant_id !== tenantId) {
          return new Response(JSON.stringify({ error: "Access denied" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, { password });
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await auditLog(adminClient, caller.id, "admin_reset_password", {
        target_user_id: user_id,
      }, tenantId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
