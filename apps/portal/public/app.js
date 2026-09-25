const grid = document.querySelector("#site-grid");
const serviceGrid = document.querySelector("#service-grid");
const count = document.querySelector("#site-count");
const portalState = document.querySelector("#portal-state");

const detailTitle = document.querySelector("#project-detail-title");
const detailDescription = document.querySelector("#project-detail-description");
const detailCategory = document.querySelector("#project-detail-category");
const detailBreadcrumb = document.querySelector("#project-detail-breadcrumb");
const detailActions = document.querySelector("#project-detail-actions");
const detailSourceKind = document.querySelector("#project-detail-source-kind");
const detailRepository = document.querySelector("#project-detail-repository");
const detailRef = document.querySelector("#project-detail-ref");
const detailUpdated = document.querySelector("#project-detail-updated");
const detailSourcePath = document.querySelector("#project-detail-source-path");
const detailError = document.querySelector("#project-detail-error");

let allProjects = [];
let projectsLoaded = false;

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
  const overviewLink = project.portalUrl
    ? `<a class="card-action primary" data-portal-route href="${escapeHtml(project.portalUrl)}">Översikt</a>`
    : "";

  const endpointLink = project.url
    ? `<a class="card-action" href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer">Öppna tjänst</a>`
    : "";

  const documentationLink = project.documentation
    ? `<a class="card-action" data-portal-route href="${escapeHtml(project.documentation)}">Dokumentation</a>`
    : "";

  const discussionsLink = project.discussions
    ? `<a class="card-action" href="${escapeHtml(project.discussions)}" target="_blank" rel="noopener noreferrer">Discussions</a>`
    : "";

  const sourceLink = project.sourceUrl
    ? `<a class="card-action" href="${escapeHtml(project.sourceUrl)}" target="_blank" rel="noopener noreferrer">Källa</a>`
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
        ${overviewLink}
        ${endpointLink}
        ${documentationLink}
        <a class="card-action" href="${escapeHtml(project.repository)}" target="_blank" rel="noopener noreferrer">GitHub</a>
        ${sourceLink}
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

function projectSlugFromLocation() {
  const match = (location.pathname.replace(/\/+$/, "") || "/").match(/^\/projekt\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function detailAction(label, href, { primary = false, internal = false } = {}) {
  if (!href) return "";
  const routeAttribute = internal ? " data-portal-route" : "";
  const externalAttributes = internal ? "" : ' target="_blank" rel="noopener noreferrer"';
  return `<a class="portal-button${primary ? " primary" : ""}"${routeAttribute} href="${escapeHtml(href)}"${externalAttributes}>${escapeHtml(label)}</a>`;
}

function resetProjectDetail() {
  if (!detailTitle) return;
  detailCategory.textContent = "PROJEKT";
  detailBreadcrumb.textContent = "Projekt";
  detailTitle.textContent = "Läser in projekt…";
  detailDescription.textContent = "Projektmetadata hämtas från Portalens normaliserade publika projektkatalog.";
  detailActions.replaceChildren();
  detailSourceKind.textContent = "—";
  detailRepository.textContent = "—";
  detailRef.textContent = "—";
  detailUpdated.textContent = "—";
  detailSourcePath.hidden = true;
  detailSourcePath.textContent = "";
  detailError.hidden = true;
}

function renderProjectDetail() {
  if (!detailTitle) return;

  const slug = projectSlugFromLocation();
  if (!slug) return;

  if (!projectsLoaded) {
    resetProjectDetail();
    return;
  }

  const project = allProjects.find(item => item.slug === slug);
  if (!project) {
    detailCategory.textContent = "PROJEKT";
    detailBreadcrumb.textContent = slug;
    detailTitle.textContent = "Projekt saknas";
    detailDescription.textContent = "Den begärda projektrouten finns inte i den aktuella publika projektkatalogen.";
    detailActions.replaceChildren();
    detailSourceKind.textContent = "—";
    detailRepository.textContent = "—";
    detailRef.textContent = "—";
    detailUpdated.textContent = "—";
    detailSourcePath.hidden = true;
    detailError.hidden = false;
    document.title = "Projekt saknas · Avkroken";
    return;
  }

  const sourceKind = project.source?.kind === "monorepo_app" ? "Monorepo-app" : "Repository";
  const sourceRepository = project.source?.repository || project.repository || "—";
  const sourceRef = project.source?.ref || "—";

  detailCategory.textContent = String(project.category || "Projekt").toUpperCase();
  detailBreadcrumb.textContent = project.name || project.slug;
  detailTitle.textContent = project.name || project.slug;
  detailDescription.textContent = project.description || "Avkroken-projekt.";
  detailSourceKind.textContent = sourceKind;
  detailRepository.textContent = sourceRepository;
  detailRef.textContent = sourceRef;
  detailUpdated.textContent = formatDate(project.updatedAt);
  detailError.hidden = true;

  if (project.source?.path) {
    detailSourcePath.hidden = false;
    detailSourcePath.textContent = project.source.path;
  } else {
    detailSourcePath.hidden = true;
    detailSourcePath.textContent = "";
  }

  const actions = [
    detailAction("Dokumentation", project.documentation, {
      primary: !project.url,
      internal: true
    }),
    detailAction("Öppna tjänst", project.url, {
      primary: Boolean(project.url)
    }),
    detailAction("Repository", project.repository),
    detailAction("Canonical source", project.sourceUrl),
    detailAction("Issues", project.issues),
    detailAction("Discussions", project.discussions),
    detailAction("Releases", project.releases)
  ].filter(Boolean);

  detailActions.innerHTML = actions.join("");
  document.title = `${project.name || project.slug} · Avkroken`;
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

  renderProjectDetail();
}

async function loadProjects() {
  try {
    const response = await fetch("/api/projects", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    allProjects = Array.isArray(payload.projects) ? payload.projects : [];
    projectsLoaded = true;

    if (portalState) {
      portalState.textContent = `${allProjects.length} PROJEKT`;
      if (payload.generatedAt) {
        portalState.title = "Projektkatalog genererad " + formatDate(payload.generatedAt);
      }
    }

    renderProjects();
  } catch (error) {
    projectsLoaded = true;
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

    if (projectSlugFromLocation() && detailTitle) {
      detailTitle.textContent = "Projektkatalogen är otillgänglig";
      detailDescription.textContent = "Projektet kan inte visas förrän den publika katalogen kan läsas.";
      detailError.hidden = false;
    }

    console.error(error);
  }
}

window.addEventListener("portal:routechange", event => {
  if (event.detail?.view === "project-detail") {
    renderProjectDetail();
  } else if (document.title.endsWith(" · Avkroken") && document.title !== "Avkroken") {
    document.title = "Avkroken";
  }
});

resetProjectDetail();
loadProjects();
