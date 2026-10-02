import { describe, expect, it } from "vitest";
import { mapJobTechHit } from "../../../packages/arbetsformedlingen/src/provider";
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
      return Boolean(items[index]);
    },
    async fill() {},
    async click() {},
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
    authOnMatchedVisit?: number;
    jobLinkAttribute?: "href" | "data-href" | "data-url" | "onclick";
    jobLinkValue?: string;
    leadingHrefCount?: number;
    matchedBodyText?: string;
    explicitEmpty?: boolean;
  } = {},
): BrowserPage {
  let currentUrl = "https://www.studentconsulting.com/sv/";
  let matchedRouteVisits = 0;
  const matchedProfileRoute =
    options.matchedProfileRoute ?? "/sv/min-profil/matcha-jobb/";

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
      if (current.pathname === "/sv/" && selector === "a") {
        const href =
          options.matchedNavHref === undefined
            ? matchedProfileRoute
            : (options.matchedNavHref ?? undefined);
        return fakeLocator([{ text: "Matcha jobb", href }]);
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

describe("StudentConsulting authenticated discovery", () => {
  it("discovers from the canonical authenticated Matcha jobb route", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage(),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: "not-used" };
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
          return { username: "user@example.test", password: "not-used" };
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

  it("rejects visible Matcha jobb navigation outside the authenticated profile area", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        matchedNavHref: "/sv/lediga-jobb/",
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: "not-used" };
        },
      },
      maxPagesPerSource: 1,
      fetcher: countryIndexFetcher,
    });

    await expect(provider.discover()).rejects.toThrow(
      /STUDENTCONSULTING_MATCHED_PROFILE_ROUTE_INVALID:.*untrusted_href.*\/sv\/lediga-jobb\//,
    );
  });

  it("rechecks authentication after the listing navigation", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({
        authOnMatchedVisit: 2,
      }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: "not-used" };
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
            return { username: "user@example.test", password: "not-used" };
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
          return { username: "user@example.test", password: "not-used" };
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
          return { username: "user@example.test", password: "not-used" };
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
          return { username: "user@example.test", password: "not-used" };
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
          return { username: "user@example.test", password: "not-used" };
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