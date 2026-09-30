import { resolveGitHubClientSecret, type GitHubSecretValue } from "./github-auth";
import type { EmailBinding } from "./notifier";

const CONFIG_ID = 1;
const CONFIG_VERSION = 1;
const ENCRYPTION_SALT = "Avkroken/Jobb/RuntimeConfig/v1";
const ENCRYPTION_INFO = "d1-runtime-configuration";
const AAD = new TextEncoder().encode("Avkroken/Jobb/runtime-config/v1");

class RuntimeConfigurationDecryptionError extends Error {}
class RuntimeConfigurationStorageUnavailableError extends Error {}

export interface RuntimeConfigValues {
  STUDENTCONSULTING_EMAIL?: string;
  STUDENTCONSULTING_PASSWORD?: string;
  STUDENTCONSULTING_AUTOSUBMIT?: string;
  JOB_INCLUDE_TERMS?: string;
  JOB_EXCLUDE_TERMS?: string;
  JOB_ALLOWED_LOCATIONS?: string;
  JOB_ALLOWED_COUNTRIES?: string;
  NOTIFY_EMAIL_TO?: string;
  NOTIFY_EMAIL_FROM?: string;
  NOTIFY_WEBHOOK_URL?: string;
  PUBLIC_BASE_URL?: string;
  TURNSTILE_SECRET?: string;
}

export interface RuntimeConfigEnv extends RuntimeConfigValues {
  DB: D1Database;
  EMAIL?: EmailBinding;
  GITHUB_OAUTH_CLIENT_SECRET?: GitHubSecretValue;
}
export type RuntimeConfigSource =
  | "deployment"
  | "dashboard"
  | "mixed"
  | "missing";

interface ManagedRuntimeConfiguration {
  studentConsultingEmail?: string;
  studentConsultingPassword?: string;
  studentConsultingAutoSubmit?: boolean;
  jobIncludeTerms?: string;
  jobExcludeTerms?: string;
  jobAllowedLocations?: string;
  jobAllowedCountries?: string;
  notifyEmailTo?: string;
  notifyEmailFrom?: string;
  notifyWebhookUrl?: string;
  turnstileSecret?: string;
}

interface StoredRuntimeConfiguration extends ManagedRuntimeConfiguration {
  v: 1;
}

interface RuntimeConfigurationRow {
  ciphertext: string;
  iv: string;
  updated_at: string;
  updated_by_github_id: number | null;
}
export interface RuntimeConfigurationView {
  studentConsultingCredentials: boolean;
  studentConsultingCredentialsSource: RuntimeConfigSource;
  studentConsultingAutoSubmit: boolean;
  studentConsultingAutoSubmitSource: RuntimeConfigSource;
  suitabilityPolicy: boolean;
  suitabilityPolicySource: RuntimeConfigSource;
  jobIncludeTerms: string;
  jobExcludeTerms: string;
  jobAllowedLocations: string;
  jobAllowedCountries: string;
  bankIdNotification: boolean;
  bankIdNotificationSource: RuntimeConfigSource;
  notifyEmailTo: string;
  notifyEmailFrom: string;
  notifyWebhookConfigured: boolean;
  turnstileConfigured: boolean;
  turnstileSource: RuntimeConfigSource;
  managedConfigurationStored: boolean;
  managedConfigurationUnreadable: boolean;
  managedConfigurationStorageReady: boolean;
  updatedAt: string | null;
}

export interface RuntimeConfigurationUpdate {
  studentConsulting?: {
    email: string;
    password: string;
  };
  studentConsultingAutoSubmit?: boolean;
  jobIncludeTerms?: string;
  jobExcludeTerms?: string;
  jobAllowedLocations?: string;
  jobAllowedCountries?: string;
  notifyEmailTo?: string;
  notifyEmailFrom?: string;
  notifyWebhookUrl?: string;
  turnstileSecret?: string;
}

