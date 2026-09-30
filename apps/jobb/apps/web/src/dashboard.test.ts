import { describe, expect, it } from "vitest";
import {
  renderDashboard,
  renderDashboardScript,
  renderDashboardStyles,
} from "./dashboard";

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
    expect(jsText).toContain("avkroken.theme");
    expect(jsText).toContain("avkroken_theme");
    expect(jsText).toContain("Domain=.denied.se");
  });
});
