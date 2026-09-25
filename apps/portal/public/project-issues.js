(() => {
  const title = document.querySelector("#project-issues-title");
  const description = document.querySelector("#project-issues-description");
  const projectLink = document.querySelector("#project-issues-project-link");
  const status = document.querySelector("#project-issues-status");
  const generated = document.querySelector("#project-issues-generated");
  const original = document.querySelector("#project-issues-original");
  const list = document.querySelector("#project-issues-list");
  const errorState = document.querySelector("#project-issues-error");

  let requestSerial = 0;

  function projectSlugFromLocation() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const match = path.match(/^\/projekt\/([^/]+)\/issues$/);
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

  function renderIssue(issue) {
    const article = document.createElement("article");
    article.className = "project-issue";

    const main = document.createElement("div");
    main.className = "project-issue-main";

    const number = document.createElement("span");
    number.className = "project-issue-number";
    number.textContent = "#" + Number(issue.number || 0);

    const issueLink = document.createElement("a");
    issueLink.className = "project-issue-title";
    issueLink.href = issue.url;
    issueLink.target = "_blank";
    issueLink.rel = "noopener noreferrer";
    issueLink.textContent = issue.title || "Issue";

    main.append(number, issueLink);

    const meta = document.createElement("div");
    meta.className = "project-issue-meta";

    const updated = document.createElement("span");
    updated.textContent = "Uppdaterad " + formatDate(issue.updatedAt);

    const created = document.createElement("span");
    created.textContent = "Skapad " + formatDate(issue.createdAt);

    meta.append(updated, created);
    article.append(main, meta);
    list.appendChild(article);
  }

  function render(payload) {
    const project = payload.project || {};
    const issues = Array.isArray(payload.issues) ? payload.issues : [];
    const coverage = payload.source?.coverage;

    title.textContent = project.name || project.slug || "Issues";
    description.textContent =
      "Öppna publika GitHub Issues för " +
      (project.name || project.slug || "repositoryprojektet") + ".";

    projectLink.textContent = project.name || project.slug || "Projekt";
    projectLink.href = project.portalUrl || "/projekt";

    if (project.issuesUrl) {
      original.href = project.issuesUrl;
      original.hidden = false;
    } else {
      original.hidden = true;
      original.removeAttribute("href");
    }

    status.textContent = issues.length === 1
      ? "1 öppet Issue"
      : issues.length + " öppna Issues";

    generated.textContent = payload.generatedAt
      ? "Snapshot " + formatDate(payload.generatedAt) +
        (coverage === "partial" ? " · delvis täckning" : " · begränsad täckning")
      : "";

    errorState.hidden = true;
    clear();

    if (!issues.length) {
      emptyState(
        "Inga öppna Issues hittades.",
        "Pull requests filtreras bort från GitHubs gemensamma Issues-endpoint."
      );
      return;
    }

    for (const issue of issues) renderIssue(issue);
    document.title = (project.name || project.slug || "Issues") + " · Issues · Avkroken";
  }

  async function loadProjectIssues() {
    const slug = projectSlugFromLocation();
    if (!slug) return;

    const serial = ++requestSerial;
    title.textContent = "Läser in Issues…";
    description.textContent = "Öppna publika GitHub Issues för repositoryprojektet.";
    projectLink.textContent = slug;
    projectLink.href = "/projekt/" + encodeURIComponent(slug);
    status.textContent = "Läser Issues…";
    generated.textContent = "";
    original.hidden = true;
    errorState.hidden = true;
    emptyState("Läser öppna Issues…", "");

    try {
      const response = await fetch(
        "/api/issues?project=" + encodeURIComponent(slug),
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) throw new Error("HTTP " + response.status);

      const payload = await response.json();
      if (serial !== requestSerial) return;
      if (payload.status !== "available") throw new Error("project Issues unavailable");

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
    if (event.detail?.view === "project-issues") {
      loadProjectIssues();
    }
  });

  if (projectSlugFromLocation()) loadProjectIssues();
})();
