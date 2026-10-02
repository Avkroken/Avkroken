export const ASSET_TICKET_PREFIX = "_system/asset-tickets/";
export const ASSET_CLAIM_PREFIX = "_system/asset-claims/";

const THEME_STAGING_PREFIX = "staging/themes-v2/apps/";
const THEME_APPS = new Set([
  "dozzle",
  "maintainerr",
  "plex",
  "prowlarr",
  "qbittorrent",
  "radarr",
  "sonarr",
  "tautulli",
]);

export function isThemeStagingKey(value) {
  const key = String(value || "");
  if (!key.startsWith(THEME_STAGING_PREFIX)) return false;
  const rest = key.slice(THEME_STAGING_PREFIX.length);
  const parts = rest.split("/");
  if (parts.length !== 2) return false;
  const [app, file] = parts;
  if (!THEME_APPS.has(app)) return false;
  const match = file.match(/^([a-z0-9-]+)-([1-7])\.png$/);
  return Boolean(match && match[1] === app);
}

export function isPngBytes(body) {
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return bytes.length >= signature.length
    && signature.every((value, index) => bytes[index] === value);
}
