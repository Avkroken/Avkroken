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
