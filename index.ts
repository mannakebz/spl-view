import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { allowedOrigin, corsHeaders, jsonResponse } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const origin = allowedOrigin(request);
  if (!origin) return Response.json({ error: "This website origin is not allowed." }, { status: 403 });

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST to change notification preferences." }, 405, origin);
  }

  let body: { action?: unknown; token?: unknown };
  try {
    const requestBody = await request.text();
    if (new TextEncoder().encode(requestBody).byteLength > 8192) {
      return jsonResponse({ error: "The device registration request is too large." }, 413, origin);
    }
    const parsed: unknown = JSON.parse(requestBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse({ error: "The registration request must be a JSON object." }, 400, origin);
    }
    body = parsed as { action?: unknown; token?: unknown };
  } catch {
    return jsonResponse({ error: "The registration request must contain valid JSON." }, 400, origin);
  }

  if (body.action !== "subscribe" && body.action !== "unsubscribe") {
    return jsonResponse({ error: "Choose subscribe or unsubscribe." }, 400, origin);
  }
  if (typeof body.token !== "string" || body.token.length < 20 || body.token.length > 4096
    || !/^[A-Za-z0-9:_-]+$/.test(body.token)) {
    return jsonResponse({ error: "The Firebase device token is invalid." }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("FCM token storage is missing Supabase service credentials.");
    return jsonResponse({ error: "Notification storage is not configured." }, 500, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = body.action === "subscribe"
    ? await adminClient.from("league_fcm_tokens").upsert({
      token: body.token,
      updated_at: new Date().toISOString(),
    }, { onConflict: "token" })
    : await adminClient.from("league_fcm_tokens").delete().eq("token", body.token);

  if (result.error) {
    console.error(`Could not ${body.action} an FCM device:`, result.error.message);
    return jsonResponse({ error: `Could not ${body.action} this device for notifications.` }, 500, origin);
  }

  return jsonResponse({ ok: true }, 200, origin);
});
