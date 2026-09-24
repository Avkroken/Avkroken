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
    expect(await css.text()).toContain(".slots");
    expect(await js.text()).toContain("/api/dashboard");
  });
});
