/**
 * Shared auth helper for all edge functions.
 *
 * Supports two modes:
 * 1. Service-role key (for internal / cron calls)
 * 2. User JWT (validates user exists + has admin/employee role + owns the tenant)
 *
 * SOC2 CC6.1 / PCI-DSS 7.1 — Logical access controls.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

export interface AuthResult {
  ok: true;
  isServiceRole: boolean;
  userId?: string;
  tenantId?: string;
}

export interface AuthError {
  ok: false;
  status: number;
  message: string;
}

/**
 * Authenticate the request.
 *
 * @param req          - Incoming request
 * @param corsHeaders  - CORS headers to include in error responses
 * @param options.requireTenant - If true, also verifies the caller belongs to `tenantId`
 * @param options.tenantId      - The tenant_id the caller claims to access
 * @param options.allowTwilioWebhook - If true, also accept valid Twilio webhook signatures
 */
export async function authenticateRequest(
  req: Request,
  corsHeaders: Record<string, string>,
  options?: { requireTenant?: boolean; tenantId?: string; allowTwilioWebhook?: boolean },
): Promise<AuthResult | AuthError> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("authorization");

  // --- Twilio webhook support ---
  if (options?.allowTwilioWebhook) {
    const twilioSig = req.headers.get("x-twilio-signature");
    if (twilioSig) {
      // If Twilio signature is present, validate it
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      if (twilioAuthToken) {
        const isValid = await validateTwilioSignature(req, twilioAuthToken, twilioSig);
        if (isValid) {
          return { ok: true, isServiceRole: false };
        }
      }
      // If TWILIO_AUTH_TOKEN is not set, log a warning but allow (for development)
      if (!twilioAuthToken) {
        console.warn("TWILIO_AUTH_TOKEN not set — skipping Twilio signature validation (set in production!)");
        return { ok: true, isServiceRole: false };
      }
      return { ok: false, status: 401, message: "Invalid Twilio signature" };
    }
  }

  // --- No auth header ---
  if (!authHeader) {
    return { ok: false, status: 401, message: "Missing authorization header" };
  }

  // --- Service-role key ---
  if (authHeader === `Bearer ${supabaseServiceKey}`) {
    return { ok: true, isServiceRole: true };
  }

  // --- User JWT ---
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await callerClient.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, message: "Invalid or expired token" };
  }

  // Check role
  const { data: isAdmin } = await callerClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
  const { data: isEmployee } = await callerClient.rpc("has_role", { _user_id: user.id, _role: "employee" });
  if (!isAdmin && !isEmployee) {
    return { ok: false, status: 403, message: "Insufficient permissions" };
  }

  // Tenant ownership check
  if (options?.requireTenant && options.tenantId) {
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: membership } = await serviceClient
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", options.tenantId)
      .limit(1)
      .single();

    if (!membership) {
      return { ok: false, status: 403, message: "Access denied for this tenant" };
    }
  }

  return { ok: true, isServiceRole: false, userId: user.id, tenantId: options?.tenantId };
}

/**
 * Return a JSON error Response from an AuthError.
 */
export function authErrorResponse(err: AuthError, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: err.message }),
    { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/**
 * Validate a Twilio webhook signature.
 * Uses HMAC-SHA1 as per Twilio's security spec.
 */
async function validateTwilioSignature(
  req: Request,
  authToken: string,
  signature: string,
): Promise<boolean> {
  try {
    const url = req.url;
    // For POST requests, we need to append sorted form parameters
    let dataString = url;
    if (req.method === "POST") {
      const cloned = req.clone();
      const formData = await cloned.formData().catch(() => null);
      if (formData) {
        const params: Record<string, string> = {};
        formData.forEach((value, key) => {
          params[key] = value.toString();
        });
        const sortedKeys = Object.keys(params).sort();
        for (const key of sortedKeys) {
          dataString += key + params[key];
        }
      }
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(authToken),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(dataString));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return computed === signature;
  } catch {
    return false;
  }
}
