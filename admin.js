const { url, anonKey } = window.SUPABASE_CONFIG || {};
const statusElement = document.querySelector("#admin-status");
const loginForm = document.querySelector("#login-form");
const editorPanel = document.querySelector("#editor-panel");
const supabaseClient = url && anonKey && window.supabase?.createClient
  ? window.supabase.createClient(url, anonKey)
  : null;
const clubNames = window.masterLeagueData.clubs.map((club) => club.name);
const MAX_PLAYERS_PER_CLUB = 15;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const formationLines = {
  "4-3-3": [["GK"], ["LB", "LCB", "RCB", "RB"], ["LCM", "CM", "RCM"], ["LW", "ST", "RW"]],
  "4-4-2": [["GK"], ["LB", "LCB", "RCB", "RB"], ["LM", "LCM", "RCM", "RM"], ["LS", "RS"]],
  "3-5-2": [["GK"], ["LCB", "CB", "RCB"], ["LWB", "LCM", "CM", "RCM", "RWB"], ["LS", "RS"]],
};
let leaguePayload = null;
let currentUserId = null;
let publishedNewsIds = new Set();

function setStatus(message, kind = "error") {
  statusElement.textContent = message;
  statusElement.classList.toggle("is-success", kind === "success");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function clubOptions(selected) {
  return clubNames.map((club) =>
    `<option value="${escapeHtml(club)}" ${club === selected ? "selected" : ""}>${escapeHtml(club)}</option>`
  ).join("");
}

function field(label, key, value, type = "text", extra = "") {
  return `<label class="editor-field"><span class="field-label">${label}</span><input data-field="${key}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`;
}

function clubField(label, key, selected) {
  return `<label class="editor-field"><span class="field-label">${label}</span><select data-field="${key}">${clubOptions(selected)}</select></label>`;
}

function photoField(label, type, id, url, hasPhoto) {
  return `
    <div class="media-field">
      <span class="field-label">${label}</span>
      <div class="media-control">
        ${hasPhoto ? `<img class="media-preview" src="${escapeHtml(url)}" alt="">` : '<span class="media-placeholder">No photo</span>'}
        <label class="quiet-button media-upload-button">${hasPhoto ? "Replace photo" : "Upload photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" data-upload-${type}="${escapeHtml(id)}">
        </label>
      </div>
    </div>`;
}

function renderResults() {
  document.querySelector("#results-editor").innerHTML = leaguePayload.results.map((match, index) => `
    <div class="editor-row" data-result-row data-index="${index}">
      ${field("Week", "week", match.week, "number", 'min="1" max="99" step="1" required')}
      ${clubField("Home club", "home", match.home)}
      ${clubField("Away club", "away", match.away)}
      ${field("Home score", "homeScore", match.homeScore, "number", 'min="0" max="99" step="1" required')}
      ${field("Away score", "awayScore", match.awayScore, "number", 'min="0" max="99" step="1" required')}
      ${field("Match note", "note", match.note || "", "text", 'maxlength="120"')}
      <button class="remove-row" type="button" data-remove="result" aria-label="Remove match">Remove</button>
    </div>
  `).join("");
}

function renderPeople(kind) {
  const isAssists = kind === "assists";
  const list = isAssists ? leaguePayload.assists : leaguePayload.scorers;
  const container = document.querySelector(isAssists ? "#assists-editor" : "#scorers-editor");
  const countKey = isAssists ? "assists" : "goals";
  container.innerHTML = list.map((person) => `
    <div class="editor-row is-compact" data-person-row="${kind}">
      ${field("Player name", "name", person.name, "text", 'maxlength="60" required')}
      ${clubField("Club", "club", person.club)}
      ${field(isAssists ? "Assists" : "Goals", countKey, person[countKey], "number", 'min="1" max="999" step="1" required')}
      <button class="remove-row" type="button" data-remove="${kind}" aria-label="Remove player">Remove</button>
    </div>
  `).join("");
}

function renderRosters() {
  const container = document.querySelector("#rosters-editor");
  container.innerHTML = window.masterLeagueData.clubs.map((club, index) => {
    const players = leaguePayload.players.filter((player) => player.club === club.name);
    return `
      <section class="roster-editor-group" data-roster-group="${index}" aria-labelledby="roster-heading-${escapeHtml(club.initials)}">
        <div class="roster-editor-heading">
          <h4 id="roster-heading-${escapeHtml(club.initials)}">${escapeHtml(club.name)}</h4>
          <span class="roster-editor-count">${players.length} / ${MAX_PLAYERS_PER_CLUB} players</span>
          <button class="quiet-button roster-add-button" type="button" data-add-roster="${escapeHtml(club.name)}"
            ${players.length >= MAX_PLAYERS_PER_CLUB ? "disabled" : ""}>Add player</button>
        </div>
        <div class="roster-player-list">
          ${players.map((player) => `
            <div class="roster-player-row" data-roster-player data-id="${escapeHtml(player.id)}" data-club="${escapeHtml(club.name)}" data-photo="${escapeHtml(player.photo || "")}">
              <div class="roster-profile-fields">
                ${field("Player name", "playerName", player.name, "text", 'maxlength="60" required')}
                <label class="editor-field"><span class="field-label">Position</span>
                  <input data-field="position" type="text" value="${escapeHtml(player.position || "")}" maxlength="40" placeholder="e.g. Midfielder">
                </label>
                ${field("Appearances", "appearances", player.appearances || 0, "number", 'min="0" max="999" step="1" required')}
                ${photoField("Profile photo", "player", player.id, player.photo || "", Boolean(player.photo))}
              </div>
              <button class="remove-row" type="button" data-remove="roster-player" aria-label="Remove ${escapeHtml(player.name)} from ${escapeHtml(club.name)}">Remove player</button>
            </div>
          `).join("") || '<p class="roster-empty">No players added yet.</p>'}
        </div>
      </section>
    `;
  }).join("");
}

function renderClubPhotos() {
  document.querySelector("#club-photos-editor").innerHTML = window.masterLeagueData.clubs.map((club) => `
    <div class="club-photo-row" data-club-photo="${escapeHtml(club.name)}" data-photo="${escapeHtml(leaguePayload.clubPhotos[club.name] || "")}">
      <strong>${escapeHtml(club.name)}</strong>
      ${photoField("Team photo or crest", "club", club.name, leaguePayload.clubPhotos[club.name] || "", Boolean(leaguePayload.clubPhotos[club.name]))}
    </div>
  `).join("");
}

function renderTotwEditor() {
  const { formation, week, players } = leaguePayload.totw;
  document.querySelector("#totw-week").value = week || 1;
  document.querySelector("#totw-formation").value = formation;
  const rosterPlayers = leaguePayload.players;
  const options = (selectedId) => `
    <option value="">Choose a player</option>
    ${rosterPlayers.map((player) => `<option value="${escapeHtml(player.id)}" ${player.id === selectedId ? "selected" : ""}>${escapeHtml(player.name)} — ${escapeHtml(player.club)}</option>`).join("")}
  `;
  let index = 0;
  document.querySelector("#totw-slot-editor").innerHTML = formationLines[formation].map((line) => `
    <div class="totw-slot-row is-${line.length}">
      ${line.map((slot) => `
        <label class="editor-field">
          <span class="field-label">${escapeHtml(slot)}</span>
          <select data-totw-slot="${index}">${options(players[index++]?.playerId || "")}</select>
        </label>
      `).join("")}
    </div>
  `).join("");
  document.querySelectorAll("#totw-slot-editor select").forEach((select) => {
    select.disabled = rosterPlayers.length === 0;
  });
}

function renderNews() {
  document.querySelector("#news-editor").innerHTML = leaguePayload.news.map((item) => `
    <article class="news-editor-row" data-news-row data-id="${escapeHtml(item.id)}" data-photo="${escapeHtml(item.photo || "")}">
      <div class="news-fields">
        ${field("Headline", "newsTitle", item.title, "text", 'maxlength="100" required')}
        <label class="editor-field"><span class="field-label">Announcement</span>
          <textarea data-field="newsSummary" maxlength="500" required>${escapeHtml(item.summary)}</textarea>
        </label>
        ${photoField("News photo", "news", item.id, item.photo || "", Boolean(item.photo))}
      </div>
      <button class="remove-row" type="button" data-remove="news" aria-label="Remove news item">Remove news</button>
    </article>
  `).join("") || '<p class="roster-empty">No news items added yet.</p>';
}

function renderEditor() {
  renderResults();
  renderRosters();
  renderClubPhotos();
  renderTotwEditor();
  renderNews();
  renderPeople("scorers");
  renderPeople("assists");
}

function readRows() {
  const results = [...document.querySelectorAll("[data-result-row]")].map((row) => ({
    week: Number(row.querySelector('[data-field="week"]').value),
    home: row.querySelector('[data-field="home"]').value,
    away: row.querySelector('[data-field="away"]').value,
    homeScore: Number(row.querySelector('[data-field="homeScore"]').value),
    awayScore: Number(row.querySelector('[data-field="awayScore"]').value),
    note: row.querySelector('[data-field="note"]').value.trim(),
  }));
  const readPeople = (kind) => [...document.querySelectorAll(`[data-person-row="${kind}"]`)].map((row) => ({
    name: row.querySelector('[data-field="name"]').value.trim(),
    club: row.querySelector('[data-field="club"]').value,
    [kind === "assists" ? "assists" : "goals"]: Number(row.querySelector(`[data-field="${kind === "assists" ? "assists" : "goals"}"]`).value),
  }));
  const players = [...document.querySelectorAll("[data-roster-player]")].map((row) => ({
    id: row.dataset.id,
    name: row.querySelector('[data-field="playerName"]').value.trim(),
    club: row.dataset.club,
    position: row.querySelector('[data-field="position"]').value.trim(),
    appearances: Number(row.querySelector('[data-field="appearances"]').value),
    photo: row.dataset.photo || "",
  }));
  const clubPhotos = Object.fromEntries([...document.querySelectorAll("[data-club-photo]")].map((row) => [
    row.dataset.clubPhoto, row.dataset.photo || "",
  ]).filter(([, photo]) => photo));
  const news = [...document.querySelectorAll("[data-news-row]")].map((row) => ({
    id: row.dataset.id,
    title: row.querySelector('[data-field="newsTitle"]').value.trim(),
    summary: row.querySelector('[data-field="newsSummary"]').value.trim(),
    photo: row.dataset.photo || "",
  }));
  const formation = document.querySelector("#totw-formation").value;
  const week = Number(document.querySelector("#totw-week").value);
  const totwPlayers = [...document.querySelectorAll("[data-totw-slot]")].map((select) => ({
    slot: Number(select.dataset.totwSlot),
    playerId: select.value,
  }));
  return {
    results, scorers: readPeople("scorers"), assists: readPeople("assists"),
    players, clubPhotos,
    totw: { week, formation, players: totwPlayers.some((entry) => entry.playerId) ? totwPlayers : [] },
    news,
  };
}

function validatePayload(payload) {
  if (payload.results.some((match) =>
    !Number.isInteger(match.week) || match.week < 1 || match.week > 99
    || !Number.isInteger(match.homeScore) || match.homeScore < 0 || match.homeScore > 99
    || !Number.isInteger(match.awayScore) || match.awayScore < 0 || match.awayScore > 99
    || !clubNames.includes(match.home) || !clubNames.includes(match.away)
    || match.home === match.away)) {
    return "Check match weeks, scores, and make sure each match has two different clubs.";
  }
  for (const [kind, rows] of [["scorer", payload.scorers], ["assist", payload.assists]]) {
    const countKey = kind === "assist" ? "assists" : "goals";
    if (rows.some((person) =>
      !person.name || person.name.length > 60 || !clubNames.includes(person.club)
      || !Number.isInteger(person[countKey]) || person[countKey] < 1 || person[countKey] > 999)) {
      return `Check each ${kind} name, club, and positive total.`;
    }
    const identities = rows.map((person) => `${person.club.toLocaleLowerCase()}::${person.name.trim().toLocaleLowerCase()}`);
    if (new Set(identities).size !== identities.length) {
      return `Combine duplicate ${kind} records for the same player and club.`;
    }
  }
  if (!Array.isArray(payload.players)
    || payload.players.some((player) => !player || typeof player.name !== "string"
      || !player.name.trim() || player.name.trim().length > 60 || !clubNames.includes(player.club))) {
    return "Check that every roster player has a name and belongs to a listed club.";
  }
  const rosterCounts = new Map(clubNames.map((club) => [club, 0]));
  payload.players.forEach((player) => rosterCounts.set(player.club, rosterCounts.get(player.club) + 1));
  const fullRoster = [...rosterCounts].find(([, count]) => count > MAX_PLAYERS_PER_CLUB);
  if (fullRoster) return `${fullRoster[0]} can have up to ${MAX_PLAYERS_PER_CLUB} players. Remove an extra player before saving.`;
  if (payload.players.some((player) => !player.id || !Number.isInteger(player.appearances)
    || player.appearances < 0 || player.appearances > 999 || typeof player.position !== "string"
    || player.position.length > 40)) {
    return "Check each profile’s position and non-negative appearance total.";
  }
  if (!payload.totw || !formationLines[payload.totw.formation]
    || !Number.isInteger(payload.totw.week) || payload.totw.week < 1 || payload.totw.week > 99) {
    return "Choose a valid Team of the Week and formation.";
  }
  const selectedPlayers = payload.totw.players.map((entry) => entry.playerId).filter(Boolean);
  if (selectedPlayers.length && (selectedPlayers.length !== 11
    || new Set(selectedPlayers).size !== 11
    || selectedPlayers.some((id) => !payload.players.some((player) => player.id === id)))) {
    return "Choose eleven different roster players for Team of the Week, or clear the entire lineup.";
  }
  if (!payload.clubPhotos || Object.entries(payload.clubPhotos).some(([club, photo]) =>
    !clubNames.includes(club) || typeof photo !== "string")) {
    return "Check the uploaded club photos.";
  }
  if (!Array.isArray(payload.news) || payload.news.some((item) =>
    !item.id || !/^[A-Za-z0-9_-]{1,120}$/.test(item.id)
    || !item.title || item.title.length > 100 || !item.summary || item.summary.length > 500
    || typeof item.photo !== "string")) {
    return "Complete each news headline and announcement before saving.";
  }
  return "";
}

async function loadAdminData(user) {
  currentUserId = user.id;
  const { data: adminRecord, error: adminError } = await supabaseClient
    .from("league_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminError) throw adminError;
  if (!adminRecord) {
    await supabaseClient.auth.signOut();
    currentUserId = null;
    loginForm.hidden = false;
    editorPanel.hidden = true;
    throw new Error("This account is not on the approved league admin list.");
  }

  const { data, error } = await supabaseClient
    .from("league_data")
    .select("payload")
    .eq("id", "season-2026")
    .single();
  if (error) throw error;
  if (!data?.payload || !Array.isArray(data.payload.results) || !Array.isArray(data.payload.scorers) || !Array.isArray(data.payload.assists)) {
    throw new Error("The saved league data has an unexpected format.");
  }
  leaguePayload = data.payload;
  leaguePayload.players = Array.isArray(leaguePayload.players) ? leaguePayload.players : [];
  if (leaguePayload.players.some((player) => !player || typeof player.name !== "string" || !clubNames.includes(player.club))) {
    throw new Error("The saved club roster data has an unexpected format. Check the players in Supabase.");
  }
  leaguePayload.players = leaguePayload.players.map((player, index) => ({
    ...player,
    id: player.id || `legacy-${index}-${player.club}-${player.name}`.toLocaleLowerCase(),
    position: typeof player.position === "string" ? player.position : "",
    appearances: Number.isInteger(player.appearances) && player.appearances >= 0 ? player.appearances : 0,
    photo: typeof player.photo === "string" ? player.photo : "",
  }));
  if (leaguePayload.clubPhotos !== undefined
    && (!leaguePayload.clubPhotos || typeof leaguePayload.clubPhotos !== "object" || Array.isArray(leaguePayload.clubPhotos))) {
    throw new Error("The saved club photo data has an unexpected format.");
  }
  leaguePayload.clubPhotos = leaguePayload.clubPhotos && typeof leaguePayload.clubPhotos === "object"
    && !Array.isArray(leaguePayload.clubPhotos) ? leaguePayload.clubPhotos : {};
  if (leaguePayload.news !== undefined && (!Array.isArray(leaguePayload.news)
    || leaguePayload.news.some((item) => !item || typeof item.title !== "string"
      || typeof item.summary !== "string" || (item.photo !== undefined && typeof item.photo !== "string")))) {
    throw new Error("The saved league news data has an unexpected format.");
  }
  leaguePayload.news = Array.isArray(leaguePayload.news)
    ? leaguePayload.news.map((item, index) => ({
      ...item,
      id: item.id || `legacy-news-${index}`,
      title: typeof item.title === "string" ? item.title : "",
      summary: typeof item.summary === "string" ? item.summary : "",
      photo: typeof item.photo === "string" ? item.photo : "",
    }))
    : [];
  publishedNewsIds = new Set(leaguePayload.news.map((item) => item.id));
  leaguePayload.totw = leaguePayload.totw && typeof leaguePayload.totw === "object"
    ? leaguePayload.totw : { week: 1, formation: "4-3-3", players: [] };
  if (!Array.isArray(leaguePayload.totw.players)) leaguePayload.totw.players = [];
  if (!formationLines[leaguePayload.totw.formation]) leaguePayload.totw.formation = "4-3-3";
  if (!Number.isInteger(leaguePayload.totw.week) || leaguePayload.totw.week < 1 || leaguePayload.totw.week > 99) {
    leaguePayload.totw.week = 1;
  }
  renderEditor();
  document.querySelector("#signed-in-email").textContent = user.email || "APPROVED ADMIN";
  loginForm.hidden = true;
  editorPanel.hidden = false;
  setStatus("Signed in. Changes are not public until you save.", "success");
}

if (!supabaseClient) {
  setStatus("Admin sign-in is not configured yet. Follow SUPABASE_SETUP.md to connect this site.");
  loginForm.querySelector("button").disabled = true;
} else {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button");
    button.disabled = true;
    setStatus("");
    const values = new FormData(loginForm);
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: values.get("email"),
      password: values.get("password"),
    });
    button.disabled = false;
    if (error) {
      setStatus(`Sign-in failed: ${error.message}`);
      return;
    }
    try {
      await loadAdminData(data.user);
    } catch (loadError) {
      setStatus(loadError.message || "Could not verify admin access. Check the database setup.");
    }
  });

  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      setStatus(`Could not check your session: ${error.message}`);
      return;
    }
    if (data.session) {
      loadAdminData(data.session.user).catch((loadError) => {
        setStatus(loadError.message || "Could not load league data.");
      });
    }
  });

  document.querySelector("#sign-out").addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      setStatus(`Could not sign out: ${error.message}`);
      return;
    }
    currentUserId = null;
    editorPanel.hidden = true;
    loginForm.hidden = false;
    loginForm.reset();
    setStatus("You have signed out.", "success");
  });

  document.querySelector("#save-data").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const invalidInput = [...editorPanel.querySelectorAll("input")].find((input) => !input.checkValidity());
    if (invalidInput) {
      invalidInput.focus();
      setStatus("Complete every required field with a valid value before saving.");
      return;
    }
    const payload = readRows();
    const validationError = validatePayload(payload);
    if (validationError) {
      setStatus(validationError);
      return;
    }
    const hasChanges = JSON.stringify(payload) !== JSON.stringify(leaguePayload);
    const newPosts = payload.news
      .filter((item) => !publishedNewsIds.has(item.id))
      .map((item) => ({ id: item.id, title: item.title, message: item.summary }));
    button.disabled = true;
    setStatus(hasChanges ? "Publishing league changes…" : "Retrying post notifications…", "success");
    const { error } = hasChanges
      ? await supabaseClient
        .from("league_data")
        .update({ payload, updated_at: new Date().toISOString() })
        .eq("id", "season-2026")
      : { error: null };
    button.disabled = false;
    if (error) {
      setStatus(`Save failed: ${error.message}`);
      return;
    }
    leaguePayload = payload;
    if (!hasChanges && !newPosts.length) {
      setStatus("Everything is already published.", "success");
      return;
    }
    if (!newPosts.length) {
      publishedNewsIds = new Set(payload.news.map((item) => item.id));
      setStatus("League changes published.", "success");
      return;
    }

    setStatus(`Post${newPosts.length === 1 ? "" : "s"} published. Sending notifications…`, "success");
    const { data: notificationResult, error: notificationError } =
      await supabaseClient.functions.invoke("publish-notification", { body: { posts: newPosts } });
    if (notificationError) {
      setStatus(`Posts are live, but notification delivery failed: ${notificationError.message} Publish again to retry.`);
      return;
    }
    if (notificationResult?.failed > 0) {
      setStatus(`${newPosts.length} post notification(s) saved; ${notificationResult.failed} device alert(s) could not be delivered. Publish again to retry.`);
      return;
    }
    if (notificationResult?.sent === 0) {
      publishedNewsIds = new Set(payload.news.map((item) => item.id));
      setStatus(`${newPosts.length} post notification(s) saved. No devices have enabled push yet.`, "success");
      return;
    }
    publishedNewsIds = new Set(payload.news.map((item) => item.id));
    const devicesSent = notificationResult.devicesSent ?? notificationResult.sent;
    setStatus(`${newPosts.length} post notification(s) published and sent to ${devicesSent} device(s).`, "success");
  });

  document.querySelector("#editor-panel").addEventListener("change", async (event) => {
    const input = event.target.closest("[data-upload-player], [data-upload-club], [data-upload-news]");
    if (!input || !input.files?.length) return;
    const file = input.files[0];
    if (!imageTypes.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      input.value = "";
      setStatus("Choose a JPG, PNG or WebP image no larger than 5 MB.");
      return;
    }
    if (!supabaseClient.storage) {
      setStatus("Photo uploads are unavailable. Load the current Supabase client and setup SQL, then try again.");
      return;
    }

    leaguePayload = readRows();
    const playerId = input.dataset.uploadPlayer;
    const club = input.dataset.uploadClub;
    const newsId = input.dataset.uploadNews;
    const mediaType = playerId ? "player" : club ? "club" : "news";
    const folder = mediaType === "player" ? "players" : mediaType === "club" ? "clubs" : "news";
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const objectPath = `${folder}/${crypto.randomUUID()}.${extension}`;
    input.disabled = true;
    setStatus("Uploading image…", "success");
    try {
      const { data, error } = await supabaseClient.storage.from("league-media").upload(objectPath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data: publicData } = supabaseClient.storage.from("league-media").getPublicUrl(data.path);
      if (!publicData?.publicUrl) throw new Error("Supabase did not return a public image URL.");
      if (playerId) {
        const player = leaguePayload.players.find((item) => item.id === playerId);
        if (!player) throw new Error("The selected player profile is no longer available. Refresh the admin page.");
        player.photo = publicData.publicUrl;
      } else if (club) {
        leaguePayload.clubPhotos[club] = publicData.publicUrl;
      } else {
        const item = leaguePayload.news.find((entry) => entry.id === newsId);
        if (!item) throw new Error("The selected news item is no longer available. Refresh the admin page.");
        item.photo = publicData.publicUrl;
      }
      renderEditor();
      setStatus("Image uploaded. Publish changes to make it public.", "success");
    } catch (uploadError) {
      setStatus(`Photo upload failed: ${uploadError.message || "Check Supabase Storage and try again."}`);
    } finally {
      input.disabled = false;
    }
  });

  document.querySelector("#add-result").addEventListener("click", () => {
    leaguePayload = readRows();
    leaguePayload.results.push({ week: 1, home: clubNames[0], away: clubNames[1], homeScore: 0, awayScore: 0, note: "" });
    renderResults();
  });
  document.querySelector("#rosters-editor").addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-roster]");
    if (addButton) {
      leaguePayload = readRows();
      const club = addButton.dataset.addRoster;
      const rosterSize = leaguePayload.players.filter((player) => player.club === club).length;
      if (rosterSize >= MAX_PLAYERS_PER_CLUB) {
        setStatus(`${club} already has the maximum of ${MAX_PLAYERS_PER_CLUB} players.`);
        return;
      }
      leaguePayload.players.push({
        id: crypto.randomUUID(), name: "", club, position: "", appearances: 0, photo: "",
      });
      renderRosters();
      renderTotwEditor();
      const clubIndex = clubNames.indexOf(club);
      document.querySelector(`[data-roster-group="${clubIndex}"] .roster-player-row:last-child input`)?.focus();
      return;
    }

    const removeButton = event.target.closest('[data-remove="roster-player"]');
    if (!removeButton) return;
    event.stopPropagation();
    const row = removeButton.closest("[data-roster-player]");
    leaguePayload = readRows();
    const index = [...document.querySelectorAll("[data-roster-player]")].indexOf(row);
    const removedId = row.dataset.id;
    leaguePayload.players.splice(index, 1);
    leaguePayload.totw.players = leaguePayload.totw.players.map((entry) =>
      entry.playerId === removedId ? { ...entry, playerId: "" } : entry);
    renderRosters();
    renderTotwEditor();
  });
  document.querySelector("#rosters-editor").addEventListener("input", (event) => {
    const nameInput = event.target.closest('[data-field="playerName"]');
    if (!nameInput) return;
    const row = nameInput.closest("[data-roster-player]");
    const optionLabel = `${nameInput.value.trim() || "Unnamed player"} — ${row.dataset.club}`;
    document.querySelectorAll(`#totw-slot-editor option[value="${CSS.escape(row.dataset.id)}"]`)
      .forEach((option) => { option.textContent = optionLabel; });
  });
  document.querySelector("#totw-formation").addEventListener("change", () => {
    leaguePayload = readRows();
    renderTotwEditor();
  });
  document.querySelector("#totw-week").addEventListener("change", () => {
    leaguePayload = readRows();
  });
  document.querySelector("#add-news").addEventListener("click", () => {
    leaguePayload = readRows();
    leaguePayload.news.push({ id: crypto.randomUUID(), title: "", summary: "", photo: "" });
    renderNews();
    document.querySelector("#news-editor [data-field='newsTitle']:last-of-type")?.focus();
  });
  document.querySelector("#add-scorer").addEventListener("click", () => {
    leaguePayload = readRows();
    leaguePayload.scorers.push({ name: "", club: clubNames[0], goals: 1 });
    renderPeople("scorers");
  });
  document.querySelector("#add-assist").addEventListener("click", () => {
    leaguePayload = readRows();
    leaguePayload.assists.push({ name: "", club: clubNames[0], assists: 1 });
    renderPeople("assists");
  });
  document.querySelector("#editor-panel").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    const kind = button.dataset.remove;
    const row = button.closest(kind === "result" ? "[data-result-row]" : kind === "news"
      ? "[data-news-row]" : `[data-person-row="${kind}"]`);
    leaguePayload = readRows();
    if (kind === "news") {
      leaguePayload.news.splice([...document.querySelectorAll("[data-news-row]")].indexOf(row), 1);
      renderNews();
    } else if (kind === "result") {
      const index = [...document.querySelectorAll("[data-result-row]")].indexOf(row);
      leaguePayload.results.splice(index, 1);
      renderResults();
    } else {
      const rows = [...document.querySelectorAll(`[data-person-row="${kind}"]`)];
      const index = rows.indexOf(row);
      leaguePayload[kind].splice(index, 1);
      renderPeople(kind);
    }
  });
}
