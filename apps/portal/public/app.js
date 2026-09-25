const grid = document.querySelector("#site-grid");
const serviceGrid = document.querySelector("#service-grid");
const count = document.querySelector("#site-count");
const portalState = document.querySelector("#portal-state");

let allSites = [];

const independentProducts = new Set(["Politiker", "Klarsprak", "Produkter"]);

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

function accentColor(accent) {
  return {
    cyan: "rgba(166,190,201,.20)",
    blue: "rgba(120,153,173,.22)",
    violet: "rgba(166,177,170,.18)",
    magenta: "rgba(208,174,103,.20)",
    pink: "rgba(225,164,155,.20)"
  }[accent] || "rgba(120,153,173,.18)";
}

function accentSolid(accent) {
  return {
    cyan: "#a6bec9",
    blue: "#7899ad",
    violet: "#a6b1aa",
    magenta: "#d0ae67",
    pink: "#e1a49b"
  }[accent] || "#d0ae67";
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

function siteCard(site) {
  const documentationLink = site.documentation
    ? `<a class="card-action" data-portal-route href="${escapeHtml(site.documentation)}">Dokumentation</a>`
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
}

function renderCollection(target, sites, emptyMessage) {
  if (!target) return;
  if (!sites.length) {
    target.innerHTML = `<div class="empty"><strong>${escapeHtml(emptyMessage)}</strong></div>`;
    return;
  }
  target.innerHTML = sites.map(siteCard).join("");
}

function renderSites() {
  if (count) {
    count.textContent = `${allSites.length} PUBLICERADE`;
  }

  renderCollection(grid, allSites, "Inga publicerade projekt eller tjänster hittades.");

  const products = allSites.filter(site => independentProducts.has(site.name));
  renderCollection(
    serviceGrid,
    products,
    "Inga självständiga publika produkter hittades i portalens discovery."
  );
}

async function loadSites() {
  try {
    const response = await fetch("/api/sites", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    allSites = Array.isArray(data) ? data : [];

    if (portalState) {
      portalState.textContent = `${allSites.length} PUBLIKA`;
    }

    renderSites();
  } catch (error) {
    if (count) count.textContent = "UNAVAILABLE";
    if (portalState) portalState.textContent = "INDEX OFFLINE";

    if (grid) {
      grid.innerHTML =
        '<div class="empty"><strong>Projektlistan är tillfälligt otillgänglig.</strong></div>';
    }
    if (serviceGrid) {
      serviceGrid.innerHTML =
        '<div class="empty"><strong>Tjänstelistan är tillfälligt otillgänglig.</strong></div>';
    }

    console.error(error);
  }
}

loadSites();
