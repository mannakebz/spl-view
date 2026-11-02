export function allowedOrigin(request: Request): string | null {
  const requestOrigin = request.headers.get("origin");
  const configuredOrigins = Deno.env.get("ALLOWED_ORIGINS")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) || [];

  if (!requestOrigin || configuredOrigins.length === 0) return null;

  try {
    const origin = new URL(requestOrigin).origin;
    return configuredOrigins.some((value) => {
      try {
        return new URL(value).origin === origin;
      } catch {
        return false;
      }
    }) ? origin : null;
  } catch {
    return null;
  }
}

export function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string,
): Response {
  return Response.json(body, {
    status,
    headers: corsHeaders(origin),
  });
}
