import { describe, expect, it } from "vitest";
import { mapJobTechHit } from "../../../packages/arbetsformedlingen/src/provider";
import type { JobCandidate } from "../../../packages/core/src/types";
import { isHostOrSubdomain } from "../../../packages/core/src/url";
import type {
  BrowserLocator,
  BrowserPage,
} from "../../../packages/studentconsulting/src/browser";
import {
  containsExactJobId,
  isStudentConsultingMatchedJobsLabel,
  loadStudentConsultingCountryIndex,
  normalizeStudentConsultingJobUrl,
  normalizeStudentConsultingMatchedJobsUrl,
  normalizeStudentConsultingUrl,
  parseStudentConsultingJobText,
  StudentConsultingProvider,
} from "../../../packages/studentconsulting/src/provider";

describe("trusted URL validation", () => {
  it("accepts exact domains and real subdomains but rejects lookalikes", () => {
    expect(isHostOrSubdomain("studentconsulting.com", "studentconsulting.com")).toBe(true);
    expect(isHostOrSubdomain("id.studentconsulting.com", "studentconsulting.com")).toBe(true);
    expect(isHostOrSubdomain("evilstudentconsulting.com", "studentconsulting.com")).toBe(false);
    expect(isHostOrSubdomain("studentconsulting.com.evil.test", "studentconsulting.com")).toBe(false);
  });

  it("canonicalizes StudentConsulting URLs onto the trusted origin", () => {
    expect(
      normalizeStudentConsultingUrl(
        "https://www.studentconsulting.com/sv/lediga-jobb/?page=2",
      ),
    ).toBe("https://www.studentconsulting.com/sv/lediga-jobb/?page=2");

    expect(
      normalizeStudentConsultingUrl(
        "https://id.studentconsulting.com/sv/lediga-jobb/?page=2",
      ),
    ).toBe("https://www.studentconsulting.com/sv/lediga-jobb/?page=2");

    expect(
      normalizeStudentConsultingUrl(
        "https://studentconsulting.com.evil.test/sv/lediga-jobb/",
      ),
    ).toBeNull();
  });

  it("requires the exact configured origin for matched-profile routes", () => {
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://www.studentconsulting.com/sv/min-profil/matcha-jobb/",
      ),
    ).toBe(
      "https://www.studentconsulting.com/sv/min-profil/matcha-jobb/",
    );
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://www.studentconsulting.com/sv/profil/matcha-jobb/",
      ),
    ).toBe("https://www.studentconsulting.com/sv/profil/matcha-jobb/");
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://profile.studentconsulting.com/sv/min-profil/matcha-jobb/",
      ),
    ).toBeNull();
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://user:secret@www.studentconsulting.com/sv/min-profil/matcha-jobb/",
      ),
    ).toBeNull();
  });

  it("only accepts StudentConsulting job-detail paths", () => {
    expect(
      normalizeStudentConsultingJobUrl(
        "https://www.studentconsulting.com/sv/lediga-jobb/stockholm/supporttekniker/87178/",
      ),
    ).toBe(
      "https://www.studentconsulting.com/sv/lediga-jobb/stockholm/supporttekniker/87178/",
    );
    expect(
      normalizeStudentConsultingJobUrl(
        "https://www.studentconsulting.com/sv/lediga-jobb/",
      ),
    ).toBeNull();
    expect(
      normalizeStudentConsultingJobUrl(
        "https://evil.test/sv/lediga-jobb/stockholm/supporttekniker/87178/",
      ),
    ).toBeNull();
  });
});

function fakeLocator(
  items: Array<{
    text?: string;
    href?: string;
    dataHref?: string;
    dataUrl?: string;
    onclick?: string;
    onClick?: () => void;
    visible?: boolean;
  }> = [],
  index = 0,
): BrowserLocator {
  return {
    async count() {
      return items.length;
    },
    nth(nextIndex: number) {
      return fakeLocator(items, nextIndex);
    },
    first() {
      return fakeLocator(items, 0);
    },
    async isVisible() {
      return Boolean(items[index]) && items[index]?.visible !== false;
    },
    async fill() {},
    async click() {
      items[index]?.onClick?.();
    },
    async dispatchEvent() {},
    async getAttribute(name: string) {
      if (name === "href") return items[index]?.href ?? null;
      if (name === "data-href") return items[index]?.dataHref ?? null;
      if (name === "data-url") return items[index]?.dataUrl ?? null;
      if (name === "onclick") return items[index]?.onclick ?? null;
      return null;
    },
    async innerText() {
      return items[index]?.text ?? "";
    },
    async inputValue() {
      return "";
    },
    async isChecked() {
      return false;
    },
  };
}

