import { renderAuthLoginPage, type AuthMode } from "./auth-ui";

const KROSA_MAJA_ISSUER = "https://auth.denied.se";
const JOBB_ORIGIN = "https://jobb.denied.se";
const CALLBACK_URL = `${JOBB_ORIGIN}/auth/callback`;
const LOGIN_COOKIE = "__Host-jobb_oidc";
const SESSION_COOKIE = "__Host-jobb_session";
const LOGIN_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;
const FETCH_TIMEOUT_MS = 8_000;

export interface SecretsStoreSecretBinding {
  get(): Promise<string>;
}

export type OidcSecretValue = string | SecretsStoreSecretBinding;

export interface OidcAuthEnv {
  KROSA_MAJA_OIDC_CLIENT_ID?: string;
  KROSA_MAJA_OIDC_CLIENT_SECRET?: OidcSecretValue;
}

interface DiscoveryDocument {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  jwks_uri?: string;
}

interface LoginState {
  v: 1;
  state: string;
  verifier: string;
  nonce: string;
  returnTo: string;
  exp: number;
}

interface SessionState {
  v: 1;
  sub: string;
  iat: number;
  exp: number;
}

interface IdTokenHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface IdTokenClaims {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  azp?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  nonce?: string;
}

interface OidcJsonWebKey extends JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

interface JsonWebKeySet {
  keys?: OidcJsonWebKey[];
}

let discoveryCache:
  | { clientId: string; expiresAt: number; document: Required<DiscoveryDocument> }
  | undefined;

export function oidcConfigurationState(
  env: OidcAuthEnv,
): "inactive" | "ready" | "misconfigured" {
  const clientId = env.KROSA_MAJA_OIDC_CLIENT_ID?.trim() ?? "";
  const rawClientSecret = env.KROSA_MAJA_OIDC_CLIENT_SECRET;
  const clientSecretConfigured =
    typeof rawClientSecret === "string"
      ? Boolean(rawClientSecret.trim())
      : Boolean(rawClientSecret);
  if (!clientId && !clientSecretConfigured) return "inactive";
  return clientId && clientSecretConfigured ? "ready" : "misconfigured";
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

export async function startOidcLogin(
  request: Request,
  env: OidcAuthEnv,
): Promise<Response> {
  const clientId = requiredClientId(env);
  const clientSecret = await resolveOidcClientSecret(env);
  const discovery = await getDiscovery(clientId);
  const verifier = randomBase64url(32);
  const state = randomBase64url(24);
  const nonce = randomBase64url(24);
  const challenge = base64url(await sha256(new TextEncoder().encode(verifier)));
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("return_to"));
  const now = unixNow();

  const loginState: LoginState = {
    v: 1,
    state,
    verifier,
    nonce,
    returnTo,
    exp: now + LOGIN_TTL_SECONDS,
  };
  const cookieValue = await signPayload(loginState, clientSecret, "login-state");

  const authorize = new URL(discovery.authorization_endpoint);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", CALLBACK_URL);
  authorize.searchParams.set("scope", "openid profile email");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("nonce", nonce);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  return redirect(authorize.toString(), [
    secureCookie(LOGIN_COOKIE, cookieValue, LOGIN_TTL_SECONDS),
  ]);
}

export async function handleOidcCallback(
  request: Request,
  env: OidcAuthEnv,
): Promise<Response> {
  const clientId = requiredClientId(env);
  const clientSecret = await resolveOidcClientSecret(env);
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

  try {
    const discovery = await getDiscovery(clientId);
    const tokens = await exchangeCode(
      discovery,
      clientId,
      clientSecret,
      code,
      loginState.verifier,
    );
    const claims = await verifyOidcIdToken(
      tokens.id_token,
      discovery,
      clientId,
      loginState.nonce,
    );

    const now = unixNow();
    const session: SessionState = {
      v: 1,
      sub: claims.sub,
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
    console.error("Krösa-Maja OIDC callback failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return redirect("/login?error=oauth", [
      clearCookie(LOGIN_COOKIE),
      clearCookie(SESSION_COOKIE),
    ]);
  }
}

export async function authenticatedOidcSubject(
  request: Request,
  env: OidcAuthEnv,
): Promise<string | null> {
  if (oidcConfigurationState(env) !== "ready") return null;
  const value = cookie(request, SESSION_COOKIE);
  if (!value) return null;

  const session = await verifyPayload<SessionState>(
    value,
    await resolveOidcClientSecret(env),
    "dashboard-session",
  );
  if (!session || session.v !== 1) return null;

  const now = unixNow();
  if (
    !session.sub ||
    !Number.isSafeInteger(session.iat) ||
    !Number.isSafeInteger(session.exp) ||
    session.iat > now + CLOCK_SKEW_SECONDS ||
    session.exp <= now ||
    session.exp - session.iat > SESSION_TTL_SECONDS
  ) {
    return null;
  }

  return session.sub;
}

