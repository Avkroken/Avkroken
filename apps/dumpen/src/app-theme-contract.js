const labels = Object.assign(Object.create(null), {
  "1": "Neon Glass",
  "2": "Cyan Blueprint",
  "3": "Isometric Console",
  "4": "Illustrated Scene",
  "5": "Emerald Radar",
  "6": "Emerald Core",
  "7": "Azure Orbit",
});

export const APP_THEME_LABELS = Object.freeze(labels);
export const APP_THEME_IDS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
export const APP_THEME_APPS = Object.freeze([
  "dozzle",
  "maintainerr",
  "plex",
  "prowlarr",
  "qbittorrent",
  "radarr",
  "sonarr",
  "tautulli",
]);

export function appThemeLabel(theme) {
  const key = String(theme || "");
  return APP_THEME_LABELS[key] || (key ? "Tema " + key : null);
}
