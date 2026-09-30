(() => {
  const title = document.querySelector("#wiki-title");
  const description = document.querySelector("#wiki-description");
  const projectLink = document.querySelector("#wiki-project-link");
  const navigation = document.querySelector("#wiki-navigation-links");
  const pageTitle = document.querySelector("#wiki-page-title");
  const pageContent = document.querySelector("#wiki-page-content");
  const collaboration = document.querySelector("#wiki-collaboration-links");
  const originalLink = document.querySelector("#wiki-original-link");
  const errorState = document.querySelector("#wiki-error");

  let requestSerial = 0;

  function routeState() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const match = path.match(/^\/projekt\/([^/]+)\/wiki(?:\/([^/]+))?$/);
    if (!match) return null;

    try {
      return {
        slug: decodeURIComponent(match[1]),
        page: match[2] ? decodeURIComponent(match[2]) : "Home"
      };
    } catch {
      return null;
    }
  }

  function wikiPageUrl(slug, page = "Home") {
    const base = "/projekt/" + encodeURIComponent(slug) + "/wiki";
    return !page || page === "Home"
      ? base
      : base + "/" + encodeURIComponent(page);
  }

  function clear(target) {
    target?.replaceChildren();
  }

  function emptyNode(titleText, copy = "") {
    const container = document.createElement("div");
    container.className = "empty";
    const strong = document.createElement("strong");
    strong.textContent = titleText;
    container.appendChild(strong);
    if (copy) {
      const span = document.createElement("span");
      span.textContent = copy;
      container.appendChild(span);
    }
    return container;
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

  function safeExternalHref(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function normalizeWikiTarget(value) {
    const source = String(value || "").trim();
    if (!source) return null;
    if (source.startsWith("#")) return { fragment: source };

    const external = safeExternalHref(source);
    if (external) return { external };

    if (/^[a-z][a-z0-9+.-]*:/i.test(source) || source.startsWith("//")) return null;

    const hashIndex = source.indexOf("#");
    const fragment = hashIndex >= 0 ? source.slice(hashIndex) : "";
    const withoutHash = hashIndex >= 0 ? source.slice(0, hashIndex) : source;
    const withoutQuery = withoutHash.split("?")[0];

    let decoded;
    try {
      decoded = decodeURIComponent(withoutQuery);
    } catch {
      return null;
    }

    const page = decoded.replace(/\.md$/i, "").trim();
    if (
      !page ||
      page.length > 120 ||
      page === "." ||
      page === ".." ||
      page.includes("/") ||
      page.includes("\\") ||
      !/^[\p{L}\p{N}][\p{L}\p{N} ._()+,&:'’\-]{0,119}$/u.test(page)
    ) {
      return null;
    }

    return { page, fragment };
  }

  function headingId(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("sv")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function appendInline(parent, text, slug) {
    const source = String(text || "");
    const pattern = /(\x60[^\x60]*\x60|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let match;

    while ((match = pattern.exec(source)) !== null) {
      if (match.index > last) {
        parent.appendChild(document.createTextNode(source.slice(last, match.index)));
      }

      const token = match[0];
      if (token.charCodeAt(0) === 96) {
        const code = document.createElement("code");
        code.textContent = token.slice(1, -1);
        parent.appendChild(code);
      } else if (token.startsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = token.slice(2, -2);
        parent.appendChild(strong);
      } else {
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (!linkMatch) {
          parent.appendChild(document.createTextNode(token));
        } else {
          const anchor = document.createElement("a");
          anchor.textContent = linkMatch[1];
          const target = normalizeWikiTarget(linkMatch[2]);

          if (target?.external) {
            anchor.href = target.external;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
          } else if (target?.fragment) {
            anchor.href = target.fragment;
          } else if (target?.page) {
            anchor.href = wikiPageUrl(slug, target.page) + (target.fragment || "");
            anchor.dataset.portalRoute = "";
          } else {
            anchor.href = "#";
            anchor.setAttribute("aria-disabled", "true");
          }

          parent.appendChild(anchor);
        }
      }

      last = pattern.lastIndex;
    }

    if (last < source.length) {
      parent.appendChild(document.createTextNode(source.slice(last)));
    }
  }

  function renderMarkdown(markdown, slug) {
    const fragment = document.createDocumentFragment();
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (line.trim().startsWith("\x60\x60\x60")) {
        const language = line.trim().slice(3).trim();
        index += 1;
        const codeLines = [];
        while (index < lines.length && !lines[index].trim().startsWith("\x60\x60\x60")) {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;

        const pre = document.createElement("pre");
        const code = document.createElement("code");
        if (language) code.dataset.language = language;
        code.textContent = codeLines.join("\n");
        pre.appendChild(code);
        fragment.appendChild(pre);
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const element = document.createElement("h" + heading[1].length);
        const id = headingId(heading[2]);
        if (id) element.id = id;
        appendInline(element, heading[2], slug);
        fragment.appendChild(element);
        index += 1;
        continue;
      }

      const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
      if (unordered) {
        const list = document.createElement("ul");
        while (index < lines.length) {
          const item = lines[index].match(/^\s*[-*+]\s+(.*)$/);
          if (!item) break;
          const li = document.createElement("li");
          appendInline(li, item[1], slug);
          list.appendChild(li);
          index += 1;
        }
        fragment.appendChild(list);
        continue;
      }

      const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
      if (ordered) {
        const list = document.createElement("ol");
        while (index < lines.length) {
          const item = lines[index].match(/^\s*\d+\.\s+(.*)$/);
          if (!item) break;
          const li = document.createElement("li");
          appendInline(li, item[1], slug);
          list.appendChild(li);
          index += 1;
        }
        fragment.appendChild(list);
        continue;
      }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        const blockquote = document.createElement("blockquote");
        const paragraph = document.createElement("p");
        const parts = [];
        while (index < lines.length) {
          const item = lines[index].match(/^>\s?(.*)$/);
          if (!item) break;
          parts.push(item[1]);
          index += 1;
        }
        appendInline(paragraph, parts.join(" "), slug);
        blockquote.appendChild(paragraph);
        fragment.appendChild(blockquote);
        continue;
      }

      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        fragment.appendChild(document.createElement("hr"));
        index += 1;
        continue;
      }

      const paragraph = document.createElement("p");
      appendInline(paragraph, line.trim(), slug);
      fragment.appendChild(paragraph);
      index += 1;
    }

    return fragment;
  }

  function showError(route, message) {
    title.textContent = "Wiki saknas";
    description.textContent = message;
    projectLink.textContent = route?.slug || "Projekt";
    projectLink.href = route?.slug
      ? "/projekt/" + encodeURIComponent(route.slug)
      : "/projekt";
    clear(navigation);
    pageTitle.textContent = "Wiki kunde inte visas";
    pageContent.replaceChildren(emptyNode(
      "Sidan kunde inte hämtas.",
      "Öppna original-Wikin eller försök igen senare."
    ));
    clear(collaboration);
    originalLink.hidden = true;
    errorState.hidden = false;
  }

  function renderNavigation(payload, route) {
    clear(navigation);
    const items = Array.isArray(payload.navigation) ? payload.navigation : [];

    for (const item of items) {
      if (!item || typeof item.label !== "string" || typeof item.page !== "string") continue;
      const anchor = link(item.label, wikiPageUrl(route.slug, item.page), { internal: true });
      if (item.page === payload.page.name) anchor.setAttribute("aria-current", "page");
      navigation.appendChild(anchor);
    }
  }

  function renderCollaboration(project) {
    clear(collaboration);
    if (project.issues) {
      collaboration.appendChild(link("Issues", project.issues, { className: "portal-button" }));
    }
    if (project.discussions) {
      collaboration.appendChild(
        link("Discussions", project.discussions, { className: "portal-button" })
      );
    }
    if (project.repository) {
      collaboration.appendChild(
        link("Repository", project.repository, { className: "portal-button" })
      );
    }
  }

  function render(payload, route) {
    const project = payload.project;
    const page = payload.page;

    title.textContent = project.name + " Wiki";
    description.textContent =
      "Publik GitHub Wiki för " + project.name +
      ". Wiki är presentation och guider; teknisk current-state ligger i README/docs.";
    projectLink.textContent = project.name;
    projectLink.href = project.portalUrl || "/projekt/" + encodeURIComponent(route.slug);

    pageTitle.textContent = page.label || page.name;
    pageContent.replaceChildren(renderMarkdown(page.markdown, route.slug));

    originalLink.href = page.sourceUrl || project.wiki;
    originalLink.hidden = false;
    errorState.hidden = true;

    renderNavigation(payload, route);
    renderCollaboration(project);

    document.title = (page.label || page.name) + " · " + project.name + " Wiki · Avkroken";
  }

  async function loadWiki() {
    const route = routeState();
    if (!route) return;

    const serial = ++requestSerial;
    title.textContent = "Läser in Wiki…";
    description.textContent = "Wiki hämtas från projektets publika GitHub Wiki.";
    pageTitle.textContent = route.page;
    pageContent.replaceChildren(emptyNode("Läser in Wiki-sida…"));
    clear(navigation);
    clear(collaboration);
    originalLink.hidden = true;
    errorState.hidden = true;

    try {
      const params = new URLSearchParams({
        project: route.slug,
        page: route.page
      });
      const response = await fetch("/api/wiki?" + params.toString(), {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => null);
      if (serial !== requestSerial) return;

      if (!response.ok || !payload || payload.status !== "available") {
        const reason = payload?.error === "wiki_page_not_found"
          ? "Den begärda Wiki-sidan finns inte."
          : payload?.error === "project_wiki_not_found"
            ? "Projektet har ingen publik repository-Wiki."
            : "Wiki-källan är tillfälligt otillgänglig.";
        showError(route, reason);
        return;
      }

      render(payload, route);
    } catch (error) {
      if (serial !== requestSerial) return;
      showError(route, "Wiki-källan är tillfälligt otillgänglig.");
      console.error(error);
    }
  }

  window.addEventListener("portal:routechange", event => {
    if (event.detail?.view === "wiki") loadWiki();
  });

  if (routeState()) loadWiki();
})();
