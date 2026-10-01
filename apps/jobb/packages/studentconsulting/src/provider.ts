import type {
  ApplicationResult,
  AuthenticationState,
  CredentialsProvider,
  JobCandidate,
  JobProvider,
} from "../../core/src/types";
import { isHostOrSubdomain } from "../../core/src/url";
import type { BrowserLocator, BrowserPage } from "./browser";

const DEFAULT_BASE_URL = "https://www.studentconsulting.com";
const STUDENTCONSULTING_DOMAIN = "studentconsulting.com";
const STUDENTCONSULTING_IDP = "id.studentconsulting.com";
const SUBMISSION_SETTLE_MS = 15_000;
const MATCHED_JOBS_URL = `${DEFAULT_BASE_URL}/sv/min-profil/matcha-jobb/`;
const MATCHED_LISTING_WAIT_MS = 15_000;
const JOB_OPENINGS_API = `${DEFAULT_BASE_URL}/api/v1/jobopenings`;
const COUNTRY_PAGE_SIZE = 200;

const STUDENTCONSULTING_COUNTRIES = [
  { id: 1, country: "Sverige", countryCode: "SE", isInternational: false },
  { id: 2, country: "Norge", countryCode: "NO", isInternational: true },
  { id: 3, country: "Danmark", countryCode: "DK", isInternational: true },
] as const;

export interface StudentConsultingCountry {
  country: string;
  countryCode: string;
  isInternational: boolean;
}

export interface StudentConsultingProviderOptions {
  page: BrowserPage;
  credentials: CredentialsProvider;
  maxJobs?: number;
  maxPagesPerSource?: number;
  autoSubmit?: boolean;
  fetcher?: typeof fetch;
}

export interface ParsedStudentConsultingJob {
  externalId?: string;
  location?: string;
  occupation?: string;
  country?: string;
  countryCode?: string;
  isInternational: boolean;
}

export class StudentConsultingProvider implements JobProvider {
  readonly id = "studentconsulting" as const;

  private readonly page: BrowserPage;
  private readonly credentials: CredentialsProvider;
  private readonly maxJobs: number;
  private readonly maxPagesPerSource: number;
  private readonly autoSubmit: boolean;
  private readonly fetcher: typeof fetch;

  constructor(options: StudentConsultingProviderOptions) {
    this.page = options.page;
    this.credentials = options.credentials;
    this.maxJobs = options.maxJobs ?? 30;
    this.maxPagesPerSource = options.maxPagesPerSource ?? 3;
    this.autoSubmit = options.autoSubmit ?? false;
    this.fetcher = options.fetcher ?? fetch;
  }

