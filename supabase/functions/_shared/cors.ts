/**
 * Shared CORS helper for all edge functions.
 *
 * Set ALLOWED_ORIGINS as a Supabase secret (comma-separated):
 *   npx supabase secrets set ALLOWED_ORIGINS="https://yourdomain.com,http://localhost:5173"
 *
 * If not set, defaults to "*" (open — for dev only).
 */

const RAW = Deno.env.get("ALLOWED_ORIGINS") || "*";
const ORIGINS = RAW === "*" ? null : RAW.split(",").map(o => o.trim());

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";

  // If no whitelist configured, allow all (dev mode)
  if (!ORIGINS) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
  }

  // Check if the request origin is in the whitelist
  if (ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Vary": "Origin",
    };
  }

  // Origin not allowed — return headers without Allow-Origin (browser will block)
  return {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}
