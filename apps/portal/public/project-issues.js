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

  function stateLabel(value) {
    return value === "closed" ? "Stängd" : "Öppen";
  }

  function renderIssue(issue) {
    const article = document.createElement("article");
    article.className = "project-issue";

    const header = document.createElement("div");
    header.className = "project-issue-head";

    const identity = document.createElement("div");

    const meta = document.createElement("div");
    meta.className = "project-issue-meta";

    const number = document.createElement("span");
    number.textContent = "#" + Number(issue.number || 0);

    const state = document.createElement("span");
    state.className = "project-issue-state";
    state.dataset.state = issue.state || "open";
    state.textContent = stateLabel(issue.state);

    meta.append(number, state);

    const heading = document.createElement("h2");
    heading.textContent = issue.title || "Issue";

    identity.append(meta, heading);

    const dates = document.createElement("div");
    dates.className = "project-issue-dates";

    const updated = document.createElement("span");
    updated.textContent = "Uppdaterad " + formatDate(issue.updatedAt);

    const comments = document.createElement("span");
    comments.textContent = Number(issue.comments || 0) + " kommentarer";

    dates.append(updated, comments);
    header.append(identity, dates);

    const labels = Array.isArray(issue.labels) ? issue.labels : [];
    const labelsRow = document.createElement("div");
    labelsRow.className = "project-issue-labels";

    for (const labelName of labels) {
      const label = document.createElement("span");
      label.className = "project-issue-label";
      label.textContent = labelName;
      labelsRow.appendChild(label);
    }

    const footer = document.createElement("div");
    footer.className = "project-issue-footer";

    const repository = document.createElement("span");
    repository.textContent = issue.repository || "";
    footer.appendChild(repository);

    const issueLink = document.createElement("a");
    issueLink.href = issue.url;
    issueLink.target = "_blank";
    issueLink.rel = "noopener noreferrer";
    issueLink.textContent = "Visa Issue";
    footer.appendChild(issueLink);

    article.append(header);
    if (labelsRow.children.length) article.appendChild(labelsRow);
    article.appendChild(footer);
    list.appendChild(article);
  }

  function render(payload) {
    const project = payload.project || {};
    const issues = Array.isArray(payload.issues) ? payload.issues : [];

    title.textContent = project.name || project.slug || "Issues";
    description.textContent =
      "Publika GitHub Issues för " +
      (project.name || project.slug || "repositoryprojektet") +
      ". Pull requests filtreras bort.";

    projectLink.textContent = project.name || project.slug || "Projekt";
    projectLink.href = project.portalUrl || "/projekt";

    if (project.issuesUrl) {
      original.href = project.issuesUrl;
      original.hidden = false;
    } else {
      original.hidden = true;
      original.removeAttribute("href");
    }

    const openCount = issues.filter(item => item.state === "open").length;
    const closedCount = issues.filter(item => item.state === "closed").length;
    status.textContent =
      issues.length + " Issues · " + openCount + " öppna · " + closedCount + " stängda";

    generated.textContent = payload.generatedAt
      ? "Snapshot " + formatDate(payload.generatedAt) + " · begränsad täckning"
      : "";

    errorState.hidden = true;
    clear();

    if (!issues.length) {
      emptyState(
        "Inga Issues hittades i den begränsade vyn.",
        "Pull requests filtreras bort. Canonical Issue-historik finns kvar på GitHub."
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
    description.textContent = "Publika GitHub Issues för repositoryprojektet.";
    projectLink.textContent = slug;
    projectLink.href = "/projekt/" + encodeURIComponent(slug);
    status.textContent = "Läser Issues…";
    generated.textContent = "";
    original.hidden = true;
    errorState.hidden = true;
    emptyState("Läser publika Issues…", "");

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
