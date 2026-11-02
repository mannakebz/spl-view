let clubs = window.masterLeagueData.clubs;
let results = window.masterLeagueData.results;
let topScorers = window.masterLeagueData.scorers;
let assists = window.masterLeagueData.assists;
let players = window.masterLeagueData.players || [];
let clubPhotos = window.masterLeagueData.clubPhotos || {};
let totw = window.masterLeagueData.totw || { week: 0, formation: "4-3-3", players: [] };
let news = window.masterLeagueData.news || [];
const MAX_PLAYERS_PER_CLUB = 15;
const supabaseConfig = window.SUPABASE_CONFIG || {};
let supabaseClient = supabaseConfig.url && supabaseConfig.anonKey && window.supabase?.createClient
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
window.masterLeagueSupabaseClient = supabaseClient;
const formationLines = {
  "4-3-3": [["GK"], ["LB", "LCB", "RCB", "RB"], ["LCM", "CM", "RCM"], ["LW", "ST", "RW"]],
  "4-4-2": [["GK"], ["LB", "LCB", "RCB", "RB"], ["LM", "LCM", "RCM", "RM"], ["LS", "RS"]],
  "3-5-2": [["GK"], ["LCB", "CB", "RCB"], ["LWB", "LCM", "CM", "RCM", "RWB"], ["LS", "RS"]],
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function calculateStandings() {
  const table = new Map(clubs.map((club) => [club.name, {
    team: club.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0,
  }]));

  results.forEach((match) => {
    const home = table.get(match.home);
    const away = table.get(match.away);
    if (!home || !away) return;
    home.p += 1;
    away.p += 1;
    home.gf += match.homeScore;
    home.ga += match.awayScore;
    away.gf += match.awayScore;
    away.ga += match.homeScore;
    if (match.homeScore > match.awayScore) {
      home.w += 1;
      home.pts += 3;
      away.l += 1;
    } else if (match.homeScore < match.awayScore) {
      away.w += 1;
      away.pts += 3;
      home.l += 1;
    } else {
      home.d += 1;
      away.d += 1;
      home.pts += 1;
      away.pts += 1;
    }
  });

  return [...table.values()].sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.team.localeCompare(b.team));
}

const clubByName = new Map(clubs.map((club) => [club.name, club]));
const crest = (name, extraClass = "") => {
  const club = clubByName.get(name);
  const photo = club.logo;
  if (photo) {
    return `<span class="club-crest has-logo ${extraClass}" style="--team-color:${club.color}" aria-hidden="true"><img class="club-crest-image" src="${escapeHtml(photo)}" alt=""></span>`;
  }
  return `<span class="club-crest ${extraClass}" style="--team-color:${club.color}" aria-hidden="true">${club.initials}</span>`;
};

function renderFixtures(mode) {
  const list = document.querySelector("#fixture-list");
  const selectedWeek = mode === "all" ? null : Number(mode.slice(4));
  const selectedResults = selectedWeek === null ? results : results.filter((match) => match.week === selectedWeek);
  list.innerHTML = selectedResults.map((match) => `
    <article class="fixture-card">
      <div class="fixture-top">
        <span>WEEK ${String(match.week).padStart(2, "0")}</span>
        <span class="fixture-status is-final">FULL TIME</span>
      </div>
      <div class="fixture-teams">
        <div class="fixture-team">
          <span class="club-label">${crest(match.home)}${escapeHtml(match.home)}</span>
          <span class="fixture-score">${match.homeScore}</span>
        </div>
        <div class="fixture-team">
          <span class="club-label">${crest(match.away)}${escapeHtml(match.away)}</span>
          <span class="fixture-score">${match.awayScore}</span>
        </div>
      </div>
      <div class="fixture-bottom"><span>MASTER LEAGUE</span>${match.note ? `<span class="match-note">${escapeHtml(match.note)}</span>` : ""}</div>
    </article>
  `).join("");
}

function renderFixtureFilters(selectedMode = "all") {
  const control = document.querySelector(".segmented-control");
  const weeks = [...new Set(results.map((match) => Number(match.week)))].sort((a, b) => a - b);
  const modes = [{ value: "all", label: "All" }, ...weeks.map((week) => ({
    value: `week${week}`,
    label: `Week ${String(week).padStart(2, "0")}`,
  }))];
  const selected = modes.some((mode) => mode.value === selectedMode) ? selectedMode : "all";
  control.innerHTML = modes.map((mode) => `
    <button class="segment-button ${mode.value === selected ? "is-selected" : ""}" type="button"
      data-fixture-mode="${mode.value}" aria-pressed="${mode.value === selected}">${mode.label}</button>
  `).join("");
  return selected;
}

