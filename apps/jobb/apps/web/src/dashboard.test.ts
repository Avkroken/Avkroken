import { describe, expect, it } from "vitest";
import {
  renderDashboard,
  renderDashboardScript,
  renderDashboardStyles,
} from "./dashboard";
import {
  buildVerifiedQuotaSlots,
  isExpiredBankIdDashboardRun,
  isOperationallyFailedDashboardRun,
  isOrphanedDashboardRun,
} from "./dashboard-data";

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

  it("does not treat expired BankID handoffs as active", () => {
    expect(
      isExpiredBankIdDashboardRun(
        {
          status: "needs_user_auth",
          auth_expires_at: "2026-10-01T15:44:59.000Z",
        },
        now,
      ),
    ).toBe(true);
    expect(
      isExpiredBankIdDashboardRun(
        {
          status: "needs_user_auth",
          auth_expires_at: "2026-10-01T15:46:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("keeps local-browser report handoffs active without Browser Run expiry", () => {
    expect(
      isExpiredBankIdDashboardRun(
        {
          status: "needs_user_auth",
          auth_live_view_url: null,
          auth_expires_at: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("counts only the latest unresolved application failure as operational", () => {
    expect(
      isOperationallyFailedDashboardRun(
        {
          status: "failed",
          application_month: "2026-10",
          verified_count: 9,
          target_count: 10,
        },
        "2026-10",
      ),
    ).toBe(true);
    expect(
      isOperationallyFailedDashboardRun(
        {
          status: "failed",
          application_month: "2026-10",
          verified_count: 10,
          target_count: 10,
        },
        "2026-10",
      ),
    ).toBe(false);
    expect(
      isOperationallyFailedDashboardRun(
        {
          status: "failed",
          application_month: "2026-09",
          verified_count: 0,
          target_count: 10,
        },
        "2026-10",
      ),
    ).toBe(false);
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

describe("dashboard application quota", () => {
  it("fills visible monthly slots only with verified applications", () => {
    expect(
      buildVerifiedQuotaSlots(
        [
          {
            application_id: "application:studentconsulting:87567",
            updated_at: "2026-10-02T13:03:40.204Z",
          },
        ],
        3,
      ),
    ).toEqual([
      {
        slot_no: 1,
        application_id: "application:studentconsulting:87567",
        state: "verified",
        updated_at: "2026-10-02T13:03:40.204Z",
      },
      {
        slot_no: 2,
        application_id: null,
        state: "free",
        updated_at: null,
      },
      {
        slot_no: 3,
        application_id: null,
        state: "free",
        updated_at: null,
      },
    ]);
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
    expect(html.toLowerCase()).not.toContain("turnstile");
    expect(html).not.toContain("challenges.cloudflare.com");
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
    expect(cssText).toContain(".app-cards");
    expect(cssText).toContain(".run-cards");
    expect(cssText).toContain(".attempt-cards");
    expect(cssText).toContain(".applications-table,.runs-table,.attempts-table{display:none}");
    expect(jsText).toContain("/api/dashboard");
    expect(jsText).toContain("/api/configuration");
    expect(jsText).toContain("Spara konfiguration");
    expect(jsText).toContain("Öppna aktivitetsrapporten");
    expect(jsText).toContain("/for-arbetssokande/mina-sidor/aktivitetsrapportera");
    expect(jsText).toContain("Aktivitetsrapport i din webbläsare");
    expect(jsText).toContain("Jag har skickat in rapporten");
    expect(jsText).toContain("/report/manual-submitted");
    expect(jsText).not.toContain("live.browser.run");
    expect(jsText).toContain("avkroken.theme");
    expect(jsText).toContain("avkroken_theme");
    expect(jsText).toContain("Domain=.denied.se");
    expect(jsText.toLowerCase()).not.toContain("turnstile");
    expect(jsText).toContain("signature===overviewSignature");
    expect(jsText).toContain("Stoppa körning");
    expect(jsText).toContain("Radera körning");
    expect(jsText).toContain("/stop");
    expect(jsText).toContain("method:action==='stop'?'POST':'DELETE'");
    expect(jsText).toContain("GitHub-inloggad, same-origin skyddad pipeline");
    expect(jsText).toContain("Övergivna körningar");
    expect(jsText).toContain("Osäkra ansökningar");
    expect(jsText).toContain("Godkända ansökningar");
    expect(jsText).toContain("saknar underlag");
    expect(jsText).toContain("function reportOnlyRunFailure");
    expect(jsText).toContain("Senaste ansökningskörningen misslyckades");
    expect(jsText).toContain("Fortsätt rapport");
    expect(jsText).toContain("Nästa körning fortsätter bara aktivitetsrapporten.");
    expect(jsText).toContain("Kontrollera igen");
    expect(jsText).toContain("Markera ej inskickad");
    expect(jsText).toContain("function runCard");
    expect(jsText).toContain('class="run-cards"');
    expect(jsText).toContain('class="attempt-cards"');
    expect(jsText).toContain("/api/applications/");
    expect(jsText).toContain("not-submitted");
  });
});
