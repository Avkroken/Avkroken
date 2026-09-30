(() => {
  const panels = [...document.querySelectorAll("[data-route-panel]")];
  const routeLinks = [...document.querySelectorAll("[data-portal-route]")];
  const menu = document.querySelector("#portal-navigation");
  const menuToggle = document.querySelector("#portal-menu-toggle");
  const themeSelect = document.querySelector("#portal-theme");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const themes = new Set(["legacy", "forest", "blackout"]);
  const defaultTheme = "legacy";
  const themeStorageKey = "avkroken.theme";
  const legacyThemeStorageKey = "avkroken.portal.theme";
  const themeCookieName = "avkroken_theme";
  const themeColors = { legacy: "#04070e", forest: "#080b09", blackout: "#000000" };

  function storedTheme() {
    const cookieValue = document.cookie
      .split("; ")
      .find(entry => entry.startsWith(themeCookieName + "="))
      ?.split("=")[1];
    if (themes.has(cookieValue)) return cookieValue;

    try {
      const shared = localStorage.getItem(themeStorageKey);
      if (themes.has(shared)) return shared;
      const legacy = localStorage.getItem(legacyThemeStorageKey);
      if (themes.has(legacy)) return legacy;
    } catch {
      // Storage may be unavailable; keep the server-provided default.
    }
    return "";
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Cross-page persistence is best effort only.
    }

    const deniedDomain = location.hostname === "denied.se" || location.hostname.endsWith(".denied.se");
    const domain = deniedDomain ? "; Domain=.denied.se" : "";
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = themeCookieName + "=" + theme + "; Max-Age=31536000; Path=/; SameSite=Lax" + domain + secure;
  }

  function applyTheme(value, { persist = false } = {}) {
    const theme = themes.has(value) ? value : defaultTheme;
    document.documentElement.dataset.theme = theme;
    if (themeSelect) themeSelect.value = theme;
    if (themeMeta) themeMeta.setAttribute("content", themeColors[theme]);

    if (persist) persistTheme(theme);
    return theme;
  }

  const savedTheme = storedTheme();
  const initialTheme = savedTheme || document.documentElement.dataset.theme || defaultTheme;
  applyTheme(initialTheme, { persist: Boolean(savedTheme) });

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

    if (/^\/projekt\/[^/]+\/aktivitet(?:\/|$)/.test(path)) return "activity";

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

  function closeMenu({ restoreFocus = false } = {}) {
    if (!menu || !menuToggle) return false;
    const wasOpen = menu.classList.contains("open");
    menu.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    if (restoreFocus && wasOpen) menuToggle.focus();
    return wasOpen;
  }

  function focusViewHeading(view) {
    const panel = panels.find(item => item.dataset.routePanel === view);
    const heading = panel?.querySelector("h1");
    if (!heading) return false;

    const hadTabindex = heading.hasAttribute("tabindex");
    if (!hadTabindex) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    if (!hadTabindex) {
      heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
    }
    return document.activeElement === heading;
  }

  function applyRoute({ dispatch = true, focus = false } = {}) {
    const view = viewForPath(location.pathname);
    setView(view);
    closeMenu();

    if (focus) focusViewHeading(view);

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
    applyRoute({ focus: true });
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

  themeSelect?.addEventListener("change", () => {
    applyTheme(themeSelect.value, { persist: true });
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (closeMenu({ restoreFocus: true })) event.preventDefault();
  });

  window.addEventListener("popstate", () => applyRoute({ focus: true }));

  window.AvKrokenPortal = {
    navigate,
    setView,
    viewForPath,
    applyRoute,
    focusViewHeading,
    applyTheme
  };

  applyRoute({ dispatch: false });
})();
