(() => {
  const title = document.querySelector("#project-releases-title");
  const description = document.querySelector("#project-releases-description");
  const projectLink = document.querySelector("#project-releases-project-link");
  const status = document.querySelector("#project-releases-status");
  const generated = document.querySelector("#project-releases-generated");
  const original = document.querySelector("#project-releases-original");
  const list = document.querySelector("#project-releases-list");
  const errorState = document.querySelector("#project-releases-error");

  let requestSerial = 0;

  function projectSlugFromLocation() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const match = path.match(/^\/projekt\/([^/]+)\/releases$/);
    if (!match) return null;

    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
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

  function emptyState(titleText, copy) {
    clear();
    const box = document.createElement("div");
    box.className = "empty";

    const strong = document.createElement("strong");
    strong.textContent = titleText;
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

    const releaseTitle = document.createElement("h2");
    releaseTitle.textContent = release.name || release.tag || "Release";
    identity.appendChild(releaseTitle);

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

    const releaseLink = document.createElement("a");
    releaseLink.href = release.url;
    releaseLink.target = "_blank";
    releaseLink.rel = "noopener noreferrer";
    releaseLink.textContent = "Visa release";
    footer.appendChild(releaseLink);

    article.append(header, footer);
    list.appendChild(article);
  }

  function render(payload) {
    const project = payload.project || {};
    const releases = Array.isArray(payload.releases) ? payload.releases : [];

    title.textContent = project.name || project.slug || "Releases";
    description.textContent =
      "Officiella publicerade GitHub Releases för " +
      (project.name || project.slug || "repositoryprojektet") + ".";

    projectLink.textContent = project.name || project.slug || "Projekt";
    projectLink.href = project.portalUrl || "/projekt";

    if (project.releasesUrl) {
      original.href = project.releasesUrl;
      original.hidden = false;
    } else {
      original.hidden = true;
      original.removeAttribute("href");
    }

    status.textContent = releases.length === 1
      ? "1 publicerad release"
      : releases.length + " publicerade releases";

    generated.textContent = payload.generatedAt
      ? "Snapshot " + formatDate(payload.generatedAt) + " · begränsad täckning"
      : "";

    errorState.hidden = true;
    clear();

    if (!releases.length) {
      emptyState(
        "Inga publicerade releases hittades.",
        "Drafts filtreras bort och projekt utan GitHub Releases visar en tom historik."
      );
      return;
    }

    for (const release of releases) renderRelease(release);
    document.title = (project.name || project.slug || "Releases") + " · Releases · Avkroken";
  }

  async function loadProjectReleases() {
    const slug = projectSlugFromLocation();
    if (!slug) return;

    const serial = ++requestSerial;
    title.textContent = "Läser in releases…";
    description.textContent = "Officiella publicerade GitHub Releases för repositoryprojektet.";
    projectLink.textContent = slug;
    projectLink.href = "/projekt/" + encodeURIComponent(slug);
    status.textContent = "Läser releaser…";
    generated.textContent = "";
    original.hidden = true;
    errorState.hidden = true;
    emptyState("Läser publicerade releases…", "");

    try {
      const response = await fetch(
        "/api/releases?project=" + encodeURIComponent(slug),
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) throw new Error("HTTP " + response.status);

      const payload = await response.json();
      if (serial !== requestSerial) return;
      if (payload.status !== "available") throw new Error("project releases unavailable");

      render(payload);
    } catch (error) {
      if (serial !== requestSerial) return;
      status.textContent = "Otillgänglig";
      generated.textContent = "";
      clear();
      original.hidden = true;
      errorState.hidden = false;
      console.error(error);
    }
  }

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "project-releases") {
      loadProjectReleases();
    }
  });

  if (projectSlugFromLocation()) loadProjectReleases();
})();
