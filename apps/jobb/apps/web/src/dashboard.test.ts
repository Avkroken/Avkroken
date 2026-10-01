import { describe, expect, it } from "vitest";
import {
  renderDashboard,
  renderDashboardScript,
  renderDashboardStyles,
} from "./dashboard";
import { isOrphanedDashboardRun } from "./dashboard-data";

describe("dashboard run state", () => {
  const now = Date.parse("2026-10-01T15:45:00Z");

  it("treats old running rows without workflow linkage or applications as orphaned", () => {
    expect(
      isOrphanedDashboardRun(
        {
          status: "running",
          workflow_instance_id: null,
          application_count: 0,
          updated_at: "2026-10-01 15:34:43",
        },
        now,
      ),
    ).toBe(true);
  });

  it("keeps linked, recent or application-bearing runs active", () => {
    expect(
      isOrphanedDashboardRun(
        {
          status: "running",
          workflow_instance_id: "manual-instance",
          application_count: 0,
          updated_at: "2026-10-01 15:30:00",
        },
        now,
      ),
    ).toBe(false);
    expect(
      isOrphanedDashboardRun(
        {
          status: "running",
          workflow_instance_id: null,
          application_count: 0,
          updated_at: "2026-10-01 15:44:00",
        },
        now,
      ),
    ).toBe(false);
    expect(
      isOrphanedDashboardRun(
        {
          status: "running",
          workflow_instance_id: null,
          application_count: 1,
          updated_at: "2026-10-01 15:30:00",
        },
        now,
      ),
    ).toBe(false);
  });
});

interface ClientHarness {
  window: { turnstile?: FakeTurnstile; onhashchange?: (() => void) | null };
  dashboard: Record<string, unknown>;
  poll(): Promise<void>;
  turnstile: FakeTurnstile;
  overviewRenderCount(): number;
  manualResult(): { textContent: string; disabled: boolean };
}

interface FakeTurnstile {
  renders: number;
  removes: number;
  resets: number;
  render(selector: string, options: { callback(token: string): void }): string;
  remove(id: string): void;
  reset(id: string): void;
}

function dashboardFixture() {
  return {
    applicationMonth: "2026-10",
    reportMonth: "2026-09",
    verified: 0,
    target: 10,
    quotaUsed: 0,
    quotaSlots: [],
    applicationWindowOpen: true,
    report: null,
    reportSaved: 0,
    reportActivities: [],
    runs: [],
    applications: [],
    notifications: [],
    attention: {
      uncertainSlots: 0,
      failedRuns: 0,
      failedNotifications: 0,
      ambiguousReportItems: 0,
      orphanedRuns: 0,
      activeRun: null,
    },
    configuration: {
      studentConsultingCredentials: true,
      studentConsultingCredentialsSource: "dashboard",
      studentConsultingAutoSubmit: true,
      studentConsultingAutoSubmitSource: "dashboard",
      suitabilityPolicy: false,
      suitabilityPolicySource: "missing",
      bankIdNotification: false,
      bankIdNotificationSource: "missing",
      turnstileConfigured: true,
      turnstileSource: "deployment",
      managedConfigurationStorageReady: true,
      managedConfigurationUnreadable: false,
      notifyWebhookConfigured: false,
      notifyEmailTo: "",
      notifyEmailFrom: "",
      jobIncludeTerms: "",
      jobExcludeTerms: "",
      jobAllowedLocations: "",
      jobAllowedCountries: "",
      updatedAt: null,
    },
    automaticMode: {
      schedule: "test schedule",
      applicationWindow: "1–14:e varje månad",
    },
  };
}

