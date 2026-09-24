const grid = document.querySelector("#site-grid");
const count = document.querySelector("#site-count");
const portalState = document.querySelector("#portal-state");
const focusLinks = [...document.querySelectorAll(".manifesto [data-focus]")];

let allSites = [];
let activeFocus = null;

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

function accentColor(accent) {
  return {
    cyan: "rgba(36,231,232,.22)",
    blue: "rgba(45,155,255,.22)",
    violet: "rgba(119,87,255,.22)",
    magenta: "rgba(213,29,203,.22)",
    pink: "rgba(255,67,139,.22)"
  }[accent] || "rgba(45,155,255,.18)";
}

function accentSolid(accent) {
  return {
    cyan: "#24e7e8",
    blue: "#2d9bff",
    violet: "#7757ff",
    magenta: "#d51dcb",
    pink: "#ff438b"
  }[accent] || "#2d9bff";
}

function formatSize(kb) {
  if (!Number.isFinite(kb) || kb < 0) return "—";
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(kb >= 10240 ? 0 : 1)} MB`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function metric(label, value) {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>`;
}

const focusByProject = {
  klarsprak: ["data", "ideas"],
  dumpen: ["code", "ideas"],
  politiker: ["data", "visions"],
  produkter: ["code", "data"],
  skvallerbyttan: ["code", "ideas"]
};

function focusesForSite(site) {
  const key = String(site.name || "").toLowerCase();
  if (focusByProject[key]) return focusByProject[key];

  const text = `${site.name || ""} ${site.description || ""} ${site.category || ""} ${site.language || ""}`.toLowerCase();
  const focuses = new Set();

  if (site.language || /verktyg|tjänst|worker|app|api|kod|code/.test(text)) focuses.add("code");
  if (/data|statistik|register|katalog|analys|index|arkiv|produkt|pris/.test(text)) focuses.add("data");
  if (/experiment|vision|framtid|prototyp|utforsk/.test(text)) focuses.add("visions");
  if (/idé|idea|koncept|språk|projekt|dokument|experiment/.test(text)) focuses.add("ideas");

  if (!focuses.size) focuses.add("ideas");
  return [...focuses];
}

function renderSites() {
  const sites = activeFocus
    ? allSites.filter(site => focusesForSite(site).includes(activeFocus))
    : allSites;

  count.textContent = activeFocus
    ? `${sites.length} / ${allSites.length}`
    : `${allSites.length} ENDPOINT${allSites.length === 1 ? "" : "S"}`;

  focusLinks.forEach(link => {
    const selected = link.dataset.focus === activeFocus;
    link.classList.toggle("active", selected);
    link.setAttribute("aria-pressed", selected ? "true" : "false");
  });

  if (!sites.length) {
    grid.innerHTML = `<div class="empty"><strong>Inga projekt i den här vyn ännu.</strong></div>`;
    return;
  }

  grid.innerHTML = sites.map(site => {
    const documentationLink = site.documentation
      ? `<a class="card-action" href="${escapeHtml(site.documentation)}">Dokumentation</a>`
      : "";

    return `
      <article class="card"
         style="--glow:${accentColor(site.accent)};--accent:${accentSolid(site.accent)}">
        <div class="card-top">
          <span class="badge">${escapeHtml(site.category)}</span>
          <span class="arrow" aria-hidden="true">↗</span>
        </div>
        <h3>${escapeHtml(site.name)}</h3>
        <p>${escapeHtml(site.description || "Avkroken-projekt.")}</p>
        <div class="host">${escapeHtml(site.host)}</div>
        <nav class="card-actions" aria-label="Länkar för ${escapeHtml(site.name)}">
          <a class="card-action primary" href="${escapeHtml(site.url)}" target="_blank" rel="noopener noreferrer">Öppna</a>
          ${documentationLink}
          <a class="card-action" href="${escapeHtml(site.repository)}" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a class="card-action" href="${escapeHtml(site.issues)}" target="_blank" rel="noopener noreferrer">Issues</a>
        </nav>
        <div class="metrics" aria-label="Projektdata">
          ${metric("STACK", site.language || "—")}
          ${metric("REPO", formatSize(site.repoSizeKb))}
          ${metric("UPDATED", formatDate(site.updatedAt))}
        </div>
      </article>`;
  }).join("");
}

function setFocus(focus, { updateHash = true, scroll = true } = {}) {
  const next = activeFocus === focus ? null : focus;
  activeFocus = next;

  if (updateHash) {
    const hash = next ? `#${next}` : `${location.pathname}${location.search}`;
    history.replaceState(null, "", hash);
  }

  renderSites();

  if (scroll) {
    document.querySelector("#public-sites")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

focusLinks.forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    setFocus(link.dataset.focus);
  });
});

async function loadSites() {
  try {
    const response = await fetch("/api/sites", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    allSites = await response.json();

    if (portalState) portalState.textContent = `${allSites.length} LIVE`;

    const hashFocus = location.hash.slice(1).toLowerCase();
    activeFocus = focusLinks.some(link => link.dataset.focus === hashFocus) ? hashFocus : null;

    if (!allSites.length) {
      count.textContent = "0 ENDPOINTS";
      grid.innerHTML = `<div class="empty"><strong>Inga projekt publicerade ännu.</strong></div>`;
      return;
    }

    renderSites();
  } catch (error) {
    count.textContent = "UNAVAILABLE";
    if (portalState) portalState.textContent = "INDEX OFFLINE";
    grid.innerHTML = `
      <div class="empty">
        <strong>Projektlistan är tillfälligt otillgänglig.</strong>
      </div>`;
    console.error(error);
  }
}

loadSites();