export interface ResolvedRuntimeConfiguration<T extends RuntimeConfigEnv> {
  env: T;
  view: RuntimeConfigurationView;
}

export async function resolveRuntimeConfiguration<T extends RuntimeConfigEnv>(
  env: T,
): Promise<ResolvedRuntimeConfiguration<T>> {
  let stored: (StoredRuntimeConfiguration & { updatedAt?: string }) | null = null;
  let managedConfigurationUnreadable = false;
  let managedConfigurationStorageReady = true;
  try {
    stored = await loadManagedRuntimeConfiguration(env);
  } catch (error) {
    if (error instanceof RuntimeConfigurationDecryptionError) {
      managedConfigurationUnreadable = true;
    } else if (error instanceof RuntimeConfigurationStorageUnavailableError) {
      managedConfigurationStorageReady = false;
    } else {
      throw error;
    }
  }

  const effective = {
    ...env,
    STUDENTCONSULTING_EMAIL: preferDeployment(
      env.STUDENTCONSULTING_EMAIL,
      stored?.studentConsultingEmail,
    ),
    STUDENTCONSULTING_PASSWORD: preferDeployment(
      env.STUDENTCONSULTING_PASSWORD,
      stored?.studentConsultingPassword,
    ),
    STUDENTCONSULTING_AUTOSUBMIT: preferDeployment(
      env.STUDENTCONSULTING_AUTOSUBMIT,
      stored?.studentConsultingAutoSubmit === undefined
        ? undefined
        : stored.studentConsultingAutoSubmit
          ? "true"
          : "false",
    ),
    JOB_INCLUDE_TERMS: preferDeployment(
      env.JOB_INCLUDE_TERMS,
      stored?.jobIncludeTerms,
    ),
    JOB_EXCLUDE_TERMS: preferDeployment(
      env.JOB_EXCLUDE_TERMS,
      stored?.jobExcludeTerms,
    ),
    JOB_ALLOWED_LOCATIONS: preferDeployment(
      env.JOB_ALLOWED_LOCATIONS,
      stored?.jobAllowedLocations,
    ),
    JOB_ALLOWED_COUNTRIES: preferDeployment(
      env.JOB_ALLOWED_COUNTRIES,
      stored?.jobAllowedCountries,
    ),
    NOTIFY_EMAIL_TO: preferDeployment(
      env.NOTIFY_EMAIL_TO,
      stored?.notifyEmailTo,
    ),
    NOTIFY_EMAIL_FROM: preferDeployment(
      env.NOTIFY_EMAIL_FROM,
      stored?.notifyEmailFrom,
    ),
    NOTIFY_WEBHOOK_URL: preferDeployment(
      env.NOTIFY_WEBHOOK_URL,
      stored?.notifyWebhookUrl,
    ),
    TURNSTILE_SECRET: preferDeployment(
      env.TURNSTILE_SECRET,
      stored?.turnstileSecret,
    ),
  } as T;

  return {
    env: effective,
    view: buildConfigurationView(
      env,
      effective,
      stored,
      managedConfigurationUnreadable,
      managedConfigurationStorageReady,
    ),
  };
}

