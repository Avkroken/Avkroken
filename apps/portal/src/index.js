import { isRetiredRepository } from "./repository-policy.mjs";
import { documentationPath, isPortalDocumentRoute, protectedRedirectForPath } from "./portal-routes.mjs";
import { normalizePublicRepositories } from "./project-source.mjs";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

const GITHUB_API =
  "https://api.github.com/orgs/Avkroken/repos?type=public&per_page=100&sort=full_name&direction=asc";

const CACHE_SECONDS = 300;
const DOCS_CACHE_SECONDS = 21600;
const DOC_CONTENT_CACHE_SECONDS = 21600;
const MAX_DOC_DEPTH = 2;

const WATCHED_SERVICES = ["skvallerbyttan"];
const HEARTBEAT_EXPECTED_INTERVAL_SECONDS = 15 * 60;
const HEARTBEAT_STALE_AFTER_SECONDS = 35 * 60;

function githubHeaders(env, accept = "application/vnd.github+json") {
  const headers = {
    "Accept": accept,
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "Avkroken-Portal-Worker"
  };
  if (env.GITHUB_TOKEN) headers.Authorization = "Bearer " + env.GITHUB_TOKEN;
  return headers;
}

function encodedPath(path) {
  return String(path || "").split("/").map(segment => encodeURIComponent(segment)).join("/");
}

