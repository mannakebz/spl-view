import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { getFirebaseAccess, sendFirebaseMessage } from "../_shared/fcm.ts";
import { allowedOrigin, corsHeaders, jsonResponse } from "../_shared/http.ts";

type PublishedPost = {
  id: string;
  title: string;
  message: string;
};

function isPublishedPost(value: unknown): value is PublishedPost {
  if (!value || typeof value !== "object") return false;
  const post = value as { id?: unknown; title?: unknown; message?: unknown };
  return typeof post.id === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(post.id)
    && typeof post.title === "string" && post.title.trim().length > 0 && post.title.length <= 100
    && typeof post.message === "string" && post.message.trim().length > 0 && post.message.length <= 500;
}

Deno.serve(async (request) => {
  const origin = allowedOrigin(request);
  if (!origin) return Response.json({ error: "This website origin is not allowed." }, { status: 403 });

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST to publish notifications." }, 405, origin);
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!bearerToken || !supabaseUrl || !publicKey || !serviceRoleKey) {
    return jsonResponse({ error: "An authenticated league admin session is required." }, 401, origin);
  }

  const callerClient = createClient(supabaseUrl, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: authError } = await callerClient.auth.getUser(bearerToken);
  if (authError || !userData.user) {
    return jsonResponse({ error: "Sign in with an approved league admin account first." }, 401, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: admin, error: adminError } = await adminClient
    .from("league_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError) {
    console.error("Could not verify league admin access:", adminError.message);
    return jsonResponse({ error: "Could not verify league admin access." }, 500, origin);
  }
  if (!admin) {
    return jsonResponse({ error: "Only approved league admins can publish notifications." }, 403, origin);
  }

  let posts: PublishedPost[];
  try {
    const requestBody = await request.text();
    if (new TextEncoder().encode(requestBody).byteLength > 16_384) {
      return jsonResponse({ error: "The notification request is too large." }, 413, origin);
    }
    const parsed: unknown = JSON.parse(requestBody);
    const parsedPosts = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      && "posts" in parsed ? parsed.posts : null;
    if (!Array.isArray(parsedPosts) || parsedPosts.length < 1 || parsedPosts.length > 20
      || !parsedPosts.every(isPublishedPost)) {
      return jsonResponse({ error: "Provide between 1 and 20 valid published posts." }, 400, origin);
    }
    posts = parsedPosts.filter(isPublishedPost);
  } catch {
    return jsonResponse({ error: "The notification request must contain valid JSON." }, 400, origin);
  }

  if (new Set(posts.map((post) => post.id)).size !== posts.length) {
    return jsonResponse({ error: "Each published post must have a unique ID." }, 400, origin);
  }

  const notifications = posts.map((post) => ({
    post_id: post.id,
    title: post.title.trim(),
    message: post.message.trim(),
    link: new URL(`/index.html#news-${encodeURIComponent(post.id)}`, origin).href,
  }));
  const { data: insertedNotifications, error: insertError } = await adminClient
    .from("league_notifications")
    .upsert(notifications, { onConflict: "post_id", ignoreDuplicates: true })
    .select("post_id");

  if (insertError) {
    console.error("Could not save published notifications:", insertError.message);
    return jsonResponse({ error: "The published posts were saved, but notification history could not be saved." }, 500, origin);
  }
  const { data: deliveryNotifications, error: notificationError } = await adminClient
    .from("league_notifications")
    .select("id, title, message, link, created_at")
    .in("post_id", posts.map((post) => post.id));
  if (notificationError) {
    console.error("Could not reload published notification records:", notificationError.message);
    return jsonResponse({ error: "Notification history was saved, but its posts could not be loaded for delivery." }, 500, origin);
  }
  if (!deliveryNotifications?.length) {
    console.error("Published notification records were not available for delivery.");
    return jsonResponse({ error: "Notification history was saved, but its posts could not be loaded for delivery." }, 500, origin);
  }

  const { count: deviceCount, error: countError } = await adminClient
    .from("league_fcm_tokens")
    .select("token", { count: "exact", head: true });
  if (countError) {
    console.error("Could not count notification devices:", countError.message);
    return jsonResponse({ error: "Notification history was saved, but device tokens could not be loaded." }, 500, origin);
  }
  if (!deviceCount) {
    return jsonResponse({ created: insertedNotifications?.length || 0, sent: 0, failed: 0, removed: 0 }, 200, origin);
  }

  let access: Awaited<ReturnType<typeof getFirebaseAccess>>;
  try {
    access = await getFirebaseAccess();
  } catch (error) {
    console.error("Could not authenticate with Firebase:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "Notification history was saved, but Firebase is not configured correctly." }, 500, origin);
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;
  const devicesSent = new Set<string>();
  const pageSize = 400;

  for (let start = 0; ; start += pageSize) {
    const { data: devices, error: devicesError } = await adminClient
      .from("league_fcm_tokens")
      .select("token")
      .order("created_at", { ascending: true })
      .range(start, start + pageSize - 1);
    if (devicesError) {
      console.error("Could not load notification devices:", devicesError.message);
      return jsonResponse({ error: "Notification history was saved, but device tokens could not be loaded." }, 500, origin);
    }
    if (!devices?.length) break;

    for (const notification of deliveryNotifications || []) {
      for (let offset = 0; offset < devices.length; offset += 20) {
        const batch = devices.slice(offset, offset + 20);
        const results = await Promise.all(batch.map(async ({ token }) => {
          try {
            return {
              token,
              result: await sendFirebaseMessage(access, token, {
                title: notification.title,
                message: notification.message,
                link: notification.link,
                notificationId: notification.id,
                createdAt: notification.created_at,
              }),
            };
          } catch (error) {
            console.error("Firebase notification request failed:", error instanceof Error ? error.message : error);
            return { token, result: { ok: false, status: 0, errorCode: "NETWORK_ERROR" } };
          }
        }));

        for (const { token, result } of results) {
          if (result.ok) {
            sent += 1;
            devicesSent.add(token);
          } else if (result.errorCode === "UNREGISTERED") {
            const { error: deleteError } = await adminClient
              .from("league_fcm_tokens")
              .delete()
              .eq("token", token);
            if (deleteError) {
              console.error("Could not remove an expired FCM token:", deleteError.message);
              failed += 1;
            } else {
              removed += 1;
            }
          } else {
            console.error("Firebase notification was rejected:", result.status, result.errorCode);
            failed += 1;
          }
        }
      }
    }

    if (devices.length < pageSize) break;
  }

  return jsonResponse({
    created: insertedNotifications?.length || 0,
    sent,
    devicesSent: devicesSent.size,
    failed,
    removed,
  }, 200, origin);
});
