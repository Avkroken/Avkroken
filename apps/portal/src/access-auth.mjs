import { createRemoteJWKSet, jwtVerify } from "jose";

const jwksCache = new Map();

function normalizedTeamDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) return null;
  return url.origin;
}

export function accessJwtConfig(env) {
  const teamDomain = normalizedTeamDomain(env?.ACCESS_TEAM_DOMAIN);
  const audience = String(env?.ACCESS_LOGO_ADMIN_AUD || "").trim();
  if (!teamDomain || !audience) return null;
  return { teamDomain, audience };
}

function remoteJwks(teamDomain) {
  if (!jwksCache.has(teamDomain)) {
    jwksCache.set(
      teamDomain,
      createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`))
    );
  }
  return jwksCache.get(teamDomain);
}

export async function verifyAccessToken(token, config, dependencies = {}) {
  const verify = dependencies.jwtVerify || jwtVerify;
  const keySet = dependencies.jwks || remoteJwks(config.teamDomain);
  return verify(token, keySet, {
    issuer: config.teamDomain,
    audience: config.audience
  });
}

export async function authorizeLogoAdmin(request, env, dependencies = {}) {
  const config = accessJwtConfig(env);
  if (!config) {
    return { ok: false, status: 503, error: "access_not_configured" };
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) {
    return { ok: false, status: 401, error: "access_token_missing" };
  }

  try {
    const result = await verifyAccessToken(token, config, dependencies);
    return { ok: true, payload: result.payload };
  } catch {
    return { ok: false, status: 403, error: "access_token_invalid" };
  }
}
