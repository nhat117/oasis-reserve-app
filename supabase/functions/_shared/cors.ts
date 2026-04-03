/**
 * Shared CORS helper for all edge functions.
 *
 * Set ALLOWED_ORIGINS as a Supabase secret (comma-separated):
 *   npx supabase secrets set ALLOWED_ORIGINS="https://yourdomain.com,https://yourdomain.vercel.app"
 *
 * In development, add http://localhost:8081 (or your dev port) to the list.
 * If ALLOWED_ORIGINS is not set, requests are rejected (fail-closed).
 */

const RAW = Deno.env.get("ALLOWED_ORIGINS") || "";
const ORIGINS: string[] = RAW
  ? RAW.split(",").map(o => o.trim()).filter(Boolean)
  : [];

/** Standard security headers appended to every response. */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const ALLOWED_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type, x-tenant-id";

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";

  // Fail-closed: if no origins configured, block cross-origin requests
  if (ORIGINS.length === 0) {
    console.warn("[CORS] ALLOWED_ORIGINS not configured — blocking cross-origin request from:", origin);
    return {
      ...SECURITY_HEADERS,
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
    };
  }

  // Check if the request origin is in the whitelist
  if (ORIGINS.includes(origin)) {
    return {
      ...SECURITY_HEADERS,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
  }

  // Origin not allowed — return headers without Allow-Origin (browser will block)
  if (origin) {
    console.warn("[CORS] Blocked request from disallowed origin:", origin);
  }
  return {
    ...SECURITY_HEADERS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
  };
}