function renderStandings() {
  const latestWeek = results.reduce((week, match) => Math.max(week, Number(match.week) || 0), 0);
  const rows = calculateStandings().map((team, index) => {
    const goalDifference = team.gf - team.ga;
    return `<tr class="${index === 0 ? "leader-row" : ""}">
      <td class="position">${String(index + 1).padStart(2, "0")}</td>
      <td class="team-cell"><span class="table-team">${crest(team.team)}${escapeHtml(team.team)}</span></td>
      <td>${team.p}</td><td>${team.w}</td><td>${team.d}</td><td>${team.l}</td>
      <td>${team.gf}:${team.ga}</td><td>${goalDifference > 0 ? "+" : ""}${goalDifference}</td>
      <td class="points">${team.pts}</td>
    </tr>`;
  }).join("");

  document.querySelector("#table-content").innerHTML = `
    <table class="league-table">
      <caption class="sr-only">Master League standings after Week ${String(latestWeek).padStart(2, "0")}</caption>
      <thead><tr><th scope="col">Pos</th><th scope="col">Club</th><th scope="col">P</th><th scope="col">W</th><th scope="col">D</th><th scope="col">L</th><th scope="col">GF:GA</th><th scope="col">GD</th><th scope="col">Pts</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  document.querySelector(".table-footnote").innerHTML =
    `<span class="legend-dot" aria-hidden="true"></span> After Week ${String(latestWeek).padStart(2, "0")}`;
}

function renderScorers() {
  const rankedScorers = [...topScorers].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
  document.querySelector("#table-content").innerHTML = `
    <div class="scorer-list" role="list" aria-label="Top goal scorers">
      ${rankedScorers.map((player, index) => `
        <div class="scorer-row" role="listitem">
          <span class="scorer-rank">${String(index + 1).padStart(2, "0")}</span>
          <span class="club-label">${crest(player.club)}<span><span class="scorer-name">${escapeHtml(player.name)}</span><br><span class="scorer-club">${escapeHtml(player.club)}</span></span></span>
          <span class="scorer-club">GOALS</span>
          <span class="scorer-goals">${player.goals}</span>
        </div>
      `).join("")}
    </div>`;
}

function renderAssists() {
  const rankedAssists = [...assists].sort((a, b) => b.assists - a.assists || a.name.localeCompare(b.name));
  if (rankedAssists.length) {
    document.querySelector("#table-content").innerHTML = `
      <div class="scorer-list" role="list" aria-label="Top assisters">
        ${rankedAssists.map((player, index) => `
          <div class="scorer-row" role="listitem">
            <span class="scorer-rank">${String(index + 1).padStart(2, "0")}</span>
            <span class="club-label">${crest(player.club)}<span><span class="scorer-name">${escapeHtml(player.name)}</span><br><span class="scorer-club">${escapeHtml(player.club)}</span></span></span>
            <span class="scorer-club">ASSISTS</span>
            <span class="scorer-goals">${player.assists}</span>
          </div>
        `).join("")}
      </div>`;
    return;
  }
  document.querySelector("#table-content").innerHTML = `
    <div class="assists-empty">
      <span class="assists-zero">00</span>
      <div><strong>No official assists recorded yet.</strong><p>Top assisters will appear once assist totals are confirmed.</p></div>
    </div>`;
}

function playerKey(player) {
  return `${player.club.toLocaleLowerCase()}::${player.name.trim().toLocaleLowerCase()}`;
}

function playerStatistics() {
  const statistics = new Map();
  const ensurePlayer = (person) => {
    const key = playerKey(person);
    if (!statistics.has(key)) statistics.set(key, { goals: 0, assists: 0 });
    return statistics.get(key);
  };
  topScorers.forEach((person) => { ensurePlayer(person).goals += Number(person.goals) || 0; });
  assists.forEach((person) => { ensurePlayer(person).assists += Number(person.assists) || 0; });
  return statistics;
}

function renderGoalContributions() {
  const statistics = playerStatistics();
  const playersWithStats = [...statistics.entries()].map(([key, stats]) => {
    const separator = key.indexOf("::");
    const club = clubs.find((item) => item.name.toLocaleLowerCase() === key.slice(0, separator));
    const name = [...topScorers, ...assists].find((person) => playerKey(person) === key)?.name || "";
    return { name, club: club?.name || "", ...stats, total: stats.goals + stats.assists };
  }).sort((a, b) => b.total - a.total || b.goals - a.goals || a.name.localeCompare(b.name));
  if (!playersWithStats.length) {
    document.querySelector("#table-content").innerHTML = `
      <div class="assists-empty"><span class="assists-zero">00</span>
        <div><strong>No goal contributions recorded yet.</strong><p>G/A totals combine confirmed goals and assists.</p></div>
      </div>`;
    return;
  }
  document.querySelector("#table-content").innerHTML = `
    <div class="scorer-list contribution-list" role="list" aria-label="Player goal contributions">
      ${playersWithStats.map((player, index) => `
        <div class="scorer-row contribution-row" role="listitem">
          <span class="scorer-rank">${String(index + 1).padStart(2, "0")}</span>
          <span class="club-label">${crest(player.club)}<span><span class="scorer-name">${escapeHtml(player.name)}</span><br><span class="scorer-club">${escapeHtml(player.club)}</span></span></span>
          <span class="contribution-stat"><span>G</span><strong>${player.goals}</strong></span>
          <span class="contribution-stat"><span>A</span><strong>${player.assists}</strong></span>
          <span class="contribution-total"><span>G/A</span><strong>${player.total}</strong></span>
        </div>
      `).join("")}
    </div>`;
}

function renderClubs() {
  const teamStats = new Map(calculateStandings().map((team) => [team.team, team]));
  document.querySelector("#club-list").innerHTML = clubs.map((club, index) => {
    const roster = players.filter((player) => player.club === club.name);
    const stats = teamStats.get(club.name);
    return `
      <article class="club-card ${clubPhotos[club.name] || club.logo ? "club-logo-card" : ""}" data-initials="${club.initials}" style="--team-color:${club.color};--card-index:${index}">
        <div class="club-card-top">${crest(club.name)}<span class="club-city">${escapeHtml(club.city)}</span></div>
        <span class="club-name">${escapeHtml(club.name)}</span>
        ${clubPhotos[club.name] ? `<img class="club-photo-banner" src="${escapeHtml(clubPhotos[club.name])}" alt="">` : ""}
        <div class="club-season-stats" aria-label="${escapeHtml(club.name)} season statistics">
          <span><strong>${stats.p}</strong> P</span><span><strong>${stats.w}</strong> W</span>
          <span><strong>${stats.d}</strong> D</span><span><strong>${stats.l}</strong> L</span>
          <span><strong>${stats.gf}:${stats.ga}</strong> GF:GA</span><span><strong>${stats.pts}</strong> PTS</span>
        </div>
        <details class="club-roster">
          <summary>
            <span>${roster.length ? "Squad roster" : "Roster not added"}</span>
            <span class="club-roster-count">${roster.length} / ${MAX_PLAYERS_PER_CLUB}</span>
          </summary>
          ${roster.length
            ? `<ol>${roster.map((player) => `<li>${escapeHtml(player.name)}</li>`).join("")}</ol>`
            : '<p class="club-roster-empty">No players listed yet.</p>'}
        </details>
      </article>
    `;
  }).join("");
}

function renderPlayerProfiles() {
  const stats = playerStatistics();
  const container = document.querySelector("#player-profile-grid");
  if (!players.length) {
    container.innerHTML = '<p class="public-empty">Player profiles will appear when club rosters are added by an admin.</p>';
    return;
  }
  container.innerHTML = players.map((player) => {
    const playerStats = stats.get(playerKey(player)) || { goals: 0, assists: 0 };
    const photo = player.photo || "";
    return `
      <article class="player-profile">
        <div class="profile-portrait">
          ${photo
            ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(player.name)}">`
            : `<span aria-hidden="true">${escapeHtml(player.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase())}</span>`}
        </div>
        <div class="profile-copy">
          <span class="profile-club">${crest(player.club)}${escapeHtml(player.club)}</span>
          <h3>${escapeHtml(player.name)}</h3>
          <p>${escapeHtml(player.position || "Position not set")}</p>
        </div>
        <dl class="profile-stat-line">
          <div><dt>Apps</dt><dd>${Number(player.appearances) || 0}</dd></div>
          <div><dt>Goals</dt><dd>${playerStats.goals}</dd></div>
          <div><dt>Assists</dt><dd>${playerStats.assists}</dd></div>
          <div><dt>G/A</dt><dd>${playerStats.goals + playerStats.assists}</dd></div>
        </dl>
      </article>`;
  }).join("");
}

function renderTeamOfWeek() {
  const content = document.querySelector("#totw-content");
  const lines = formationLines[totw.formation];
  const lineup = Array.isArray(totw.players) ? totw.players : [];
  const playerById = new Map(players.map((player) => [player.id, player]));
  if (!lines || lineup.length !== 11 || lineup.some((entry) => !playerById.has(entry.playerId))
    || new Set(lineup.map((entry) => entry.playerId)).size !== 11) {
    document.querySelector("#totw-formation").textContent = "";
    document.querySelector("#totw-subtitle").textContent = "The weekly XI selected by league admins.";
    content.innerHTML = '<p class="public-empty">This week’s lineup has not been selected yet.</p>';
    return;
  }
  document.querySelector("#totw-formation").textContent = totw.formation;
  document.querySelector("#totw-subtitle").textContent = `Week ${String(totw.week).padStart(2, "0")} · Selected by league admins`;
  let index = 0;
  content.innerHTML = `
    <div class="totw-pitch" aria-label="Team of the week formation ${escapeHtml(totw.formation)}">
      ${lines.map((line) => `
        <div class="totw-line">
          ${line.map((slot) => {
            const player = playerById.get(lineup[index++]?.playerId);
            return `<div class="totw-player">
              <span class="totw-player-photo">${player.photo
                ? `<img src="${escapeHtml(player.photo)}" alt="">`
                : escapeHtml(player.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase())}</span>
              <strong>${escapeHtml(player.name)}</strong>
              <span>${escapeHtml(slot)}</span>
            </div>`;
          }).join("")}
        </div>`).join("")}
    </div>`;
}

function renderNews() {
  const container = document.querySelector("#news-grid");
  if (!news.length) {
    container.innerHTML = '<p class="public-empty">No league news published yet.</p>';
    return;
  }
  container.innerHTML = news.map((item) => `
    <article class="news-item" id="news-${escapeHtml(item.id)}" tabindex="-1">
      ${item.photo ? `<img class="news-photo" src="${escapeHtml(item.photo)}" alt="">` : ""}
      <div class="news-copy">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
      </div>
    </article>
  `).join("");
}

function renderOverviewDetails() {
  const latest = [...results].sort((a, b) => b.week - a.week)[0];
  if (latest) {
    const latestWeek = `WEEK ${String(latest.week).padStart(2, "0")}`;
    document.querySelector("#phone-week").textContent = latestWeek;
    document.querySelector("#phone-home").textContent = latest.home;
    document.querySelector("#phone-away").textContent = latest.away;
    document.querySelector("#phone-home-score").textContent = latest.homeScore;
    document.querySelector("#phone-away-score").textContent = latest.awayScore;
    document.querySelector("#phone-home-crest").innerHTML = crest(latest.home);
    document.querySelector("#phone-away-crest").innerHTML = crest(latest.away);
    document.querySelector("#preview-week").textContent = `AFTER ${latestWeek}`;
  }

  const statValues = document.querySelectorAll(".stat-item strong");
  const totalGoals = results.reduce((sum, match) => sum + match.homeScore + match.awayScore, 0);
  const totalAssists = assists.reduce((sum, player) => sum + player.assists, 0);
  [clubs.length, results.length, totalGoals, totalAssists].forEach((value, index) => {
    statValues[index].textContent = String(value).padStart(2, "0");
  });
  document.querySelector("#phone-club-count").textContent = String(clubs.length).padStart(2, "0");
  document.querySelector("#phone-goals").textContent = String(totalGoals).padStart(2, "0");
  document.querySelector("#preview-match-count").textContent = `${String(results.length).padStart(2, "0")} MATCHES PLAYED`;
  document.querySelector("#preview-goal-count").textContent = `${String(totalGoals).padStart(2, "0")} GOALS SCORED`;

  document.querySelector("#preview-standings").innerHTML = calculateStandings().map((team, index) => `
    <div class="preview-standing-row ${index === 0 ? "is-leader" : ""}">
      <span class="preview-team">${String(index + 1).padStart(2, "0")}${crest(team.team)}<b>${escapeHtml(team.team)}</b></span>
      <span>${team.p}</span>
      <span>${team.gf - team.ga > 0 ? "+" : ""}${team.gf - team.ga}</span>
      <strong>${team.pts}</strong>
    </div>
  `).join("");

  const leader = [...topScorers].sort((a, b) => b.goals - a.goals)[0];
  const leaderPanel = document.querySelector("#leading-scorer");
  const note = document.querySelector(".scorer-note");
  if (leader) {
    leaderPanel.querySelector("strong").textContent = leader.name;
    leaderPanel.querySelector("div span").textContent = leader.club;
    leaderPanel.querySelector(".goal-count strong").textContent = String(leader.goals).padStart(2, "0");
    const others = topScorers.filter((player) => player !== leader);
    note.textContent = others.length
      ? `${others.map((player) => `${player.name} (${player.goals})`).join(" and ")} follow.`
      : "Leading the scoring chart.";
  } else {
    leaderPanel.querySelector("div strong").textContent = "No scorers yet";
    leaderPanel.querySelector("div span").textContent = "Master League";
    leaderPanel.querySelector(".goal-count strong").textContent = "00";
    note.textContent = "Scorer records will appear here once confirmed.";
  }

}

function showDataError(message) {
  const status = document.querySelector("#data-status");
  status.hidden = false;
  status.textContent = `Live league data could not be loaded. Showing the saved site data instead. ${message}`;
}

async function loadSavedLeagueData() {
  const config = window.SUPABASE_CONFIG;
  if (!config?.url || !config?.anonKey) return false;
  if (!window.supabase?.createClient) {
    showDataError("Supabase could not be reached. Check the site setup.");
    return false;
  }

  try {
    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey);
      window.masterLeagueSupabaseClient = supabaseClient;
    }
    const { data, error } = await supabaseClient
      .from("league_data")
      .select("payload")
      .eq("id", "season-2026")
      .single();
    if (error) throw error;
    const payload = data?.payload;
    if (!payload || !Array.isArray(payload.results) || !Array.isArray(payload.scorers) || !Array.isArray(payload.assists)) {
      throw new Error("League data has an unexpected format.");
    }
    const savedPlayers = payload.players === undefined ? [] : payload.players;
    if (!Array.isArray(savedPlayers)
      || savedPlayers.some((player) => !player || typeof player.name !== "string"
        || !player.name.trim() || player.name.trim().length > 60 || !clubByName.has(player.club))) {
      throw new Error("Club roster data has an unexpected format.");
    }
    const rosterCounts = new Map(clubs.map((club) => [club.name, 0]));
    savedPlayers.forEach((player) => rosterCounts.set(player.club, rosterCounts.get(player.club) + 1));
    const oversizedRoster = [...rosterCounts].find(([, count]) => count > MAX_PLAYERS_PER_CLUB);
    if (oversizedRoster) {
      throw new Error(`${oversizedRoster[0]} has more than ${MAX_PLAYERS_PER_CLUB} players in the saved roster.`);
    }
    if (payload.clubPhotos !== undefined && (!payload.clubPhotos || typeof payload.clubPhotos !== "object" || Array.isArray(payload.clubPhotos))) {
      throw new Error("Club photo data has an unexpected format.");
    }
    const savedNews = payload.news === undefined ? [] : payload.news;
    if (!Array.isArray(savedNews)
      || savedNews.some((item) => !item || typeof item.title !== "string" || typeof item.summary !== "string")) {
      throw new Error("League news data has an unexpected format.");
    }
    const savedTotw = payload.totw || { week: 0, formation: "4-3-3", players: [] };
    if (!savedTotw || typeof savedTotw !== "object" || !Array.isArray(savedTotw.players)) {
      throw new Error("Team of the week data has an unexpected format.");
    }
    if (savedTotw.players.length && (savedTotw.players.length !== 11
      || savedTotw.players.some((entry) => !entry || typeof entry.playerId !== "string")
      || new Set(savedTotw.players.map((entry) => entry.playerId).filter(Boolean)).size !== 11)) {
      throw new Error("Team of the week must contain eleven different roster players.");
    }
    const normalizedPlayers = savedPlayers.map((player, index) => ({
      ...player,
      id: player.id || `legacy-${index}-${player.club}-${player.name}`.toLocaleLowerCase(),
      position: typeof player.position === "string" ? player.position : "",
      appearances: Number.isInteger(player.appearances) && player.appearances >= 0 ? player.appearances : 0,
      photo: typeof player.photo === "string" ? player.photo : "",
    }));
    results = payload.results;
    topScorers = payload.scorers;
    assists = payload.assists;
    players = normalizedPlayers;
    clubPhotos = payload.clubPhotos || {};
    totw = { ...savedTotw, players: savedTotw.players };
    news = savedNews.map((item, index) => ({
      ...item,
      id: typeof item.id === "string" ? item.id : `legacy-news-${index}`,
    }));
    window.masterLeagueData.results = results;
    window.masterLeagueData.scorers = topScorers;
    window.masterLeagueData.assists = assists;
    window.masterLeagueData.players = players;
    window.masterLeagueData.clubPhotos = clubPhotos;
    window.masterLeagueData.totw = totw;
    window.masterLeagueData.news = news;
    return true;
  } catch (error) {
    showDataError(error.message || "Check the Supabase project and network connection.");
    return false;
  }
}

document.querySelector(".segmented-control").addEventListener("click", (event) => {
  const button = event.target.closest("[data-fixture-mode]");
  if (!button) return;
  document.querySelectorAll("[data-fixture-mode]").forEach((item) => {
    const selected = item === button;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  renderFixtures(button.dataset.fixtureMode);
});

document.querySelectorAll("[data-table-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-table-mode]").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    if (button.dataset.tableMode === "scorers") renderScorers();
    else if (button.dataset.tableMode === "assists") renderAssists();
    else if (button.dataset.tableMode === "contributions") renderGoalContributions();
    else renderStandings();
  });
});

const menuToggle = document.querySelector(".menu-toggle");
const sidebar = document.querySelector("#league-sidebar");
const navigation = document.querySelector(".sidebar-nav");

function setSidebarOpen(open) {
  const mobileNavigation = window.matchMedia("(max-width: 900px)").matches;
  const expanded = mobileNavigation && open;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close league navigation" : "Open league navigation");
  sidebar.classList.toggle("is-open", expanded);
  sidebar.inert = mobileNavigation && !open;
}

setSidebarOpen(false);

function setActiveSection(sectionId) {
  navigation.querySelectorAll("a[href^=\"#\"]").forEach((link) => {
    const selected = link.hash === `#${sectionId}`;
    link.classList.toggle("is-active", selected);
    if (selected) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

