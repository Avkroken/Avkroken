import { createPrivateKey, createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const GITHUB_API_VERSION = "2026-03-10";
const USER_AGENT = "Avkroken-Skvallerbyttan-credential-check";

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

export function createGitHubAppJwt(clientId, privateKeyPem, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!clientId?.trim()) throw new Error("GitHub App client id is missing");
  if (!privateKeyPem?.trim()) throw new Error("GitHub App private key is missing");

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iat: nowSeconds - 60,
    exp: nowSeconds + 540,
    iss: clientId.trim(),
  }));
  const unsigned = `${header}.${payload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(createPrivateKey(privateKeyPem)).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function githubGet(fetchImpl, path, jwt) {
  return fetchImpl(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": USER_AGENT,
    },
  });
}

export async function verifyGitHubAppSource({
  clientId,
  privateKeyPem,
  organization,
  fetchImpl = fetch,
  nowSeconds,
}) {
  const jwt = createGitHubAppJwt(clientId, privateKeyPem, nowSeconds);

  const appResponse = await githubGet(fetchImpl, "/app", jwt);
  if (!appResponse.ok) {
    throw new Error(`GitHub App credential validation failed at GET /app (HTTP ${appResponse.status})`);
  }

  const app = await appResponse.json();
  if (app?.client_id && app.client_id !== clientId.trim()) {
    throw new Error("GitHub App credential validation returned a different client id");
  }

  const org = organization?.trim();
  if (!org) throw new Error("GitHub organization is missing");

  const installationResponse = await githubGet(
    fetchImpl,
    `/orgs/${encodeURIComponent(org)}/installation`,
    jwt,
  );
  if (!installationResponse.ok) {
    throw new Error(
      `GitHub App installation validation failed for ${org} (HTTP ${installationResponse.status})`,
    );
  }

  const installation = await installationResponse.json();
  if (!Number.isSafeInteger(installation?.id) || installation.id <= 0) {
    throw new Error("GitHub App installation id is missing");
  }

  return { ok: true };
}

export async function verifyConfiguredGitHubAppSource() {
  const raw = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(raw);
  const clientId = String(process.env.GAMNACKEN_GITHUB_APP_CLIENT_ID || "").trim();
  const organization = String(config?.vars?.SKVALLERBYTTAN_ORG || "Avkroken").trim();
  const privateKeyPem = String(process.env.GAMNACKEN_GITHUB_APP_PRIVATE_KEY || "");

  await verifyGitHubAppSource({
    clientId,
    privateKeyPem,
    organization,
  });

  console.log(`Gamnacken GitHub App source credential validated for ${organization}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyConfiguredGitHubAppSource().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