function authenticationRedirectPage(targetUrl: string): BrowserPage {
  let currentUrl = "https://www.studentconsulting.com/signin";

  return {
    async goto(url: string) {
      currentUrl =
        new URL(url).pathname === "/signin"
          ? targetUrl
          : url;
    },
    url() {
      return currentUrl;
    },
    locator() {
      return fakeLocator();
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  };
}

const countryIndexFetcher: typeof fetch = async (_input, init) => {
  const request = JSON.parse(String(init?.body ?? "{}")) as {
    locations?: Array<{ id?: number }>;
  };
  const data =
    request.locations?.[0]?.id === 1
      ? [{ url: "/sv/lediga-jobb/stockholm/supporttekniker/87178/" }]
      : [];
  return new Response(
    JSON.stringify({ data, meta: { totalHits: data.length } }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};

function matchedProfilePage(
  options: {
    redirectMatched?: boolean;
    matchedProfileRoute?: string;
    matchedNavHref?: string | null;
    matchedNavDataHref?: string;
    matchedNavDataUrl?: string;
    matchedNavClickRoute?: string;
    matchedNavAfterClickHref?: string;
    matchedNavAfterClickJobHref?: string;
    matchedNavLabel?: string;
    matchedNavControl?: "anchor" | "button";
    matchedNavVisible?: boolean;
    authOnMatchedVisit?: number;
    jobLinkAttribute?: "href" | "data-href" | "data-url" | "onclick";
    jobLinkValue?: string;
    leadingHrefCount?: number;
    matchedBodyText?: string;
    explicitEmpty?: boolean;
  } = {},
): BrowserPage {
  let currentUrl = "https://www.studentconsulting.com/sv/profil/";
  let matchedRouteVisits = 0;
  let matchedNavClicked = false;
  const profileLandingRoute = "/sv/profil/";
  const matchedProfileRoute =
    options.matchedProfileRoute ?? "/sv/profil/matcha-jobb/";

  return {
    async goto(url: string) {
      const pathname = new URL(url).pathname;
      if (pathname === matchedProfileRoute) matchedRouteVisits += 1;
      currentUrl =
        options.redirectMatched && pathname === matchedProfileRoute
          ? "https://www.studentconsulting.com/sv/lediga-jobb/"
          : url;
    },
    url() {
      return currentUrl;
    },
    locator(selector: string) {
      const current = new URL(currentUrl);
      if (
        current.pathname === profileLandingRoute &&
        selector === "a" &&
        (options.matchedNavControl ?? "anchor") === "anchor"
      ) {
        const href =
          options.matchedNavHref === undefined
            ? matchedProfileRoute
            : (options.matchedNavHref ?? undefined);
        const items = [
          {
            text: options.matchedNavLabel ?? "Matcha jobb",
            href,
            dataHref: options.matchedNavDataHref,
            dataUrl: options.matchedNavDataUrl,
            onClick: () => {
              matchedNavClicked = true;
              if (options.matchedNavClickRoute) {
                currentUrl = new URL(
                  options.matchedNavClickRoute,
                  "https://www.studentconsulting.com",
                ).toString();
              }
            },
            visible: options.matchedNavVisible,
          },
        ];
        if (matchedNavClicked && options.matchedNavAfterClickHref) {
          items.push({
            text: "Mina jobbmatchningar",
            href: options.matchedNavAfterClickHref,
            dataHref: undefined,
            dataUrl: undefined,
            onClick: () => {},
            visible: true,
          });
        }
        return fakeLocator(items);
      }
      if (
        current.pathname === profileLandingRoute &&
        selector ===
          'button,[role="link"],[data-href],[data-url],[onclick]' &&
        options.matchedNavControl === "button"
      ) {
        return fakeLocator([
          {
            text: options.matchedNavLabel ?? "Mina jobbmatchningar",
            onClick: () => {
              currentUrl = new URL(
                matchedProfileRoute,
                "https://www.studentconsulting.com",
              ).toString();
            },
          },
        ]);
      }
      if (
        current.pathname === profileLandingRoute &&
        matchedNavClicked &&
        options.matchedNavAfterClickJobHref &&
        selector === "a[href]"
      ) {
        return fakeLocator([{ href: options.matchedNavAfterClickJobHref }]);
      }
      if (
        current.pathname === matchedProfileRoute &&
        (options.authOnMatchedVisit ?? Number.POSITIVE_INFINITY) <=
          matchedRouteVisits &&
        [
          'input[type="password"]',
          'input[autocomplete="current-password"]',
          'input[type="email"]',
          'input[autocomplete="username"]',
          'input[name="Email"]',
          'input[name="email"]',
        ].includes(selector)
      ) {
        return fakeLocator([{}]);
      }
      if (
        current.pathname === matchedProfileRoute &&
        ["a[href]", "[data-href]", "[data-url]", "[onclick]"].includes(selector)
      ) {
        if (options.explicitEmpty) return fakeLocator();
        const attribute = options.jobLinkAttribute ?? "href";
        const expectedSelector =
          attribute === "href" ? "a[href]" : `[${attribute}]`;
        if (selector !== expectedSelector) return fakeLocator();

        const jobLinkValue =
          options.jobLinkValue ??
          "/sv/lediga-jobb/stockholm/supporttekniker/87178/";
        const jobItem =
          attribute === "href"
            ? { href: jobLinkValue }
            : attribute === "data-href"
              ? { dataHref: jobLinkValue }
              : attribute === "data-url"
                ? { dataUrl: jobLinkValue }
                : { onclick: `window.location='${jobLinkValue}'` };
        const leading =
          attribute === "href"
            ? Array.from({ length: options.leadingHrefCount ?? 0 }, (_, index) => ({
                href: `/sv/om-oss/${index}`,
              }))
            : [];
        return fakeLocator([...leading, jobItem]);
      }
      if (
        current.pathname === matchedProfileRoute &&
        selector === "body" &&
        (options.explicitEmpty || options.matchedBodyText)
      ) {
        return fakeLocator([
          { text: options.matchedBodyText ?? "0 matchande jobb" },
        ]);
      }
      if (
        current.pathname ===
          "/sv/lediga-jobb/stockholm/supporttekniker/87178/" &&
        selector === "h1"
      ) {
        return fakeLocator([{ text: "IT-supporttekniker" }]);
      }
      if (
        current.pathname ===
          "/sv/lediga-jobb/stockholm/supporttekniker/87178/" &&
        selector === "body"
      ) {
        return fakeLocator([
          {
            text: [
              "Fakta om jobbet",
              "Jobb-ID 87178",
              "Ort",
              "Stockholm",
              "Yrkeskategori",
              "IT / Support",
            ].join("\n"),
          },
        ]);
      }
      return fakeLocator();
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  };
}

function applicationsVerificationPage(
  options: {
    applicationsHref?: string | null;
    applicationsDataHref?: string;
    applicationsDataUrl?: string;
    applicationsClickRoute?: string;
    applicationsInlineAfterClick?: boolean;
    redirectApplicationsTo?: string;
    profileBodyText?: string;
    applicationsBodyText?: string;
    applicationsJobHref?: string;
    authenticatedStatus?: { found: boolean; applied: boolean };
  } = {},
): BrowserPage {
  let currentUrl = "https://www.studentconsulting.com/sv/profil/";
  let applicationsClicked = false;
  const applicationsRoute = "/sv/profil/ansokningar/";

  return {
    async goto(url: string) {
      const pathname = new URL(url).pathname;
      currentUrl =
        pathname === applicationsRoute && options.redirectApplicationsTo
          ? new URL(
              options.redirectApplicationsTo,
              "https://www.studentconsulting.com",
            ).toString()
          : url;
    },
    url() {
      return currentUrl;
    },
    locator(selector: string) {
      const current = new URL(currentUrl);
      if (
        current.pathname === "/sv/profil/" &&
        selector === "a"
      ) {
        const href =
          options.applicationsHref === undefined
            ? applicationsRoute
            : (options.applicationsHref ?? undefined);
        return fakeLocator([
          {
            text: "Ansökningar",
            href,
            dataHref: options.applicationsDataHref,
            dataUrl: options.applicationsDataUrl,
            onClick: () => {
              applicationsClicked = true;
              if (options.applicationsClickRoute) {
                currentUrl = new URL(
                  options.applicationsClickRoute,
                  "https://www.studentconsulting.com",
                ).toString();
              }
            },
          },
        ]);
      }

      const showingApplications =
        current.pathname === applicationsRoute ||
        (current.pathname === "/sv/profil/" &&
          applicationsClicked &&
          options.applicationsInlineAfterClick === true);

      if (showingApplications && selector === "body") {
        return fakeLocator([
          { text: options.applicationsBodyText ?? "" },
        ]);
      }
      if (
        current.pathname === "/sv/profil/" &&
        !applicationsClicked &&
        selector === "body" &&
        options.profileBodyText
      ) {
        return fakeLocator([{ text: options.profileBodyText }]);
      }
      if (
        showingApplications &&
        selector === "a[href]" &&
        options.applicationsJobHref
      ) {
        return fakeLocator([{ href: options.applicationsJobHref }]);
      }
      if (
        current.pathname === "/sv/profil/" &&
        selector ===
          'button,[role="link"],[data-href],[data-url],[onclick]'
      ) {
        return fakeLocator();
      }
      return fakeLocator();
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
    async evaluate<T, A>(
      _pageFunction: (arg: A) => T | Promise<T>,
      _arg: A,
    ): Promise<T> {
      if (!options.authenticatedStatus) {
        throw new Error("evaluate not configured");
      }
      return options.authenticatedStatus as T;
    },
  };
}

function dynamicRequiredApplicationPage(): BrowserPage {
  let currentUrl = "https://www.studentconsulting.com/sv/profil/";

  return {
    async goto(url: string) {
      currentUrl =
        new URL(url).pathname === "/signin"
          ? "https://www.studentconsulting.com/sv/profil/"
          : url;
    },
    url() {
      return currentUrl;
    },
    locator(selector: string) {
      const pathname = new URL(currentUrl).pathname;
      if (
        /\/sv\/lediga-jobb\//.test(pathname) &&
        selector === "body"
      ) {
        return fakeLocator([{ text: "Fakta om jobbet\nJobb-ID 87570" }]);
      }
      if (
        /\/sv\/lediga-jobb\//.test(pathname) &&
        selector.includes("data-val-required")
      ) {
        return fakeLocator([{}]);
      }
      return fakeLocator();
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  };
}

const verificationJob: JobCandidate = {
  provider: "studentconsulting",
  externalId: "87570",
  title: "Testjobb",
  countryCode: "SE",
  isInternational: false,
  sourceUrl:
    "https://www.studentconsulting.com/sv/lediga-jobb/stockholm/testjobb/87570/",
};

describe("StudentConsulting authentication", () => {
  it("reuses an already authenticated profile session before reading credentials", async () => {
    let credentialReads = 0;
    const provider = new StudentConsultingProvider({
      page: authenticationRedirectPage(
        "https://www.studentconsulting.com/sv/profil/",
      ),
      credentials: {
        async getStudentConsultingCredentials() {
          credentialReads += 1;
          return {
            username: "user@example.test",
            password: ["test", "placeholder"].join("-"),
          };
        },
      },
    });

    await expect(provider.authenticate()).resolves.toEqual({
      status: "authenticated",
    });
    expect(credentialReads).toBe(0);
  });

  it("does not treat a public StudentConsulting page without a login form as authenticated", async () => {
    const provider = new StudentConsultingProvider({
      page: authenticationRedirectPage(
        "https://www.studentconsulting.com/sv/",
      ),
      credentials: {
        async getStudentConsultingCredentials() {
          return {
            username: "user@example.test",
            password: ["test", "placeholder"].join("-"),
          };
        },
      },
    });

    await expect(provider.authenticate()).resolves.toEqual(
      expect.objectContaining({
        status: "failed",
        code: "STUDENTCONSULTING_LOGIN_FORM_NOT_FOUND",
      }),
    );
  });
});

describe("StudentConsulting application verification", () => {
  const credentials = {
    async getStudentConsultingCredentials() {
      return {
        username: "user@example.test",
        password: ["test", "placeholder"].join("-"),
      };
    },
  };

  it("verifies from the authenticated StudentConsulting applied status", async () => {
    const provider = new StudentConsultingProvider({
      page: applicationsVerificationPage({
        authenticatedStatus: { found: true, applied: true },
        applicationsHref: "https://evil.test/sv/profil/ansokningar/",
      }),
      credentials,
    });

    await expect(provider.verify(verificationJob)).resolves.toBe(true);
  });

  it("classifies an authenticated exact Jobb-ID as definitely not applied", async () => {
    const provider = new StudentConsultingProvider({
      page: applicationsVerificationPage({
        authenticatedStatus: { found: true, applied: false },
        applicationsHref: "https://evil.test/sv/profil/ansokningar/",
      }),
      credentials,
    });

    await expect(
      provider.inspectApplicationStatus(verificationJob),
    ).resolves.toBe("not_applied");
    await expect(provider.verify(verificationJob)).resolves.toBe(false);
  });

  it("verifies an exact Jobb-ID through a trusted Ansökningar link", async () => {
    const provider = new StudentConsultingProvider({
      page: applicationsVerificationPage({
        applicationsBodyText: "Jobb-ID 87570",
      }),
      credentials,
    });

    await expect(provider.verify(verificationJob)).resolves.toBe(true);
  });

  it("verifies an inline Ansökningar list after clicking a root placeholder", async () => {
    const provider = new StudentConsultingProvider({
      page: applicationsVerificationPage({
        applicationsHref: "/",
        applicationsInlineAfterClick: true,
        applicationsBodyText: "Jobb-ID 87570",
      }),
      credentials,
    });

    await expect(provider.verify(verificationJob)).resolves.toBe(true);
  });

  it("verifies from an exact trusted job-detail URL when Jobb-ID is not text", async () => {
    const provider = new StudentConsultingProvider({
      page: applicationsVerificationPage({
        applicationsBodyText: "Ansökan mottagen",
        applicationsJobHref:
          "/sv/lediga-jobb/stockholm/testjobb/87570/",
      }),
      credentials,
    });

    await expect(provider.verify(verificationJob)).resolves.toBe(true);
  });

  it("rejects a trusted Ansökningar URL that redirects to another profile view", async () => {
    const provider = new StudentConsultingProvider({
      page: applicationsVerificationPage({
        applicationsBodyText: "Jobb-ID 87570",
        redirectApplicationsTo: "/sv/profil/matcha-jobb/",
      }),
      credentials,
    });

    await expect(provider.verify(verificationJob)).resolves.toBe(false);
  });

  it("does not treat a pre-existing profile job reference as an in-place applications view", async () => {
    const provider = new StudentConsultingProvider({
      page: applicationsVerificationPage({
        applicationsHref: "/",
        profileBodyText: "Jobb-ID 87570",
        applicationsInlineAfterClick: false,
      }),
      credentials,
    });

    await expect(provider.verify(verificationJob)).resolves.toBe(false);
  });

  it("rejects untrusted Ansökningar navigation", async () => {
    const provider = new StudentConsultingProvider({
      page: applicationsVerificationPage({
        applicationsHref:
          "https://evil.test/sv/profil/ansokningar/",
        applicationsBodyText: "Jobb-ID 87570",
      }),
      credentials,
    });

    await expect(provider.verify(verificationJob)).resolves.toBe(false);
  });
});

describe("StudentConsulting application submission guard", () => {
  it("stops before submit when StudentConsulting uses data-val-required", async () => {
    const provider = new StudentConsultingProvider({
      page: dynamicRequiredApplicationPage(),
      credentials: {
        async getStudentConsultingCredentials() {
          return {
            username: "user@example.test",
            password: ["test", "placeholder"].join("-"),
          };
        },
      },
      autoSubmit: true,
    });

    await expect(provider.apply(verificationJob)).resolves.toEqual(
      expect.objectContaining({
        status: "failed",
        submissionAttempted: false,
        error: expect.stringContaining("APPLICATION_REQUIRES_INPUT"),
      }),
    );
  });
});

describe("StudentConsulting authenticated discovery", () => {
  it("discovers from the canonical authenticated Matcha jobb route", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage(),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).resolves.toEqual([
      expect.objectContaining({
        provider: "studentconsulting",
        externalId: "87178",
        title: "IT-supporttekniker",
        discoverySource: "studentconsulting_matcha_jobb",
        countryCode: "SE",
      }),
    ]);
  });

  it("uses a trusted visible Matcha jobb profile route outside the canonical allowlist", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedProfileRoute: "/sv/min-profil/mina-jobbmatchningar/",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).resolves.toEqual([
      expect.objectContaining({
        externalId: "87178",
        discoverySource: "studentconsulting_matcha_jobb",
      }),
    ]);
  });

  it("recognizes current-style jobbmatchning navigation labels", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedProfileRoute: "/sv/min-profil/mina-jobbmatchningar/",
        matchedNavLabel: "Mina jobbmatchningar",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).resolves.toEqual([
      expect.objectContaining({
        externalId: "87178",
        discoverySource: "studentconsulting_matcha_jobb",
      }),
    ]);
  });

  it("uses a trusted data-url when the matched anchor href is a root placeholder", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedProfileRoute: "/sv/profil/mina-jobbmatchningar/",
        matchedNavLabel: "Mina jobbmatchningar",
        matchedNavHref: "/",
        matchedNavDataUrl: "/sv/profil/mina-jobbmatchningar/",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return {
            username: "user@example.test",
            password: ["test", "placeholder"].join("-"),
          };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).resolves.toEqual([
      expect.objectContaining({
        externalId: "87178",
        discoverySource: "studentconsulting_matcha_jobb",
      }),
    ]);
  });

  it("clicks one semantic root-placeholder anchor and validates its destination", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedProfileRoute: "/sv/profil/mina-jobbmatchningar/",
        matchedNavLabel: "Mina jobbmatchningar",
        matchedNavHref: "/",
        matchedNavClickRoute: "/sv/profil/mina-jobbmatchningar/",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return {
            username: "user@example.test",
            password: ["test", "placeholder"].join("-"),
          };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).resolves.toEqual([
      expect.objectContaining({
        externalId: "87178",
        discoverySource: "studentconsulting_matcha_jobb",
      }),
    ]);
  });

  it("rescans profile navigation after a root-placeholder toggle click", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedProfileRoute: "/sv/profil/mina-jobbmatchningar/",
        matchedNavLabel: "Mina jobbmatchningar",
        matchedNavHref: "/",
        matchedNavAfterClickHref: "/sv/profil/mina-jobbmatchningar/",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return {
            username: "user@example.test",
            password: ["test", "placeholder"].join("-"),
          };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).resolves.toEqual([
      expect.objectContaining({
        externalId: "87178",
        discoverySource: "studentconsulting_matcha_jobb",
      }),
    ]);
  });

  it("discovers inline matched jobs after a root-placeholder toggle click", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedNavLabel: "Mina jobbmatchningar",
        matchedNavHref: "/",
        matchedNavAfterClickJobHref:
          "/sv/lediga-jobb/stockholm/supporttekniker/87178/",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return {
            username: "user@example.test",
            password: ["test", "placeholder"].join("-"),
          };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).resolves.toEqual([
      expect.objectContaining({
        externalId: "87178",
        discoverySource: "studentconsulting_matcha_jobb",
      }),
    ]);
  });

  it("follows a semantic button control to the matched profile route", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedProfileRoute: "/sv/min-profil/mina-jobbmatchningar/",
        matchedNavLabel: "Mina jobbmatchningar",
        matchedNavControl: "button",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return {
            username: "user@example.test",
            password: ["test", "placeholder"].join("-"),
          };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).resolves.toEqual([
      expect.objectContaining({
        externalId: "87178",
        discoverySource: "studentconsulting_matcha_jobb",
      }),
    ]);
  });

  it("does not fall back to the obsolete canonical route when navigation is absent", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedNavLabel: "Profil",
        matchedNavHref: "/sv/min-profil/jobbmatchningar/",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).rejects.toThrow(
      /STUDENTCONSULTING_MATCHED_PROFILE_NAVIGATION_NOT_FOUND:.*profilePaths=\/sv\/min-profil\/jobbmatchningar\//,
    );
  });

  it("reports sanitized landing structure when matching navigation is hidden", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedProfileRoute: "/sv/min-profil/mina-jobbmatchningar/",
        matchedNavLabel: "Mina jobbmatchningar",
        matchedNavVisible: false,
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return {
            username: "user@example.test",
            password: ["test", "placeholder"].join("-"),
          };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).rejects.toThrow(
      /profilePaths=\/sv\/min-profil\/mina-jobbmatchningar\/; anchors=1; visibleAnchors=0; controls=0; visibleControls=0; semanticMatches=1; visibleSemanticMatches=0; dataHref=0; dataUrl=0; onclick=0/,
    );
  });

  it.each([
    "/sv/lediga-jobb/",
    "/sv/for-jobbsokare/jobbmatchning/",
  ])(
    "rejects visible Matcha jobb navigation outside the authenticated profile area: %s",
    async (matchedNavHref) => {
      const provider = new StudentConsultingProvider({
        page: matchedProfilePage({
          matchedNavHref,
        }),
        credentials: {
          async getStudentConsultingCredentials() {
            return {
              username: "user@example.test",
              password: ["test", "placeholder"].join("-"),
            };
          },
        },
        maxPagesPerSource: 1,
        fetcher: countryIndexFetcher,
      });

      let message = "";
      try {
        await provider.discover();
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toContain(
        "STUDENTCONSULTING_MATCHED_PROFILE_ROUTE_INVALID",
      );
      expect(message).toContain("untrusted_href");
      expect(message).toContain(`path=${matchedNavHref}`);
  });

  it("rejects matched-profile navigation on a StudentConsulting subdomain", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedNavHref:
          "https://profile.studentconsulting.com/sv/min-profil/mina-jobbmatchningar/",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).rejects.toThrow(
      /STUDENTCONSULTING_MATCHED_PROFILE_ROUTE_INVALID:.*untrusted_href/,
    );
  });

  it("does not expose non-https matched-navigation payloads in diagnostics", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedNavHref: "data:text/plain,user@example.com",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return {
            username: "user@example.test",
            password: ["test", "placeholder"].join("-"),
          };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    let message = "";
    try {
      await provider.discover();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(
      /STUDENTCONSULTING_MATCHED_PROFILE_ROUTE_INVALID:.*untrusted_href/,
    );
    expect(message).not.toContain("user@example.com");
    expect(message).not.toContain("data:");
  });

  it("rejects matched-profile navigation with URL credentials", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedNavHref:
          "https://user:secret@www.studentconsulting.com/sv/min-profil/mina-jobbmatchningar/",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).rejects.toThrow(
      /STUDENTCONSULTING_MATCHED_PROFILE_ROUTE_INVALID:.*untrusted_href/,
    );
  });

  it("rechecks authentication after the listing navigation", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        authOnMatchedVisit: 2,
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).rejects.toThrow(
      /STUDENTCONSULTING_PROFILE_AUTH_REQUIRED: Matcha jobb-listningen/,
    );
  });

  it.each(["data-href", "data-url", "onclick"] as const)(
    "discovers trusted job URLs from %s cards on Matcha jobb",
    async (jobLinkAttribute) => {
      const provider = new StudentConsultingProvider({
        page: matchedProfilePage({ jobLinkAttribute }),
        credentials: {
          async getStudentConsultingCredentials() {
            return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
          },
        },
        maxPagesPerSource: 1,
        fetcher: countryIndexFetcher,
      });

      await expect(provider.discover()).resolves.toEqual([
        expect.objectContaining({
          provider: "studentconsulting",
          externalId: "87178",
          discoverySource: "studentconsulting_matcha_jobb",
        }),
      ]);
    },
  );

  it("rejects foreign absolute URLs embedded in inline navigation", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        jobLinkAttribute: "onclick",
        jobLinkValue:
          "https://evil.test/sv/lediga-jobb/stockholm/supporttekniker/87178/",
        matchedBodyText: "0 matchande jobb",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).rejects.toThrow(
      /STUDENTCONSULTING_NO_MATCHED_JOBS/,
    );
  });

  it("finds a trusted job link after more than 250 ordinary anchors", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        leadingHrefCount: 300,
        matchedBodyText: "0 matchande jobb",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).resolves.toEqual([
      expect.objectContaining({
        externalId: "87178",
        discoverySource: "studentconsulting_matcha_jobb",
      }),
    ]);
  });

  it("distinguishes an explicit empty Matcha jobb profile", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({ explicitEmpty: true }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).rejects.toThrow(
      /STUDENTCONSULTING_NO_MATCHED_JOBS/,
    );
  });

  it("fails closed if Matcha jobb redirects to a public listing", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({ redirectMatched: true }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: ["test", "placeholder"].join("-") };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).rejects.toThrow(
      /MATCHED_PROFILE_REDIRECTED/,
    );
  });
});