  async authenticate(): Promise<AuthenticationState> {
    try {
      const { username, password } =
        await this.credentials.getStudentConsultingCredentials();
      const redirectUrl = `${DEFAULT_BASE_URL}/sv/`;
      const loginUrl = `${DEFAULT_BASE_URL}/signin?language=sv-SE&redirectUrl=${encodeURIComponent(redirectUrl)}`;

      await this.page.goto(loginUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      const email = await firstVisible(this.page, [
        'input[type="email"]',
        'input[autocomplete="username"]',
        'input[name="Email"]',
        'input[name="email"]',
      ]);
      const passwordInput = await firstVisible(this.page, [
        'input[type="password"]',
        'input[autocomplete="current-password"]',
      ]);

      if (!email || !passwordInput) {
        return {
          status: "failed",
          code: "STUDENTCONSULTING_LOGIN_FORM_NOT_FOUND",
          message: "StudentConsulting login form could not be identified.",
        };
      }

      await email.fill(username);
      await passwordInput.fill(password);

      const submit = await firstVisible(this.page, [
        'button[type="submit"]',
        'input[type="submit"]',
      ]);
      if (!submit) {
        return {
          status: "failed",
          code: "STUDENTCONSULTING_LOGIN_SUBMIT_NOT_FOUND",
          message: "StudentConsulting login submit control could not be identified.",
        };
      }

      await submit.click({ timeout: 10_000 });
      await settleAfterAuthentication(this.page, 20_000);

      const host = safeHostname(this.page.url());
      if (!host || host === STUDENTCONSULTING_IDP) {
        return {
          status: "failed",
          code: "STUDENTCONSULTING_LOGIN_FAILED",
          message: "StudentConsulting did not establish an authenticated session.",
        };
      }
      if (!isHostOrSubdomain(host, STUDENTCONSULTING_DOMAIN)) {
        return {
          status: "failed",
          code: "STUDENTCONSULTING_UNEXPECTED_REDIRECT",
          message: `Unexpected login redirect host: ${host}`,
        };
      }

      return { status: "authenticated" };
    } catch (error) {
      return {
        status: "failed",
        code: "STUDENTCONSULTING_AUTH_ERROR",
        message: errorMessage(error),
      };
    }
  }

  async discover(): Promise<JobCandidate[]> {
    const matchedJobsUrl = normalizeStudentConsultingMatchedJobsUrl(
      MATCHED_JOBS_URL,
    );
    if (!matchedJobsUrl) {
      throw new Error(
        "STUDENTCONSULTING_MATCHED_PROFILE_ROUTE_INVALID: Matcha jobb-routen kunde inte valideras.",
      );
    }

    await this.page.goto(matchedJobsUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!isSameMatchedJobsRoute(this.page.url(), matchedJobsUrl)) {
      throw new Error(
        "STUDENTCONSULTING_MATCHED_PROFILE_REDIRECTED: Matcha jobb omdirigerades utanför den verifierade profilvyn.",
      );
    }

    const countryByExternalId = await loadStudentConsultingCountryIndex(
      this.fetcher,
    ).catch((error) => {
      console.warn("StudentConsulting country index unavailable", {
        error: errorMessage(error),
      });
      return new Map<string, StudentConsultingCountry>();
    });
    const candidates = new Map<string, JobCandidate>();
    for (let pageNumber = 1; pageNumber <= this.maxPagesPerSource; pageNumber += 1) {
      if (candidates.size >= this.maxJobs) break;

      const listingUrl = withPage(matchedJobsUrl, pageNumber);
      await this.page.goto(listingUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      if (!isSameMatchedJobsRoute(this.page.url(), matchedJobsUrl)) {
        throw new Error(
          "STUDENTCONSULTING_MATCHED_PROFILE_REDIRECTED: Matcha jobb omdirigerades utanför den verifierade profilvyn.",
        );
      }

      const listing = await collectJobLinks(this.page);
      if (listing.links.length === 0) {
        if (pageNumber === 1 && listing.explicitEmpty) {
          throw new Error(
            "STUDENTCONSULTING_NO_MATCHED_JOBS: Matcha jobb rapporterade inga matchande jobb.",
          );
        }
        break;
      }

      let addedOnPage = 0;
      for (const sourceUrl of listing.links) {
        if (candidates.size >= this.maxJobs) break;
        if (candidates.has(sourceUrl)) continue;

        const candidate = await this.readJob(sourceUrl, countryByExternalId);
        if (!candidate) continue;
        candidates.set(sourceUrl, candidate);
        addedOnPage += 1;
      }

      if (addedOnPage === 0) break;
    }

    return [...candidates.values()].slice(0, this.maxJobs);
  }

  async apply(job: JobCandidate): Promise<ApplicationResult> {
    if (job.provider !== this.id) {
      return {
        status: "failed",
        error: "StudentConsulting provider received a job from another provider.",
        submissionAttempted: false,
      };
    }

    const safeJobUrl = normalizeStudentConsultingJobUrl(job.sourceUrl);
    if (!safeJobUrl) {
      return {
        status: "failed",
        error: "INVALID_JOB_URL: the job URL is outside StudentConsulting or has an unexpected path.",
        submissionAttempted: false,
      };
    }

    let submissionAttempted = false;

    try {
      const auth = await this.authenticate();
      if (auth.status !== "authenticated") {
        return {
          status: "failed",
          error:
            auth.status === "failed"
              ? `${auth.code}: ${auth.message}`
              : "Authentication required.",
          submissionAttempted: false,
        };
      }

      await this.page.goto(safeJobUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      const bodyText = await safeInnerText(this.page.locator("body").first());
      if (alreadyApplied(bodyText)) {
        return {
          status: "submitted",
          reference: job.externalId,
          submissionAttempted: false,
        };
      }

      if (!this.autoSubmit) {
        return {
          status: "failed",
          error:
            "AUTOSUBMIT_DISABLED: set STUDENTCONSULTING_AUTOSUBMIT=true after validating the authenticated application form.",
          submissionAttempted: false,
        };
      }

      const requiredState = await validateRequiredControls(this.page);
      if (!requiredState.ok) {
        return {
          status: "failed",
          error: requiredState.error,
          submissionAttempted: false,
        };
      }

      const submit = await findApplicationSubmit(this.page);
      if (!submit) {
        return {
          status: "failed",
          error:
            "APPLICATION_SUBMIT_NOT_FOUND: no unambiguous StudentConsulting application submit button was found.",
          submissionAttempted: false,
        };
      }

      // Dispatch the already-validated unique submit control directly so a
      // successful return means the external click side effect was emitted.
      await submit.dispatchEvent("click");
      submissionAttempted = true;
      await waitForSubmissionToSettle(this.page, SUBMISSION_SETTLE_MS);

      if (await this.verify(job)) {
        return {
          status: "submitted",
          reference: job.externalId,
          submissionAttempted: true,
        };
      }

      return {
        status: "unknown",
        reference: job.externalId,
        error:
          "Submission was attempted but the exact Jobb-ID could not be verified in StudentConsulting applications.",
        submissionAttempted: true,
      };
    } catch (error) {
      return {
        status: submissionAttempted ? "unknown" : "failed",
        reference: submissionAttempted ? job.externalId : undefined,
        error: errorMessage(error),
        submissionAttempted,
      };
    }
  }

  async verify(job: JobCandidate): Promise<boolean> {
    try {
      await this.page.goto(`${DEFAULT_BASE_URL}/sv/`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      const applicationsUrl = await findApplicationsUrl(this.page);
      if (!applicationsUrl) return false;

      await this.page.goto(applicationsUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      const bodyText = await safeInnerText(this.page.locator("body").first());
      return containsExactJobId(bodyText, job.externalId);
    } catch {
      return false;
    }
  }

  private async readJob(
    sourceUrl: string,
    countryByExternalId: Map<string, StudentConsultingCountry>,
  ): Promise<JobCandidate | null> {
    const safeJobUrl = normalizeStudentConsultingJobUrl(sourceUrl);
    if (!safeJobUrl) return null;

    await this.page.goto(safeJobUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    const title = (await safeInnerText(this.page.locator("h1").first())).trim();
    const bodyText = await safeInnerText(this.page.locator("body").first());
    const parsed = parseStudentConsultingJobText(bodyText);
    if (!title || !parsed.externalId) return null;
    const indexedCountry = countryByExternalId.get(parsed.externalId);

    return {
      provider: this.id,
      externalId: parsed.externalId,
      title,
      employer: "StudentConsulting",
      location: parsed.location,
      country: parsed.country ?? indexedCountry?.country,
      countryCode: parsed.countryCode ?? indexedCountry?.countryCode,
      isInternational:
        parsed.countryCode !== undefined
          ? parsed.isInternational
          : (indexedCountry?.isInternational ?? parsed.isInternational),
      occupation: parsed.occupation,
      applicationUrl: safeJobUrl,
      discoverySource: "studentconsulting_matcha_jobb",
      sourceUrl: safeJobUrl,
    };
  }
}

export function parseStudentConsultingJobText(
  bodyText: string,
): ParsedStudentConsultingJob {
  const factsStart = bodyText.search(/Fakta om jobbet/i);
  const facts = factsStart >= 0 ? bodyText.slice(factsStart) : bodyText;
  const externalId = facts.match(/Jobb-ID\s*([0-9]+)/i)?.[1];

  const country = classifyCountry(readFact(facts, "Land"));

  return {
    externalId,
    location: readFact(facts, "Ort"),
    occupation: readFact(facts, "Yrkeskategori"),
    ...country,
  };
}

export function containsExactJobId(text: string, externalId: string): boolean {
  const escaped = escapeRegExp(externalId.trim());
  if (!escaped) return false;
  return new RegExp(`(?:^|\\D)${escaped}(?:\\D|$)`).test(text);
}

export function normalizeStudentConsultingUrl(value: string): string | null {
  try {
    const parsed = new URL(value, DEFAULT_BASE_URL);
    if (parsed.protocol !== "https:") return null;
    if (!isHostOrSubdomain(parsed.hostname, STUDENTCONSULTING_DOMAIN)) return null;

    return new URL(
      `${parsed.pathname}${parsed.search}${parsed.hash}`,
      DEFAULT_BASE_URL,
    ).toString();
  } catch {
    return null;
  }
}

export function normalizeStudentConsultingJobUrl(
  value: string,
): string | null {
  const safe = normalizeStudentConsultingUrl(value);
  if (!safe) return null;

  const parsed = new URL(safe);
  if (!/\/sv\/lediga-jobb\/[^/]+\/[^/]+\/\d+\/?$/i.test(parsed.pathname)) {
    return null;
  }
  return safe;
}

function extractStudentConsultingJobUrlCandidates(value: string): string[] {
  const candidates = new Set<string>([value.trim()]);
  const matches = value.match(
    /(?:https:\/\/(?:[a-z0-9-]+\.)?studentconsulting\.com)?\/sv\/lediga-jobb\/[^\s"'<>]+\/[^\s"'<>]+\/\d+\/?/gi,
  );
  for (const match of matches ?? []) candidates.add(match);
  return [...candidates].filter(Boolean);
}

export function isStudentConsultingMatchedJobsLabel(label: string): boolean {
  const normalized = normalize(label);
  return /^(matcha jobb|matchade jobb|matchande jobb)(?:\s|$)/i.test(normalized);
}

export function normalizeStudentConsultingMatchedJobsUrl(
  value: string,
): string | null {
  const safe = normalizeStudentConsultingUrl(value);
  if (!safe) return null;

  const pathname = new URL(safe).pathname;
  if (!/^\/sv\/min-profil\/matcha-jobb\/?$/i.test(pathname)) {
    return null;
  }
  return safe;
}

export async function loadStudentConsultingCountryIndex(
  fetcher: typeof fetch = fetch,
): Promise<Map<string, StudentConsultingCountry>> {
  const result = new Map<string, StudentConsultingCountry>();
  const ambiguous = new Set<string>();

  for (const country of STUDENTCONSULTING_COUNTRIES) {
    let page = 1;
    let totalHits = Number.POSITIVE_INFINITY;

    while ((page - 1) * COUNTRY_PAGE_SIZE < totalHits && page <= 10) {
      const response = await fetcher(JOB_OPENINGS_API, {
        method: "POST",
        headers: {
          accept: "application/json",
          "accept-language": "sv-SE",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          locations: [{ type: "country", id: country.id, name: country.country }],
          professions: [],
          schemas: [],
          types: [],
          keywords: [],
          onlySummer: false,
          onlyInternal: false,
          sortOrder: 0,
          page,
          pageSize: COUNTRY_PAGE_SIZE,
        }),
      });
      if (!response.ok) {
        throw new Error(
          `STUDENTCONSULTING_COUNTRY_INDEX_FAILED: HTTP ${response.status}`,
        );
      }

      const payload = (await response.json()) as {
        data?: Array<{ url?: string }>;
        meta?: { totalHits?: number };
      };
      const rows = Array.isArray(payload.data) ? payload.data : [];
      totalHits = Number(payload.meta?.totalHits ?? rows.length);

      for (const row of rows) {
        const externalId = row.url?.match(/\/([0-9]+)\/?(?:\?.*)?$/)?.[1];
        if (!externalId || ambiguous.has(externalId)) continue;

        const value: StudentConsultingCountry = {
          country: country.country,
          countryCode: country.countryCode,
          isInternational: country.isInternational,
        };
        const existing = result.get(externalId);
        if (existing && existing.countryCode !== value.countryCode) {
          result.delete(externalId);
          ambiguous.add(externalId);
          continue;
        }
        result.set(externalId, value);
      }

      if (rows.length === 0) break;
      page += 1;
    }
  }

  return result;
}

function isSameMatchedJobsRoute(current: string, expected: string): boolean {
  const currentSafe = normalizeStudentConsultingMatchedJobsUrl(current);
  const expectedSafe = normalizeStudentConsultingMatchedJobsUrl(expected);
  if (!currentSafe || !expectedSafe) return false;

  return new URL(currentSafe).pathname === new URL(expectedSafe).pathname;
}

interface MatchedListingObservation {
  links: string[];
  explicitEmpty: boolean;
}

async function collectJobLinks(
  page: BrowserPage,
): Promise<MatchedListingObservation> {
  const started = Date.now();

  while (Date.now() - started < MATCHED_LISTING_WAIT_MS) {
    const links = new Set<string>();
    const sources = [
      { selector: "a[href]", attribute: "href" },
      { selector: "[data-href]", attribute: "data-href" },
      { selector: "[data-url]", attribute: "data-url" },
      { selector: "[onclick]", attribute: "onclick" },
    ] as const;

    for (const source of sources) {
      const elements = page.locator(source.selector);
      const count = Math.min(await elements.count(), 250);
      for (let index = 0; index < count; index += 1) {
        const value = await elements.nth(index).getAttribute(source.attribute);
        if (!value) continue;
        for (const candidate of extractStudentConsultingJobUrlCandidates(value)) {
          const safeJobUrl = normalizeStudentConsultingJobUrl(candidate);
          if (safeJobUrl) links.add(safeJobUrl);
        }
      }
    }

    if (links.size > 0) {
      return { links: [...links], explicitEmpty: false };
    }

    const bodyText = await safeInnerText(page.locator("body").first());
    if (matchedListingExplicitlyEmpty(bodyText)) {
      return { links: [], explicitEmpty: true };
    }

    await page.waitForTimeout(400);
  }

  const bodyText = await safeInnerText(page.locator("body").first());
  return {
    links: [],
    explicitEmpty: matchedListingExplicitlyEmpty(bodyText),
  };
}

function matchedListingExplicitlyEmpty(text: string): boolean {
  return /(?:^|\n)\s*(?:0\s+(?:matchande|matchade)?\s*jobb|inga\s+(?:matchande|matchade)?\s*jobb|inget\s+jobb\s+matchar)[^\n]*(?:$|\n)/im.test(
    text,
  );
}

async function firstVisible(
  page: BrowserPage,
  selectors: string[],
): Promise<BrowserLocator | null> {
  for (const selector of selectors) {
    const matches = page.locator(selector);
    const count = Math.min(await matches.count(), 10);
    for (let index = 0; index < count; index += 1) {
      const candidate = matches.nth(index);
      if (await candidate.isVisible()) return candidate;
    }
  }
  return null;
}

async function validateRequiredControls(
  page: BrowserPage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const controls = page.locator(
    "input[required], textarea[required], select[required]",
  );
  const count = Math.min(await controls.count(), 100);
  const checkedRadioGroups = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;

    const type = ((await control.getAttribute("type")) ?? "").toLowerCase();
    if (type === "radio") {
      const name = (await control.getAttribute("name"))?.trim();
      if (!name) {
        if (!(await control.isChecked())) {
          return {
            ok: false,
            error: "APPLICATION_REQUIRES_INPUT: a required radio option is unresolved.",
          };
        }
        continue;
      }

      if (checkedRadioGroups.has(name)) continue;
      if (!(await anyRadioChecked(page, name))) {
        return {
          ok: false,
          error: "APPLICATION_REQUIRES_INPUT: a required radio group is unresolved.",
        };
      }
      checkedRadioGroups.add(name);
      continue;
    }

    if (type === "checkbox") {
      if (!(await control.isChecked())) {
        return {
          ok: false,
          error: "APPLICATION_REQUIRES_INPUT: a required checkbox is unresolved.",
        };
      }
      continue;
    }

    if (type === "file") {
      return {
        ok: false,
        error: "APPLICATION_REQUIRES_INPUT: a required file upload is unresolved.",
      };
    }

    if ((await control.inputValue()).trim() === "") {
      return {
        ok: false,
        error: "APPLICATION_REQUIRES_INPUT: a required application field is empty.",
      };
    }
  }

  return { ok: true };
}

async function anyRadioChecked(page: BrowserPage, name: string): Promise<boolean> {
  const escapedName = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const radios = page.locator(`input[type="radio"][name="${escapedName}"]`);
  const count = Math.min(await radios.count(), 100);
  for (let index = 0; index < count; index += 1) {
    if (await radios.nth(index).isChecked()) return true;
  }
  return false;
}

async function findApplicationSubmit(
  page: BrowserPage,
): Promise<BrowserLocator | null> {
  const controls = page.locator('button, input[type="submit"]');
  const count = Math.min(await controls.count(), 100);
  const matches: BrowserLocator[] = [];
  const accepted = /^(skicka( in)? ansökan|sök tjänsten|sök jobbet|ansök)$/i;

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;
    const label = (
      (await safeInnerText(control)) ||
      (await control.getAttribute("value")) ||
      ""
    ).trim();
    if (accepted.test(label)) matches.push(control);
  }
  return matches.length === 1 ? matches[0] : null;
}

async function findApplicationsUrl(page: BrowserPage): Promise<string | null> {
  const anchors = page.locator("a");
  const count = Math.min(await anchors.count(), 300);
  const accepted = /^(ansökningar|applications|søknader|ansøgninger)$/i;

  for (let index = 0; index < count; index += 1) {
    const anchor = anchors.nth(index);
    if (!(await anchor.isVisible())) continue;
    const label = (await safeInnerText(anchor)).trim();
    if (!accepted.test(label)) continue;

    const href = await anchor.getAttribute("href");
    if (!href) continue;
    const safeUrl = normalizeStudentConsultingUrl(href);
    if (safeUrl) return safeUrl;
  }
  return null;
}

async function waitForSubmissionToSettle(
  page: BrowserPage,
  timeout: number,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const body = await safeInnerText(page.locator("body").first());
    if (submissionConfirmationVisible(body)) return;

    try {
      await page.waitForLoadState("networkidle", { timeout: 750 });
    } catch {
      // Same-page submissions may never trigger a navigation event.
    }
    await page.waitForTimeout(250);
  }
}

function submissionConfirmationVisible(text: string): boolean {
  return /tack för din ansökan|ansökan (?:har )?skickats|application (?:has been )?submitted|søknad(?:en)? (?:er )?sendt|ansøgning(?:en)? (?:er )?sendt|redan sökt|already applied|allerede søkt|allerede søgt/i.test(
    text,
  );
}

async function settleAfterAuthentication(
  page: BrowserPage,
  timeout: number,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 2_000 });
    } catch {
      // Authentication redirects may still be in progress.
    }

