export const RETIRED_REPOSITORIES = new Set([
  "Skvallerbyttan",
  "Krosa-Maja",
  "Jobb",
  "Dumpen",
]);

export function isRetiredRepository(name) {
  return RETIRED_REPOSITORIES.has(String(name || ""));
}
