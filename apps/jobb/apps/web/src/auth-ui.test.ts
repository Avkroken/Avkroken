import { describe, expect, it } from "vitest";
import { renderAuthStyles, renderErrorPage } from "./auth-ui";

describe("auth UI", () => {
  it("renders a styled standard error page with safe diagnostics", async () => {
    const response = renderErrorPage({
      status: 502,
      eyebrow: "Säker inloggning",
      title: "Inloggningen kunde inte starta",
      message: "Ett oväntat fel uppstod.",
      code: "unexpected",
      referenceId: "ref-123",
      primaryHref: "/login",
      primaryLabel: "Försök igen",
    });

    expect(response.status).toBe(502);
    expect(response.headers.get("content-security-policy")).toContain(
      "style-src 'self'",
    );

    const html = await response.text();
    expect(html).toContain("/assets/auth.css");
    expect(html).toContain("ref-123");
    expect(html).toContain("unexpected");
    expect(html).toContain("Försök igen");
    expect(html).not.toContain("client_secret");
  });

  it("serves the auth stylesheet as non-cacheable CSS", async () => {
    const response = renderAuthStyles();
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const css = await response.text();
    expect(css).toContain(".auth-layout");
    expect(css).toContain(".error-layout");
  });
});
