(() => {
  const breadcrumbs = document.querySelector("#activity-breadcrumbs");
  const projectLink = document.querySelector("#activity-project-link");
  const title = document.querySelector("#activity-title");
  const description = document.querySelector("#activity-description");
  const status = document.querySelector("#activity-status");
  const generated = document.querySelector("#activity-generated");
  const original = document.querySelector("#activity-original");
  const observedCount = document.querySelector("#activity-observed-count");
  const repositoryCount = document.querySelector("#activity-repository-count");
  const coverageSummary = document.querySelector("#activity-coverage-summary");
  const list = document.querySelector("#activity-list");
  const errorState = document.querySelector("#activity-error");
  const periodButtons = [...document.querySelectorAll("[data-activity-days]")];

  let requestSerial = 0;
  let selectedDays = 7;

  function routeState() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/aktivitet") return { active: true, projectSlug: null };

    const match = path.match(/^\/projekt\/([^/]+)\/aktivitet$/);
    if (!match) return { active: false, projectSlug: null };

    try {
      return { active: true, projectSlug: decodeURIComponent(match[1]) };
    } catch {
      return { active: false, projectSlug: null };
    }
  }

  function clear() {
    list?.replaceChildren();
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function formatDate(value) {
    if (!value) return "Ej observerad";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Ej observerad";

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

  function coverageLabel(value) {
    return {
      complete: "Komplett",
      partial: "Delvis",
      sampled: "Samplad",
      since_installation: "Sedan installation",
      since_first_observation: "Sedan första observation",
      unknown: "Okänd"
    }[value] || "Okänd";
  }

  function sourceLabel(value) {
    return {
      webhook: "Webhook",
      audit_log: "Audit log",
      snapshot_diff: "Snapshot-diff",
      reconciliation: "Reconciliation"
    }[value] || String(value || "Källa");
  }

  function eventLabel(value) {
    return String(value || "event")
      .replaceAll("_", " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function renderEvent(item) {
    const article = document.createElement("article");
    article.className = "activity-row";

    const main = document.createElement("div");
    main.className = "activity-row-main";

    const project = document.createElement("a");
    project.className = "activity-project-link";
    project.href = item.projectUrl || "/projekt";
    project.dataset.portalRoute = "";
    project.textContent = item.projectName || item.projectSlug || "Projekt";

    const heading = document.createElement("h2");
    heading.textContent = eventLabel(item.event) +
      (item.action ? " · " + String(item.action) : "");

    const meta = document.createElement("div");
    meta.className = "activity-row-meta";

    const source = document.createElement("span");
    source.textContent = sourceLabel(item.source);

    const coverage = document.createElement("span");
    coverage.textContent = coverageLabel(item.coverage);

    const capability = document.createElement("span");
    capability.textContent = item.capability || "";

    meta.append(source, coverage, capability);
    main.append(project, heading, meta);

    const time = document.createElement("div");
    time.className = "activity-row-time";

    const received = document.createElement("time");
    received.dateTime = item.receivedAt || "";
    received.textContent = formatDate(item.receivedAt);

    const repository = document.createElement("span");
    repository.textContent = item.repository || "";

    time.append(received, repository);
    article.append(main, time);
    list.appendChild(article);
  }

  function render(payload, projectSlug) {
    const activity = payload.activity || {};
    const project = payload.project || null;
    const recent = safeArray(activity.recent);
    const grouped = safeArray(activity.grouped);
    const coverage = safeArray(activity.coverage);

    if (projectSlug && project) {
      breadcrumbs.hidden = false;
      projectLink.textContent = project.name || project.slug || projectSlug;
      projectLink.href = project.portalUrl || "/projekt/" + encodeURIComponent(projectSlug);
      title.textContent = (project.name || project.slug || projectSlug) + " · Aktivitet";
      description.textContent =
        "Observerade GitHub-händelser för repositoryprojektet. Coverage visas explicit och är inte samma sak som komplett historik.";
      if (project.repositoryUrl) {
        original.href = project.repositoryUrl;
        original.hidden = false;
      } else {
        original.hidden = true;
        original.removeAttribute("href");
      }
    } else {
      breadcrumbs.hidden = true;
      title.textContent = "Aktivitet";
      description.textContent =
        "Observerade GitHub-händelser från Portalens publika repositoryprojekt. Coverage visas explicit och ska inte tolkas som komplett historik.";
      original.hidden = true;
      original.removeAttribute("href");
    }

    generated.textContent = payload.generatedAt
      ? "Snapshot " + formatDate(payload.generatedAt) +
        (payload.source?.coverage === "partial" ? " · delvis scope" : " · begränsad scope")
      : "";

    const totalObserved = grouped.reduce(
      (sum, item) => sum + Math.max(0, Number(item.observedCount) || 0),
      0
    );
    observedCount.textContent = String(totalObserved);
    repositoryCount.textContent = String(Math.max(0, Number(activity.repositoryCount) || 0));

    const coverageKinds = [...new Set(
      coverage.map(item => coverageLabel(item.coverage)).filter(Boolean)
    )];
    coverageSummary.textContent = coverageKinds.length
      ? coverageKinds.join(" · ")
      : "Ej observerad";

    errorState.hidden = true;
    clear();

    if (activity.available !== true) {
      status.textContent = activity.status === "not_configured"
        ? "Ej konfigurerad"
        : activity.status === "not_observed"
          ? "Ej observerad"
          : "Otillgänglig";
      emptyState(
        activity.status === "not_observed"
          ? "Ingen public-safe observation finns ännu."
          : "Aktivitetsdata är inte tillgänglig.",
        "Portalen fabricerar inte aktivitet när observationsunderlaget saknas."
      );
      return;
    }

    status.textContent = totalObserved === 1
      ? "1 observerat event"
      : totalObserved + " observerade event";

    if (!recent.length) {
      emptyState(
        "Inga observerade events i perioden.",
        "Det betyder inte nödvändigtvis att ingen aktivitet har skett; coverage kan vara begränsad."
      );
      return;
    }

    for (const item of recent) renderEvent(item);
    document.title = project
      ? (project.name || project.slug || projectSlug) + " · Aktivitet · Avkroken"
      : "Aktivitet · Avkroken";
  }

  async function loadActivity() {
    const route = routeState();
    if (!route.active) return;

    const serial = ++requestSerial;
    status.textContent = "Läser observerad aktivitet…";
    generated.textContent = "";
    observedCount.textContent = "—";
    repositoryCount.textContent = "—";
    coverageSummary.textContent = "—";
    errorState.hidden = true;
    emptyState("Läser observerade events…", "");

    const params = new URLSearchParams({ days: String(selectedDays) });
    if (route.projectSlug) params.set("project", route.projectSlug);

    try {
      const response = await fetch("/api/activity?" + params.toString(), {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("HTTP " + response.status);

      const payload = await response.json();
      if (serial !== requestSerial) return;
      if (payload.status !== "available") throw new Error("activity unavailable");

      render(payload, route.projectSlug);
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

  for (const button of periodButtons) {
    button.addEventListener("click", () => {
      const days = Number(button.dataset.activityDays);
      if (![1, 7, 30].includes(days) || days === selectedDays) return;
      selectedDays = days;
      for (const item of periodButtons) {
        item.setAttribute(
          "aria-pressed",
          String(Number(item.dataset.activityDays) === selectedDays)
        );
      }
      loadActivity();
    });
  }

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "activity") loadActivity();
  });

  if (routeState().active) loadActivity();
})();
