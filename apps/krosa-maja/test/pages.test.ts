import assert from "node:assert/strict";
import test from "node:test";
import {
  consentPage,
  consentScript,
  signInPage,
} from "../src/pages.ts";
import { htmlHeaders } from "../src/security.ts";

test("direct admin login does not forward an unsigned return_to as oauth_query", async () => {
  const response = signInPage("return_to=%2Fadmin");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.doesNotMatch(html, /name="oauth_query"/);
  assert.doesNotMatch(html, /return_to/);
  assert.match(html, /<a class="button" href="\/sign-in\/github">Fortsätt med GitHub<\/a>/);
  assert.doesNotMatch(html, /<form method="post" action="\/sign-in\/github">/);
});

test("signed provider login preserves the signed OAuth query for GitHub handoff", async () => {
  const response = signInPage(
    "client_id=jobb&redirect_uri=https%3A%2F%2Fjobb.denied.se%2Fauth%2Fcallback&sig=abc%2Bdef%2Fghi%3D",
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<form method="post" action="\/sign-in\/github">/);
  assert.match(html, /name="oauth_query"/);
  assert.match(html, /client_id=jobb/);
  assert.match(html, /sig=abc%2Bdef%2Fghi%3D/);
  assert.doesNotMatch(html, /href="\/sign-in\/github"/);
});


test("consent page labels client ID and keeps signed OAuth state in POST body", async () => {
  const query = new URLSearchParams(
    "client_id=jobb-client&scope=openid%20profile&state=abc&sig=def",
  );
  const response = consentPage(query);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Client ID/);
  assert.match(html, /är inte en hemlighet/);
  assert.match(html, /jobb-client/);
  assert.match(html, /data-consent-form/);
  assert.match(html, /name="oauth_query"/);
  assert.match(html, /src="\/consent\.js"/);
  assert.doesNotMatch(html, /client secret/i);
});

test("consent script submits same-origin POST and navigates only after JSON redirect", async () => {
  const response = consentScript();
  const script = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/javascript/);
  assert.match(script, /method: "POST"/);
  assert.match(script, /credentials: "same-origin"/);
  assert.match(script, /Accept: "application\/json"/);
  assert.match(script, /window\.location\.assign\(payload\.url\)/);
});


test("consent CSP permits only same-origin script and fetch", () => {
  const csp = htmlHeaders().get("Content-Security-Policy") ?? "";
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /form-action 'self'/);
});
