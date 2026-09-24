import { describe, expect, it } from "vitest";
import {
  dashboardAuthConfigured,
  dashboardAuthMode,
} from "./auth";

describe("dashboard auth mode", () => {
  it("uses GitHub only when client, secret and allowlist are complete", () => {
    const env = {
      GITHUB_OAUTH_CLIENT_ID: "github-client",
      GITHUB_OAUTH_CLIENT_SECRET: "github-client-secret",
      JOBB_ALLOWED_GITHUB_IDS: "123",
    };
    expect(dashboardAuthMode(env)).toBe("github");
    expect(dashboardAuthConfigured(env)).toBe(true);
  });

  it("accepts a Secrets Store client secret binding", () => {
    const env = {
      GITHUB_OAUTH_CLIENT_ID: "github-client",
      GITHUB_OAUTH_CLIENT_SECRET: {
        get: async () => "github-client-secret",
      },
      JOBB_ALLOWED_GITHUB_IDS: "123",
    };
    expect(dashboardAuthMode(env)).toBe("github");
    expect(dashboardAuthConfigured(env)).toBe(true);
  });

  it("fails closed for a partially configured GitHub client", () => {
    const env = {
      GITHUB_OAUTH_CLIENT_ID: "github-client",
      JOBB_ALLOWED_GITHUB_IDS: "123",
    };
    expect(dashboardAuthMode(env)).toBe("misconfigured");
    expect(dashboardAuthConfigured(env)).toBe(false);
  });

  it("is unconfigured when GitHub auth is absent", () => {
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
