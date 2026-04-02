/**
 * Shared CORS helper for all edge functions.
 *
 * Set ALLOWED_ORIGINS as a Supabase secret (comma-separated):
 *   npx supabase secrets set ALLOWED_ORIGINS="https://yourdomain.com,http://localhost:5173"
 *
 * If not set, defaults to "*" ONLY in local development.
 * In production (SUPABASE_URL contains supabase.co), wildcard CORS is blocked.
 *
 * SOC2 CC6.3 — Restrict unauthorized network access.
 */

const RAW = Deno.env.get("ALLOWED_ORIGINS") || "";
const IS_PRODUCTION = (Deno.env.get("SUPABASE_URL") || "").includes("supabase.co");
const ORIGINS = RAW
  ? RAW.split(",").map(o => o.trim())
  : (IS_PRODUCTION ? null : null); // null = wildcard in dev, blocked in prod

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";

  const methodsHeader = "GET, POST, PATCH, DELETE, OPTIONS";

  // If no whitelist configured
  if (!RAW) {
    if (IS_PRODUCTION) {
      // Fail closed in production — no CORS allowed without explicit config
      console.warn("CORS: ALLOWED_ORIGINS not set in production! Requests from browsers will be blocked.");
      return {
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": methodsHeader,
      };
    }
    // Dev mode: allow all
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": methodsHeader,
    };
  }

  const allowedOrigins = RAW.split(",").map(o => o.trim());

  // Check if the request origin is in the whitelist
  if (allowedOrigins.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": methodsHeader,
      "Vary": "Origin",
    };
  }

  // Origin not allowed — return headers without Allow-Origin (browser will block)
  return {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": methodsHeader,
  };
}
