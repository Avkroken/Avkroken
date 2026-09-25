import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const axePath = fileURLToPath(new URL("../node_modules/axe-core/axe.min.js", import.meta.url));
const serverPort = 41823;
const driverPort = 9515;
const origin = `http://127.0.0.1:${serverPort}`;
const driverOrigin = `http://127.0.0.1:${driverPort}`;
const now = "2026-09-25T18:30:00Z";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function json(res, value, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}

function apiFixture(pathname) {
  if (pathname === "/api/projects") {
    return {
      source: { provider: "github", scope: "Avkroken", coverage: "active_public_repositories" },
      generatedAt: now,
      projects: [],
    };
  }
  if (pathname === "/api/sites") return [];
  if (pathname === "/api/docs") return [];
  if (pathname === "/api/operations") {
    return {
      schemaVersion: 1,
      available: true,
      status: "available",
      generatedAt: now,
      providers: [],
      capabilities: [],
    };
  }
  if (pathname === "/api/changelog") {
    return {
      status: "available",
      generatedAt: now,
      source: { provider: "github", coverage: "bounded" },
      releases: [],
    };
  }
  if (pathname === "/api/activity") {
    return {
      status: "available",
      generatedAt: now,
      source: { provider: "github", coverage: "bounded" },
      activity: {
        available: true,
        status: "available",
        repositoryCount: 0,
        grouped: [],
        coverage: [],
        recent: [],
      },
    };
  }
  if (pathname === "/api/search") {
    return {
      query: "",
      status: "query_required",
      generatedAt: null,
      source: null,
      resultCount: 0,
      results: [],
    };
  }
  return null;
}

async function startFixtureServer() {
  const index = await readFile(join(publicDir, "index.html"));

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", origin);
      const fixture = apiFixture(url.pathname);
      if (fixture !== null) {
        json(res, fixture);
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        json(res, { status: "error", error: "fixture_not_implemented" }, 404);
        return;
      }

      const relative = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
      const candidate = join(publicDir, relative);
      if (relative && candidate.startsWith(publicDir)) {
        try {
          const info = await stat(candidate);
          if (info.isFile()) {
            const body = await readFile(candidate);
            res.writeHead(200, {
              "Content-Type": mime[extname(candidate)] || "application/octet-stream",
              "Cache-Control": "no-store",
            });
            res.end(body);
            return;
          }
        } catch {
          // Fall through to SPA document.
        }
      }

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(index);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(serverPort, "127.0.0.1", resolve);
  });

  return server;
}