    const host = safeHostname(page.url());
    if (
      host &&
      host !== STUDENTCONSULTING_IDP &&
      isHostOrSubdomain(host, STUDENTCONSULTING_DOMAIN)
    ) {
      return;
    }
    await page.waitForTimeout(300);
  }
}

function readFact(text: string, label: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const normalizedLabel = normalize(label);

  const inlinePattern = new RegExp(
    `^${escapeRegExp(label)}(?:\\s*[:–-]\\s*|\\s+)(.+)$`,
    "i",
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = normalize(line);
    if (normalizedLine === normalizedLabel) return lines[index + 1];

    const inlineMatch = line.match(inlinePattern);
    const value = inlineMatch?.[1]?.trim();
    if (value) return value;
  }
  return undefined;
}

function classifyCountry(value?: string): {
  country?: string;
  countryCode?: string;
  isInternational: boolean;
} {
  const normalized = normalize(value ?? "");
  if (!normalized) {
    return { isInternational: false };
  }
  if (/^(sverige|sweden)$/.test(normalized)) {
    return { country: value, countryCode: "SE", isInternational: false };
  }
  if (/^(norge|norway)$/.test(normalized)) {
    return { country: value, countryCode: "NO", isInternational: true };
  }
  if (/^(danmark|denmark)$/.test(normalized)) {
    return { country: value, countryCode: "DK", isInternational: true };
  }
  return { country: value, isInternational: true };
}

function withPage(url: string, page: number): string {
  const safe = normalizeStudentConsultingUrl(url);
  if (!safe) throw new Error("Unsafe StudentConsulting listing URL");
  if (page <= 1) return safe;

  const parsed = new URL(safe);
  parsed.searchParams.set("page", String(page));
  return parsed.toString();
}

function alreadyApplied(text: string): boolean {
  return /redan sökt|already applied|allerede søkt|allerede søgt/i.test(text);
}

function safeHostname(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

async function safeInnerText(locator: BrowserLocator): Promise<string> {
  try {
    return await locator.innerText();
  } catch {
    return "";
  }
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("sv-SE").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
