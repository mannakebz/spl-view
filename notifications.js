const notificationButton = document.querySelector("#notification-toggle");
const notificationStatus = document.querySelector("#notification-status");
const notificationList = document.querySelector("#notification-list");
const firebaseConfig = window.FIREBASE_CONFIG || {};
const notificationClient = window.masterLeagueSupabaseClient || null;
const firebaseConfigFields = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId", "vapidKey"];
const firebaseConfigured = firebaseConfigFields.every((field) =>
  typeof firebaseConfig[field] === "string" && firebaseConfig[field].trim()
);
const loadMoreButton = document.querySelector("#load-more-notifications");
const notificationPageSize = 25;
let notificationHistory = [];
let messaging = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function setNotificationStatus(message) {
  notificationStatus.textContent = message;
  notificationStatus.hidden = !message;
}

function setNotificationsEnabled(enabled) {
  notificationButton.setAttribute("aria-checked", String(enabled));
  notificationButton.querySelector(".notification-toggle-label").textContent =
    enabled ? "Push enabled" : "Enable push";
}

function isBrowserPushSupported() {
  return window.isSecureContext
    && "Notification" in window
    && "serviceWorker" in navigator
    && Boolean(messaging);
}

function renderNotifications(notifications) {
  if (!notifications.length) {
    notificationList.innerHTML = '<p class="public-empty">No notifications yet. Published league posts will appear here.</p>';
    return;
  }

  notificationList.innerHTML = notifications.map((notification) => {
    let localLink = "#news";
    try {
      const target = new URL(notification.link, window.location.origin);
      if (target.origin === window.location.origin) {
        localLink = `${target.pathname}${target.search}${target.hash}`;
      }
    } catch {
      localLink = "#news";
    }
    const timestamp = new Date(notification.created_at);
    const dateLabel = Number.isNaN(timestamp.getTime())
      ? "Recently published"
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
    return `
      <article class="notification-item">
        <div>
          <h3>${escapeHtml(notification.title)}</h3>
          <p>${escapeHtml(notification.message)}</p>
          <a href="${escapeHtml(localLink)}">Read post</a>
        </div>
        <time datetime="${escapeHtml(notification.created_at)}">${escapeHtml(dateLabel)}</time>
      </article>`;
  }).join("");
}

function notificationHistoryError(error, operation) {
  if (error?.code === "PGRST205" || error?.message?.includes("public.league_notifications")) {
    return "Notification history is not set up yet. Run the updated supabase-setup.sql as postgres.";
  }
  return `Could not ${operation} notification history: ${error?.message || "Check the Supabase connection."}`;
}

async function loadNotifications(reset = false) {
  if (!notificationClient) {
    notificationList.innerHTML = '<p class="public-empty">Notification history is unavailable until Supabase is configured.</p>';
    return;
  }

  if (reset) notificationHistory = [];
  const { data, error } = await notificationClient
    .from("league_notifications")
    .select("id, title, message, link, created_at")
    .order("created_at", { ascending: false })
    .range(notificationHistory.length, notificationHistory.length + notificationPageSize - 1);
  if (error) throw error;
  notificationHistory = [...notificationHistory, ...(data || [])];
  loadMoreButton.hidden = (data || []).length < notificationPageSize;
  renderNotifications(notificationHistory);
}

async function manageToken(action, token) {
  if (!notificationClient) throw new Error("Notification storage is not configured.");
  const { error } = await notificationClient.functions.invoke("manage-fcm-token", {
    body: { action, token },
  });
  if (error) throw new Error(error.message || `Could not ${action} this device.`);
}

async function getServiceWorkerRegistration() {
  return navigator.serviceWorker.register("./firebase-messaging-sw.js", { scope: "./" });
}

async function updateNotificationControl() {
  const configured = firebaseConfigured && Boolean(notificationClient);
  const supported = isBrowserPushSupported();
  const enabled = localStorage.getItem("master-league-notifications") === "enabled"
    && "Notification" in window
    && Notification.permission === "granted";
  setNotificationsEnabled(enabled);

  if (!configured) {
    notificationButton.disabled = true;
    setNotificationStatus("Push is not configured yet. Add the Firebase web app settings and finish the Supabase setup.");
  } else if (!supported) {
    notificationButton.disabled = true;
    setNotificationStatus("Push notifications need a supported browser and a secure HTTPS connection.");
  } else if (Notification.permission === "denied" && !enabled) {
    notificationButton.disabled = true;
    setNotificationStatus("Push is blocked in this browser. Allow notifications in site settings, then try again.");
  } else {
    notificationButton.disabled = false;
  }
}

