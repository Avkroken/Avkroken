const grid = document.querySelector("#site-grid");
const serviceGrid = document.querySelector("#service-grid");
const count = document.querySelector("#site-count");
const portalState = document.querySelector("#portal-state");

let allProjects = [];

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

function projectCard(project) {
  const endpointLink = project.url
    ? `<a class="card-action primary" href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer">Öppna tjänst</a>`
    : "";

  const documentationLink = project.documentation
    ? `<a class="card-action${project.url ? "" : " primary"}" data-portal-route href="${escapeHtml(project.documentation)}">Dokumentation</a>`
    : "";

  const discussionsLink = project.discussions
    ? `<a class="card-action" href="${escapeHtml(project.discussions)}" target="_blank" rel="noopener noreferrer">Discussions</a>`
    : "";

  const location = project.host ||
    project.source?.repository ||
    project.repository ||
    "Repository";

  return `
    <article class="card"
       style="--glow:${accentColor(project.accent)};--accent:${accentSolid(project.accent)}">
      <div class="card-top">
        <span class="badge">${escapeHtml(project.category || "Projekt")}</span>
        <span class="arrow" aria-hidden="true">↗</span>
      </div>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.description || "Avkroken-projekt.")}</p>
      <div class="host">${escapeHtml(location)}</div>
      <nav class="card-actions" aria-label="Länkar för ${escapeHtml(project.name)}">
        ${endpointLink}
        ${documentationLink}
        <a class="card-action" href="${escapeHtml(project.repository)}" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a class="card-action" href="${escapeHtml(project.issues)}" target="_blank" rel="noopener noreferrer">Issues</a>
        ${discussionsLink}
      </nav>
      <div class="metrics" aria-label="Projektdata">
        ${metric("STACK", project.language || "—")}
        ${metric("REPO", formatSize(project.repoSizeKb))}
        ${metric("UPDATED", formatDate(project.updatedAt))}
      </div>
    </article>`;
}

function renderCollection(target, projects, emptyMessage) {
  if (!target) return;
  if (!projects.length) {
    target.innerHTML = `<div class="empty"><strong>${escapeHtml(emptyMessage)}</strong></div>`;
    return;
  }
  target.innerHTML = projects.map(projectCard).join("");
}

function renderProjects() {
  if (count) {
    count.textContent = `${allProjects.length} PROJEKT`;
  }

  renderCollection(grid, allProjects, "Inga aktiva publika projekt hittades.");

  const products = allProjects.filter(project => project.independentProduct === true);
  renderCollection(
    serviceGrid,
    products,
    "Inga självständiga publika produkter hittades i projektkatalogen."
  );
}

async function loadProjects() {
  try {
    const response = await fetch("/api/projects", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    allProjects = Array.isArray(payload.projects) ? payload.projects : [];

    if (portalState) {
      portalState.textContent = `${allProjects.length} PROJEKT`;
      if (payload.generatedAt) {
        portalState.title = "Projektkatalog genererad " + formatDate(payload.generatedAt);
      }
    }

    renderProjects();
  } catch (error) {
    if (count) count.textContent = "UNAVAILABLE";
    if (portalState) portalState.textContent = "INDEX OFFLINE";

    if (grid) {
      grid.innerHTML =
        '<div class="empty"><strong>Projektkatalogen är tillfälligt otillgänglig.</strong></div>';
    }
    if (serviceGrid) {
      serviceGrid.innerHTML =
        '<div class="empty"><strong>Tjänstelistan är tillfälligt otillgänglig.</strong></div>';
    }

    console.error(error);
  }
}

loadProjects();