export function logoutOidc(): Response {
  return redirect("/login", [
    clearCookie(LOGIN_COOKIE),
    clearCookie(SESSION_COOKIE),
  ]);
}

export function renderOidcLoginPage(
  request: Request,
  mode: AuthMode,
): Response {
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("return_to"));
  return renderAuthLoginPage(request, mode, returnTo);
}

export type OidcStartFailureCode =
  | "secret_unavailable"
  | "provider_unavailable"
  | "metadata_invalid"
  | "unexpected";

export interface OidcStartFailure {
  code: OidcStartFailureCode;
  status: number;
  title: string;
  message: string;
}

export function classifyOidcStartFailure(error: unknown): OidcStartFailure {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";

  if (message.includes("KROSA_MAJA_OIDC_CLIENT_SECRET")) {
    return {
      code: "secret_unavailable",
      status: 503,
      title: "Inloggningen är inte redo",
      message:
        "Jobb kunde inte läsa sin OIDC-klienthemlighet från runtime-konfigurationen. Försök igen när konfigurationen är verifierad.",
    };
  }

  if (
    message.startsWith("OIDC discovery failed with") ||
    name === "TimeoutError" ||
    name === "AbortError" ||
    /timed out|timeout/i.test(message)
  ) {
    return {
      code: "provider_unavailable",
      status: 502,
      title: "Krösa-Maja går inte att nå",
      message:
        "Jobb kunde inte hämta OIDC-metadata från Krösa-Maja just nu. Försök igen om en stund.",
    };
  }

  if (
    message.includes("OIDC discovery issuer mismatch") ||
    message.includes("OIDC discovery is missing") ||
    message.includes("must use HTTPS") ||
    message.includes("must use the Krösa-Maja issuer origin")
  ) {
    return {
      code: "metadata_invalid",
      status: 502,
      title: "OIDC-konfigurationen avvisades",
      message:
        "Krösa-Majas metadata matchar inte Jobbs säkerhetskrav. Inloggningen stoppades innan några credentials skickades.",
    };
  }

  return {
    code: "unexpected",
    status: 502,
    title: "Inloggningen kunde inte starta",
    message:
      "Ett oväntat fel uppstod innan inloggningen kunde skickas vidare till Krösa-Maja.",
  };
}

export async function verifyOidcIdToken(
  idToken: string,
  discovery: Required<DiscoveryDocument>,
  clientId: string,
  expectedNonce: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ sub: string }> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("OIDC ID token is malformed");

  const header = parseJsonSegment<IdTokenHeader>(parts[0]);
  const claims = parseJsonSegment<IdTokenClaims>(parts[1]);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("OIDC ID token uses an unsupported signing algorithm");
  }

  const jwksResponse = await fetchImpl(discovery.jwks_uri, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!jwksResponse.ok) {
    throw new Error(`OIDC JWKS fetch failed with ${jwksResponse.status}`);
  }
  const jwks = (await jwksResponse.json()) as JsonWebKeySet;
  const jwk = jwks.keys?.find(
    (candidate) =>
      candidate.kid === header.kid &&
      candidate.kty === "RSA" &&
      (!candidate.alg || candidate.alg === "RS256") &&
      (!candidate.use || candidate.use === "sig"),
  );
  if (!jwk) throw new Error("OIDC signing key was not found");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!validSignature) throw new Error("OIDC ID token signature is invalid");

  const now = unixNow();
  if (claims.iss !== KROSA_MAJA_ISSUER) throw new Error("OIDC issuer mismatch");
  if (!claims.sub) throw new Error("OIDC subject is missing");
  if (!audienceIncludes(claims.aud, clientId)) throw new Error("OIDC audience mismatch");
  if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId) {
    throw new Error("OIDC authorized party mismatch");
  }
  if (claims.azp && claims.azp !== clientId) throw new Error("OIDC authorized party mismatch");
  const expiresAt = Number(claims.exp);
  const issuedAt = Number(claims.iat);
  if (!Number.isFinite(expiresAt) || expiresAt <= now - CLOCK_SKEW_SECONDS) {
    throw new Error("OIDC ID token is expired");
  }
  if (!Number.isFinite(issuedAt) || issuedAt > now + CLOCK_SKEW_SECONDS) {
    throw new Error("OIDC ID token issued-at is invalid");
  }
  if (claims.nbf !== undefined) {
    const notBefore = Number(claims.nbf);
    if (!Number.isFinite(notBefore) || notBefore > now + CLOCK_SKEW_SECONDS) {
      throw new Error("OIDC ID token is not active");
    }
  }
  if (!claims.nonce || !safeEqual(claims.nonce, expectedNonce)) {
    throw new Error("OIDC nonce mismatch");
  }

  return { sub: claims.sub };
}

