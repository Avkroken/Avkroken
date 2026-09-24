import { escapeHtml, htmlHeaders } from "./security.ts";

const STYLE = `
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark;background:#0b0d10;color:#eef4fb}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#1a2230 0,#0b0d10 35rem);padding:24px}
main{width:min(720px,100%);margin:7vh auto}.eyebrow{text-transform:uppercase;letter-spacing:.14em;color:#7dd3fc;font-weight:800;font-size:.73rem}
h1{font-size:clamp(2.4rem,8vw,4rem);margin:.2rem 0}.lead{color:#a2afbf;line-height:1.6}.card{margin-top:24px;border:1px solid #263244;background:#0e131bcc;border-radius:16px;padding:24px;box-shadow:0 20px 60px #0005}
button,a.button{display:inline-flex;align-items:center;justify-content:center;border:1px solid #3b4a60;background:#eef6ff;color:#08111c;border-radius:10px;padding:11px 16px;font-weight:800;text-decoration:none;cursor:pointer}
button.secondary{background:transparent;color:#dbe7f5}form{margin:0}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}.small{color:#7f8da0;font-size:.82rem;line-height:1.5}
code{background:#111923;border:1px solid #273548;padding:.1rem .35rem;border-radius:6px}.scope{display:inline-block;margin:.2rem .25rem .2rem 0;padding:.25rem .45rem;border-radius:999px;background:#152234;border:1px solid #2a4161;color:#cde7ff;font-size:.82rem}
label{display:block;font-weight:700;margin-top:14px}input,textarea,select{width:100%;margin-top:6px;background:#0a0f16;color:#eef4fb;border:1px solid #334155;border-radius:8px;padding:10px;font:inherit}textarea{min-height:110px}
.error{border-color:#7f1d1d;background:#2a1115;color:#fecaca;padding:10px 12px;border-radius:10px}.ok{border-color:#14532d;background:#0e2418;color:#bbf7d0;padding:10px 12px;border-radius:10px}
`;

