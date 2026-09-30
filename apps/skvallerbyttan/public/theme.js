const THEMES = new Set(["legacy", "forest", "blackout"]);
const DEFAULT_THEME = "legacy";
const STORAGE_KEY = "avkroken.theme";
const COOKIE_NAME = "avkroken_theme";
const THEME_COLORS = {
  legacy: "#04070e",
  forest: "#080b09",
  blackout: "#000000",
};

function cookieTheme() {
  const value = document.cookie
    .split("; ")
    .find(entry => entry.startsWith(COOKIE_NAME + "="))
    ?.split("=")[1];
  return THEMES.has(value) ? value : "";
}

function localTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEMES.has(value) ? value : "";
  } catch {
    return "";
  }
}

function persist(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Theme persistence is best effort and never security relevant.
  }
  const deniedDomain = location.hostname === "denied.se" || location.hostname.endsWith(".denied.se");
  const domain = deniedDomain ? "; Domain=.denied.se" : "";
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = COOKIE_NAME + "=" + theme
    + "; Max-Age=31536000; Path=/; SameSite=Lax" + domain + secure;
}

export function applyTheme(value, { persist: save = false } = {}) {
  const theme = THEMES.has(value) ? value : DEFAULT_THEME;
  document.documentElement.dataset.theme = theme;
  document.querySelector("#theme-select")?.setAttribute("data-current-theme", theme);
  const select = document.querySelector("#theme-select");
  if (select) select.value = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  if (save) persist(theme);
  return theme;
}

export function initTheme() {
  const saved = cookieTheme() || localTheme();
  applyTheme(saved || document.documentElement.dataset.theme || DEFAULT_THEME, {
    persist: Boolean(saved),
  });
  document.querySelector("#theme-select")?.addEventListener("change", event => {
    applyTheme(event.currentTarget.value, { persist: true });
  });
}