async function waitFor(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError || "not ready"}`);
}

async function webdriver(method, path, body) {
  const response = await fetch(driverOrigin + path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) {
    throw new Error(
      `WebDriver ${method} ${path} failed: ${JSON.stringify(payload.value || payload)}`
    );
  }
  return payload.value;
}

function key(value) {
  return {
    type: "key",
    id: "keyboard",
    actions: [
      { type: "keyDown", value },
      { type: "keyUp", value },
    ],
  };
}

async function main() {
  const server = await startFixtureServer();
  const driver = spawn("chromedriver", [`--port=${driverPort}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let driverOutput = "";
  driver.stdout.on("data", chunk => { driverOutput += chunk.toString(); });
  driver.stderr.on("data", chunk => { driverOutput += chunk.toString(); });

  let sessionId = null;

  try {
    await waitFor(driverOrigin + "/status");

    const session = await webdriver("POST", "/session", {
      capabilities: {
        alwaysMatch: {
          browserName: "chrome",
          "goog:chromeOptions": {
            args: [
              "--headless=new",
              "--no-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--window-size=1280,900",
            ],
          },
        },
      },
    });
    sessionId = session.sessionId;

    const command = (method, path, body) =>
      webdriver(method, `/session/${sessionId}${path}`, body);

    const execute = (script, args = []) =>
      command("POST", "/execute/sync", { script, args });

    const executeAsync = (script, args = []) =>
      command("POST", "/execute/async", { script, args });

    const navigate = async path => {
      await command("POST", "/url", { url: origin + path });
      await executeAsync(
        "var done = arguments[arguments.length - 1];" +
        "if (document.readyState === 'complete') return done(true);" +
        "window.addEventListener('load', function(){ done(true); }, { once: true });"
      );
      await new Promise(resolve => setTimeout(resolve, 120));
    };

    const setViewport = (width, height) =>
      command("POST", "/window/rect", { width, height, x: 0, y: 0 });

    const press = value => command("POST", "/actions", { actions: [key(value)] });
    const clearActions = () => command("DELETE", "/actions");

    const axeSource = await readFile(axePath, "utf8");

    const runAxe = async path => {
      await navigate(path);
      await execute(axeSource);
      const result = await executeAsync(
        "var done = arguments[arguments.length - 1];" +
        "axe.run(document, {" +
        "runOnly: { type: 'tag', values: [" +
        "'wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa'" +
        "] }" +
        "}).then(function(results) {" +
        "done({ violations: results.violations.map(function(v) {" +
        "return { id: v.id, impact: v.impact, help: v.help, targets: v.nodes.map(function(n){ return n.target; }) };" +
        "}) });" +
        "}).catch(function(error){ done({ error: String(error) }); });"
      );

      if (result.error) throw new Error(`axe failed on ${path}: ${result.error}`);
      assert.deepEqual(
        result.violations,
        [],
        `axe violations on ${path}: ${JSON.stringify(result.violations, null, 2)}`
      );
    };

    await setViewport(1280, 900);
    for (const path of [
      "/",
      "/projekt",
      "/dokumentation",
      "/tjanster",
      "/drift",
      "/changelog",
      "/aktivitet",
      "/auth",
      "/om",
      "/sok",
    ]) {
      await runAxe(path);
    }

    await navigate("/");
    await press("\uE004");
    let active = await execute(
      "return { text: document.activeElement && document.activeElement.textContent.trim(), " +
      "className: document.activeElement && document.activeElement.className };"
    );
    assert.equal(active.className, "skip-link");
    assert.equal(active.text, "Hoppa till innehåll");

    await press("\uE007");
    active = await execute(
      "return { id: document.activeElement && document.activeElement.id, hash: location.hash };"
    );
    assert.equal(active.id, "portal-content");
    assert.equal(active.hash, "#portal-content");
    await clearActions();

    await execute(
      `document.querySelector('a[href="/projekt"][data-nav-view="projects"]').click(); return true;`
    );
    await new Promise(resolve => setTimeout(resolve, 50));
    active = await execute(
      `return {
        id: document.activeElement && document.activeElement.id,
        current: document.querySelector('a[data-nav-view="projects"]').getAttribute('aria-current'),
        visible: document.querySelectorAll('[data-route-panel]:not([hidden])').length
      };`
    );
    assert.equal(active.id, "public-sites");
    assert.equal(active.current, "page");
    assert.equal(active.visible, 1);

    await setViewport(390, 844);
    for (const path of ["/", "/dokumentation", "/aktivitet"]) {
      await runAxe(path);
      const overflow = await execute(
        `var viewport = document.documentElement.clientWidth;
        var offenders = Array.from(document.querySelectorAll('body *'))
          .filter(function(element) {
            var style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            var rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.right > viewport + 1 || rect.left < -1);
          })
          .slice(0, 12)
          .map(function(element) {
            var rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              id: element.id || null,
              className: typeof element.className === 'string' ? element.className : null,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              text: (element.textContent || '').trim().slice(0, 80)
            };
          });
        var internalOverflow = Array.from(document.querySelectorAll('body *'))
          .filter(function(element) {
            var style = getComputedStyle(element);
            return style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              element.scrollWidth > element.clientWidth + 1;
          })
          .slice(0, 20)
          .map(function(element) {
            var style = getComputedStyle(element);
            return {
              tag: element.tagName.toLowerCase(),
              id: element.id || null,
              className: typeof element.className === 'string' ? element.className : null,
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              overflowX: style.overflowX,
              whiteSpace: style.whiteSpace,
              wordBreak: style.wordBreak,
              overflowWrap: style.overflowWrap,
              text: (element.textContent || '').trim().slice(0, 120)
            };
          });
        var pseudo = Array.from(document.querySelectorAll('body *'))
          .flatMap(function(element) {
            return ['::before', '::after'].map(function(kind) {
              var style = getComputedStyle(element, kind);
              return {
                tag: element.tagName.toLowerCase(),
                id: element.id || null,
                className: typeof element.className === 'string' ? element.className : null,
                kind: kind,
                content: style.content,
                position: style.position,
                width: style.width,
                left: style.left,
                right: style.right,
                transform: style.transform,
                display: style.display
              };
            });
          })
          .filter(function(item) {
            return item.content && item.content !== 'none' && item.content !== 'normal';
          })
          .slice(0, 20);
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: viewport,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
          bodyRect: (function() {
            var rect = document.body.getBoundingClientRect();
            return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
          })(),
          htmlRect: (function() {
            var rect = document.documentElement.getBoundingClientRect();
            return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
          })(),
          bodyBefore: (function() {
            var style = getComputedStyle(document.body, '::before');
            return {
              content: style.content,
              position: style.position,
              width: style.width,
              left: style.left,
              right: style.right,
              transform: style.transform
            };
          })(),
          bodyAfter: (function() {
            var style = getComputedStyle(document.body, '::after');
            return {
              content: style.content,
              position: style.position,
              width: style.width,
              left: style.left,
              right: style.right,
              transform: style.transform
            };
          })(),
          offenders: offenders,
          internalOverflow: internalOverflow,
          pseudo: pseudo
        };`
      );
      assert.ok(
        overflow.scrollWidth <= overflow.clientWidth + 1,
        `horizontal overflow on ${path}: ${JSON.stringify(overflow)}`
      );
    }

    await navigate("/");
    await execute(
      "var button=document.querySelector('#portal-menu-toggle');" +
      "button.focus(); button.click();" +
      "document.querySelector('#portal-navigation a').focus();" +
      "return true;"
    );
    const openState = await execute(
      "return {" +
      "expanded: document.querySelector('#portal-menu-toggle').getAttribute('aria-expanded')," +
      "open: document.querySelector('#portal-navigation').classList.contains('open')" +
      "};"
    );
    assert.deepEqual(openState, { expanded: "true", open: true });

    await press("\uE00C");
    const closedState = await execute(
      "return {" +
      "expanded: document.querySelector('#portal-menu-toggle').getAttribute('aria-expanded')," +
      "open: document.querySelector('#portal-navigation').classList.contains('open')," +
      "active: document.activeElement && document.activeElement.id" +
      "};"
    );
    assert.deepEqual(closedState, {
      expanded: "false",
      open: false,
      active: "portal-menu-toggle",
    });
    await clearActions();

    console.log("Portal browser accessibility checks passed.");
  } finally {
    if (sessionId) {
      try {
        await webdriver("DELETE", `/session/${sessionId}`);
      } catch {
        // Best-effort cleanup.
      }
    }
    driver.kill("SIGTERM");
    await new Promise(resolve => server.close(resolve));
    if (driver.exitCode && driver.exitCode !== 0) {
      console.error(driverOutput);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
