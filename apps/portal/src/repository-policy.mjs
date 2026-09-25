export const RETIRED_REPOSITORIES = new Set([
  "Skvallerbyttan",
  "Krosa-Maja",
  "Jobb",
  "Dumpen",
]);

export function isRetiredRepository(name) {
  return RETIRED_REPOSITORIES.has(String(name || ""));
}


export const MIXED_SCOPE_REPOSITORIES = new Set([
  "Avkroken",
]);

export function isMixedScopeRepository(name) {
  return MIXED_SCOPE_REPOSITORIES.has(String(name || ""));
}
