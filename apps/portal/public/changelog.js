(() => {
  const status = document.querySelector("#changelog-status");
  const generated = document.querySelector("#changelog-generated");
  const list = document.querySelector("#changelog-list");
  const errorState = document.querySelector("#changelog-error");
  const filterButtons = [...document.querySelectorAll("[data-changelog-filter]")];

  const allowedFilters = new Set([
    "all",
    "features",
    "fixes",
    "security",
    "documentation",
    "releases"
  ]);

  let requestSerial = 0;
  let currentReleases = [];
  let activeFilter = "all";

  function isChangelogRoute() {
    return (location.pathname.replace(/\/+$/, "") || "/") === "/changelog";
  }

  function clear() {
    list?.replaceChildren();
  }

  function formatDate(value) {
    if (!value) return "Okänt datum";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Okänt datum";

    return new Intl.DateTimeFormat("sv-SE", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function emptyState(title, copy) {
    clear();
    const box = document.createElement("div");
    box.className = "empty";

    const strong = document.createElement("strong");
    strong.textContent = title;
    box.appendChild(strong);

    if (copy) {
      const span = document.createElement("span");
      span.textContent = copy;
      box.appendChild(span);
    }

    list?.appendChild(box);
  }

  function renderRelease(release) {
    const article = document.createElement("article");
    article.className = "changelog-release";

    const header = document.createElement("div");
    header.className = "changelog-release-head";

    const identity = document.createElement("div");

    const project = document.createElement("a");
    project.className = "changelog-project-link";
    project.href = release.projectUrl;
    project.dataset.portalRoute = "";
    project.textContent = release.projectName || release.projectSlug || "Projekt";

    const title = document.createElement("h2");
    title.textContent = release.name || release.tag || "Release";

    identity.append(project, title);

    const meta = document.createElement("div");
    meta.className = "changelog-release-meta";

    const tag = document.createElement("span");
    tag.className = "badge";
    tag.textContent = release.tag || "release";
    meta.appendChild(tag);

    if (release.prerelease === true) {
      const prerelease = document.createElement("span");
      prerelease.className = "changelog-prerelease";
      prerelease.textContent = "Prerelease";
      meta.appendChild(prerelease);
    }

    const date = document.createElement("time");
    date.dateTime = release.publishedAt || "";
    date.textContent = formatDate(release.publishedAt);
    meta.appendChild(date);

    header.append(identity, meta);

    const footer = document.createElement("div");
    footer.className = "changelog-release-footer";

    const repository = document.createElement("span");
    repository.textContent = release.repository || "";
    footer.appendChild(repository);

    const original = document.createElement("a");
    original.href = release.url;
    original.target = "_blank";
    original.rel = "noopener noreferrer";
    original.textContent = "Visa release";
    footer.appendChild(original);

    article.append(header, footer);
    list.appendChild(article);
  }

  function filterLabel(value) {
    return {
      all: "Alla",
      features: "Features",
      fixes: "Fixes",
      security: "Security",
      documentation: "Documentation",
      releases: "Releases"
    }[value] || "Alla";
  }

  function releaseMatchesFilter(release) {
    if (activeFilter === "all") return true;

    const categories = Array.isArray(release?.categories)
      ? release.categories
      : ["releases"];

    return categories.includes(activeFilter);
  }

  function renderList() {
    const visible = currentReleases.filter(releaseMatchesFilter);

    status.textContent = activeFilter === "all"
      ? (currentReleases.length === 1
        ? "1 publicerad release"
        : currentReleases.length + " publicerade releases")
      : visible.length + " av " + currentReleases.length +
        " · " + filterLabel(activeFilter);

    clear();

    if (!currentReleases.length) {
      emptyState(
        "Inga publicerade releases hittades.",
        "Projekt utan GitHub Releases visas inte som produktförändringar."
      );
      return;
    }

    if (!visible.length) {
      emptyState(
        "Inga releaser i kategorin " + filterLabel(activeFilter) + ".",
        "Filtret använder endast kategorier som kan härledas från publicerade release-sektioner."
      );
      return;
    }

    for (const release of visible) renderRelease(release);
  }

  function render(payload) {
    currentReleases = Array.isArray(payload.releases) ? payload.releases : [];
    const coverage = payload.source?.coverage;

    generated.textContent = payload.generatedAt
      ? "Snapshot " + formatDate(payload.generatedAt) +
        (coverage === "partial" ? " · delvis täckning" : " · begränsad täckning")
      : "";

    errorState.hidden = true;
    renderList();
  }

  async function loadChangelog() {
    if (!isChangelogRoute()) return;

    const serial = ++requestSerial;
    status.textContent = "Läser releaser…";
    generated.textContent = "";
    currentReleases = [];
    errorState.hidden = true;
    emptyState("Läser publicerade releases…", "");

    try {
      const response = await fetch("/api/changelog", {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("HTTP " + response.status);

      const payload = await response.json();
      if (serial !== requestSerial) return;
      if (payload.status !== "available") throw new Error("changelog unavailable");

      render(payload);
      document.title = "Changelog · Avkroken";
    } catch (error) {
      if (serial !== requestSerial) return;
      status.textContent = "Otillgänglig";
      generated.textContent = "";
      currentReleases = [];
      clear();
      errorState.hidden = false;
      console.error(error);
    }
  }

  for (const button of filterButtons) {
    button.addEventListener("click", () => {
      const filter = String(button.dataset.changelogFilter || "");
      if (!allowedFilters.has(filter) || filter === activeFilter) return;

      activeFilter = filter;
      for (const item of filterButtons) {
        item.setAttribute(
          "aria-pressed",
          String(item.dataset.changelogFilter === activeFilter)
        );
      }

      renderList();
    });
  }

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "changelog") loadChangelog();
  });

  if (isChangelogRoute()) loadChangelog();
})();
