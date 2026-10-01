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
  items: Array<{ text?: string; href?: string }> = [],
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

function matchedProfilePage(options: { redirectMatched?: boolean } = {}): BrowserPage {
  let currentUrl = "https://www.studentconsulting.com/sv/";

  return {
    async goto(url: string) {
      currentUrl =
        options.redirectMatched && new URL(url).pathname.includes("/matcha-jobb/")
          ? "https://www.studentconsulting.com/sv/lediga-jobb/"
          : url;
    },
    url() {
      return currentUrl;
    },
    locator(selector: string) {
      const current = new URL(currentUrl);
      if (
        current.pathname === "/sv/min-profil/matcha-jobb/" &&
        selector === 'a[href*="/sv/lediga-jobb/"]'
      ) {
        return fakeLocator([
          {
            href: "/sv/lediga-jobb/stockholm/supporttekniker/87178/",
          },
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
              "Land",
              "Sverige",
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
  it("discovers from the canonical authenticated Matcha jobb route without depending on a visible navigation link", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage(),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: "not-used" };
        },
      },
      maxPagesPerSource: 1,
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

  it("fails closed if Matcha jobb redirects to a public listing", async () => {
    const provider = new StudentConsultingProvider({
      page: matchedProfilePage({ redirectMatched: true }),
      credentials: {
        async getStudentConsultingCredentials() {
          return { username: "user@example.test", password: "not-used" };
        },
      },
      maxPagesPerSource: 1,
    });

    await expect(provider.discover()).rejects.toThrow(
      /MATCHED_PROFILE_REDIRECTED/,
    );
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