async function enableNotifications() {
  if (!firebaseConfigured || !notificationClient || !messaging) {
    throw new Error("Push is not configured yet. Complete the Firebase and Supabase setup first.");
  }
  if (!isBrowserPushSupported()) {
    throw new Error("Push notifications need a supported browser and a secure HTTPS connection.");
  }

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error(permission === "denied"
        ? "Notifications were blocked. Allow them in your browser’s site settings and try again."
        : "Notification permission was not granted.");
    }
  }

  const serviceWorkerRegistration = await getServiceWorkerRegistration();
  const token = await messaging.getToken({
    vapidKey: firebaseConfig.vapidKey,
    serviceWorkerRegistration,
  });
  if (!token) throw new Error("Firebase did not return a device token. Check the Firebase messaging setup.");

  await manageToken("subscribe", token);
  localStorage.setItem("master-league-notifications", "enabled");
  setNotificationsEnabled(true);
  setNotificationStatus("Push is on for this device. New league posts will appear here and as browser alerts.");
}

async function disableNotifications() {
  const serviceWorkerRegistration = await navigator.serviceWorker.getRegistration("./");
  let token = "";
  if (serviceWorkerRegistration && Notification.permission === "granted") {
    token = await messaging.getToken({
      vapidKey: firebaseConfig.vapidKey,
      serviceWorkerRegistration,
    });
  }

  if (token) await manageToken("unsubscribe", token);
  if (messaging) await messaging.deleteToken();
  localStorage.setItem("master-league-notifications", "disabled");
  setNotificationsEnabled(false);
  setNotificationStatus("Push is off on this device. Your saved notification history remains available.");
}

async function refreshSavedToken() {
  if (localStorage.getItem("master-league-notifications") !== "enabled"
    || Notification.permission !== "granted") return;
  const serviceWorkerRegistration = await getServiceWorkerRegistration();
  const token = await messaging.getToken({
    vapidKey: firebaseConfig.vapidKey,
    serviceWorkerRegistration,
  });
  if (token) await manageToken("subscribe", token);
}

notificationButton.addEventListener("click", async () => {
  const enabled = notificationButton.getAttribute("aria-checked") === "true";
  notificationButton.disabled = true;
  setNotificationStatus(enabled ? "Turning push off…" : "Requesting notification permission…");

  try {
    if (enabled) await disableNotifications();
    else await enableNotifications();
  } catch (error) {
    setNotificationStatus(error.message || "Notification settings could not be updated.");
  } finally {
    try {
      await updateNotificationControl();
    } catch (error) {
      notificationButton.disabled = true;
      setNotificationStatus(`Could not refresh notification settings: ${error.message}`);
    }
  }
});

loadMoreButton.addEventListener("click", async () => {
  loadMoreButton.disabled = true;
  loadMoreButton.textContent = "Loading notifications…";
  try {
    await loadNotifications();
  } catch (error) {
    setNotificationStatus(notificationHistoryError(error, "load older"));
  } finally {
    loadMoreButton.disabled = false;
    loadMoreButton.textContent = "Load older notifications";
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === "master-league-notifications") {
    updateNotificationControl().catch((error) => {
      notificationButton.disabled = true;
      setNotificationStatus(`Could not refresh notification settings: ${error.message}`);
    });
  }
});

if (notificationClient) {
  notificationClient.channel("league-notifications")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "league_notifications",
    }, () => {
      loadNotifications(true).catch((error) => {
        notificationList.innerHTML = `<p class="public-empty">${escapeHtml(notificationHistoryError(error, "refresh"))}</p>`;
      });
    })
    .subscribe();
}

loadNotifications().catch((error) => {
  notificationList.innerHTML = `<p class="public-empty">${escapeHtml(notificationHistoryError(error, "load"))}</p>`;
});

if (firebaseConfigured && window.firebase?.messaging) {
  if (!window.firebase.apps.length) {
    const { vapidKey: _vapidKey, ...firebaseAppConfig } = firebaseConfig;
    window.firebase.initializeApp(firebaseAppConfig);
  }
  try {
    messaging = window.firebase.messaging();
    messaging.onMessage((payload) => {
      const data = payload.data || {};
      loadNotifications(true).catch((error) => {
        notificationList.innerHTML = `<p class="public-empty">${escapeHtml(notificationHistoryError(error, "refresh"))}</p>`;
      });
      if (Notification.permission === "granted") {
        try {
          const alert = new Notification(data.title || "Master League update", {
            body: data.message || "A new league post is ready.",
            icon: "./assets/master-league-logo.png",
            data: { link: data.link || "./index.html#notifications" },
          });
          alert.addEventListener("click", () => {
            window.location.href = alert.data.link;
          }, { once: true });
        } catch (error) {
          setNotificationStatus(`The browser could not display this alert: ${error.message}`);
        }
      }
    });
  } catch (error) {
    setNotificationStatus(`Firebase Messaging could not start: ${error.message}`);
  }
}

async function initializeNotifications() {
  if (messaging && await window.firebase.messaging.isSupported()) {
    await updateNotificationControl();
    await refreshSavedToken();
  } else {
    await updateNotificationControl();
  }
}

initializeNotifications().catch((error) => {
  notificationButton.disabled = true;
  setNotificationStatus(`Could not initialize push notifications: ${error.message}`);
});
