export type FirebaseAccess = {
  projectId: string;
  accessToken: string;
};

let cachedAccessToken = "";
let cachedAccessExpiresAt = 0;

function encodeBase64Url(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function readFirebaseSecrets() {
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");

  if (!projectId || !/^[a-z0-9-]+$/.test(projectId) || !clientEmail || !privateKey) {
    throw new Error("Firebase service-account secrets are not configured.");
  }
  return { projectId, clientEmail, privateKey };
}

export async function getFirebaseAccess(): Promise<FirebaseAccess> {
  const { projectId, clientEmail, privateKey } = readFirebaseSecrets();
  if (cachedAccessToken && Date.now() < cachedAccessExpiresAt - 60_000) {
    return { projectId, accessToken: cachedAccessToken };
  }

  const pem = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const issuedAt = Math.floor(Date.now() / 1000);
  const assertionHeader = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const assertionClaims = encodeBase64Url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const signingInput = `${assertionHeader}.${assertionClaims}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const tokenBody: unknown = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenBody || typeof tokenBody !== "object"
    || !("access_token" in tokenBody) || typeof tokenBody.access_token !== "string") {
    console.error("Firebase OAuth token exchange failed:", tokenResponse.status);
    throw new Error("Could not authenticate with Firebase. Check the service-account configuration.");
  }

  cachedAccessToken = tokenBody.access_token;
  const expiresIn = "expires_in" in tokenBody && typeof tokenBody.expires_in === "number"
    ? tokenBody.expires_in
    : 3600;
  cachedAccessExpiresAt = Date.now() + expiresIn * 1000;
  return { projectId, accessToken: cachedAccessToken };
}

export async function sendFirebaseMessage(
  access: FirebaseAccess,
  token: string,
  data: Record<string, string>,
): Promise<{ ok: boolean; status: number; errorCode?: string }> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(access.projectId)}/messages:send`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access.accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({ message: { token, data } }),
    },
  );

  if (response.ok) return { ok: true, status: response.status };
  let errorCode = "";
  try {
    const body = await response.json();
    errorCode = typeof body?.error?.status === "string" ? body.error.status : "";
  } catch {
    errorCode = "";
  }
  return { ok: false, status: response.status, errorCode };
}