function shell(title: string, body: string, scripts = ""): Response {
  const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escapeHtml(title)} · Krösa-Maja</title><style>${STYLE}</style></head><body><main><p class="eyebrow">Avkroken identity</p><h1>Krösa-Maja</h1>${body}</main>${scripts}</body></html>`;
  return new Response(html, { status: 200, headers: htmlHeaders() });
}

export function signInPage(query: string): Response {
  const params = new URLSearchParams(query);
  const oauthQuery = params.has("sig") ? params.toString() : "";
  const action = oauthQuery
    ? `<form method="post" action="/sign-in/github"><input type="hidden" name="oauth_query" value="${escapeHtml(oauthQuery)}"><button type="submit">Fortsätt med GitHub</button></form>`
    : `<a class="button" href="/sign-in/github">Fortsätt med GitHub</a>`;
  return shell(
    "Logga in",
    `<p class="lead">Central OAuth 2.1- och OpenID Connect-identitet för Avkrokens tjänster.</p><section class="card"><h2>Logga in</h2><p>GitHub används som rotidentitet. Krösa-Maja utfärdar därefter egna OIDC/OAuth-token till registrerade klienter.</p>${action}<p class="small">Endast uttryckligen tillåtna GitHub-ID:n kan skapa en Krösa-Maja-session.</p></section>`,
  );
}

export function consentPage(query: URLSearchParams): Response {
  const clientId = query.get("client_id") ?? "okänd klient";
  const scopes = (query.get("scope") ?? "").split(/\s+/).filter(Boolean);
  const signedQuery = query.toString();
  return shell(
    "Godkänn åtkomst",
    `<p class="lead">En registrerad klient begär åtkomst via Krösa-Maja.</p><section class="card"><h2>Godkänn åtkomst</h2><p class="small">Client ID — identifierar appen och är inte en hemlighet.</p><p><code>${escapeHtml(clientId)}</code></p><div>${scopes.map((scope) => `<span class="scope">${escapeHtml(scope)}</span>`).join("") || "<span class=\"small\">Inga extra scopes.</span>"}</div><p id="consent-error" class="error" hidden>Beslutet kunde inte skickas. Försök igen.</p><div class="actions"><form data-consent-form method="post" action="/consent/decision"><input type="hidden" name="accept" value="true"><input type="hidden" name="oauth_query" value="${escapeHtml(signedQuery)}"><button type="submit">Godkänn</button></form><form data-consent-form method="post" action="/consent/decision"><input type="hidden" name="accept" value="false"><input type="hidden" name="oauth_query" value="${escapeHtml(signedQuery)}"><button class="secondary" type="submit">Neka</button></form></div><p class="small">Ditt val skickas som en same-origin POST. Den signerade OAuth-queryn lämnar inte request body.</p></section>`,
    '<script src="/consent.js" defer></script>',
  );
}

export function consentScript(): Response {
  const script = `(() => {
    const forms = document.querySelectorAll("form[data-consent-form]");
    const error = document.getElementById("consent-error");
    for (const form of forms) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const buttons = document.querySelectorAll("form[data-consent-form] button");
        for (const button of buttons) button.disabled = true;
        if (error) error.hidden = true;
        try {
          const response = await fetch(form.action, {
            method: "POST",
            body: new FormData(form),
            credentials: "same-origin",
            headers: { Accept: "application/json" },
          });
          if (!response.ok) throw new Error("consent request failed");
          const payload = await response.json();
          if (!payload || typeof payload.url !== "string") {
            throw new Error("consent redirect missing");
          }
          window.location.assign(payload.url);
        } catch {
          if (error) error.hidden = false;
          for (const button of buttons) button.disabled = false;
        }
      });
    }
  })();`;

  return new Response(script, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/javascript; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export interface AdminViewModel {
  cloudflareConfigured: boolean;
  cloudflareLinked: boolean;
  accounts: readonly { providerId?: string; accountId?: string; scopes?: readonly string[] }[];
  message?: string;
}

export function adminPage(model: AdminViewModel): Response {
  const cloudflare = !model.cloudflareConfigured
    ? `<p class="error">Cloudflare OAuth-klienten är inte konfigurerad ännu.</p>`
    : model.cloudflareLinked
      ? `<p class="ok">Cloudflare är länkad. Delegerade API-token lagras krypterat.</p><form method="post" action="/admin/verify-cloudflare"><button class="secondary" type="submit">Verifiera Cloudflare API</button></form>`
      : `<form method="post" action="/admin/connect-cloudflare"><button type="submit">Koppla Cloudflare</button></form>`;
  const providers = model.accounts.map((account) => `<li><strong>${escapeHtml(account.providerId ?? "unknown")}</strong> · ${escapeHtml(account.accountId ?? "")}</li>`).join("");
  return shell(
    "Administration",
    `<p class="lead">Hantera identitetskopplingar och förstapartsklienter.</p>${model.message ? `<p class="ok">${escapeHtml(model.message)}</p>` : ""}<section class="card"><h2>Identitetskopplingar</h2>${cloudflare}<ul>${providers}</ul></section><section class="card"><h2>Ny OAuth/OIDC-klient</h2><form method="post" action="/admin/clients"><label>Namn<input name="client_name" required maxlength="100"></label><label>Klienttyp<select name="client_type"><option value="web">Webb / konfidentiell</option><option value="native">Native / publik</option></select></label><label>Redirect URI:er, en per rad<textarea name="redirect_uris" required></textarea></label><label>Post-logout URI:er, en per rad (valfritt)<textarea name="post_logout_redirect_uris"></textarea></label><label><input style="width:auto" type="checkbox" name="skip_consent" value="true"> Förstapartsklient: hoppa över samtyckesskärmen</label><div class="actions"><button type="submit">Skapa klient</button></div></form><p class="small">Konfidentiella klienter får ett client secret som visas i svaret. Spara det som en hemlighet; det loggas inte av Krösa-Maja.</p></section>`,
  );
}

export function clientCreatedPage(client: { client_id?: unknown; client_secret?: unknown }): Response {
  const clientId = String(client.client_id ?? "");
  const clientSecret = typeof client.client_secret === "string" ? client.client_secret : null;
  return shell(
    "Klient skapad",
    `<p class="lead">Klienten är skapad.</p><section class="card"><h2>Credentials</h2><p>Client ID</p><p><code>${escapeHtml(clientId)}</code></p>${clientSecret ? `<p>Client secret — kopiera och lagra säkert nu:</p><p><code>${escapeHtml(clientSecret)}</code></p>` : `<p>Publik klient — inget client secret utfärdades.</p>`}<div class="actions"><a class="button" href="/admin">Till administration</a></div></section>`,
  );
}

export function cloudflareVerifiedPage(user: { id: string; email: string; firstName?: string | null; lastName?: string | null }): Response {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return shell(
    "Cloudflare verifierad",
    `<p class="lead">Krösa-Maja kunde hämta användarprofilen med den delegerade Cloudflare-tokenen.</p><section class="card"><h2>Cloudflare API fungerar</h2>${name ? `<p>${escapeHtml(name)}</p>` : ""}<p>${escapeHtml(user.email)}</p><p class="small">Cloudflare user ID: <code>${escapeHtml(user.id)}</code></p><div class="actions"><a class="button" href="/admin">Till administration</a></div></section>`,
  );
}