export async function saveRuntimeConfiguration(
  env: RuntimeConfigEnv,
  update: RuntimeConfigurationUpdate,
  updatedByGithubId: number,
): Promise<void> {
  let existing: (StoredRuntimeConfiguration & { updatedAt?: string }) | null = null;
  try {
    existing = await loadManagedRuntimeConfiguration(env);
  } catch (error) {
    if (!(error instanceof RuntimeConfigurationDecryptionError)) throw error;
  }
  const next: StoredRuntimeConfiguration = {
    ...(existing ?? {}),
    v: 1,
  };

  if (update.studentConsulting !== undefined) {
    const email = normalizeEmail(
      update.studentConsulting.email,
      "StudentConsulting e-post",
    );
    const password = update.studentConsulting.password.trim();
    if (!password || password.length > 512) {
      throw new Error(
        "StudentConsulting-lösenord måste anges och vara högst 512 tecken.",
      );
    }
    next.studentConsultingEmail = email;
    next.studentConsultingPassword = update.studentConsulting.password;
  }
  if (update.studentConsultingAutoSubmit !== undefined) {
    next.studentConsultingAutoSubmit = update.studentConsultingAutoSubmit;
  }
  if (update.jobIncludeTerms !== undefined) {
    next.jobIncludeTerms = normalizeCsv(update.jobIncludeTerms, 2000);
  }
  if (update.jobExcludeTerms !== undefined) {
    next.jobExcludeTerms = normalizeCsv(update.jobExcludeTerms, 2000);
  }
  if (update.jobAllowedLocations !== undefined) {
    next.jobAllowedLocations = normalizeCsv(update.jobAllowedLocations, 2000);
  }
  if (update.jobAllowedCountries !== undefined) {
    next.jobAllowedCountries = normalizeCountries(update.jobAllowedCountries);
  }
  if (update.notifyEmailTo !== undefined) {
    next.notifyEmailTo = optionalEmail(
      update.notifyEmailTo,
      "Notifieringsmottagare",
    );
  }
  if (update.notifyEmailFrom !== undefined) {
    next.notifyEmailFrom = optionalEmail(
      update.notifyEmailFrom,
      "Notifieringsavsändare",
    );
  }
  if (update.notifyWebhookUrl !== undefined) {
    next.notifyWebhookUrl = normalizeWebhook(update.notifyWebhookUrl);
  }
  if (update.turnstileSecret !== undefined) {
    const secret = update.turnstileSecret.trim();
    if (!secret || secret.length > 512) {
      throw new Error(
        "Turnstile-hemligheten måste anges och vara högst 512 tecken.",
      );
    }
    next.turnstileSecret = update.turnstileSecret;
  }

  validateEffectiveConfiguration(env, next);

  const secret = await resolveGitHubClientSecret(env);
  const key = await deriveEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(next));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: AAD },
    key,
    plaintext,
  );

  await env.DB.prepare(
    `INSERT INTO runtime_configuration
       (id, ciphertext, iv, schema_version, updated_by_github_id, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       ciphertext = excluded.ciphertext,
       iv = excluded.iv,
       schema_version = excluded.schema_version,
       updated_by_github_id = excluded.updated_by_github_id,
       updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(
      CONFIG_ID,
      base64url(ciphertext),
      base64url(iv),
      CONFIG_VERSION,
      updatedByGithubId,
    )
    .run();
}

async function loadManagedRuntimeConfiguration(
  env: RuntimeConfigEnv,
): Promise<(StoredRuntimeConfiguration & { updatedAt?: string }) | null> {
  let row: RuntimeConfigurationRow | null;
  try {
    row = await env.DB.prepare(
      `SELECT ciphertext, iv, updated_at, updated_by_github_id
       FROM runtime_configuration
       WHERE id = ?`,
    )
      .bind(CONFIG_ID)
      .first<RuntimeConfigurationRow>();
  } catch (error) {
    if (isMissingRuntimeConfigurationTable(error)) {
      throw new RuntimeConfigurationStorageUnavailableError(
        "Runtime-konfigurationslagret är inte initierat. D1-migration 0006_runtime_configuration.sql måste appliceras av en auktoriserad Cloudflare-identitet.",
      );
    }
    throw error;
  }
  if (!row) return null;

  const secret = await resolveGitHubClientSecret(env);
  const key = await deriveEncryptionKey(secret);
  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64url(row.iv),
        additionalData: AAD,
      },
      key,
      decodeBase64url(row.ciphertext),
    );
  } catch {
    throw new RuntimeConfigurationDecryptionError(
      "Den lagrade runtime-konfigurationen kunde inte dekrypteras.",
    );
  }

  const parsed = JSON.parse(
    new TextDecoder().decode(decrypted),
  ) as StoredRuntimeConfiguration;
  if (parsed.v !== CONFIG_VERSION) {
    throw new Error(
      "Den lagrade runtime-konfigurationen har en okänd version.",
    );
  }
  return { ...parsed, updatedAt: row.updated_at };
}

function buildConfigurationView(
  deployment: RuntimeConfigEnv,
  effective: RuntimeConfigEnv,
  stored: (StoredRuntimeConfiguration & { updatedAt?: string }) | null,
  managedConfigurationUnreadable: boolean,
  managedConfigurationStorageReady: boolean,
): RuntimeConfigurationView {
  const credentialsSource = pairSource(
    deployment.STUDENTCONSULTING_EMAIL,
    deployment.STUDENTCONSULTING_PASSWORD,
    stored?.studentConsultingEmail,
    stored?.studentConsultingPassword,
  );
  const emailNotificationConfigured = Boolean(
    effective.EMAIL &&
      effective.NOTIFY_EMAIL_TO &&
      effective.NOTIFY_EMAIL_FROM,
  );
  const webhookConfigured = Boolean(effective.NOTIFY_WEBHOOK_URL);

  return {
    studentConsultingCredentials: Boolean(
      effective.STUDENTCONSULTING_EMAIL &&
        effective.STUDENTCONSULTING_PASSWORD,
    ),
    studentConsultingCredentialsSource: credentialsSource,
    studentConsultingAutoSubmit:
      effective.STUDENTCONSULTING_AUTOSUBMIT === "true",
    studentConsultingAutoSubmitSource: sourceOf(
      deployment.STUDENTCONSULTING_AUTOSUBMIT,
      stored?.studentConsultingAutoSubmit,
    ),
    suitabilityPolicy: csv(effective.JOB_INCLUDE_TERMS).length > 0,
    suitabilityPolicySource: sourceOf(
      deployment.JOB_INCLUDE_TERMS,
      stored?.jobIncludeTerms,
    ),
    jobIncludeTerms: effective.JOB_INCLUDE_TERMS ?? "",
    jobExcludeTerms: effective.JOB_EXCLUDE_TERMS ?? "",
    jobAllowedLocations: effective.JOB_ALLOWED_LOCATIONS ?? "",
    jobAllowedCountries: effective.JOB_ALLOWED_COUNTRIES ?? "",
    bankIdNotification: emailNotificationConfigured || webhookConfigured,
    bankIdNotificationSource: notificationSource(deployment, stored),
    notifyEmailTo: effective.NOTIFY_EMAIL_TO ?? "",
    notifyEmailFrom: effective.NOTIFY_EMAIL_FROM ?? "",
    notifyWebhookConfigured: webhookConfigured,
    turnstileConfigured: Boolean(effective.TURNSTILE_SECRET),
    turnstileSource: sourceOf(
      deployment.TURNSTILE_SECRET,
      stored?.turnstileSecret,
    ),
    managedConfigurationStored: Boolean(stored),
    managedConfigurationUnreadable,
    managedConfigurationStorageReady,
    updatedAt: stored?.updatedAt ?? null,
  };
}

function validateEffectiveConfiguration(
  deployment: RuntimeConfigEnv,
  stored: StoredRuntimeConfiguration,
): void {
  const email = preferDeployment(
    deployment.STUDENTCONSULTING_EMAIL,
    stored.studentConsultingEmail,
  );
  const password = preferDeployment(
    deployment.STUDENTCONSULTING_PASSWORD,
    stored.studentConsultingPassword,
  );
  const includeTerms = preferDeployment(
    deployment.JOB_INCLUDE_TERMS,
    stored.jobIncludeTerms,
  );
  const autosubmit = preferDeployment(
    deployment.STUDENTCONSULTING_AUTOSUBMIT,
    stored.studentConsultingAutoSubmit === undefined
      ? undefined
      : stored.studentConsultingAutoSubmit
        ? "true"
        : "false",
  );
  if (
    autosubmit === "true" &&
    (!email || !password || csv(includeTerms).length === 0)
  ) {
    throw new Error(
      "Autosubmit kan bara aktiveras när StudentConsulting-konto och minst en inkluderande lämplighetsregel är konfigurerade.",
    );
  }

  const notifyTo = preferDeployment(
    deployment.NOTIFY_EMAIL_TO,
    stored.notifyEmailTo,
  );
  const notifyFrom = preferDeployment(
    deployment.NOTIFY_EMAIL_FROM,
    stored.notifyEmailFrom,
  );
  if (Boolean(notifyTo) !== Boolean(notifyFrom)) {
    throw new Error(
      "E-postnotifiering kräver både mottagare och avsändare.",
    );
  }
}
function preferDeployment<T>(
  deployment: T | undefined,
  managed: T | undefined,
): T | undefined {
  return deployment !== undefined && deployment !== "" ? deployment : managed;
}

function sourceOf(
  deployment: unknown,
  managed: unknown,
): RuntimeConfigSource {
  if (deployment !== undefined && deployment !== "") return "deployment";
  if (managed !== undefined && managed !== "") return "dashboard";
  return "missing";
}

function pairSource(
  firstDeployment: unknown,
  secondDeployment: unknown,
  firstManaged: unknown,
  secondManaged: unknown,
): RuntimeConfigSource {
  const first = sourceOf(firstDeployment, firstManaged);
  const second = sourceOf(secondDeployment, secondManaged);
  if (first === second) return first;
  if (first === "missing" && second === "missing") return "missing";
  return "mixed";
}

function notificationSource(
  deployment: RuntimeConfigEnv,
  stored: StoredRuntimeConfiguration | null,
): RuntimeConfigSource {
  const deploymentConfigured = Boolean(
    (deployment.NOTIFY_EMAIL_TO && deployment.NOTIFY_EMAIL_FROM) ||
      deployment.NOTIFY_WEBHOOK_URL,
  );
  const managedConfigured = Boolean(
    (stored?.notifyEmailTo && stored?.notifyEmailFrom) ||
      stored?.notifyWebhookUrl,
  );
  if (deploymentConfigured && managedConfigured) return "mixed";
  if (deploymentConfigured) return "deployment";
  if (managedConfigured) return "dashboard";
  return "missing";
}

function normalizeCsv(value: string, maxLength: number): string {
  const normalized = csv(value).join(",");
  if (normalized.length > maxLength) {
    throw new Error(
      `Konfigurationsvärdet får vara högst ${maxLength} tecken.`,
    );
  }
  return normalized;
}

function normalizeCountries(value: string): string {
  const countries = csv(value).map((item) => item.toUpperCase());
  if (countries.some((item) => !/^[A-Z]{2}$/.test(item))) {
    throw new Error(
      "Tillåtna länder ska anges som tvåställiga landskoder, till exempel SE,NO,DK.",
    );
  }
  return countries.join(",");
}
function csv(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmail(value: string, label: string): string {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new Error(`${label} är inte en giltig e-postadress.`);
  }
  return normalized;
}

function optionalEmail(
  value: string,
  label: string,
): string | undefined {
  const normalized = value.trim();
  return normalized ? normalizeEmail(normalized, label) : undefined;
}

function normalizeWebhook(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > 2048) {
    throw new Error("Webhook-URL får vara högst 2048 tecken.");
  }
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Webhook-URL är ogiltig.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(
      "Webhook-URL måste använda HTTPS och får inte innehålla inloggningsuppgifter.",
    );
  }
  return url.toString();
}

async function deriveEncryptionKey(secret: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(ENCRYPTION_SALT),
      info: new TextEncoder().encode(ENCRYPTION_INFO),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
function base64url(input: ArrayBuffer | Uint8Array): string {
  const bytes =
    input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function isMissingRuntimeConfigurationTable(error: unknown): boolean {
  return (
    error instanceof Error &&
    /no such table:\s*runtime_configuration/i.test(error.message)
  );
}

function decodeBase64url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
