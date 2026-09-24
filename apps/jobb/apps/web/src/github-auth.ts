import { renderAuthLoginPage, type AuthMode } from "./auth-ui";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_API_VERSION = "2026-03-10";
const USER_AGENT = "Avkroken-Jobb-auth";
const JOBB_ORIGIN = "https://jobb.denied.se";
const CALLBACK_URL = `${JOBB_ORIGIN}/auth/callback`;
const LOGIN_COOKIE = "__Host-jobb_oauth";
const SESSION_COOKIE = "__Host-jobb_session";
const LOGIN_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;
const FETCH_TIMEOUT_MS = 8_000;

export interface SecretsStoreSecretBinding {
  get(): Promise<string>;
}

export type GitHubSecretValue = string | SecretsStoreSecretBinding;

export interface GitHubAuthEnv {
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: GitHubSecretValue;
  JOBB_ALLOWED_GITHUB_IDS?: string;
}

interface LoginState {
  v: 1;
  state: string;
  verifier: string;
  returnTo: string;
  exp: number;
}

interface SessionState {
  v: 1;
  uid: number;
  iat: number;
  exp: number;
}

interface GitHubUser {
  id?: number;
  login?: string;
}

export function githubAuthConfigurationState(
  env: GitHubAuthEnv,
): "inactive" | "ready" | "misconfigured" {
  const clientId = env.GITHUB_OAUTH_CLIENT_ID?.trim() ?? "";
  const secretConfigured =
    typeof env.GITHUB_OAUTH_CLIENT_SECRET === "string"
      ? Boolean(env.GITHUB_OAUTH_CLIENT_SECRET.trim())
      : Boolean(env.GITHUB_OAUTH_CLIENT_SECRET);
  const allowed = allowedIds(env);

  if (!clientId && !secretConfigured && allowed.size === 0) return "inactive";
  return clientId && secretConfigured && allowed.size > 0
    ? "ready"
    : "misconfigured";
}

export function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.length > 2048) return "/";
  try {
    const resolved = new URL(value, JOBB_ORIGIN);
    if (resolved.origin !== JOBB_ORIGIN) return "/";
    return `${resolved.pathname}${resolved.search}`;
  } catch {
    return "/";
  }
}

export async function resolveGitHubClientSecret(
  env: GitHubAuthEnv,
): Promise<string> {
  const value = env.GITHUB_OAUTH_CLIENT_SECRET;
  try {
    const resolved =
      typeof value === "string"
        ? value.trim()
        : value
          ? (await value.get()).trim()
          : "";
    if (!resolved) throw new Error("GITHUB_OAUTH_CLIENT_SECRET is required");
    return resolved;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "GITHUB_OAUTH_CLIENT_SECRET is required"
    ) {
      throw error;
    }
    throw new Error("GITHUB_OAUTH_CLIENT_SECRET could not be resolved");
  }
}

export async function startGitHubLogin(
  request: Request,
  env: GitHubAuthEnv,
): Promise<Response> {
  if (githubAuthConfigurationState(env) !== "ready") {
    return redirect("/login?error=config");
  }

  const clientId = env.GITHUB_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = await resolveGitHubClientSecret(env);
  const verifier = randomBase64url(32);
  const state = randomBase64url(24);
  const challenge = base64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("return_to"));
  const loginState: LoginState = {
    v: 1,
    state,
    verifier,
    returnTo,
    exp: unixNow() + LOGIN_TTL_SECONDS,
  };

  const authorize = new URL(GITHUB_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", CALLBACK_URL);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "false");
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  return redirect(authorize.toString(), [
    secureCookie(
      LOGIN_COOKIE,
      await signPayload(loginState, clientSecret, "login-state"),
      LOGIN_TTL_SECONDS,
    ),
  ]);
}

export async function handleGitHubCallback(
  request: Request,
  env: GitHubAuthEnv,
): Promise<Response> {
  if (githubAuthConfigurationState(env) !== "ready") {
    return redirect("/login?error=config", [clearCookie(LOGIN_COOKIE)]);
  }

  const clientId = env.GITHUB_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = await resolveGitHubClientSecret(env);
  const url = new URL(request.url);
  if (url.searchParams.has("error")) {
    return redirect("/login?error=oauth", [clearCookie(LOGIN_COOKIE)]);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stored = cookie(request, LOGIN_COOKIE);
  if (!code || !state || !stored) {
    return redirect("/login?error=state", [clearCookie(LOGIN_COOKIE)]);
  }

  const loginState = await verifyPayload<LoginState>(
    stored,
    clientSecret,
    "login-state",
  );
  if (
    !loginState ||
    loginState.v !== 1 ||
    loginState.exp <= unixNow() ||
    !safeEqual(loginState.state, state)
  ) {
    return redirect("/login?error=state", [clearCookie(LOGIN_COOKIE)]);
  }

  let accessToken: string | null = null;
  try {
    accessToken = await exchangeCode(
      clientId,
      clientSecret,
      code,
      loginState.verifier,
    );
    const user = await fetchGitHubUser(accessToken);
    const userId = Number(user.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error("GitHub user id missing");
    }
    if (!allowedIds(env).has(userId)) {
      return redirect("/login?error=forbidden", [
        clearCookie(LOGIN_COOKIE),
        clearCookie(SESSION_COOKIE),
      ]);
    }

    const now = unixNow();
    const session: SessionState = {
      v: 1,
      uid: userId,
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
    };
    const sessionValue = await signPayload(
      session,
      clientSecret,
      "dashboard-session",
    );

    return redirect(loginState.returnTo, [
      clearCookie(LOGIN_COOKIE),
      secureCookie(SESSION_COOKIE, sessionValue, SESSION_TTL_SECONDS),
    ]);
  } catch (error) {
    console.error("GitHub OAuth callback failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return redirect("/login?error=oauth", [
      clearCookie(LOGIN_COOKIE),
      clearCookie(SESSION_COOKIE),
    ]);
  } finally {
    if (accessToken) {
      await revokeGitHubToken(clientId, clientSecret, accessToken);
    }
  }
}

