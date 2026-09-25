(() => {
  const title = document.querySelector("#project-builds-title");
  const description = document.querySelector("#project-builds-description");
  const projectLink = document.querySelector("#project-builds-project-link");
  const status = document.querySelector("#project-builds-status");
  const generated = document.querySelector("#project-builds-generated");
  const original = document.querySelector("#project-builds-original");
  const summaryTarget = document.querySelector("#project-builds-summary");
  const detailTarget = document.querySelector("#project-builds-detail");
  const unavailable = document.querySelector("#project-builds-unavailable");
  const errorState = document.querySelector("#project-builds-error");

  const passRate = document.querySelector("#project-builds-pass-rate");
  const failures = document.querySelector("#project-builds-failures");
  const duration = document.querySelector("#project-builds-duration");
  const mttr = document.querySelector("#project-builds-mttr");
  const coverage = document.querySelector("#project-builds-coverage");
  const completed = document.querySelector("#project-builds-completed");
  const success = document.querySelector("#project-builds-success");
  const failed = document.querySelector("#project-builds-failed");
  const cancelled = document.querySelector("#project-builds-cancelled");
  const running = document.querySelector("#project-builds-running");
  const latestFailure = document.querySelector("#project-builds-latest-failure");

  let requestSerial = 0;

  function projectSlugFromLocation() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const match = path.match(/^\/projekt\/([^/]+)\/builds$/);
    if (!match) return null;

    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
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

  function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("sv-SE", {
      style: "percent",
      maximumFractionDigits: 1
    }).format(number);
  }

  function formatDuration(value) {
    const ms = Number(value);
    if (!Number.isFinite(ms) || ms < 0) return "—";
    if (ms < 60_000) return Math.round(ms / 1000) + " s";
    if (ms < 3_600_000) return Math.round(ms / 60_000) + " min";
    return (ms / 3_600_000).toFixed(ms >= 36_000_000 ? 0 : 1).replace(".", ",") + " h";
  }

  function resetStates() {
    summaryTarget.hidden = true;
    detailTarget.hidden = true;
    unavailable.hidden = true;
    errorState.hidden = true;
  }

  function render(payload) {
    const project = payload.project || {};
    const ci = payload.ci || {};
    const summary = ci.summary || null;

    title.textContent = project.name || project.slug || "Builds / CI";
    description.textContent =
      "Sampled GitHub Actions-state för " +
      (project.name || project.slug || "repositoryprojektet") +
      ", observerad och cachead av Skvallerbyttan.";

    projectLink.textContent = project.name || project.slug || "Projekt";
    projectLink.href = project.portalUrl || "/projekt";

    if (project.actionsUrl) {
      original.href = project.actionsUrl;
      original.hidden = false;
    } else {
      original.hidden = true;
      original.removeAttribute("href");
    }

    const freshness = ci.freshness === "stale"
      ? "stale"
      : ci.freshness === "fresh"
        ? "fresh"
        : "okänd freshness";

    generated.textContent = ci.sourceRefreshedAt
      ? "Observerad " + formatDate(ci.sourceRefreshedAt) + " · " + freshness
      : "Ingen cachead observation";

    resetStates();

    if (ci.available !== true || !summary) {
      status.textContent = ci.status === "not_observed" ? "Ej observerad" : "Otillgänglig";
      unavailable.hidden = false;
      document.title = (project.name || project.slug || "Builds") + " · Builds / CI · Avkroken";
      return;
    }

    status.textContent = ci.freshness === "stale"
      ? "Observerad CI · stale"
      : "Observerad CI";

    passRate.textContent = formatPercent(summary.passRate);
    failures.textContent =
      Number(summary.failedLast24h || 0) + " / " + Number(summary.failedLast7d || 0);
    duration.textContent =
      formatDuration(summary.medianDurationMs) + " / " + formatDuration(summary.p95DurationMs);
    mttr.textContent = formatDuration(summary.mttrMedianMs);

    const sampled = Number(ci.coverage?.sampledRuns || 0);
    const total = Number(ci.coverage?.totalRuns || 0);
    const limit = Number(ci.coverage?.sampleLimit || 100);
    coverage.textContent =
      "Sample " + sampled + " av " + total +
      " rapporterade runs · providergräns " + limit +
      ". Siffrorna presenteras inte som komplett historik.";

    completed.textContent = String(Number(summary.completedSample || 0));
    success.textContent = String(Number(summary.successfulSample || 0));
    failed.textContent = String(Number(summary.failedSample || 0));
    cancelled.textContent = String(Number(summary.cancelledSample || 0));
    running.textContent = String(Number(summary.inProgressSample || 0));
    latestFailure.textContent = formatDate(summary.latestFailureAt);

    summaryTarget.hidden = false;
    detailTarget.hidden = false;
    document.title = (project.name || project.slug || "Builds") + " · Builds / CI · Avkroken";
  }

  async function loadProjectBuilds() {
    const slug = projectSlugFromLocation();
    if (!slug) return;

    const serial = ++requestSerial;
    title.textContent = "Läser observerad CI…";
    description.textContent = "Sampled GitHub Actions-state observerad och cachead av Skvallerbyttan.";
    projectLink.textContent = slug;
    projectLink.href = "/projekt/" + encodeURIComponent(slug);
    status.textContent = "Läser CI-state…";
    generated.textContent = "";
    original.hidden = true;
    resetStates();

    try {
      const response = await fetch(
        "/api/builds?project=" + encodeURIComponent(slug),
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok) throw new Error("HTTP " + response.status);

      const payload = await response.json();
      if (serial !== requestSerial) return;
      if (payload.status !== "available") throw new Error("project Builds unavailable");

      render(payload);
    } catch (error) {
      if (serial !== requestSerial) return;
      status.textContent = "Otillgänglig";
      generated.textContent = "";
      original.hidden = true;
      resetStates();
      errorState.hidden = false;
      console.error(error);
    }
  }

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "project-builds") loadProjectBuilds();
  });

  if (projectSlugFromLocation()) loadProjectBuilds();
})();