async function flushClient(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function createClientHarness(
  turnstileInitiallyAvailable: boolean,
): Promise<ClientHarness> {
  const elements = new Map<string, any>();
  let overviewRenders = 0;
  let intervalCallback: (() => Promise<void>) | null = null;
  let dashboard = dashboardFixture();

  const makeElement = (id = ""): any => ({
    id,
    dataset: {},
    hidden: false,
    disabled: false,
    value: "",
    textContent: "",
    className: "",
    onclick: null,
    oninput: null,
    onchange: null,
    onsubmit: null,
    setAttribute() {},
    querySelectorAll() {
      return [];
    },
  });
  const ensure = (id: string) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };

  const panels = ["overview", "applications", "runs", "report", "system"].map(
    (name) => {
      const panel = makeElement();
      panel.dataset.panel = name;
      Object.defineProperty(panel, "innerHTML", {
        get() {
          return "";
        },
        set(value: string) {
          if (name === "overview") {
            overviewRenders += 1;
            if (value.includes('id="turnstile"')) ensure("turnstile");
            if (value.includes('id="manual"')) ensure("manual");
            if (value.includes('id="manualResult"')) ensure("manualResult");
            if (value.includes('id="bankidCheck"')) ensure("bankidCheck");
          }
          if (name === "applications") {
            ensure("appSearch");
            ensure("appStatus");
            ensure("appRows");
          }
          if (name === "system") ensure("runtimeConfigForm");
        },
      });
      return panel;
    },
  );

  ensure("freshness");
  ensure("closeRun");

  const document = {
    cookie: "",
    documentElement: { dataset: { theme: "legacy" } },
    getElementById(id: string) {
      return elements.get(id) ?? null;
    },
    querySelector(selector: string) {
      if (selector === "meta[name=theme-color]") return { content: "" };
      const match = selector.match(/^\[data-panel=([^\]]+)\]$/);
      return match ? panels.find((panel) => panel.dataset.panel === match[1]) ?? null : null;
    },
    querySelectorAll(selector: string) {
      if (selector === "[data-panel]") return panels;
      return [];
    },
  };
  const location = {
    hostname: "jobb.denied.se",
    protocol: "https:",
    hash: "#overview",
  };
  const localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };
  const turnstile: FakeTurnstile = {
    renders: 0,
    removes: 0,
    resets: 0,
    render(_selector, options) {
      this.renders += 1;
      options.callback("token");
      return `widget-${this.renders}`;
    },
    remove() {
      this.removes += 1;
    },
    reset() {
      this.resets += 1;
    },
  };
  const window: ClientHarness["window"] = {
    onhashchange: null,
    ...(turnstileInitiallyAvailable ? { turnstile } : {}),
  };
  const fetch = async () => ({
    ok: true,
    async json() {
      return dashboard;
    },
    async text() {
      return "";
    },
  });
  const setIntervalStub = (callback: () => Promise<void>) => {
    intervalCallback = callback;
    return 1;
  };
  const setTimeoutStub = (callback: () => void) => {
    callback();
    return 1;
  };

  const jsText = await renderDashboardScript().text();
  const run = new Function(
    "window",
    "document",
    "location",
    "localStorage",
    "fetch",
    "setInterval",
    "setTimeout",
    jsText,
  );
  run(window, document, location, localStorage, fetch, setIntervalStub, setTimeoutStub);
  await flushClient();

  return {
    window,
    get dashboard() {
      return dashboard as unknown as Record<string, unknown>;
    },
    set dashboard(value: Record<string, unknown>) {
      dashboard = value as ReturnType<typeof dashboardFixture>;
    },
    async poll() {
      if (!intervalCallback) throw new Error("dashboard polling was not registered");
      await intervalCallback();
      await flushClient();
    },
    turnstile,
    overviewRenderCount() {
      return overviewRenders;
    },
    manualResult() {
      return ensure("manualResult");
    },
  };
}

