(() => {
  const status = document.querySelector("#operations-status");
  const generated = document.querySelector("#operations-generated");
  const providerGrid = document.querySelector("#operations-provider-grid");
  const capabilitySummary = document.querySelector("#operations-capability-summary");
  const activityTotal = document.querySelector("#operations-activity-total");
  const activityCopy = document.querySelector("#operations-activity-copy");
  const capabilitiesTarget = document.querySelector("#operations-capabilities");
  const activityTarget = document.querySelector("#operations-activity-list");
  const coverageTarget = document.querySelector("#operations-coverage");
  const errorState = document.querySelector("#operations-error");

  let requestSerial = 0;

  function isOperationsRoute() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    return path === "/drift" || path.startsWith("/drift/");
  }

  function clear(target) {
    target?.replaceChildren();
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
      unknown: "Okänd",
      not_supported: "Stöds inte",
      not_exposed_by_provider: "Exponeras inte av provider"
    }[value] || "Okänd";
  }

  function freshnessLabel(value) {
    return {
      fresh: "Fresh",
      stale: "Stale",
      unknown: "Okänd"
    }[value] || "Okänd";
  }

  function providerLabel(value) {
    return value === "github" ? "GitHub" : value === "cloudflare" ? "Cloudflare" : String(value || "Provider");
  }

  function statusBadge(value) {
    const badge = document.createElement("span");
    badge.className = "operations-status-badge";
    badge.dataset.status = String(value || "unknown");
    badge.textContent = statusLabel(value);
    return badge;
  }

  function renderProviders(providers) {
    clear(providerGrid);
    for (const provider of safeArray(providers)) {
      const card = document.createElement("article");
      card.className = "portal-info-card";

      const label = document.createElement("div");
      label.className = "portal-meta-label";
      label.textContent = providerLabel(provider.provider).toUpperCase();

      const heading = document.createElement("h3");
      heading.appendChild(statusBadge(provider.status));

      const copy = document.createElement("p");
      copy.textContent = "Senast observerad: " + formatDate(provider.lastObservedAt);

      card.append(label, heading, copy);
      providerGrid.appendChild(card);
    }

    if (!providerGrid.children.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Ingen providerstatus observerad.";
      providerGrid.appendChild(empty);
    }
  }

  function renderCapabilities(capabilities) {
    clear(capabilitiesTarget);
    const items = safeArray(capabilities);
    const available = items.filter(item => item.status === "available").length;
    const stale = items.filter(item => item.status === "stale").length;
    capabilitySummary.textContent = available + " / " + items.length + " tillgängliga" +
      (stale ? " · " + stale + " stale" : "");

    for (const provider of ["github", "cloudflare"]) {
      const rows = items.filter(item => item.provider === provider);
      if (!rows.length) continue;

      const details = document.createElement("details");
      details.className = "operations-capability-group";
      details.open = true;

      const summary = document.createElement("summary");
      summary.textContent = providerLabel(provider) + " · " + rows.length + " capabilities";
      details.appendChild(summary);

      const list = document.createElement("div");
      list.className = "operations-capability-list";

      for (const item of rows) {
        const row = document.createElement("div");
        row.className = "operations-capability-row";

        const main = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.name || item.key;
        const key = document.createElement("span");
        key.className = "operations-capability-key";
        key.textContent = item.key || "";
        main.append(name, key);

        const state = document.createElement("div");
        state.className = "operations-capability-state";
        state.appendChild(statusBadge(item.status));

        const freshness = document.createElement("span");
        freshness.className = "operations-freshness";
        freshness.textContent = freshnessLabel(item.freshness) + " · " + formatDate(item.lastSuccessAt);
        state.appendChild(freshness);

        if (item.scopeCoverage) {
          const scope = document.createElement("span");
          scope.className = "operations-scope";
          scope.textContent =
            "Scope " + Number(item.scopeCoverage.available || 0) +
            "/" + Number(item.scopeCoverage.expected || 0) + " available";
          state.appendChild(scope);
        }

        row.append(main, state);
        list.appendChild(row);
      }

      details.appendChild(list);
      capabilitiesTarget.appendChild(details);
    }

    if (!capabilitiesTarget.children.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Inga capability-observationer tillgängliga.";
      capabilitiesTarget.appendChild(empty);
    }
  }

  function renderActivity(activity) {
    clear(activityTarget);
    clear(coverageTarget);

    if (!activity?.available) {
      activityTotal.textContent = "Ej tillgänglig";
      activityCopy.textContent = "Skvallerbyttan har ingen tillgänglig aggregerad activity-state.";
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Ingen observerad aktivitetsdata tillgänglig.";
      activityTarget.appendChild(empty);
      return;
    }

    activityTotal.textContent = Number(activity.observedTotal || 0) + " observerade events";
    activityCopy.textContent =
      "Summering för de senaste " + Number(activity.period?.days || 1) +
      " dygnen. Perioden deklareras inte som komplett.";

    for (const item of safeArray(activity.byCapability)) {
      const row = document.createElement("div");
      row.className = "operations-activity-row";

      const title = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = item.capability || "Capability";
      const provider = document.createElement("span");
      provider.textContent = providerLabel(item.provider);
      title.append(strong, provider);

      const count = document.createElement("span");
      count.className = "operations-activity-count";
      count.textContent = String(Number(item.observedCount || 0));

      row.append(title, count);
      activityTarget.appendChild(row);
    }

    if (!activityTarget.children.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Inga events observerade under perioden.";
      activityTarget.appendChild(empty);
    }

    const coverageRows = safeArray(activity.coverage);
    if (coverageRows.length) {
      const heading = document.createElement("h3");
      heading.textContent = "Täckning";
      coverageTarget.appendChild(heading);

      for (const item of coverageRows) {
        const line = document.createElement("div");
        line.className = "operations-coverage-row";
        line.textContent =
          providerLabel(item.provider) + " · " +
          String(item.capability || "") + " · " +
          String(item.source || "") + " · " +
          String(item.coverage || "unknown") + " · " +
          Number(item.observedCount || 0) + " observerade";
        coverageTarget.appendChild(line);
      }
    }
  }

  function render(payload) {
    status.textContent = "Observerad state";
    generated.textContent = payload.generatedAt
      ? "Snapshot " + formatDate(payload.generatedAt)
      : "";
    errorState.hidden = true;

    renderProviders(payload.providers);
    renderCapabilities(payload.capabilities);
    renderActivity(payload.activity);
  }

  async function loadOperations() {
    if (!isOperationsRoute()) return;

    const serial = ++requestSerial;
    status.textContent = "Läser observerad state…";
    generated.textContent = "";
    errorState.hidden = true;

    try {
      const response = await fetch("/api/operations", {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("HTTP " + response.status);

      const payload = await response.json();
      if (serial !== requestSerial) return;
      if (payload.available !== true) throw new Error("operations unavailable");

      render(payload);
      document.title = "Drift & insyn · Avkroken";
    } catch (error) {
      if (serial !== requestSerial) return;
      status.textContent = "Otillgänglig";
      generated.textContent = "";
      clear(providerGrid);
      clear(capabilitiesTarget);
      clear(activityTarget);
      clear(coverageTarget);
      capabilitySummary.textContent = "—";
      activityTotal.textContent = "—";
      activityCopy.textContent = "Ingen operativ state visas när källan inte kan läsas.";
      errorState.hidden = false;
      console.error(error);
    }
  }

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "operations") loadOperations();
  });

  if (isOperationsRoute()) loadOperations();
})();
