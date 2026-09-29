const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_API_VERSION = "2026-03-10";
const USER_AGENT = "Avkroken-Dumpen-auth";
const DUMPEN_ORIGIN = "https://dumpen.denied.se";
const CALLBACK_URL = `${DUMPEN_ORIGIN}/auth/callback`;
const LOGIN_COOKIE = "__Host-dumpen_oauth";
const SESSION_COOKIE = "__Host-dumpen_session";
const LOGIN_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;
const FETCH_TIMEOUT_MS = 8_000;

export function githubAuthConfigurationState(env) {
  const clientId = String(env?.GITHUB_OAUTH_CLIENT_ID || "").trim();
  const value = env?.GITHUB_OAUTH_CLIENT_SECRET;
  const secretConfigured = typeof value === "string" ? Boolean(value.trim()) : Boolean(value);
  const allowed = allowedIds(env);
  if (!clientId && !secretConfigured && allowed.size === 0) return "inactive";
  return clientId && secretConfigured && allowed.size > 0 ? "ready" : "misconfigured";
}

export function sanitizeReturnTo(value) {
  if (!value || !value.startsWith("/") || value.length > 2048) return "/admin";
  try {
    const resolved = new URL(value, DUMPEN_ORIGIN);
    if (resolved.origin !== DUMPEN_ORIGIN) return "/admin";
    if (!resolved.pathname.startsWith("/admin")) return "/admin";
    return `${resolved.pathname}${resolved.search}`;
  } catch {
    return "/admin";
  }
}

export async function resolveGitHubClientSecret(env) {
  const value = env?.GITHUB_OAUTH_CLIENT_SECRET;
  try {
    const resolved = typeof value === "string" ? value.trim() : value ? String(await value.get()).trim() : "";
    if (!resolved) throw new Error("GITHUB_OAUTH_CLIENT_SECRET is required");
    return resolved;
  } catch (error) {
    if (error instanceof Error && error.message === "GITHUB_OAUTH_CLIENT_SECRET is required") throw error;
    throw new Error("GITHUB_OAUTH_CLIENT_SECRET could not be resolved");
  }
}

export async function startGitHubLogin(request, env) {
  if (githubAuthConfigurationState(env) !== "ready") return redirect("/login?error=config");
  const clientId = String(env.GITHUB_OAUTH_CLIENT_ID).trim();
  const clientSecret = await resolveGitHubClientSecret(env);
  const verifier = randomBase64url(32);
  const state = randomBase64url(24);
  const challenge = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("return_to"));
  const loginState = { v: 1, state, verifier, returnTo, exp: unixNow() + LOGIN_TTL_SECONDS };
  const authorize = new URL(GITHUB_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", CALLBACK_URL);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "false");
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  return redirect(authorize.toString(), [
    secureCookie(LOGIN_COOKIE, await signPayload(loginState, clientSecret, "login-state"), LOGIN_TTL_SECONDS),
  ]);
}

