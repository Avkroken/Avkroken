(() => {
  const panels = [...document.querySelectorAll("[data-route-panel]")];
  const routeLinks = [...document.querySelectorAll("[data-portal-route]")];
  const menu = document.querySelector("#portal-navigation");
  const menuToggle = document.querySelector("#portal-menu-toggle");

  function normalizePath(pathname) {
    const value = String(pathname || "/").replace(/\/+$/, "");
    return value || "/";
  }

  function viewForPath(pathname) {
    const path = normalizePath(pathname);

    if (
      path === "/dokumentation" ||
      path.startsWith("/dokumentation/") ||
      /^\/projekt\/[^/]+\/dokumentation(?:\/|$)/.test(path)
    ) return "docs";

    if (/^\/projekt\/[^/]+\/wiki(?:\/|$)/.test(path)) return "wiki";

    if (/^\/projekt\/[^/]+\/releases(?:\/|$)/.test(path)) return "project-releases";

    if (/^\/projekt\/[^/]+\/issues(?:\/|$)/.test(path)) return "project-issues";

    if (/^\/projekt\/[^/]+\/builds(?:\/|$)/.test(path)) return "project-builds";

    if (/^\/projekt\/[^/]+$/.test(path)) return "project-detail";
    if (path === "/projekt") return "projects";
    if (path === "/tjanster") return "services";
    if (path === "/auth" || path.startsWith("/auth/")) return "auth";
    if (path === "/drift" || path.startsWith("/drift/")) return "operations";
    if (path === "/changelog") return "changelog";
    if (path === "/aktivitet") return "activity";
    if (path === "/om") return "about";
    if (path === "/sok") return "search";
    return "home";
  }

  function setView(view) {
    panels.forEach(panel => {
      panel.hidden = panel.dataset.routePanel !== view;
    });

    routeLinks.forEach(link => {
      const selected = link.dataset.navView === view;
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function closeMenu() {
    if (!menu || !menuToggle) return;
    menu.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }

  function applyRoute({ dispatch = true } = {}) {
    const view = viewForPath(location.pathname);
    setView(view);
    closeMenu();

    if (dispatch) {
      window.dispatchEvent(new CustomEvent("portal:routechange", {
        detail: { view, pathname: location.pathname }
      }));
    }

    return view;
  }

  function navigate(target) {
    const url = new URL(target, location.origin);
    if (url.origin !== location.origin) {
      location.href = url.href;
      return;
    }

    const next = url.pathname + url.search + url.hash;
    const current = location.pathname + location.search + location.hash;
    if (next !== current) history.pushState(null, "", next);
    applyRoute();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-portal-route]");
    if (!link) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const url = new URL(link.href, location.origin);
    if (url.origin !== location.origin) return;

    event.preventDefault();
    navigate(url.href);
  });

  menuToggle?.addEventListener("click", () => {
    if (!menu) return;
    const open = !menu.classList.contains("open");
    menu.classList.toggle("open", open);
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("popstate", () => applyRoute());

  window.AvKrokenPortal = {
    navigate,
    setView,
    viewForPath,
    applyRoute
  };

  applyRoute({ dispatch: false });
})();