describe("StudentConsulting country resolution", () => {
  it("maps public job IDs through StudentConsulting country filters", async () => {
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        locations: Array<{ id: number }>;
      };
      const countryId = body.locations[0]?.id;
      const url =
        countryId === 1
          ? "/sv/lediga-jobb/borlange/test/87542"
          : countryId === 2
            ? "/sv/lediga-jobb/oslo/test/87398"
            : "/sv/lediga-jobb/kopenhamn/test/87000";
      return new Response(
        JSON.stringify({ data: [{ url }], meta: { totalHits: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const index = await loadStudentConsultingCountryIndex(fetcher);
    expect(index.get("87542")?.countryCode).toBe("SE");
    expect(index.get("87398")?.countryCode).toBe("NO");
    expect(index.get("87000")?.countryCode).toBe("DK");
  });
});

describe("StudentConsulting parsing", () => {
  it("extracts job id, location and occupation from the facts section", () => {
    const parsed = parseStudentConsultingJobText(`
      Annonsinnehåll
      Fakta om jobbet
      Jobb-ID 87178
      Antal platser 2 st
      Ort
      Malmö
      Yrkeskategori
      Industri / Produktion
    `);

    expect(parsed).toEqual({
      externalId: "87178",
      location: "Malmö",
      occupation: "Industri / Produktion",
      isInternational: false,
    });
  });

  it("recognizes the authenticated Matcha jobb navigation label and route", () => {
    expect(isStudentConsultingMatchedJobsLabel("Matcha jobb")).toBe(true);
    expect(isStudentConsultingMatchedJobsLabel("Matcha jobb 12")).toBe(true);
    expect(isStudentConsultingMatchedJobsLabel("Jobbmatchning")).toBe(true);
    expect(isStudentConsultingMatchedJobsLabel("Mina jobbmatchningar")).toBe(true);
    expect(isStudentConsultingMatchedJobsLabel("Matchningar mot jobb")).toBe(true);
    expect(isStudentConsultingMatchedJobsLabel("Rusta och matcha")).toBe(false);
    expect(isStudentConsultingMatchedJobsLabel("Rusta och matcha jobb")).toBe(false);
    expect(isStudentConsultingMatchedJobsLabel("Lediga jobb")).toBe(false);
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://www.studentconsulting.com/sv/min-profil/matcha-jobb/",
      ),
    ).toBe(
      "https://www.studentconsulting.com/sv/min-profil/matcha-jobb/",
    );
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://www.studentconsulting.com/sv/lediga-jobb/",
      ),
    ).toBeNull();
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://www.studentconsulting.com/sv/matcha-jobb/",
      ),
    ).toBeNull();
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://www.studentconsulting.com/sv/lediga-jobb/matcha-jobb/",
      ),
    ).toBeNull();
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://www.studentconsulting.com/sv/min-profil/matchade-jobb/",
      ),
    ).toBe(
      "https://www.studentconsulting.com/sv/min-profil/matchade-jobb/",
    );
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://www.studentconsulting.com/sv/min-profil/",
      ),
    ).toBeNull();
    expect(
      normalizeStudentConsultingMatchedJobsUrl(
        "https://studentconsulting.com.evil.test/sv/min-profil/matcha-jobb/",
      ),
    ).toBeNull();
  });

  it("does not parse location names beginning with Land as the country fact", () => {
    const parsed = parseStudentConsultingJobText(`
      Fakta om jobbet
      Jobb-ID 90000
      Ort
      Landskrona
      Yrkeskategori
      IT / Support
    `);

    expect(parsed.location).toBe("Landskrona");
    expect(parsed.country).toBeUndefined();
    expect(parsed.countryCode).toBeUndefined();
    expect(parsed.isInternational).toBe(false);
  });

  it("supports bounded inline country facts", () => {
    expect(
      parseStudentConsultingJobText(`
        Fakta om jobbet
        Jobb-ID 90002
        Ort: Oslo
        Land: Norge
        Yrkeskategori: IT / Support
      `),
    ).toMatchObject({
      location: "Oslo",
      country: "Norge",
      countryCode: "NO",
      isInternational: true,
    });
  });

  it("classifies explicit non-Swedish job countries", () => {
    expect(
      parseStudentConsultingJobText(`
        Fakta om jobbet
        Jobb-ID 90001
        Ort
        Oslo
        Land
        Norge
        Yrkeskategori
        IT / Support
      `),
    ).toMatchObject({
      country: "Norge",
      countryCode: "NO",
      isInternational: true,
    });
  });

  it("matches only the exact Jobb-ID during application verification", () => {
    expect(containsExactJobId("Jobb-ID 87178 Supporttekniker", "87178")).toBe(true);
    expect(containsExactJobId("Jobb-ID 187178 Supporttekniker", "87178")).toBe(false);
    expect(containsExactJobId("Butiksmedarbetare", "87178")).toBe(false);
  });
});

describe("JobTech mapping", () => {
  it("normalizes Swedish ads", () => {
    const mapped = mapJobTechHit({
      id: "123",
      headline: "Supporttekniker",
      webpage_url: "https://example.test/123",
      employer: { name: "Exempel AB" },
      workplace_address: {
        municipality: "Stockholm",
        country: "Sverige",
        country_code: "199",
      },
      occupation: { concept_id: "abc", label: "Supporttekniker" },
      application_details: {
        url: "https://example.test/apply",
        reference: "REF-123",
      },
    });

    expect(mapped).toMatchObject({
      provider: "arbetsformedlingen",
      externalId: "123",
      employer: "Exempel AB",
      location: "Stockholm",
      countryCode: "SE",
      isInternational: false,
      occupationConceptId: "abc",
      applicationReference: "REF-123",
    });
  });

  it("marks non-Swedish ads as international", () => {
    const mapped = mapJobTechHit({
      id: "456",
      headline: "Lagerarbeider",
      workplace_address: {
        municipality: "Oslo",
        country: "Norge",
        country_code: "NO",
      },
    });

    expect(mapped).toMatchObject({
      country: "Norge",
      countryCode: "NO",
      isInternational: true,
    });
  });
});