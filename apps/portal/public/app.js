const grid = document.querySelector("#site-grid");
const serviceGrid = document.querySelector("#service-grid");
const count = document.querySelector("#site-count");
const portalState = document.querySelector("#portal-state");

const projectDetailTitle = document.querySelector("#project-detail-title");
const projectDetailDescription = document.querySelector("#project-detail-description");
const projectDetailKind = document.querySelector("#project-detail-kind");
const projectDetailBreadcrumbs = document.querySelector("#project-detail-breadcrumbs");
const projectDetailSource = document.querySelector("#project-detail-source");
const projectDetailMetrics = document.querySelector("#project-detail-metrics");
const projectDetailLinks = document.querySelector("#project-detail-links");
const projectDetailSourceNote = document.querySelector("#project-detail-source-note");

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

function projectOverviewPath(project) {
  const slug = String(project?.slug || project?.name || "").trim();
  return slug ? "/projekt/" + encodeURIComponent(slug) : "/projekt";
}

function projectCard(project) {
  const overview = projectOverviewPath(project);
  const endpointLink = project.url
    ? `<a class="card-action primary" href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer">Öppna tjänst</a>`
    : "";

  const overviewLink =
    `<a class="card-action${project.url ? "" : " primary"}" data-portal-route href="${escapeHtml(overview)}">Översikt</a>`;

  const documentationLink = project.documentation
    ? `<a class="card-action" data-portal-route href="${escapeHtml(project.documentation)}">Dokumentation</a>`
    : "";

  const discussionsLink = project.discussions
    ? `<a class="card-action" href="${escapeHtml(project.discussions)}" target="_blank" rel="noopener noreferrer">Discussions</a>`
    : "";

  const location = project.host ||
    project.source?.repository ||
    project.repository ||
    "Repository";

  const category = project.independentProduct === true
    ? "Produkt"
    : project.category || "Projekt";

  return `
    <article class="card"
       style="--glow:${accentColor(project.accent)};--accent:${accentSolid(project.accent)}">
      <div class="card-top">
        <span class="badge">${escapeHtml(category)}</span>
        <span class="arrow" aria-hidden="true">↗</span>
      </div>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.description || "Avkroken-projekt.")}</p>
      <div class="host">${escapeHtml(location)}</div>
      <nav class="card-actions" aria-label="Länkar för ${escapeHtml(project.name)}">
        ${endpointLink}
        ${overviewLink}
        ${documentationLink}
        <a class="card-action" href="${escapeHtml(project.repository)}" target="_blank" rel="noopener noreferrer">Visa original</a>
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

function currentProjectSlug() {
  const match = location.pathname.match(/^\/projekt\/([^/]+)(?:\/|$)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function projectDetailLink(label, href, { internal = false, primary = false } = {}) {
  if (!href) return "";
  const attrs = internal
    ? "data-portal-route"
    : 'target="_blank" rel="noopener noreferrer"';

  return `
    <a class="portal-project-link${primary ? " primary" : ""}" ${attrs} href="${escapeHtml(href)}">
      <span>${escapeHtml(label)}</span>
      <span aria-hidden="true">${internal ? "→" : "↗"}</span>
    </a>`;
}

function setMissingProjectDetail(message) {
  if (projectDetailKind) projectDetailKind.textContent = "PROJEKT";
  if (projectDetailTitle) projectDetailTitle.textContent = "Projekt saknas";
  if (projectDetailDescription) projectDetailDescription.textContent = message;

  if (projectDetailBreadcrumbs) {
    projectDetailBreadcrumbs.innerHTML = '<a href="/projekt" data-portal-route>Projekt</a>';
  }

  if (projectDetailSource) {
    projectDetailSource.href = "https://github.com/Avkroken";
    projectDetailSource.textContent = "Visa organisation";
  }

  if (projectDetailMetrics) projectDetailMetrics.innerHTML = "";
  if (projectDetailLinks) projectDetailLinks.innerHTML = "";

  if (projectDetailSourceNote) {
    projectDetailSourceNote.innerHTML =
      "<strong>Ingen publik projektpost</strong>Projektet finns inte i den normaliserade publika project catalog.";
  }
}

function renderProjectDetail() {
  if (!projectDetailTitle) return;

  const slug = currentProjectSlug();
  if (!slug) {
    setMissingProjectDetail("Ingen projektreferens finns i URL:en.");
    return;
  }

  const project = allProjects.find(entry => entry.slug === slug);
  if (!project) {
    setMissingProjectDetail("Projektet finns inte i den publika project catalog.");
    return;
  }

  const category = project.independentProduct === true
    ? "Produkt"
    : project.category || "Projekt";
  const sourceRef = project.source?.ref || "main";
  const canonicalRepository = project.repository;
  const actionsUrl = canonicalRepository ? canonicalRepository + "/actions" : null;
  const commitsUrl = canonicalRepository
    ? canonicalRepository + "/commits/" + encodeURIComponent(sourceRef)
    : null;

  if (projectDetailKind) projectDetailKind.textContent = category.toUpperCase();
  if (projectDetailTitle) projectDetailTitle.textContent = project.name;
  if (projectDetailDescription) {
    projectDetailDescription.textContent =
      project.description || "Publikt Avkroken-projekt utan repositorybeskrivning.";
  }

  if (projectDetailBreadcrumbs) {
    projectDetailBreadcrumbs.innerHTML =
      '<a href="/projekt" data-portal-route>Projekt</a>' +
      '<span aria-hidden="true">›</span>' +
      `<span aria-current="page">${escapeHtml(project.name)}</span>`;
  }

  if (projectDetailSource) {
    projectDetailSource.href = canonicalRepository;
    projectDetailSource.textContent = "Visa original";
  }

  if (projectDetailMetrics) {
    projectDetailMetrics.innerHTML = [
      metric("TYP", category),
      metric("STACK", project.language || "—"),
      metric("UPPDATERAD", formatDate(project.updatedAt)),
      metric("REF", sourceRef)
    ].join("");
  }

  if (projectDetailLinks) {
    projectDetailLinks.innerHTML = [
      projectDetailLink("Dokumentation", project.documentation, { internal: true, primary: true }),
      project.url ? projectDetailLink("Publik tjänst", project.url) : "",
      projectDetailLink("Issues", project.issues),
      project.discussions ? projectDetailLink("Discussions", project.discussions) : "",
      projectDetailLink("Releases", project.releases),
      projectDetailLink("Builds / CI", actionsUrl),
      projectDetailLink("Aktivitet", commitsUrl),
      project.pages ? projectDetailLink("GitHub Pages", project.pages) : "",
      projectDetailLink("Visa original", canonicalRepository)
    ].filter(Boolean).join("");
  }

  if (projectDetailSourceNote) {
    projectDetailSourceNote.innerHTML =
      "<strong>Källmodell</strong>" +
      "Metadata är normaliserad från " +
      escapeHtml(project.source?.provider || "GitHub") +
      " · " +
      escapeHtml(project.source?.repository || project.name) +
      " · ref " +
      escapeHtml(sourceRef) +
      ". Operativ state hämtas inte i denna vy.";
  }
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
    renderProjectDetail();
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

    setMissingProjectDetail("Projektkatalogen kunde inte läsas.");
    console.error(error);
  }
}

window.addEventListener("portal:routechange", event => {
  if (event.detail?.view === "project-detail") renderProjectDetail();
});

loadProjects();