async function exchangeCode(
  discovery: Required<DiscoveryDocument>,
  clientId: string,
  clientSecret: string,
  code: string,
  verifier: string,
): Promise<{ id_token: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: CALLBACK_URL,
    code_verifier: verifier,
  });
  const credentials = btoa(
    `${formEncode(clientId)}:${formEncode(clientSecret)}`,
  );
  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`OIDC token exchange failed with ${response.status}`);
  }
  const data = (await response.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("OIDC token response has no ID token");
  return { id_token: data.id_token };
}

async function getDiscovery(
  clientId: string,
): Promise<Required<DiscoveryDocument>> {
  const now = Date.now();
  if (
    discoveryCache &&
    discoveryCache.clientId === clientId &&
    discoveryCache.expiresAt > now
  ) {
    return discoveryCache.document;
  }

  const response = await fetch(
    `${KROSA_MAJA_ISSUER}/.well-known/openid-configuration`,
    {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok) {
    throw new Error(`OIDC discovery failed with ${response.status}`);
  }
  const raw = (await response.json()) as DiscoveryDocument;
  if (raw.issuer !== KROSA_MAJA_ISSUER) throw new Error("OIDC discovery issuer mismatch");

  const authorizationEndpoint = requiredIssuerUrl(
    raw.authorization_endpoint,
    "authorization_endpoint",
  );
  const tokenEndpoint = requiredIssuerUrl(raw.token_endpoint, "token_endpoint");
  const jwksUri = requiredIssuerUrl(raw.jwks_uri, "jwks_uri");
  const document: Required<DiscoveryDocument> = {
    issuer: KROSA_MAJA_ISSUER,
    authorization_endpoint: authorizationEndpoint,
    token_endpoint: tokenEndpoint,
    jwks_uri: jwksUri,
  };
  discoveryCache = {
    clientId,
    expiresAt: now + 5 * 60 * 1000,
    document,
  };
  return document;
}

function requiredIssuerUrl(value: string | undefined, name: string): string {
  if (!value) throw new Error(`OIDC discovery is missing ${name}`);
  const url = new URL(value);
  const issuer = new URL(KROSA_MAJA_ISSUER);
  if (url.protocol !== "https:") throw new Error(`OIDC ${name} must use HTTPS`);
  if (url.origin !== issuer.origin) {
    throw new Error(`OIDC ${name} must use the Krösa-Maja issuer origin`);
  }
  return url.toString();
}

function requiredClientId(env: OidcAuthEnv): string {
  const value = env.KROSA_MAJA_OIDC_CLIENT_ID?.trim();
  if (!value) throw new Error("KROSA_MAJA_OIDC_CLIENT_ID is required");
  return value;
}

export async function resolveOidcClientSecret(
  env: OidcAuthEnv,
): Promise<string> {
  const value = env.KROSA_MAJA_OIDC_CLIENT_SECRET;
  let resolved = "";
  try {
    resolved =
      typeof value === "string"
        ? value.trim()
        : value
          ? (await value.get()).trim()
          : "";
  } catch {
    throw new Error(
      "KROSA_MAJA_OIDC_CLIENT_SECRET could not be resolved",
    );
  }
  if (!resolved) {
    throw new Error("KROSA_MAJA_OIDC_CLIENT_SECRET is required");
  }
  return resolved;
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
  const encoded = value.slice(0, separator);
  const signature = decodeBase64url(value.slice(separator + 1));
  const valid = await crypto.subtle.verify(
    "HMAC",
    await derivedHmacKey(secret, purpose),
    signature,
    new TextEncoder().encode(encoded),
  );
  if (!valid) return null;
  try {
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
      salt: new TextEncoder().encode("Avkroken/Jobb/Krosa-Maja/OIDC/v1"),
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

async function sha256(value: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", toArrayBuffer(value));
}

function base64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
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
  return toArrayBuffer(bytes);
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function parseJsonSegment<T>(value: string): T {
  try {
    return JSON.parse(
      new TextDecoder().decode(decodeBase64url(value)),
    ) as T;
  } catch {
    throw new Error("OIDC ID token JSON is malformed");
  }
}

function audienceIncludes(
  audience: string | string[] | undefined,
  clientId: string,
): boolean {
  return typeof audience === "string"
    ? audience === clientId
    : Array.isArray(audience) && audience.includes(clientId);
}

function formEncode(value: string): string {
  const encoded = new URLSearchParams({ v: value }).toString();
  return encoded.slice(2);
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