export async function authenticatedGitHubUserId(
  request: Request,
  env: GitHubAuthEnv,
): Promise<number | null> {
  if (githubAuthConfigurationState(env) !== "ready") return null;
  const value = cookie(request, SESSION_COOKIE);
  if (!value) return null;

  const session = await verifyPayload<SessionState>(
    value,
    await resolveGitHubClientSecret(env),
    "dashboard-session",
  );
  if (!session || session.v !== 1) return null;

  const now = unixNow();
  if (
    !Number.isSafeInteger(session.uid) ||
    session.uid <= 0 ||
    !Number.isSafeInteger(session.iat) ||
    !Number.isSafeInteger(session.exp) ||
    session.iat > now + CLOCK_SKEW_SECONDS ||
    session.exp <= now ||
    session.exp - session.iat > SESSION_TTL_SECONDS
  ) {
    return null;
  }

  return allowedIds(env).has(session.uid) ? session.uid : null;
}

export function logoutGitHub(): Response {
  return redirect("/login", [
    clearCookie(LOGIN_COOKIE),
    clearCookie(SESSION_COOKIE),
  ]);
}

export function renderGitHubLoginPage(
  request: Request,
  mode: AuthMode,
): Response {
  const url = new URL(request.url);
  return renderAuthLoginPage(
    request,
    mode,
    sanitizeReturnTo(url.searchParams.get("return_to")),
  );
}

export type GitHubStartFailureCode =
  | "secret_unavailable"
  | "unexpected";

export interface GitHubStartFailure {
  code: GitHubStartFailureCode;
  status: number;
  title: string;
  message: string;
}

export function classifyGitHubStartFailure(
  error: unknown,
): GitHubStartFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("GITHUB_OAUTH_CLIENT_SECRET")) {
    return {
      code: "secret_unavailable",
      status: 503,
      title: "Inloggningen är inte redo",
      message:
        "Jobb kunde inte läsa GitHub OAuth-klienthemligheten från runtime-konfigurationen.",
    };
  }
  return {
    code: "unexpected",
    status: 502,
    title: "Inloggningen kunde inte starta",
    message:
      "Ett oväntat fel uppstod innan inloggningen kunde skickas vidare till GitHub.",
  };
}

async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  verifier: string,
): Promise<string> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: CALLBACK_URL,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) {
    throw new Error(`GitHub OAuth token exchange failed with ${response.status}`);
  }
  const data = await response.json<{ access_token?: string; error?: string }>();
  if (!data.access_token || data.error) {
    throw new Error("GitHub OAuth token exchange returned no access token");
  }
  return data.access_token;
}

async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch(GITHUB_USER_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub user lookup failed with ${response.status}`);
  }
  return response.json<GitHubUser>();
}

async function revokeGitHubToken(
  clientId: string,
  clientSecret: string,
  accessToken: string,
): Promise<void> {
  try {
    await fetch(
      `https://api.github.com/applications/${encodeURIComponent(clientId)}/token`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({ access_token: accessToken }),
      },
    );
  } catch {
    // The token is never persisted and is used only for the identity lookup.
  }
}

function allowedIds(env: GitHubAuthEnv): Set<number> {
  return new Set(
    (env.JOBB_ALLOWED_GITHUB_IDS ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  );
}

async function signPayload(
  payload: LoginState | SessionState,
  secret: string,
  purpose: "login-state" | "dashboard-session",
): Promise<string> {
  const encoded = base64url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await derivedHmacKey(secret, purpose),
    new TextEncoder().encode(encoded),
  );
  return `${encoded}.${base64url(signature)}`;
}

async function verifyPayload<T>(
  value: string,
  secret: string,
  purpose: "login-state" | "dashboard-session",
): Promise<T | null> {
  const separator = value.lastIndexOf(".");
  if (separator <= 0 || separator === value.length - 1) return null;

  try {
    const encoded = value.slice(0, separator);
    const signature = decodeBase64url(value.slice(separator + 1));
    const valid = await crypto.subtle.verify(
      "HMAC",
      await derivedHmacKey(secret, purpose),
      signature,
      new TextEncoder().encode(encoded),
    );
    if (!valid) return null;
    return JSON.parse(
      new TextDecoder().decode(decodeBase64url(encoded)),
    ) as T;
  } catch {
    return null;
  }
}

async function derivedHmacKey(
  secret: string,
  purpose: "login-state" | "dashboard-session",
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("Avkroken/Jobb/GitHubOAuth/v1"),
      info: new TextEncoder().encode(purpose),
    },
    baseKey,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

function cookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return null;
}

function secureCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 303, headers });
}

function randomBase64url(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

function base64url(input: string | ArrayBuffer | Uint8Array): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return diff === 0;
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}
