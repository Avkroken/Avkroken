(() => {
  const form = document.querySelector("#portal-search-form");
  const input = document.querySelector("#portal-search-input");
  const meta = document.querySelector("#portal-search-meta");
  const results = document.querySelector("#portal-search-results");

  if (!form || !input || !meta || !results) return;

  let requestSerial = 0;

  function queryFromLocation() {
    if (location.pathname !== "/sok") return "";
    return new URLSearchParams(location.search).get("q")?.trim() || "";
  }

  function formatTimestamp(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("sv-SE", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function kindLabel(result) {
    if (result.kind === "project") return "Projekt";
    if (result.kind === "wiki") return "Wiki";
    if (result.sourceKind === "public_app_manifest") return "Appdokument";
    return "Dokument";
  }

  function coverageText(payload) {
    const coverage = payload?.coverage || {};
    const state = coverage.state;

    if (state === "configured_sources") {
      return "Tillåtna källor · projekt · dokumentation · Wiki · publicerade appdocs";
    }
    if (state === "partial") {
      return "Partiell täckning · en eller flera tillåtna källor är tillfälligt otillgängliga";
    }
    if (state === "unavailable") {
      return "Sökningen är tillfälligt otillgänglig";
    }
    return "Publikt tillåtna källor";
  }

  function resultMeta(result) {
    const values = [];
    if (result.repository) values.push(result.repository);
    if (result.sourcePath) values.push(result.sourcePath);
    return values.join(" · ");
  }

  function appendLink(parent, label, href, { internal = false, primary = false } = {}) {
    if (!href) return;

    const link = document.createElement("a");
    link.className = "portal-search-link" + (primary ? " primary" : "");
    link.href = href;
    link.textContent = label;

    if (internal) {
      link.dataset.portalRoute = "";
    } else {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    parent.appendChild(link);
  }

  function renderEmpty(title, copy) {
    results.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "portal-search-empty";

    const strong = document.createElement("strong");
    strong.textContent = title;
    empty.appendChild(strong);

    if (copy) {
      const text = document.createElement("span");
      text.textContent = copy;
      empty.appendChild(text);
    }

    results.appendChild(empty);
  }

  function renderResults(payload) {
    const items = Array.isArray(payload.results) ? payload.results : [];
    const freshness = formatTimestamp(payload.externalGeneratedAt);
    meta.textContent = [
      coverageText(payload),
      freshness ? "Docs/Wiki-index " + freshness : null,
      items.length + " träff" + (items.length === 1 ? "" : "ar")
    ].filter(Boolean).join(" · ");

    if (!items.length) {
      renderEmpty(
        "Inga träffar.",
        "Prova en annan term. Skyddad Auth/Jobb-data ingår aldrig i det publika indexet."
      );
      return;
    }

    const list = document.createElement("ol");
    list.className = "portal-search-list";

    items.forEach(item => {
      const row = document.createElement("li");
      row.className = "portal-search-result";

      const top = document.createElement("div");
      top.className = "portal-search-result-top";

      const badge = document.createElement("span");
      badge.className = "portal-search-kind";
      badge.textContent = kindLabel(item);
      top.appendChild(badge);

      const source = document.createElement("span");
      source.className = "portal-search-source";
      source.textContent = resultMeta(item);
      top.appendChild(source);

      const heading = document.createElement("h2");
      heading.className = "portal-search-result-title";

      const destination = item.portalUrl || item.canonicalUrl;
      if (destination) {
        const titleLink = document.createElement("a");
        titleLink.href = destination;
        titleLink.textContent = item.title || "Resultat";
        if (item.portalUrl) {
          titleLink.dataset.portalRoute = "";
        } else {
          titleLink.target = "_blank";
          titleLink.rel = "noopener noreferrer";
        }
        heading.appendChild(titleLink);
      } else {
        heading.textContent = item.title || "Resultat";
      }

      row.appendChild(top);
      row.appendChild(heading);

      if (item.snippet) {
        const snippet = document.createElement("p");
        snippet.className = "portal-search-snippet";
        snippet.textContent = item.snippet;
        row.appendChild(snippet);
      }

      const actions = document.createElement("div");
      actions.className = "portal-search-actions";

      if (item.portalUrl) {
        appendLink(actions, item.kind === "project" ? "Översikt" : "Läs i Avkroken", item.portalUrl, {
          internal: true,
          primary: true
        });
      }

      if (item.canonicalUrl) {
        appendLink(
          actions,
          item.portalUrl ? "Visa original" : (item.kind === "wiki" ? "Öppna Wiki" : "Visa källa"),
          item.canonicalUrl,
          { primary: !item.portalUrl }
        );
      }

      if (actions.childElementCount) row.appendChild(actions);
      list.appendChild(row);
    });

    results.replaceChildren(list);
  }

  async function performSearch(query) {
    const serial = ++requestSerial;
    input.value = query;
    document.title = query ? `Sök: ${query} · Avkroken` : "Sök · Avkroken";

    if (!query) {
      meta.textContent = "Sökindexet laddas först när du söker.";
      renderEmpty(
        "Publik, access-aware sökning.",
        "Skyddad Jobb/Auth-data ingår inte i indexet."
      );
      return;
    }

    meta.textContent = "Söker i publikt tillåtna källor…";
    renderEmpty("Söker…", "");

    try {
      const params = new URLSearchParams({ q: query });
      const response = await fetch("/api/search?" + params.toString(), {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json();

      if (serial !== requestSerial) return;

      if (!response.ok) {
        const unavailable = response.status === 503;
        meta.textContent = unavailable
          ? "Sökningen är tillfälligt otillgänglig."
          : "Sökfrågan kunde inte behandlas.";
        renderEmpty(
          unavailable ? "Sökkällorna kunde inte läsas." : "Sökningen misslyckades.",
          "Försök igen senare."
        );
        return;
      }

      renderResults(payload);
    } catch (error) {
      if (serial !== requestSerial) return;
      meta.textContent = "Sökningen är tillfälligt otillgänglig.";
      renderEmpty("Sökkällorna kunde inte läsas.", "Försök igen senare.");
      console.error(error);
    }
  }

  function navigateToQuery(query) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const target = "/sok" + (params.size ? "?" + params.toString() : "");

    if (window.AvKrokenPortal?.navigate) {
      window.AvKrokenPortal.navigate(target);
    } else {
      location.href = target;
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    navigateToQuery(input.value.trim());
  });

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "search") {
      performSearch(queryFromLocation());
    }
  });

  if (location.pathname === "/sok") {
    performSearch(queryFromLocation());
  }
})();
