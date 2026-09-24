import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import {
  createGitHubAppJwt,
  verifyGitHubAppSource,
} from "../scripts/verify-github-app-source.mjs";

function fixtureKey() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicKey,
  };
}

function decodePart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

test("creates a GitHub App RS256 JWT with bounded claims", () => {
  const { privatePem, publicKey } = fixtureKey();
  const jwt = createGitHubAppJwt("Iv-test-client", privatePem, 1_790_000_000);
  const [header, payload, signature] = jwt.split(".");

  assert.deepEqual(decodePart(header), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(decodePart(payload), {
    iat: 1_789_999_940,
    exp: 1_790_000_540,
    iss: "Iv-test-client",
  });
  assert.equal(
    verify(
      "RSA-SHA256",
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, "base64url"),
    ),
    true,
  );
});

test("validates the App identity and Avkroken installation before secret sync", async () => {
  const { privatePem } = fixtureKey();
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, auth: init.headers.Authorization });
    if (url.endsWith("/app")) {
      return new Response(JSON.stringify({ client_id: "Iv-test-client" }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 42 }), { status: 200 });
  };

  await assert.doesNotReject(() => verifyGitHubAppSource({
    clientId: "Iv-test-client",
    privateKeyPem: privatePem,
    organization: "Avkroken",
    fetchImpl,
    nowSeconds: 1_790_000_000,
  }));

  assert.equal(seen.length, 2);
  assert.equal(seen[0].url, "https://api.github.com/app");
  assert.equal(seen[1].url, "https://api.github.com/orgs/Avkroken/installation");
  assert.match(seen[0].auth, /^Bearer [^.]+\.[^.]+\.[^.]+$/);
});

test("fails closed before secret mutation when GitHub rejects the source credential", async () => {
  const { privatePem } = fixtureKey();
  const fetchImpl = async () => new Response(
    JSON.stringify({ message: "sensitive provider error must not be echoed" }),
    { status: 401 },
  );

  await assert.rejects(
    () => verifyGitHubAppSource({
      clientId: "Iv-test-client",
      privateKeyPem: privatePem,
      organization: "Avkroken",
      fetchImpl,
      nowSeconds: 1_790_000_000,
    }),
    /GET \/app \(HTTP 401\)/,
  );
});