function docsRepoTag(repoName) {
  let safe = String(repoName || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-");

  while (safe.startsWith("-")) safe = safe.slice(1);
  while (safe.endsWith("-")) safe = safe.slice(0, -1);

  return "docs-repo-" + (safe || "unknown");
}

function isPublicMarkdownPath(path) {
  const value = String(path || "");
  return /^docs\/.*\.(md|markdown)$/i.test(value) ||
    /^readme\.(md|markdown)$/i.test(value);
}

async function purgeDocumentationCache(ctx, tags) {
  const uniqueTags = [...new Set(tags.filter(Boolean))];
  if (!uniqueTags.length) return { success: true, errors: [] };

  const delaysMs = [0, 100, 300];
  let lastErrors = [];

  for (const delayMs of delaysMs) {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    try {
      const result = await ctx.cache.purge({ tags: uniqueTags });
      if (result.success) return result;
      lastErrors = Array.isArray(result.errors) ? result.errors : [];
    } catch (error) {
      lastErrors = [String(error instanceof Error ? error.message : error)];
    }
  }

  return { success: false, errors: lastErrors };
}

function pageLabel(path) {
  const name = path.split("/").pop() || path;
  const stem = name.replace(/\.(md|markdown)$/i, "");
  const known = {
    "README": "Översikt",
    "index": "Översikt",
    "architecture": "Arkitektur",
    "operations": "Drift",
    "security": "Säkerhet",
    "project-context": "Projektkontext",
    "engineering-context": "Engineering context",
    "deployment": "Deployment",
    "authentication": "Autentisering",
    "automation": "Automation",
    "discovery": "Discovery",
    "providers": "Providers"
  };
  if (known[stem]) return known[stem];
  return stem.replace(/[-_]+/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

async function fetchGitHubJson(url, env) {
  const response = await fetch(url, { headers: githubHeaders(env) });
  if (!response.ok) return { ok: false, status: response.status, data: null };
  return { ok: true, status: response.status, data: await response.json() };
}

async function scanMarkdownDocs(repo, env, path = "docs", depth = 0) {
  if (depth > MAX_DOC_DEPTH) return [];
  const endpoint = "https://api.github.com/repos/Avkroken/" + encodeURIComponent(repo.name) +
    "/contents/" + encodedPath(path) + "?ref=" + encodeURIComponent(repo.default_branch);
  const result = await fetchGitHubJson(endpoint, env);
  if (!result.ok || !Array.isArray(result.data)) return [];

  const files = result.data
    .filter(item => item && item.type === "file" && /\.(md|markdown)$/i.test(item.name || ""))
    .map(item => ({ path: item.path, label: pageLabel(item.path) }));

  if (depth < MAX_DOC_DEPTH) {
    const directories = result.data.filter(item => item && item.type === "dir");
    const nested = await Promise.all(
      directories.map(item => scanMarkdownDocs(repo, env, item.path, depth + 1))
    );
    nested.forEach(items => files.push(...items));
  }

  return files;
}

async function readmePage(repo, env) {
  const endpoint = "https://api.github.com/repos/Avkroken/" + encodeURIComponent(repo.name) +
    "/readme?ref=" + encodeURIComponent(repo.default_branch);
  const result = await fetchGitHubJson(endpoint, env);
  if (!result.ok || !result.data || typeof result.data.path !== "string") return null;
  if (!isPublicMarkdownPath(result.data.path)) return null;
  return { path: result.data.path, label: "Översikt" };
}

function pageSort(a, b) {
  const rank = value => value.path === "docs/index.md" ? 0 : value.path === "README.md" ? 1 : 2;
  const diff = rank(a) - rank(b);
  if (diff !== 0) return diff;
  return a.path.localeCompare(b.path, "sv");
}

async function buildDocsEntry(repo, env) {
  const [docs, readme] = await Promise.all([
    scanMarkdownDocs(repo, env),
    readmePage(repo, env)
  ]);

  const pages = [...docs];
  if (readme && !pages.some(page => page.path === readme.path)) pages.push(readme);
  pages.sort(pageSort);

  return {
    name: repo.name,
    description: repo.description || "",
    repository: repo.html_url,
    issues: repo.html_url + "/issues",
    language: repo.language || null,
    updatedAt: repo.pushed_at || repo.updated_at || null,
    defaultBranch: repo.default_branch,
    hasPages: repo.has_pages === true,
    pagesUrl: repo.has_pages === true
      ? "https://avkroken.github.io/" + encodeURIComponent(repo.name) + "/"
      : null,
    pages
  };
}

async function loadDocsCatalog(env) {
  const github = await fetch(GITHUB_API, { headers: githubHeaders(env) });
  if (!github.ok) throw new Error("github_unavailable:" + github.status);

  const repos = (await github.json()).filter(repo =>
    repo &&
    repo.visibility === "public" &&
    repo.archived === false &&
    !isRetiredRepository(repo.name)
  );
  const entries = await Promise.all(repos.map(repo => buildDocsEntry(repo, env)));
  entries.sort((a, b) => a.name.localeCompare(b.name, "sv"));
  return entries;
}

async function getDocsCatalog(env) {
  try {
    const entries = await loadDocsCatalog(env);
    return new Response(JSON.stringify(entries), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Cloudflare-CDN-Cache-Control": "public, max-age=" + DOCS_CACHE_SECONDS,
        "Cache-Tag": "docs-catalog"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "github_unavailable" }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
}

async function getDocContent(requestUrl, env) {
  const repoName = requestUrl.searchParams.get("repo") || "";
  const requestedPath = requestUrl.searchParams.get("path") || "";

  let catalog;
  try {
    catalog = await loadDocsCatalog(env);
  } catch {
    return new Response(JSON.stringify({ error: "github_unavailable" }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  const repo = catalog.find(entry => entry.name === repoName);
  const page = repo?.pages.find(entry => entry.path === requestedPath);
  if (!repo || !page) {
    return new Response(JSON.stringify({ error: "document_not_found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  const endpoint = "https://api.github.com/repos/Avkroken/" + encodeURIComponent(repo.name) +
    "/contents/" + encodedPath(page.path) + "?ref=" + encodeURIComponent(repo.defaultBranch);
  const github = await fetch(endpoint, {
    headers: githubHeaders(env, "application/vnd.github.raw+json")
  });

  if (!github.ok) {
    return new Response(JSON.stringify({ error: "document_unavailable", status: github.status }), {
      status: github.status === 404 ? 404 : 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  const markdown = await github.text();
  if (markdown.length > 250000) {
    return new Response(JSON.stringify({ error: "document_too_large" }), {
      status: 413,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  return new Response(JSON.stringify({
    repo: repo.name,
    path: page.path,
    label: page.label,
    markdown,
    sourceUrl: repo.repository + "/blob/" + encodeURIComponent(repo.defaultBranch) + "/" +
      page.path.split("/").map(encodeURIComponent).join("/")
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Cloudflare-CDN-Cache-Control": "public, max-age=" + DOC_CONTENT_CACHE_SECONDS,
      "Cache-Tag": "docs-catalog," + docsRepoTag(repo.name)
    }
  });
}
async function loadPublicProjects(env) {
  const github = await fetch(GITHUB_API, { headers: githubHeaders(env) });
  if (!github.ok) throw new Error("github_unavailable:" + github.status);
  return normalizePublicRepositories(await github.json());
}

async function getPublicProjects(env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request("https://avkroken-cache.invalid/github-projects-v1");
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const projects = await loadPublicProjects(env);
    const response = new Response(JSON.stringify({
      source: {
        provider: "github",
        scope: "Avkroken",
        coverage: "active_public_repositories"
      },
      generatedAt: new Date().toISOString(),
      projects
    }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Cloudflare-CDN-Cache-Control": "public, max-age=" + CACHE_SECONDS
      }
    });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return new Response(JSON.stringify({ error: "github_unavailable" }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
}

async function getPortalSites(env, ctx) {
  const projectsResponse = await getPublicProjects(env, ctx);
  if (!projectsResponse.ok) return projectsResponse;

  const payload = await projectsResponse.clone().json();
  const sites = Array.isArray(payload.projects)
    ? payload.projects.filter(project => project.portalPublished === true)
    : [];

  return new Response(JSON.stringify(sites), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Cloudflare-CDN-Cache-Control": "public, max-age=" + CACHE_SECONDS
    }
  });
}

function operationalWatchdogStub(env, service) {
  if (!env.OPS_WATCHDOG) throw new Error("operational watchdog binding is not configured");
  const id = env.OPS_WATCHDOG.idFromName(service);
  return env.OPS_WATCHDOG.get(id);
}

function sanitizeHeartbeatChecks(value) {
  const allowed = [
    "config",
    "d1",
    "secrets",
    "github",
    "cloudflareR1",
    "cloudflareR2",
    "cloudflareR3"
  ];
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(allowed.map(key => [key, source[key] === true]));
}

async function sendOperationalEmail(env, subject, text) {
  const to = String(env.OPS_NOTIFY_TO || "").trim();
  const from = String(env.OPS_NOTIFY_FROM || "").trim();
  if (!env.OPS_EMAIL || !to || !from) {
    console.error("operational notification email is not configured", {
      hasBinding: Boolean(env.OPS_EMAIL),
      hasTo: Boolean(to),
      hasFrom: Boolean(from)
    });
    return false;
  }

  try {
    await env.OPS_EMAIL.send({
      to,
      from,
      subject,
      text
    });
    return true;
  } catch (error) {
    console.error("operational notification email failed", {
      subject,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

function heartbeatAgeSeconds(state, nowMs) {
  const reference = state.lastReceivedAt || state.monitorStartedAt;
  const referenceMs = Date.parse(reference || "");
  if (!Number.isFinite(referenceMs)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((nowMs - referenceMs) / 1000));
}

function heartbeatStateSummary(state) {
  const checks = state?.checks && typeof state.checks === "object" ? state.checks : {};
  const failed = Object.entries(checks)
    .filter(([, ok]) => ok !== true)
    .map(([name]) => name);
  return failed.length ? failed.join(", ") : "none";
}

export class OperationalWatchdog extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/heartbeat" && request.method === "POST") {
      let report;
      try {
        report = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      if (!report || report.service !== "skvallerbyttan") {
        return new Response("Unknown service", { status: 400 });
      }

      const emittedAt = typeof report.emittedAt === "string" && Number.isFinite(Date.parse(report.emittedAt))
        ? report.emittedAt
        : null;
      const ready = report.ready === true;
      const checks = sanitizeHeartbeatChecks(report.checks);
      const now = new Date();
      const nowIso = now.toISOString();
      const previous = await this.ctx.storage.get("state");

      let recoveryNotificationPending =
        previous?.state === "stale" || previous?.recoveryNotificationPending === true;

      if (recoveryNotificationPending) {
        const recoverySent = await sendOperationalEmail(
          this.env,
          ready
            ? "Avkroken drift: Skvallerbyttan heartbeat återställd"
            : "Avkroken drift: Skvallerbyttan heartbeat åter, men readiness är false",
          [
            "Den förväntade heartbeat-leveransen från Skvallerbyttan har återupptagits.",
            `Mottagen: ${nowIso}`,
            `Ready: ${ready ? "ja" : "nej"}`,
            `Misslyckade readiness-kontroller: ${heartbeatStateSummary({ checks })}`
          ].join("\n")
        );
        recoveryNotificationPending = !recoverySent;
      }

      const state = {
        service: report.service,
        expectedIntervalSeconds: HEARTBEAT_EXPECTED_INTERVAL_SECONDS,
        staleAfterSeconds: HEARTBEAT_STALE_AFTER_SECONDS,
        monitorStartedAt: previous?.monitorStartedAt || nowIso,
        lastReceivedAt: nowIso,
        lastEmittedAt: emittedAt,
        lastReady: ready,
        checks,
        state: ready ? "healthy" : "unready",
        lastAlertAt: previous?.lastAlertAt || null,
        lastRecoveryAt:
          previous?.state === "stale" && !recoveryNotificationPending
            ? nowIso
            : previous?.lastRecoveryAt || null,
        recoveryNotificationPending,
        updatedAt: nowIso
      };

      await this.ctx.storage.put("state", state);

      return Response.json({
        ok: true,
        service: state.service,
        receivedAt: nowIso,
        ready: state.lastReady
      });
    }

    if (url.pathname === "/check" && request.method === "POST") {
      const now = new Date();
      const nowIso = now.toISOString();
      let state = await this.ctx.storage.get("state");

      if (!state) {
        state = {
          service: "skvallerbyttan",
          expectedIntervalSeconds: HEARTBEAT_EXPECTED_INTERVAL_SECONDS,
          staleAfterSeconds: HEARTBEAT_STALE_AFTER_SECONDS,
          monitorStartedAt: nowIso,
          lastReceivedAt: null,
          lastEmittedAt: null,
          lastReady: null,
          checks: {},
          state: "pending",
          lastAlertAt: null,
          lastRecoveryAt: null,
          recoveryNotificationPending: false,
          updatedAt: nowIso
        };
        await this.ctx.storage.put("state", state);
        return Response.json({ ok: true, service: state.service, state: state.state });
      }

      const ageSeconds = heartbeatAgeSeconds(state, now.getTime());
      const stale = ageSeconds > Number(state.staleAfterSeconds || HEARTBEAT_STALE_AFTER_SECONDS);

      if (stale && state.state !== "stale") {
        const sent = await sendOperationalEmail(
          this.env,
          "Avkroken drift: heartbeat från Skvallerbyttan saknas",
          [
            "Skvallerbyttans förväntade heartbeat har uteblivit.",
            `Förväntad leverans: var ${Math.floor(HEARTBEAT_EXPECTED_INTERVAL_SECONDS / 60)} minut.`,
            `Larmgräns: ${Math.floor(HEARTBEAT_STALE_AFTER_SECONDS / 60)} minuter.`,
            `Senast mottagen: ${state.lastReceivedAt || "ingen heartbeat mottagen"}`,
            `Senast rapporterad ready: ${state.lastReady === true ? "ja" : state.lastReady === false ? "nej" : "okänd"}`,
            `Misslyckade readiness-kontroller vid senaste leverans: ${heartbeatStateSummary(state)}`
          ].join("\n")
        );

        if (sent) {
          state = {
            ...state,
            state: "stale",
            lastAlertAt: nowIso,
            recoveryNotificationPending: false,
            updatedAt: nowIso
          };
          await this.ctx.storage.put("state", state);
        }
      }

      return Response.json({
        ok: true,
        service: state.service,
        state: stale ? "stale" : state.state,
        ageSeconds,
        lastReceivedAt: state.lastReceivedAt,
        ready: state.lastReady
      });
    }

    return new Response("Not Found", { status: 404 });
  }
}

export class OperationalHeartbeatService extends WorkerEntrypoint {
  async postHeartbeat(report) {
    if (!report || report.service !== "skvallerbyttan") {
      throw new Error("unknown operational heartbeat service");
    }

    const response = await operationalWatchdogStub(this.env, report.service).fetch(
      "https://ops-watchdog.internal/heartbeat",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          service: report.service,
          emittedAt: report.emittedAt,
          ready: report.ready === true,
          checks: sanitizeHeartbeatChecks(report.checks)
        })
      }
    );

    if (!response.ok) {
      throw new Error(`operational heartbeat receiver returned ${response.status}`);
    }

    return response.json();
  }
}

async function checkOperationalWatchdogs(env) {
  await Promise.all(WATCHED_SERVICES.map(async service => {
    try {
      const response = await operationalWatchdogStub(env, service).fetch(
        "https://ops-watchdog.internal/check",
        { method: "POST" }
      );
      if (!response.ok) {
        console.error("operational watchdog check failed", {
          service,
          status: response.status
        });
      }
    } catch (error) {
      console.error("operational watchdog check threw", {
        service,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }));
}

export class DocsInvalidationService extends WorkerEntrypoint {
  async invalidateDocs(repositoryName, previousRepositoryName = null) {
    const names = [repositoryName, previousRepositoryName]
      .filter(name => typeof name === "string" && name.length > 0);

    if (names.length === 0 || names.some(name => !/^[A-Za-z0-9._-]+$/.test(name))) {
      throw new Error("invalid repository name");
    }

    const tags = ["docs-catalog", ...names.map(docsRepoTag)];
    const purge = await purgeDocumentationCache(this.ctx, tags);
    if (!purge.success) {
      console.error("Internal docs cache purge failed", {
        repositories: names,
        tags,
        errors: purge.errors
      });
      throw new Error("docs cache purge failed");
    }

    return {
      ok: true,
      purged: [...new Set(tags)]
    };
  }
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(checkOperationalWatchdogs(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/projects") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return getPublicProjects(env, ctx);
    }

    if (url.pathname === "/api/sites") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return getPortalSites(env, ctx);
    }

    if (url.pathname === "/api/docs") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return getDocsCatalog(env);
    }

    if (url.pathname === "/api/docs/content") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return getDocContent(url, env);
    }

    const isRead = request.method === "GET" || request.method === "HEAD";
    const protectedRedirect = protectedRedirectForPath(url.pathname);

    if (isRead && protectedRedirect) {
      return Response.redirect(protectedRedirect, 302);
    }

    if (
      isRead &&
      isPortalDocumentRoute(url.pathname)
    ) {
      const shellUrl = new URL("/index.html", url.origin);
      return env.ASSETS.fetch(new Request(shellUrl, request));
    }

    return env.ASSETS.fetch(request);
  }
};
