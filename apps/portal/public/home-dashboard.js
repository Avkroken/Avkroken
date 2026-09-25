(() => {
  const projectCount = document.querySelector("#home-project-count");
  const projectCopy = document.querySelector("#home-project-copy");
  const providerStatus = document.querySelector("#home-provider-status");
  const providerCopy = document.querySelector("#home-provider-copy");
  const attentionCount = document.querySelector("#home-attention-count");
  const attentionCopy = document.querySelector("#home-attention-copy");
  const activityCount = document.querySelector("#home-activity-count");
  const activityCopy = document.querySelector("#home-activity-copy");
  const freshness = document.querySelector("#home-dashboard-freshness");
  const attentionList = document.querySelector("#home-attention-list");
  const recentActivity = document.querySelector("#home-recent-activity");
  const errorState = document.querySelector("#home-dashboard-error");

  let requestSerial = 0;
  let lastLoadedAt = 0;

  function isHomeRoute() {
    return (location.pathname.replace(/\/+$/, "") || "/") === "/";
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

  function statusLabel(value) {
    return {
      available: "Tillgänglig",
      stale: "Inaktuell",
      not_observed: "Ej observerad",
      not_configured: "Ej konfigurerad",
      permission_denied: "Behörighet saknas",
      unavailable: "Otillgänglig",
      error: "Fel",
      unknown: "Okänd"
    }[value] || String(value || "Okänd");
  }

  function coverageLabel(value) {
    return {
      complete: "komplett",
      partial: "delvis",
      sampled: "samplad",
      since_installation: "sedan installation",
      since_first_observation: "sedan första observation",
      unknown: "okänd"
    }[value] || "okänd";
  }

  async function readJson(path) {
    const response = await fetch(path, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }

  function clear(target) {
    target?.replaceChildren();
  }

  function emptyRow(target, title, copy) {
    clear(target);

    const box = document.createElement("div");
    box.className = "home-dashboard-empty";

    const strong = document.createElement("strong");
    strong.textContent = title;
    box.appendChild(strong);

    if (copy) {
      const span = document.createElement("span");
      span.textContent = copy;
      box.appendChild(span);
    }

    target?.appendChild(box);
  }

  function renderProjects(payload) {
    const projects = safeArray(payload?.projects);
    projectCount.textContent = String(projects.length);
    projectCopy.textContent = projects.length === 1
      ? "Publikt projekt i Portalens katalog."
      : "Publika projekt och verktyg i Portalens katalog.";
    return payload?.generatedAt || null;
  }

  function renderOperations(payload) {
    if (payload?.available !== true) {
      providerStatus.textContent = "Ej tillgänglig";
      providerCopy.textContent = "Ingen public-safe driftöversikt kunde läsas.";
      attentionCount.textContent = "—";
      attentionCopy.textContent = "Observerad capability-state saknas.";
      emptyRow(
        attentionList,
        "Driftunderlaget är inte tillgängligt.",
        "Portalen fabricerar inte provider- eller capability-status."
      );
      return payload?.generatedAt || null;
    }

    const providers = safeArray(payload.providers);
    const capabilities = safeArray(payload.capabilities);
    const availableProviders = providers.filter(item => item.status === "available").length;

    providerStatus.textContent = providers.length
      ? availableProviders + "/" + providers.length
      : "Ej observerad";
    providerCopy.textContent = providers.length
      ? "Observerade providers tillgängliga i Skvallerbyttans public-safe modell."
      : "Ingen providerstatus observerad.";

    const actionable = capabilities.filter(item =>
      ["stale", "not_observed", "not_configured", "permission_denied", "unavailable", "error", "unknown"]
        .includes(item.status)
    );

    attentionCount.textContent = String(actionable.length);
    attentionCopy.textContent = actionable.length
      ? "Observerade capabilities som kan behöva uppmärksamhet."
      : "Inga avvikelser i det aktuella observerade underlaget.";

    clear(attentionList);

    if (!actionable.length) {
      emptyRow(
        attentionList,
        "Inga observerade avvikelser.",
        "Detta beskriver bara det underlag som Skvallerbyttan faktiskt observerar."
      );
      return payload?.generatedAt || null;
    }

    for (const item of actionable.slice(0, 5)) {
      const row = document.createElement("div");
      row.className = "home-dashboard-row";

      const main = document.createElement("div");
      main.className = "home-dashboard-row-main";

      const name = document.createElement("strong");
      name.textContent = item.name || item.key || "Capability";

      const key = document.createElement("span");
      key.textContent = item.key || "";

      main.append(name, key);

      const state = document.createElement("div");
      state.className = "home-dashboard-row-state";

      const badge = document.createElement("span");
      badge.className = "operations-status-badge";
      badge.dataset.status = String(item.status || "unknown");
      badge.textContent = statusLabel(item.status);

      const observed = document.createElement("span");
      observed.textContent = formatDate(item.lastSuccessAt);

      state.append(badge, observed);
      row.append(main, state);
      attentionList.appendChild(row);
    }

    return payload?.generatedAt || null;
  }

  function eventLabel(value) {
    return String(value || "event")
      .replaceAll("_", " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function renderActivity(payload) {
    const activity = payload?.activity || {};
    const grouped = safeArray(activity.grouped);
    const recent = safeArray(activity.recent);
    const totalObserved = grouped.reduce(
      (sum, item) => sum + Math.max(0, Number(item.observedCount) || 0),
      0
    );

    if (activity.available !== true) {
      activityCount.textContent = "—";
      activityCopy.textContent = "Observerad aktivitet är inte tillgänglig.";
      emptyRow(
        recentActivity,
        activity.status === "not_observed"
          ? "Ingen public-safe aktivitet observerad ännu."
          : "Aktivitetsunderlaget är inte tillgängligt.",
        "Portalen skiljer på observerad aktivitet och komplett historik."
      );
      return payload?.generatedAt || null;
    }

    activityCount.textContent = String(totalObserved);
    activityCopy.textContent =
      "Observerade events senaste 7 dagarna · " +
      coverageLabel(payload?.source?.coverage) +
      " scope.";

    clear(recentActivity);

    if (!recent.length) {
      emptyRow(
        recentActivity,
        "Inga observerade events i perioden.",
        "Det betyder inte nödvändigtvis att ingen aktivitet har skett."
      );
      return payload?.generatedAt || null;
    }

    for (const item of recent.slice(0, 5)) {
      const row = document.createElement("div");
      row.className = "home-dashboard-row";

      const main = document.createElement("div");
      main.className = "home-dashboard-row-main";

      const project = document.createElement("a");
      project.href = item.projectUrl || "/projekt";
      project.dataset.portalRoute = "";
      project.textContent = item.projectName || item.projectSlug || "Projekt";

      const event = document.createElement("strong");
      event.textContent = eventLabel(item.event) +
        (item.action ? " · " + String(item.action) : "");

      const meta = document.createElement("span");
      meta.textContent =
        String(item.source || "källa") +
        " · " +
        coverageLabel(item.coverage);

      main.append(project, event, meta);

      const state = document.createElement("div");
      state.className = "home-dashboard-row-state";

      const time = document.createElement("time");
      time.dateTime = item.receivedAt || "";
      time.textContent = formatDate(item.receivedAt);

      state.appendChild(time);
      row.append(main, state);
      recentActivity.appendChild(row);
    }

    return payload?.generatedAt || null;
  }

  function failedCard(targetValue, targetCopy, copy) {
    targetValue.textContent = "—";
    targetCopy.textContent = copy;
  }

  async function loadHomeDashboard({ force = false } = {}) {
    if (!isHomeRoute()) return;
    if (!force && lastLoadedAt && Date.now() - lastLoadedAt < 60_000) return;

    const serial = ++requestSerial;
    freshness.textContent = "Läser public-safe nuläge…";
    errorState.hidden = true;

    const results = await Promise.allSettled([
      readJson("/api/projects"),
      readJson("/api/operations"),
      readJson("/api/activity?days=7")
    ]);

    if (serial !== requestSerial) return;

    const [projectsResult, operationsResult, activityResult] = results;
    const generated = [];
    let succeeded = 0;

    if (projectsResult.status === "fulfilled") {
      generated.push(renderProjects(projectsResult.value));
      succeeded += 1;
    } else {
      failedCard(projectCount, projectCopy, "Projektkatalogen är tillfälligt otillgänglig.");
    }

    if (operationsResult.status === "fulfilled") {
      generated.push(renderOperations(operationsResult.value));
      succeeded += 1;
    } else {
      failedCard(providerStatus, providerCopy, "Driftöversikten är tillfälligt otillgänglig.");
      failedCard(attentionCount, attentionCopy, "Capability-state kunde inte läsas.");
      emptyRow(
        attentionList,
        "Driftunderlaget kunde inte läsas.",
        "Öppna Drift & insyn för detaljer när källan åter är tillgänglig."
      );
    }

    if (activityResult.status === "fulfilled") {
      generated.push(renderActivity(activityResult.value));
      succeeded += 1;
    } else {
      failedCard(activityCount, activityCopy, "Aktivitetsunderlaget är tillfälligt otillgängligt.");
      emptyRow(
        recentActivity,
        "Aktivitet kunde inte läsas.",
        "Ingen aktivitet antas när observationskällan saknas."
      );
    }

    const timestamps = generated
      .filter(Boolean)
      .map(value => new Date(value))
      .filter(date => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    freshness.textContent = timestamps.length
      ? "Senaste snapshot " + formatDate(timestamps[0].toISOString()) +
        " · " + succeeded + "/3 källor lästa"
      : succeeded + "/3 källor lästa";

    if (succeeded === 0) {
      errorState.hidden = false;
    }

    lastLoadedAt = Date.now();
  }

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "home") loadHomeDashboard();
  });

  if (isHomeRoute()) loadHomeDashboard({ force: true });
})();