menuToggle.addEventListener("click", () => {
  setSidebarOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});
navigation.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^=\"#\"]");
  if (link) {
    setActiveSection(link.hash.slice(1));
    setSidebarOpen(false);
  }
});
document.addEventListener("click", (event) => {
  const clickedBackdrop = event.target === sidebar
    && event.clientX > sidebar.getBoundingClientRect().right;
  if (sidebar.classList.contains("is-open")
    && (!sidebar.contains(event.target) || clickedBackdrop)
    && !menuToggle.contains(event.target)) {
    setSidebarOpen(false);
  }
});
window.addEventListener("resize", () => setSidebarOpen(false), { passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && sidebar.classList.contains("is-open")) {
    setSidebarOpen(false);
    menuToggle.focus();
  }
});

let sectionUpdatePending = false;
window.addEventListener("scroll", () => {
  if (sectionUpdatePending) return;
  sectionUpdatePending = true;
  window.requestAnimationFrame(() => {
    sectionUpdatePending = false;
    const activationLine = Math.max(document.querySelector(".topbar").offsetHeight + 24, window.innerHeight * .42);
    const sections = [...document.querySelectorAll(".content-section")];
    const currentSection = sections
      .filter((section) => section.getBoundingClientRect().top <= activationLine)
      .pop();
    if (currentSection) setActiveSection(currentSection.id);
  });
}, { passive: true });

const initialSection = document.getElementById(location.hash.slice(1));
setActiveSection(initialSection && initialSection.classList.contains("content-section") ? initialSection.id : "home");

function renderDashboard() {
  const selectedTable = document.querySelector("[data-table-mode].is-selected")?.dataset.tableMode || "table";
  const selectedFixture = renderFixtureFilters(document.querySelector("[data-fixture-mode].is-selected")?.dataset.fixtureMode || "all");
  renderFixtures(selectedFixture);
  if (selectedTable === "scorers") renderScorers();
  else if (selectedTable === "assists") renderAssists();
  else if (selectedTable === "contributions") renderGoalContributions();
  else renderStandings();
  renderClubs();
  renderPlayerProfiles();
  renderTeamOfWeek();
  renderNews();
  renderOverviewDetails();
}

renderDashboard();
loadSavedLeagueData().then((loaded) => {
  if (loaded) renderDashboard();
});
