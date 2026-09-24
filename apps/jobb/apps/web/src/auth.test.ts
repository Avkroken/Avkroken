import { describe, expect, it } from "vitest";
import {
  dashboardAuthConfigured,
  dashboardAuthMode,
} from "./auth";

describe("dashboard auth mode", () => {
  it("uses Krösa-Maja only when the OIDC client is complete", () => {
    const env = {
      KROSA_MAJA_OIDC_CLIENT_ID: "jobb-client",
      KROSA_MAJA_OIDC_CLIENT_SECRET: "generated-client-secret",
    };
    expect(dashboardAuthMode(env)).toBe("oidc");
    expect(dashboardAuthConfigured(env)).toBe(true);
  });

  it("accepts a Secrets Store client secret binding", () => {
    const env = {
      KROSA_MAJA_OIDC_CLIENT_ID: "jobb-client",
      KROSA_MAJA_OIDC_CLIENT_SECRET: {
        get: async () => "generated-client-secret",
      },
    };
    expect(dashboardAuthMode(env)).toBe("oidc");
    expect(dashboardAuthConfigured(env)).toBe(true);
  });

  it("fails closed for a partially configured OIDC client", () => {
    const env = {
      KROSA_MAJA_OIDC_CLIENT_ID: "jobb-client",
    };
    expect(dashboardAuthMode(env)).toBe("misconfigured");
    expect(dashboardAuthConfigured(env)).toBe(false);
  });

  it("is unconfigured when OIDC is absent", () => {
    expect(dashboardAuthMode({})).toBe("unconfigured");
    expect(dashboardAuthConfigured({})).toBe(false);
  });

  it("does not recognize legacy Basic Auth variables", () => {
    expect(
      dashboardAuthMode({
        DASHBOARD_USERNAME: "operator",
        DASHBOARD_PASSWORD: "secret",
      } as never),
    ).toBe("unconfigured");
  });
});