export async function handleGitHubCallback(request, env) {
  if (githubAuthConfigurationState(env) !== "ready") return redirect("/login?error=config", [clearCookie(LOGIN_COOKIE)]);
  const clientId = String(env.GITHUB_OAUTH_CLIENT_ID).trim();
  const clientSecret = await resolveGitHubClientSecret(env);
  const url = new URL(request.url);
  if (url.searchParams.has("error")) return redirect("/login?error=oauth", [clearCookie(LOGIN_COOKIE)]);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stored = cookie(request, LOGIN_COOKIE);
  if (!code || !state || !stored) return redirect("/login?error=state", [clearCookie(LOGIN_COOKIE)]);
  const loginState = await verifyPayload(stored, clientSecret, "login-state");
  if (!loginState || loginState.v !== 1 || loginState.exp <= unixNow() || !safeEqual(loginState.state, state)) {
    return redirect("/login?error=state", [clearCookie(LOGIN_COOKIE)]);
  }
  let accessToken = null;
  try {
    accessToken = await exchangeCode(clientId, clientSecret, code, loginState.verifier);
    const user = await fetchGitHubUser(accessToken);
    const userId = Number(user?.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("GitHub user id missing");
    if (!allowedIds(env).has(userId)) {
      return redirect("/login?error=forbidden", [clearCookie(LOGIN_COOKIE), clearCookie(SESSION_COOKIE)]);
    }
    const now = unixNow();
    const session = { v: 1, uid: userId, iat: now, exp: now + SESSION_TTL_SECONDS };
    return redirect(loginState.returnTo, [
      clearCookie(LOGIN_COOKIE),
      secureCookie(SESSION_COOKIE, await signPayload(session, clientSecret, "dashboard-session"), SESSION_TTL_SECONDS),
    ]);
  } catch (error) {
    console.error("Dumpen GitHub OAuth callback failed", { error: error instanceof Error ? error.message : String(error) });
    return redirect("/login?error=oauth", [clearCookie(LOGIN_COOKIE), clearCookie(SESSION_COOKIE)]);
  } finally {
    if (accessToken) await revokeGitHubToken(clientId, clientSecret, accessToken);
  }
}

export async function authenticatedGitHubUserId(request, env) {
  if (githubAuthConfigurationState(env) !== "ready") return null;
  const value = cookie(request, SESSION_COOKIE);
  if (!value) return null;
  const session = await verifyPayload(value, await resolveGitHubClientSecret(env), "dashboard-session");
  if (!session || session.v !== 1) return null;
  const now = unixNow();
  if (!Number.isSafeInteger(session.uid) || session.uid <= 0 || !Number.isSafeInteger(session.iat) || !Number.isSafeInteger(session.exp) ||
      session.iat > now + CLOCK_SKEW_SECONDS || session.exp <= now || session.exp - session.iat > SESSION_TTL_SECONDS) return null;
  return allowedIds(env).has(session.uid) ? session.uid : null;
}

export function logoutGitHub() {
  return redirect("/", [clearCookie(LOGIN_COOKIE), clearCookie(SESSION_COOKIE)]);
}

export function renderGitHubLoginPage(request, state = "ready") {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const returnTo = sanitizeReturnTo(url.searchParams.get("return_to"));
  const messages = {
    config: "GitHub-inloggningen är inte komplett konfigurerad.",
    state: "Inloggningsförsöket kunde inte verifieras. Försök igen.",
    oauth: "GitHub-inloggningen misslyckades. Försök igen.",
    forbidden: "GitHub-kontot har inte åtkomst till Dumpen.",
  };
  const message = state === "ready" ? (messages[error] || "Logga in med GitHub för att öppna Dumpens privata kontrollpanel.") : messages.config;
  const href = state === "ready" ? `/auth/start?return_to=${encodeURIComponent(returnTo)}` : "/";
  const label = state === "ready" ? "Logga in med GitHub" : "Till startsidan";
  return new Response(`<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Dumpen · GitHub Auth</title><style>:root{color-scheme:dark;--bg:#050505;--panel:#0b0b0d;--line:#252529;--text:#f4f4f5;--muted:#a1a1aa;--accent:#6ee71e}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}.card{width:min(560px,calc(100% - 32px));padding:28px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}h1{margin:0 0 12px;font-size:30px;font-weight:500}p{color:var(--muted)}a{display:inline-block;margin-top:12px;padding:10px 14px;border:1px solid var(--accent);border-radius:7px;color:var(--accent);text-decoration:none}</style></head><body><main class="card"><h1>Dumpen · GitHub Auth</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></main></body></html>`, {
    status: state === "ready" ? 200 : 503,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow, noarchive" },
  });
}

async function exchangeCode(clientId, clientSecret, code, verifier) {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: CALLBACK_URL, code_verifier: verifier }),
  });
  if (!response.ok) throw new Error(`GitHub OAuth token exchange failed with ${response.status}`);
  const data = await response.json();
  if (!data.access_token || data.error) throw new Error("GitHub OAuth token exchange returned no access token");
  return data.access_token;
}

async function fetchGitHubUser(accessToken) {
  const response = await fetch(GITHUB_USER_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${accessToken}`, "X-GitHub-Api-Version": GITHUB_API_VERSION, "User-Agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`GitHub user lookup failed with ${response.status}`);
  return response.json();
}

async function revokeGitHubToken(clientId, clientSecret, accessToken) {
  try {
    await fetch(`https://api.github.com/applications/${encodeURIComponent(clientId)}/token`, {
      method: "DELETE", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/vnd.github+json", Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, "Content-Type": "application/json", "X-GitHub-Api-Version": GITHUB_API_VERSION, "User-Agent": USER_AGENT },
      body: JSON.stringify({ access_token: accessToken }),
    });
  } catch {
    // Provider token is ephemeral and never becomes Dumpen session state.
  }
}

function allowedIds(env) {
  return new Set(String(env?.DUMPEN_ALLOWED_GITHUB_IDS || "").split(",").map((value) => Number(value.trim())).filter((value) => Number.isSafeInteger(value) && value > 0));
}

async function signPayload(payload, secret, purpose) {
  const encoded = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await derivedHmacKey(secret, purpose), new TextEncoder().encode(encoded));
  return `${encoded}.${base64url(signature)}`;
}

async function verifyPayload(value, secret, purpose) {
  const separator = value.lastIndexOf(".");
  if (separator <= 0 || separator === value.length - 1) return null;
  try {
    const encoded = value.slice(0, separator);
    const signature = decodeBase64url(value.slice(separator + 1));
    const valid = await crypto.subtle.verify("HMAC", await derivedHmacKey(secret, purpose), signature, new TextEncoder().encode(encoded));
    if (!valid) return null;
    return JSON.parse(new TextDecoder().decode(decodeBase64url(encoded)));
  } catch {
    return null;
  }
}

async function derivedHmacKey(secret, purpose) {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("Avkroken/Dumpen/GitHubOAuth/v1"), info: new TextEncoder().encode(purpose) }, baseKey, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign", "verify"]);
}

function cookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) return trimmed.slice(name.length + 1);
  }
  return null;
}

function secureCookie(name, value, maxAge) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function clearCookie(name) { return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 303, headers });
}
function randomBase64url(length) { const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); return base64url(bytes); }
function base64url(input) {
  const bytes = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : new TextEncoder().encode(input);
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function decodeBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded); const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const copy = new Uint8Array(bytes.byteLength); copy.set(bytes); return copy.buffer;
}
function safeEqual(left, right) {
  const a = new TextEncoder().encode(left); const b = new TextEncoder().encode(right); const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length; for (let i = 0; i < length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0); return diff === 0;
}
function unixNow() { return Math.floor(Date.now() / 1000); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
