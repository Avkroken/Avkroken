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
const projectDetailClassification = document.querySelector("#project-detail-classification");

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

function hrefLink(label, href, { primary = false, internal = false } = {}) {
  if (!href) return "";
  const attrs = internal
    ? 'data-portal-route'
    : 'target="_blank" rel="noopener noreferrer"';
  return `<a class="card-action${primary ? " primary" : ""}" ${attrs} href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function projectCard(project, { serviceMode = false } = {}) {
  const homepageHost = project.homepage
    ? new URL(project.homepage).host
    : "avkroken · " + String(project.kindLabel || "Projekt").toLowerCase();

  const primaryAction = serviceMode && project.homepage
    ? hrefLink("Öppna tjänst", project.homepage, { primary: true })
    : hrefLink("Översikt", project.links?.overview, { primary: true, internal: true });

  const secondaryOverview = serviceMode
    ? hrefLink("Projektöversikt", project.links?.overview, { internal: true })
    : "";

  return `
    <article class="card"
       style="--glow:${accentColor(project.accent)};--accent:${accentSolid(project.accent)}">
      <div class="card-top">
        <span class="badge">${escapeHtml(project.kindLabel || "Projekt")}</span>
        <span class="arrow" aria-hidden="true">↗</span>
      </div>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.description || "Avkroken-projekt.")}</p>
      <div class="host">${escapeHtml(homepageHost)}</div>
      <nav class="card-actions" aria-label="Länkar för ${escapeHtml(project.name)}">
        ${primaryAction}
        ${secondaryOverview}
        ${hrefLink("Dokumentation", project.links?.documentation, { internal: true })}
        ${!serviceMode && project.homepage ? hrefLink("Öppna", project.homepage) : ""}
        ${hrefLink("Visa original", project.links?.repository)}
      </nav>
      <div class="metrics" aria-label="Projektdata">
        ${metric("TYP", project.kindLabel || "Projekt")}
        ${metric("STACK", project.language || "—")}
        ${metric("UPPDATERAD", formatDate(project.updatedAt))}
      </div>
    </article>`;
}

function renderCollection(target, projects, emptyMessage, options = {}) {
  if (!target) return;
  if (!projects.length) {
    target.innerHTML = `<div class="empty"><strong>${escapeHtml(emptyMessage)}</strong></div>`;
    return;
  }
  target.innerHTML = projects.map(project => projectCard(project, options)).join("");
}

function renderCatalog() {
  const projects = allProjects.filter(project => !project.independentProduct);
  const products = allProjects.filter(project => project.independentProduct);

  if (count) count.textContent = `${projects.length} PROJEKT`;
  if (portalState) portalState.textContent = `${allProjects.length} PUBLIKA`;

  renderCollection(
    grid,
    projects,
    "Inga publika projekt eller verktyg hittades."
  );

  renderCollection(
    serviceGrid,
    products,
    "Inga självständiga publika produkter hittades.",
    { serviceMode: true }
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

function detailLink(label, href, { internal = false, primary = false } = {}) {
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

function clearProjectDetail(message) {
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
  if (projectDetailClassification) {
    projectDetailClassification.innerHTML =
      "<strong>Ingen project metadata</strong>Kontrollera project-katalogen eller öppna Projekt.";
  }
}

function renderProjectDetail() {
  if (!projectDetailTitle) return;

  const slug = currentProjectSlug();
  if (!slug) {
    clearProjectDetail("Ingen projektreferens finns i URL:en.");
    return;
  }

  const project = allProjects.find(entry => entry.slug === slug);
  if (!project) {
    clearProjectDetail("Projektet finns inte i den publika project-katalogen.");
    return;
  }

  if (projectDetailKind) {
    projectDetailKind.textContent = String(project.kindLabel || "Projekt").toUpperCase();
  }
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
    projectDetailSource.href = project.links.repository;
    projectDetailSource.textContent = "Visa original";
  }

  if (projectDetailMetrics) {
    projectDetailMetrics.innerHTML = [
      metric("TYP", project.kindLabel || "Projekt"),
      metric("STACK", project.language || "—"),
      metric("UPPDATERAD", formatDate(project.updatedAt)),
      metric("DEFAULT BRANCH", project.defaultBranch || "—")
    ].join("");
  }

  if (projectDetailLinks) {
    const links = [
      detailLink("Dokumentation", project.links.documentation, { internal: true, primary: true }),
      project.homepage ? detailLink("Publik tjänst", project.homepage) : "",
      project.features?.wiki ? detailLink("Wiki", project.links.wiki) : "",
      project.features?.issues ? detailLink("Issues", project.links.issues) : "",
      project.features?.discussions ? detailLink("Discussions", project.links.discussions) : "",
      detailLink("Releases", project.links.releases),
      detailLink("Builds / CI", project.links.actions),
      detailLink("Aktivitet", project.links.commits),
      project.features?.pages ? detailLink("GitHub Pages", project.links.pages) : ""
    ].filter(Boolean);

    projectDetailLinks.innerHTML = links.join("");
  }

  if (projectDetailClassification) {
    const sourceText = {
      portal_policy: "explicit Portal-presentationspolicy",
      topic: "repository topic",
      default: "Portal fallback eftersom explicit presentationstopic saknas"
    }[project.kindSource] || "Portal presentation";

    projectDetailClassification.innerHTML =
      "<strong>Presentationsmetadata</strong>" +
      `Klassning: ${escapeHtml(sourceText)}. Teknisk current-state ägs fortfarande av repositoryt.`;
  }
}

async function loadProjects() {
  try {
    const response = await fetch("/api/projects", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    allProjects = Array.isArray(data) ? data : [];
    renderCatalog();
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
        '<div class="empty"><strong>Tjänstekatalogen är tillfälligt otillgänglig.</strong></div>';
    }

    clearProjectDetail("Projektkatalogen kunde inte läsas.");
    console.error(error);
  }
}

window.addEventListener("portal:routechange", event => {
  if (event.detail?.view === "project-detail") renderProjectDetail();
});

loadProjects();
