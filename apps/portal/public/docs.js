(() => {
  const viewTabs = [...document.querySelectorAll(".portal-tab[data-view]")];
  const viewPanels = [...document.querySelectorAll("[data-view-panel]")];
  const docsCount = document.querySelector("#docs-count");
  const docsRepoTabs = document.querySelector("#docs-repo-tabs");
  const docsPageTabs = document.querySelector("#docs-page-tabs");
  const docsLinks = document.querySelector("#docs-links");
  const docsContent = document.querySelector("#docs-content");

  let catalog = null;
  let activeRepo = null;
  let activePath = null;
  let requestSerial = 0;

  function docsUrl(repoName, path) {
    let url = repoName
      ? "/projekt/" + encodeURIComponent(repoName) + "/dokumentation"
      : "/dokumentation";

    if (path) {
      const encodedPath = String(path)
        .split("/")
        .filter(Boolean)
        .map(segment => encodeURIComponent(segment))
        .join("/");
      if (encodedPath) url += "/" + encodedPath;
    }

    return url;
  }

  function legacyRouteFromHash() {
    const parts = location.hash.slice(1).split("/");
    if (decodeURIComponent(parts[0] || "") !== "docs") return null;
    return {
      repo: parts[1] ? decodeURIComponent(parts[1]) : null,
      path: parts[2] ? decodeURIComponent(parts.slice(2).join("/")) : null
    };
  }

  function routeFromLocation() {
    const legacy = legacyRouteFromHash();
    if (legacy) return legacy;

    const pathname = location.pathname.replace(/\/+$/, "") || "/";
    const projectDocs = pathname.match(/^\/projekt\/([^/]+)\/dokumentation(?:\/(.*))?$/);
    if (projectDocs) {
      return {
        repo: decodeURIComponent(projectDocs[1]),
        path: projectDocs[2]
          ? projectDocs[2].split("/").map(segment => decodeURIComponent(segment)).join("/")
          : null
      };
    }

    if (pathname === "/dokumentation" || pathname.startsWith("/dokumentation/")) {
      return { repo: null, path: null };
    }

    return null;
  }

  function navigateDocs(repoName, path = null) {
    const target = docsUrl(repoName, path);
    if (window.AvKrokenPortal?.navigate) {
      window.AvKrokenPortal.navigate(target);
    } else {
      location.href = target;
    }
  }

  function setView(view) {
    if (window.AvKrokenPortal?.setView) {
      window.AvKrokenPortal.setView(view);
      return;
    }

    viewTabs.forEach(tab => {
      const selected = tab.dataset.view === view;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", selected ? "true" : "false");
    });

    viewPanels.forEach(panel => {
      panel.hidden = panel.dataset.viewPanel !== view;
    });
  }

  function preferredPage(repo, requestedPath) {
    if (!repo || !Array.isArray(repo.pages) || !repo.pages.length) return null;
    if (requestedPath && repo.pages.some(page => page.path === requestedPath)) {
      return requestedPath;
    }

    for (const candidate of ["docs/index.md", "README.md"]) {
      if (repo.pages.some(page => page.path === candidate)) return candidate;
    }
    return repo.pages[0].path;
  }

  function renderRepoTabs() {
    docsRepoTabs.replaceChildren();
    if (!catalog) return;

    catalog.forEach(repo => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "docs-tab docs-repo-tab";
      button.textContent = repo.name;
      const selected = activeRepo && activeRepo.name === repo.name;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.addEventListener("click", () => {
        navigateDocs(repo.name);
      });
      docsRepoTabs.appendChild(button);
    });
  }

  function renderPageTabs() {
    docsPageTabs.replaceChildren();
    if (!activeRepo || !Array.isArray(activeRepo.pages)) return;

    activeRepo.pages.forEach(page => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "docs-tab docs-page-tab";
      button.textContent = page.label || page.path;
      button.title = page.path;
      const selected = page.path === activePath;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.addEventListener("click", () => {
        navigateDocs(activeRepo.name, page.path);
      });
      docsPageTabs.appendChild(button);
    });
  }

  function renderLinks(sourceUrl) {
    docsLinks.replaceChildren();
    if (!activeRepo) return;

    const links = [
      { label: "GitHub", href: activeRepo.repository },
      { label: "Issues", href: activeRepo.issues }
    ];

    if (activeRepo.pagesUrl) {
      links.push({ label: "GitHub Pages", href: activeRepo.pagesUrl });
    }
    if (sourceUrl) {
      links.push({ label: "Visa original", href: sourceUrl });
    }

    links.forEach(item => {
      const link = document.createElement("a");
      link.className = "docs-link";
      link.href = item.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.label;
      docsLinks.appendChild(link);
    });
  }

  function stripFrontMatter(markdown) {
    return String(markdown || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  }

  function normalizeRelativePath(basePath, target) {
    const clean = target.split("#")[0].split("?")[0];
    const parts = clean.startsWith("/") ? [] : basePath.split("/").slice(0, -1);

    clean.replace(/^\/+/, "").split("/").forEach(part => {
      if (!part || part === ".") return;
      if (part === "..") parts.pop();
      else parts.push(part);
    });

    return parts.join("/");
  }

  function internalDocPath(target) {
    if (!activeRepo || !activePath) return null;
    const value = String(target || "").trim();

    const liquid = value.match(/^\{\{\s*['"]\/([^'"]*)['"]\s*\|\s*relative_url\s*\}\}$/);
    if (liquid) {
      const slug = liquid[1].replace(/^\/+|\/+$/g, "");
      if (!slug) return preferredPage(activeRepo, "docs/index.md");
      const match = activeRepo.pages.find(page => {
        const stem = page.path.split("/").pop().replace(/\.(md|markdown)$/i, "");
        return stem === slug;
      });
      return match ? match.path : null;
    }

    if (/^https?:\/\//i.test(value)) return null;

    if (value.startsWith("/")) {
      const slug = value.replace(/^\/+|\/+$/g, "");
      const match = activeRepo.pages.find(page => {
        const stem = page.path.split("/").pop().replace(/\.(md|markdown)$/i, "");
        return stem === slug;
      });
      return match ? match.path : null;
    }

    if (/\.(md|markdown)([#?].*)?$/i.test(value) || value.startsWith("./") || value.startsWith("../")) {
      const resolved = normalizeRelativePath(activePath, value);
      return activeRepo.pages.some(page => page.path === resolved) ? resolved : null;
    }

    return null;
  }

  function safeExternalHref(target) {
    const value = String(target || "").trim();
    if (value.startsWith("#")) return value;

    try {
      const url = new URL(value, location.origin);
      if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch {
      return null;
    }

    return null;
  }

  function appendInline(parent, text) {
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
        if (linkMatch) {
          const anchor = document.createElement("a");
          anchor.textContent = linkMatch[1];

          const internal = internalDocPath(linkMatch[2]);
          if (internal) {
            anchor.href = docsUrl(activeRepo.name, internal);
          } else {
            const href = safeExternalHref(linkMatch[2]);
            if (href) {
              anchor.href = href;
              if (/^https?:\/\//i.test(href) && new URL(href).origin !== location.origin) {
                anchor.target = "_blank";
                anchor.rel = "noopener noreferrer";
              }
            } else {
              anchor.href = "#";
              anchor.setAttribute("aria-disabled", "true");
            }
          }
          parent.appendChild(anchor);
        } else {
          parent.appendChild(document.createTextNode(token));
        }
      }

      last = pattern.lastIndex;
    }

    if (last < source.length) {
      parent.appendChild(document.createTextNode(source.slice(last)));
    }
  }

  function tableCells(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map(cell => cell.trim());
  }

  function isTableSeparator(line) {
    const cells = tableCells(line);
    return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
  }

  function renderMarkdown(markdown) {
    const fragment = document.createDocumentFragment();
    const lines = stripFrontMatter(markdown).replace(/\r\n/g, "\n").split("\n");
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
        appendInline(element, heading[2]);
        fragment.appendChild(element);
        index += 1;
        continue;
      }

      if (line.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");

        tableCells(line).forEach(cell => {
          const th = document.createElement("th");
          appendInline(th, cell);
          headRow.appendChild(th);
        });

        thead.appendChild(headRow);
        table.appendChild(thead);
        index += 2;

        const tbody = document.createElement("tbody");
        while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
          const row = document.createElement("tr");
          tableCells(lines[index]).forEach(cell => {
            const td = document.createElement("td");
            appendInline(td, cell);
            row.appendChild(td);
          });
          tbody.appendChild(row);
          index += 1;
        }

        table.appendChild(tbody);
        fragment.appendChild(table);
        continue;
      }

      const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
      if (unordered) {
        const list = document.createElement("ul");
        while (index < lines.length) {
          const item = lines[index].match(/^\s*[-*+]\s+(.*)$/);
          if (!item) break;
          const li = document.createElement("li");
          appendInline(li, item[1]);
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
          appendInline(li, item[1]);
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

        appendInline(paragraph, parts.join(" "));
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
      appendInline(paragraph, line.trim());
      fragment.appendChild(paragraph);
      index += 1;
    }

    return fragment;
  }

  async function loadDocument(repo, path) {
    const serial = ++requestSerial;
    docsContent.innerHTML = '<div class="empty">Läser in dokumentation…</div>';
    renderLinks(null);

    try {
      const params = new URLSearchParams({ repo: repo.name, path });
      const response = await fetch("/api/docs/content?" + params.toString(), {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("HTTP " + response.status);

      const data = await response.json();
      if (serial !== requestSerial) return;

      docsContent.replaceChildren(renderMarkdown(data.markdown));
      renderLinks(data.sourceUrl || null);
    } catch (error) {
      if (serial !== requestSerial) return;
      docsContent.innerHTML =
        '<div class="empty"><strong>Dokumentet kunde inte hämtas.</strong><span>Försök igen senare.</span></div>';
      console.error(error);
    }
  }

  function selectRepo(repoName, requestedPath) {
    if (!catalog || !catalog.length) return;

    activeRepo = catalog.find(repo => repo.name === repoName) ||
      catalog.find(repo => repo.name === "Skvallerbyttan") ||
      catalog[0];

    activePath = preferredPage(activeRepo, requestedPath);
    renderRepoTabs();
    renderPageTabs();
    docsCount.textContent = catalog.length + " REPOS";

    if (!activePath) {
      renderLinks(null);
      docsContent.innerHTML =
        '<div class="empty"><strong>Ingen publik Markdown-dokumentation hittades.</strong>' +
        '<span>Förrådet finns i katalogen, men saknar README eller Markdown under docs/.</span></div>';
      return;
    }

    loadDocument(activeRepo, activePath);
  }

  async function ensureCatalog(route) {
    if (catalog) {
      selectRepo(route && route.repo, route && route.path);
      return;
    }

    docsCount.textContent = "LOADING…";
    docsContent.innerHTML = '<div class="empty">Läser in dokumentationskatalog…</div>';

    try {
      const response = await fetch("/api/docs", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("HTTP " + response.status);
      catalog = await response.json();

      if (!Array.isArray(catalog) || !catalog.length) {
        docsCount.textContent = "0 REPOS";
        docsContent.innerHTML =
          '<div class="empty"><strong>Ingen publik dokumentation hittades.</strong></div>';
        return;
      }

      selectRepo(route && route.repo, route && route.path);
    } catch (error) {
      docsCount.textContent = "UNAVAILABLE";
      docsContent.innerHTML =
        '<div class="empty"><strong>Dokumentationskatalogen är tillfälligt otillgänglig.</strong></div>';
      console.error(error);
    }
  }

  function applyRoute() {
    const route = routeFromLocation();

    if (route) {
      setView("docs");
      ensureCatalog(route);
    } else {
      if (!window.AvKrokenPortal) setView("projects");
    }
  }

  viewTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      if (tab.dataset.view === "docs") {
        navigateDocs(activeRepo ? activeRepo.name : null);
      } else {
        window.AvKrokenPortal?.navigate ? window.AvKrokenPortal.navigate("/projekt") : (location.href = "/projekt");
      }
    });
  });

  window.addEventListener("hashchange", applyRoute);
  window.addEventListener("portal:routechange", applyRoute);
  applyRoute();
})();
