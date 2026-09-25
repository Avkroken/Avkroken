(() => {
  const breadcrumbs = document.querySelector("#activity-breadcrumbs");
  const projectLink = document.querySelector("#activity-project-link");
  const title = document.querySelector("#activity-title");
  const description = document.querySelector("#activity-description");
  const status = document.querySelector("#activity-status");
  const generated = document.querySelector("#activity-generated");
  const list = document.querySelector("#activity-list");
  const errorState = document.querySelector("#activity-error");

  let requestSerial = 0;

  function projectSlugFromLocation() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const match = path.match(/^\/projekt\/([^/]+)\/aktivitet$/);
    if (!match) return null;

    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }

  function isActivityRoute() {
    return location.pathname === "/aktivitet" || Boolean(projectSlugFromLocation());
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

  function kindLabel(kind) {
    return {
      push: "Push",
      pull_request: "Pull request",
      issue: "Issue",
      release: "Release",
      repository: "Repository"
    }[kind] || "Event";
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

  function renderEvent(item) {
    const row = document.createElement("article");
    row.className = "activity-row";

    const marker = document.createElement("span");
    marker.className = "activity-marker";
    marker.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    body.className = "activity-row-body";

    const top = document.createElement("div");
    top.className = "activity-row-top";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = kindLabel(item.kind);

    const project = document.createElement("a");
    project.href = item.projectUrl;
    project.dataset.portalRoute = "";
    project.className = "activity-project";
    project.textContent = item.projectName || item.projectSlug || "Projekt";

    const time = document.createElement("time");
    time.dateTime = item.occurredAt || "";
    time.textContent = formatDate(item.occurredAt);

    top.append(badge, project, time);

    const summary = document.createElement("a");
    summary.className = "activity-summary";
    summary.href = item.url;
    summary.target = "_blank";
    summary.rel = "noopener noreferrer";
    summary.textContent = item.summary || "Repositoryevent";

    const repository = document.createElement("span");
    repository.className = "activity-repository";
    repository.textContent = item.repository || "";

    body.append(top, summary, repository);
    row.append(marker, body);
    list.appendChild(row);
  }

  function render(payload, requestedSlug) {
    const project = payload.project || null;
    const events = Array.isArray(payload.events) ? payload.events : [];

    if (project) {
      breadcrumbs.hidden = false;
      projectLink.textContent = project.name || project.slug;
      projectLink.href = project.portalUrl || "/projekt";
      title.textContent = (project.name || project.slug) + " · Aktivitet";
      description.textContent =
        "Publika repositoryevents för projektet. GitHubs Events-källa är fördröjd och begränsad.";
    } else {
      breadcrumbs.hidden = true;
      projectLink.textContent = "Projekt";
      projectLink.href = "/projekt";
      title.textContent = "Aktivitet";
      description.textContent =
        "Publika repositoryevents från fristående Avkroken-projekt. Strömmen är fördröjd och begränsad, inte komplett eller realtid.";
    }

    status.textContent = events.length === 1
      ? "1 observerat publikt event"
      : events.length + " observerade publika events";

    generated.textContent = payload.generatedAt
      ? "Snapshot " + formatDate(payload.generatedAt) + " · bounded · ej realtid"
      : "bounded · ej realtid";

    errorState.hidden = true;
    clear();

    if (!events.length) {
      emptyState(
        "Inga accepterade publika events i snapshoten.",
        requestedSlug
          ? "Projektet har inga accepterade event bland GitHubs senaste publika organisationshändelser."
          : "Källan är begränsad till GitHubs senaste publika organisationshändelser."
      );
    } else {
      for (const item of events) renderEvent(item);
    }

    document.title = project
      ? (project.name || project.slug) + " · Aktivitet · Avkroken"
      : "Aktivitet · Avkroken";
  }

  async function loadActivity() {
    if (!isActivityRoute()) return;

    const projectSlug = projectSlugFromLocation();
    const serial = ++requestSerial;

    status.textContent = "Läser publik aktivitet…";
    generated.textContent = "";
    errorState.hidden = true;
    emptyState("Läser publika repositoryevents…", "");

    try {
      const suffix = projectSlug ? "?project=" + encodeURIComponent(projectSlug) : "";
      const response = await fetch("/api/activity" + suffix, {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) throw new Error("HTTP " + response.status);
      const payload = await response.json();

      if (serial !== requestSerial) return;
      if (payload.status !== "available") throw new Error("Activity unavailable");

      render(payload, projectSlug);
    } catch (error) {
      if (serial !== requestSerial) return;

      breadcrumbs.hidden = !projectSlug;
      if (projectSlug) {
        projectLink.textContent = projectSlug;
        projectLink.href = "/projekt/" + encodeURIComponent(projectSlug);
        title.textContent = projectSlug + " · Aktivitet";
      } else {
        title.textContent = "Aktivitet";
      }

      status.textContent = "Otillgänglig";
      generated.textContent = "";
      clear();
      errorState.hidden = false;
      console.error(error);
    }
  }

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "activity") loadActivity();
  });

  if (isActivityRoute()) loadActivity();
})();
