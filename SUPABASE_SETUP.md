# Supabase setup

The public league pages stay static. Supabase stores the official match results, player profiles and rosters, scorer/assist totals, Team of the Week, club photos, news, notification history, and private Firebase Cloud Messaging (FCM) device tokens. Standings and club records are calculated from match scores (3 points for a win, 1 for a draw), then sorted by points, goal difference, goals scored, and club name. Row-level security lets anyone read league data, uploaded media, and published notification history, but only accounts explicitly listed as league admins can change records or upload images. Device tokens are accessible only to the Supabase Edge Functions.

## Connect the project

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase-setup.sql`](./supabase-setup.sql) as the `postgres` role. It creates the tables, applies row-level security and Storage policies, creates the private FCM token table and public-read notification history, configures notification realtime updates and the public-read `league-media` bucket with a 5 MB JPG/PNG/WebP limit, and inserts the current league data without overwriting an existing season row. If you already ran an earlier version, run the updated script again to enable photos and FCM notifications.
3. In Supabase Authentication settings, disable public sign-ups. Invite or create each admin account yourself.
4. Copy the invited user's UUID from Authentication and add that user to the allowlist in the SQL Editor:

   ```sql
   insert into public.league_admins (user_id)
   values ('PASTE-AUTH-USER-UUID-HERE')
   on conflict (user_id) do nothing;
   ```

5. In the project's API settings, copy the **Project URL** and the **publishable/anon key** into `supabase-config.js`:

   ```js
   window.SUPABASE_CONFIG = {
     url: "https://YOUR-PROJECT.supabase.co",
     anonKey: "YOUR-PUBLISHABLE-OR-ANON-KEY",
   };
   ```

   The publishable/anon key is intended for browser use and is protected by the SQL policies. **Never put a `service_role` key in this website.**

6. In Supabase Authentication URL settings, set the production website as the Site URL and add its HTTPS origin to the allowed redirect URLs.
7. Publish the complete `master-league-site` folder on an HTTPS static host. Both `index.html` and `admin.html` need `supabase-config.js`, `league-data.js`, and the shared `assets` folder beside them.

## Enable Firebase Cloud Messaging

The public site saves each published-post notification (title, message, timestamp, and post link) in Supabase. Visitors can read the saved history at any time and optionally enable push on each browser/device. When an admin publishes a new news item, the authenticated `publish-notification` Edge Function saves its notification and sends a data-only FCM alert to opted-in device tokens. The Firebase service-account key and Supabase service-role key stay server-side.

1. In the [Firebase Console](https://console.firebase.google.com/), create or select a Firebase project. Register a **Web app** in Project settings, then enable the **Firebase Cloud Messaging API (V1)** for the project.
2. In the web app's Cloud Messaging settings, generate a **Web Push certificate** (VAPID key pair). Copy the Firebase web-app values and the public VAPID key into `firebase-config.js`:

   ```js
   self.FIREBASE_CONFIG = {
     apiKey: "YOUR-FIREBASE-WEB-API-KEY",
     authDomain: "YOUR-PROJECT.firebaseapp.com",
     projectId: "YOUR-FIREBASE-PROJECT-ID",
     messagingSenderId: "YOUR-SENDER-ID",
     appId: "YOUR-WEB-APP-ID",
     vapidKey: "YOUR-PUBLIC-WEB-PUSH-CERTIFICATE-KEY",
   };
   ```

   These Firebase web settings and the VAPID **public** key are used by browsers and the service worker. They are not the service-account credentials. Restrict the Firebase API key to your website's HTTP referrers and only the Firebase APIs the site needs.
3. Create a dedicated Google service account for server-side FCM delivery. Grant it only the **Firebase Cloud Messaging API Admin** role (`roles/firebasecloudmessaging.admin`) in the Firebase project's Google Cloud IAM. Create a JSON key, then add only its `project_id`, `client_email`, and `private_key` as Supabase Edge Function secrets. Never commit the JSON key or place its private key in `firebase-config.js`.
4. In Supabase Dashboard → **Edge Functions → Secrets**, set:
   - `FIREBASE_PROJECT_ID`: `project_id` from the service account.
   - `FIREBASE_CLIENT_EMAIL`: `client_email` from the service account.
   - `FIREBASE_PRIVATE_KEY`: `private_key` from the service account (keep the full PEM, including the `BEGIN`/`END` lines; Supabase can store the embedded newlines).
   - `ALLOWED_ORIGINS`: comma-separated exact origins, e.g. `https://your-league.example,http://localhost:8000`. Include the deployed HTTPS origin and any local origin used for testing. Do not include paths or trailing slashes.

   Supabase supplies the Edge Functions with `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`), and `SUPABASE_SERVICE_ROLE_KEY`. Never add the service-role key to a website file.
