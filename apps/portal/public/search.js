(() => {
  const form = document.querySelector("#portal-search-form");
  const input = document.querySelector("#portal-search-input");
  const status = document.querySelector("#portal-search-status");
  const freshness = document.querySelector("#portal-search-freshness");
  const results = document.querySelector("#portal-search-results");

  let requestSerial = 0;

  function isSearchRoute() {
    return (location.pathname.replace(/\/+$/, "") || "/") === "/sok";
  }

  function queryFromLocation() {
    return new URLSearchParams(location.search).get("q") || "";
  }

  function clearResults() {
    results?.replaceChildren();
  }

  function emptyState(title, copy) {
    clearResults();
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

    results?.appendChild(box);
  }

  function formatFreshness(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("sv-SE", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function resultKindLabel(kind) {
    return {
      project: "Projekt",
      document: "Dokument",
      wiki: "Wiki"
    }[kind] || "Resultat";
  }

  function sourceLabel(source) {
    if (!source || typeof source !== "object") return "";
    const repository = source.repository || "";
    const path = source.path || "";
    return [repository, path].filter(Boolean).join(" · ");
  }

  function renderResults(payload) {
    const items = Array.isArray(payload.results) ? payload.results : [];
    clearResults();

    if (!items.length) {
      emptyState(
        "Inga träffar.",
        "Sökningen gav ingen träff i de publika projekt-, dokumentations- eller Wiki-källorna."
      );
      return;
    }

    for (const result of items) {
      const article = document.createElement("article");
      article.className = "portal-search-result";

      const top = document.createElement("div");
      top.className = "portal-search-result-top";

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = resultKindLabel(result.kind);
      top.appendChild(badge);

      if (result.subtitle) {
        const subtitle = document.createElement("span");
        subtitle.className = "portal-search-result-subtitle";
        subtitle.textContent = result.subtitle;
        top.appendChild(subtitle);
      }

      const titleLink = document.createElement("a");
      titleLink.className = "portal-search-result-title";
      titleLink.href = result.url;
      titleLink.dataset.portalRoute = "";
      titleLink.textContent = result.title || "Resultat";

      const excerpt = document.createElement("p");
      excerpt.textContent = result.snippet || "";

      const footer = document.createElement("div");
      footer.className = "portal-search-result-footer";

      const source = document.createElement("span");
      source.className = "portal-search-result-source";
      source.textContent = sourceLabel(result.source);
      footer.appendChild(source);

      if (result.canonicalUrl) {
        const original = document.createElement("a");
        original.href = result.canonicalUrl;
        original.target = "_blank";
        original.rel = "noopener noreferrer";
        original.textContent = "Visa original";
        footer.appendChild(original);
      }

      article.append(top, titleLink, excerpt, footer);
      results.appendChild(article);
    }
  }

  async function runSearch() {
    if (!isSearchRoute()) return;

    const query = queryFromLocation().trim();
    input.value = query;

    if (query.length < 2) {
      requestSerial += 1;
      status.textContent = "Skriv minst två tecken.";
      freshness.textContent = "";
      emptyState(
        "Ingen sökning ännu.",
        "Resultat visas endast från Portalens publika, förfiltrerade källor."
      );
      document.title = "Sök · Avkroken";
      return;
    }

    const serial = ++requestSerial;
    status.textContent = "Söker…";
    freshness.textContent = "";
    emptyState("Söker…", "Läser det cacheade publika sökindexet.");

    try {
      const response = await fetch("/api/search?q=" + encodeURIComponent(query), {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) throw new Error("HTTP " + response.status);
      const payload = await response.json();
      if (serial !== requestSerial) return;

      const count = Number(payload.resultCount) || 0;
      status.textContent = count === 1 ? "1 träff" : count + " träffar";

      const generated = formatFreshness(payload.generatedAt);
      const coverage = payload.source?.coverage;
      const coverageLabel = coverage === "partial"
        ? " · delvis täckning"
        : coverage === "bounded"
          ? " · begränsad täckning"
          : "";
      freshness.textContent = generated
        ? "Index " + generated + coverageLabel
        : "";

      renderResults(payload);
      document.title = "Sök: " + query + " · Avkroken";
    } catch (error) {
      if (serial !== requestSerial) return;
      status.textContent = "Sök otillgänglig";
      freshness.textContent = "";
      emptyState(
        "Sökindexet kunde inte läsas.",
        "Försök igen senare. Ingen skyddad källa används som fallback."
      );
      console.error(error);
    }
  }

  form?.addEventListener("submit", event => {
    event.preventDefault();
    const query = input.value.trim();

    if (query.length < 2) {
      status.textContent = "Skriv minst två tecken.";
      input.focus();
      return;
    }

    const target = "/sok?q=" + encodeURIComponent(query);
    if (window.AvKrokenPortal?.navigate) {
      window.AvKrokenPortal.navigate(target);
    } else {
      location.href = target;
    }
  });

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "search") runSearch();
  });

  if (isSearchRoute()) runSearch();
})();