describe("dashboard polling behavior", () => {
  it("preserves one Turnstile mount across unchanged polls and remounts only after an active run completes", async () => {
    const harness = await createClientHarness(true);

    expect(harness.turnstile.renders).toBe(1);
    expect(harness.overviewRenderCount()).toBe(1);

    await harness.poll();
    expect(harness.turnstile.renders).toBe(1);
    expect(harness.turnstile.removes).toBe(0);
    expect(harness.overviewRenderCount()).toBe(1);

    const active = dashboardFixture();
    active.attention.activeRun = { id: "run-1", status: "running" } as any;
    active.runs = [{ id: "run-1", status: "running" }] as any;
    harness.dashboard = active as unknown as Record<string, unknown>;
    await harness.poll();

    expect(harness.turnstile.renders).toBe(1);
    expect(harness.turnstile.removes).toBe(1);
    expect(harness.manualResult().textContent).toContain("En körning pågår");

    const completed = dashboardFixture();
    completed.runs = [{ id: "run-1", status: "completed" }] as any;
    harness.dashboard = completed as unknown as Record<string, unknown>;
    await harness.poll();

    expect(harness.turnstile.renders).toBe(2);
    expect(harness.overviewRenderCount()).toBe(3);
  });

  it("initializes Turnstile on a later unchanged poll when the library loads late", async () => {
    const harness = await createClientHarness(false);

    expect(harness.turnstile.renders).toBe(0);
    expect(harness.manualResult().textContent).toBe("Turnstile laddas…");
    expect(harness.overviewRenderCount()).toBe(1);

    harness.window.turnstile = harness.turnstile;
    await harness.poll();

    expect(harness.turnstile.renders).toBe(1);
    expect(harness.overviewRenderCount()).toBe(1);
  });

  it("rerenders when manual-run configuration or the application window changes", async () => {
    const harness = await createClientHarness(true);
    const baseline = harness.overviewRenderCount();

    const changedConfig = dashboardFixture();
    changedConfig.configuration.studentConsultingAutoSubmit = false;
    harness.dashboard = changedConfig as unknown as Record<string, unknown>;
    await harness.poll();
    expect(harness.overviewRenderCount()).toBe(baseline + 1);

    const changedWindow = dashboardFixture();
    changedWindow.applicationWindowOpen = false;
    harness.dashboard = changedWindow as unknown as Record<string, unknown>;
    await harness.poll();
    expect(harness.overviewRenderCount()).toBe(baseline + 2);
  });
});

describe("dashboard rendering", () => {
  it("renders operational navigation without embedding credential names", async () => {
    const response = renderDashboard();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    for (const tab of ["overview", "applications", "runs", "report", "system"]) {
      expect(html).toContain(`data-tab="${tab}"`);
    }
    expect(html).toContain("/assets/dashboard.css");
    expect(html).toContain("/assets/dashboard.js");
    expect(html).toContain('<html lang="sv" data-theme="legacy">');
    expect(html).toMatch(/<option value="legacy">Legacy<\/option>.*<option value="forest">Avkroken<\/option>/s);
    expect(html).not.toContain("DASHBOARD_PASSWORD");
    expect(html).not.toContain("STUDENTCONSULTING_PASSWORD");
  });


  it("always exposes local OIDC logout", async () => {
    const html = await renderDashboard().text();
    expect(html).toContain('action="/auth/logout"');
    expect(html).toContain("Logga ut");
  });

  it("serves externalized dashboard assets", async () => {
    const css = renderDashboardStyles();
    const js = renderDashboardScript();
    expect(css.headers.get("content-type")).toContain("text/css");
    expect(js.headers.get("content-type")).toContain("text/javascript");
    const cssText = await css.text();
    const jsText = await js.text();
    expect(cssText).toContain(".slots");
    expect(cssText).toContain(':root[data-theme="forest"]');
    expect(cssText).toContain(':root[data-theme="blackout"]');
    expect(cssText).toContain("--accent:#7dd3fc");
    expect(cssText).toContain("rgba(36,231,232,.11)");
    expect(cssText).toContain("rgba(213,29,203,.10)");
    expect(cssText).toContain("background-size:42px 42px");
    expect(jsText).toContain("/api/dashboard");
    expect(jsText).toContain("/api/configuration");
    expect(jsText).toContain("Spara konfiguration");
    expect(jsText).toContain("Öppna BankID");
    expect(jsText).toContain("Jag är klar – kontrollera");
    expect(jsText).toContain("avkroken.theme");
    expect(jsText).toContain("avkroken_theme");
    expect(jsText).toContain("Domain=.denied.se");
    expect(jsText).toContain("0x4AAAAAAFFcNlOYVIZhQ4Qd");
    expect(jsText).not.toContain("0x4AAAAAADtfk0hF05HrDLLJ");
    expect(jsText).not.toContain("cfgTurnstile");
    expect(jsText).toContain("signature===overviewSignature");
    expect(jsText).toContain(
      "En körning pågår. Turnstile behövs först inför nästa manuella start.",
    );
    expect(jsText).toContain("Övergivna körningar");
    expect(jsText).toContain(
      "Turnstile hanteras centralt i deployment och behöver inte fyllas i här.",
    );
  });
});