5. Run the updated [`supabase-setup.sql`](./supabase-setup.sql) as `postgres` to create the notification-history and private FCM-token tables, grants, RLS policies, and Realtime publication.
6. Install and authenticate the Supabase CLI, then deploy both functions from the project folder:

   ```text
   supabase functions deploy manage-fcm-token --project-ref YOUR-PROJECT-REF --no-verify-jwt
   supabase functions deploy publish-notification --project-ref YOUR-PROJECT-REF
   ```

   The token-management function is public because visitors do not need accounts; it validates the request and accepts only configured website origins. The publish function keeps JWT verification enabled and independently checks the caller against `league_admins`.
7. Publish the site over HTTPS. Visitors choose **Enable push** and allow the browser permission prompt. They opt in separately on each browser/device. Web push works in browsers supported by Firebase Messaging; iPhone/iPad users need a supported iOS version and may need to add the site to their Home Screen. Browser or operating-system settings can still suppress alerts.

The push toggle stays unavailable until the Firebase web app config, Supabase setup, Edge Function deployment, and HTTPS hosting are ready. Notification history remains available on the site independently of whether a visitor enables push. Delivery is best-effort through FCM; offline devices may receive alerts later according to browser and FCM behavior. On local development, add the exact `http://localhost` origin and port to `ALLOWED_ORIGINS`.

### Security notes

- Firebase web config and the VAPID public key are public client settings, not secrets. Restrict the Firebase API key to your production and local development HTTP referrers.
- Keep the Google service-account private key and Supabase service-role key only in Edge Function secrets. Use a dedicated least-privilege service account, rotate its key if exposed, and never commit credential JSON.
- `league_fcm_tokens` has row-level security and no client-role grants. Public visitors can read notification history, but only the authenticated, allowlisted publishing function can write it.
- `manage-fcm-token` must allow anonymous browser requests so visitors can opt in. Its origin allowlist and input checks are not authentication against direct server requests; configure rate limits and consider Firebase App Check verification before accepting traffic at scale.
- The publishing function verifies the Supabase user and the `league_admins` allowlist. Keep public sign-ups disabled and remove admin access promptly when it is no longer needed.

## Admin workflow

Open `/admin.html` and sign in with an invited and allowlisted account. Admins can manage rosters (up to 15 players per club), profile positions and appearances, select the 11-player Team of the Week in a 4-3-3, 4-4-2, or 3-5-2 formation, and publish news. Player goals and assists use the official scorer and assist lists; G/A is calculated as goals plus assists. Club wins, draws, losses, goals for/against, and points are calculated from results.

Upload JPG, PNG, or WebP photos up to 5 MB for players, clubs, or news. Uploading requires the `league-media` bucket and Storage policies created by the updated setup script. An upload places the image in Storage; choose **Publish changes** afterward to publish its reference in the league data payload. Public visitors can view images but cannot upload them.

Choose **Publish changes** to publish text and lineup changes to the public dashboard. A newly added post gets a persistent notification containing its headline, summary, publish time, and link. Push alerts go to opted-in devices after the database publish succeeds; an FCM delivery error does not undo the published post. Older payloads without player profile, club photo, Team of the Week, or news fields load with empty defaults and gain those fields on the next save. Use **Sign out** on shared devices.

The static admin page itself can be requested like any other website file; the login form does not claim to hide that HTML. Authentication plus database row-level security protects the private admin capability and all writes. If the hosting provider supports access rules, `/admin.html` can additionally be restricted at the edge.

## Local preview

The public site works with the bundled data before Supabase is configured. To test sign-in or live updates locally, configure the project values above and serve the folder from `http://localhost` (not by opening the files directly). A configured project that cannot be reached displays an error and retains the bundled view instead of pretending the live update succeeded.
