(() => {
  const title = document.querySelector("#wiki-title");
  const description = document.querySelector("#wiki-description");
  const projectLink = document.querySelector("#wiki-project-link");
  const navigation = document.querySelector("#wiki-navigation-links");
  const docList = document.querySelector("#wiki-doc-list");
  const collaboration = document.querySelector("#wiki-collaboration-links");
  const originalLink = document.querySelector("#wiki-original-link");
  const errorState = document.querySelector("#wiki-error");

  let requestSerial = 0;

  function routeSlug() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const match = path.match(/^\/projekt\/([^/]+)\/wiki(?:\/.*)?$/);
    if (!match) return null;

    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }

  function portalDocsUrl(slug, path = null) {
    let url = "/projekt/" + encodeURIComponent(slug) + "/dokumentation";
    if (!path) return url;

    const encoded = String(path)
      .split("/")
      .filter(Boolean)
      .map(segment => encodeURIComponent(segment))
      .join("/");

    return encoded ? url + "/" + encoded : url;
  }

  function clear(target) {
    target?.replaceChildren();
  }

  function link(label, href, { internal = false, className = "" } = {}) {
    const element = document.createElement("a");
    element.textContent = label;
    element.href = href;
    if (className) element.className = className;

    if (internal) {
      element.dataset.portalRoute = "";
    } else {
      element.target = "_blank";
      element.rel = "noopener noreferrer";
    }

    return element;
  }

  function preferredOverviewPage(entry) {
    if (!entry || !Array.isArray(entry.pages)) return null;

    for (const candidate of ["README.md", "docs/index.md"]) {
      const page = entry.pages.find(item => item.path === candidate);
      if (page) return page;
    }

    return entry.pages[0] || null;
  }

  function showError(slug, message) {
    title.textContent = "Wiki saknas";
    description.textContent = message;
    projectLink.textContent = slug || "Projekt";
    projectLink.href = slug ? "/projekt/" + encodeURIComponent(slug) : "/projekt";
    clear(navigation);
    clear(docList);
    clear(collaboration);
    originalLink.hidden = true;
    errorState.hidden = false;
  }

  function render(project, docsEntry) {
    const slug = project.slug;
    const overview = preferredOverviewPage(docsEntry);

    title.textContent = project.name + " Wiki";
    description.textContent =
      "Navigation och presentation ovanpå " + project.name +
      "s repositoryägda README och versionsstyrda dokumentation.";
    projectLink.textContent = project.name;
    projectLink.href = project.portalUrl || "/projekt/" + encodeURIComponent(slug);
    originalLink.href = project.wiki;
    originalLink.hidden = false;
    errorState.hidden = true;

    clear(navigation);
    navigation.appendChild(link("Home", project.wikiPortalUrl, { internal: true }));

    if (project.documentation) {
      navigation.appendChild(link("Dokumentation", project.documentation, { internal: true }));
    }
    if (overview) {
      navigation.appendChild(
        link(
          overview.label || "Översikt",
          portalDocsUrl(slug, overview.path),
          { internal: true }
        )
      );
    }
    navigation.appendChild(link("Repository", project.repository));

    clear(docList);
    const pages = Array.isArray(docsEntry?.pages) ? docsEntry.pages : [];

    if (!pages.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.innerHTML =
        "<strong>Ingen publik README/docs hittades.</strong>" +
        "<span>Original-Wikin finns fortfarande tillgänglig via canonical länken.</span>";
      docList.appendChild(empty);
    } else {
      for (const page of pages) {
        const item = document.createElement("a");
        item.className = "wiki-doc-item";
        item.href = portalDocsUrl(slug, page.path);
        item.dataset.portalRoute = "";

        const label = document.createElement("strong");
        label.textContent = page.label || page.path;
        const path = document.createElement("span");
        path.textContent = page.path;

        item.append(label, path);
        docList.appendChild(item);
      }
    }

    clear(collaboration);
    collaboration.appendChild(link("Issues", project.issues, { className: "portal-button" }));
    if (project.discussions) {
      collaboration.appendChild(
        link("Discussions", project.discussions, { className: "portal-button" })
      );
    }
    collaboration.appendChild(
      link("Repository", project.repository, { className: "portal-button" })
    );

    document.title = project.name + " Wiki · Avkroken";
  }

  async function loadWiki() {
    const slug = routeSlug();
    if (!slug) return;

    const serial = ++requestSerial;
    title.textContent = "Läser in Wiki…";
    description.textContent =
      "Wiki är ett navigations- och presentationslager ovanpå repositoryägd dokumentation.";
    errorState.hidden = true;

    try {
      const [projectResponse, docsResponse] = await Promise.all([
        fetch("/api/projects", { headers: { Accept: "application/json" } }),
        fetch("/api/docs", { headers: { Accept: "application/json" } })
      ]);

      if (!projectResponse.ok || !docsResponse.ok) {
        throw new Error("catalog_unavailable");
      }

      const [projectPayload, docsCatalog] = await Promise.all([
        projectResponse.json(),
        docsResponse.json()
      ]);
      if (serial !== requestSerial) return;

      const projects = Array.isArray(projectPayload.projects) ? projectPayload.projects : [];
      const project = projects.find(item => item.slug === slug);

      if (!project || !project.wiki || !project.wikiPortalUrl) {
        showError(slug, "Projektet har ingen publik repository-Wiki i den aktuella projektkatalogen.");
        return;
      }

      const docsEntry = Array.isArray(docsCatalog)
        ? docsCatalog.find(item => (item.key || item.name) === slug)
        : null;

      render(project, docsEntry);
    } catch (error) {
      if (serial !== requestSerial) return;
      showError(slug, "Wiki- och dokumentationskatalogen är tillfälligt otillgänglig.");
      console.error(error);
    }
  }

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "wiki") loadWiki();
  });

  if (routeSlug()) loadWiki();
})();
