import type { Env } from "./env";
import { organization } from "./env";
import {
  getGitHubInstallationMetadataLive,
  githubListAll,
  githubOptionalJson,
  mapLimit,
  type ListResult,
  type OptionalResult,
} from "./github";
import {
  recordCapabilityObservation,
  recordCapabilityScopeObservation,
  type CapabilityScopeObservationInput,
} from "./capabilities";
import { provenance, statusFromHttp } from "./observation-model";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeObject(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => safeObject(item, depth + 1));
  const input = record(value);
  if (!input) return null;
  const output: UnknownRecord = {};
  for (const [key, item] of Object.entries(input)) {
    if (/(secret|token|private[_-]?key|authorization|credential|password)/i.test(key)) continue;
    output[key] = safeObject(item, depth + 1);
  }
  return output;
}

function githubProviderFailure(error: unknown): OptionalResult<never> {
  return {
    available: false,
    value: null,
    status: 0,
    reason: error instanceof Error ? error.message : String(error),
    acceptedPermissions: null,
  };
}

function notSupportedSection(reason = "github_user_account_has_no_organization_scope"): Record<string, unknown> {
  return {
    status: "not_supported",
    available: false,
    httpStatus: null,
    acceptedPermissions: null,
    reason,
  };
}

function section<T>(result: OptionalResult<T> | ListResult<T>): Record<string, unknown> {
  if (!result.available) {
    return {
      status: result.status === 401 || result.status === 403 ? "permission_denied" : result.status === 0 ? "error" : "unknown",
      available: false,
      httpStatus: result.status,
      acceptedPermissions: result.acceptedPermissions,
      reason: result.status === 401 || result.status === 403
        ? "required_read_permission_not_granted"
        : result.status === 0
          ? "github_provider_request_failed"
          : `github_http_${result.status}`,
    };
  }
  return {
    status: "available",
    available: true,
    httpStatus: result.status,
    acceptedPermissions: result.acceptedPermissions,
    value: result.value,
    ...("truncated" in result ? { truncated: result.truncated } : {}),
  };
}

async function observeResult<T>(
  env: Env,
  capability: string,
  result: OptionalResult<T> | ListResult<T>,
): Promise<void> {
  await recordCapabilityObservation(env, capability, result.available
    ? {
      status: "available",
      permissionState: "granted",
      dataState: "available",
      httpStatus: result.status,
      acceptedPermissions: result.acceptedPermissions,
    }
    : {
      httpStatus: result.status,
      error: result.status === 0 ? "github-provider-request-failed" : `github-http-${result.status}`,
      acceptedPermissions: result.acceptedPermissions,
    });
}

function resultObservation<T>(
  scopeId: string,
  result: OptionalResult<T> | ListResult<T>,
): CapabilityScopeObservationInput {
  if (result.available) {
    return {
      scopeId,
      status: "available",
      permissionState: "granted",
      dataState: "available",
      httpStatus: result.status,
      acceptedPermissions: result.acceptedPermissions,
    };
  }
  return {
    scopeId,
    ...statusFromHttp(result.status),
    httpStatus: result.status,
    error: result.status === 0 ? "github-provider-request-failed" : `github-http-${result.status}`,
    acceptedPermissions: result.acceptedPermissions,
  };
}

function mergeObservationPermissions(
  observation: CapabilityScopeObservationInput,
  values: readonly (string | null | undefined)[],
): CapabilityScopeObservationInput {
  const acceptedPermissions = [...new Set(values
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item)))].join(" | ") || null;
  return { ...observation, acceptedPermissions };
}

export function normalizeRuleset(value: unknown, retrievedAt = new Date().toISOString()): Record<string, unknown> {
  const ruleset = record(value) ?? {};
  const sourceType = text(ruleset.source_type);
  const direct = sourceType === "Repository";
  return {
    id: integer(ruleset.id),
    name: text(ruleset.name),
    target: text(ruleset.target),
    enforcement: text(ruleset.enforcement),
    source: text(ruleset.source),
    sourceType,
    conditions: safeObject(ruleset.conditions),
    rules: array(ruleset.rules).map((item) => {
      const rule = record(item) ?? {};
      return { type: text(rule.type) ?? "unknown", parameters: safeObject(rule.parameters) };
    }),
    provenance: provenance({
      provider: "github",
      source: "repository-rulesets-api",
      scope: "repository",
      sourceId: integer(ruleset.id)?.toString() ?? null,
      direct,
      inherited: !direct,
      derived: false,
      retrievedAt,
    }),
  };
}

export function normalizeCustomPropertyDefinition(value: unknown): Record<string, unknown> {
  const item = record(value) ?? {};
  return {
    name: text(item.property_name),
    description: text(item.description),
    type: text(item.value_type),
    allowedValues: array(item.allowed_values).flatMap((entry) => text(entry) ? [text(entry)!] : []),
    defaultValue: safeObject(item.default_value),
    required: bool(item.required),
    requireExplicitValues: bool(item.require_explicit_values),
    valuesEditableBy: text(item.values_editable_by),
    source: text(item.source_type),
  };
}

export function normalizeSecurityConfiguration(value: unknown): Record<string, unknown> {
  const item = record(value) ?? {};
  const fields = [
    "advanced_security",
    "dependency_graph",
    "dependency_graph_autosubmit_action",
    "dependabot_alerts",
    "dependabot_security_updates",
    "code_scanning_default_setup",
    "code_scanning_delegated_alert_dismissal",
    "secret_scanning",
    "secret_scanning_push_protection",
    "secret_scanning_delegated_bypass",
    "secret_scanning_validity_checks",
    "secret_scanning_non_provider_patterns",
    "secret_scanning_generic_secrets",
    "secret_scanning_delegated_alert_dismissal",
    "private_vulnerability_reporting",
    "enforcement",
  ];
  const settings: UnknownRecord = {};
  for (const field of fields) settings[field] = safeObject(item[field]);
  return {
    id: integer(item.id),
    name: text(item.name),
    description: text(item.description),
    targetType: text(item.target_type),
    settings,
    createdAt: text(item.created_at),
    updatedAt: text(item.updated_at),
  };
}

export async function getGitHubOrganizationGovernance(env: Env): Promise<Record<string, unknown>> {
  const org = organization(env);
  let installation: Awaited<ReturnType<typeof getGitHubInstallationMetadataLive>>;
  try {
    installation = await getGitHubInstallationMetadataLive(env);
  } catch (error) {
    const unavailable = githubProviderFailure(error);
    await Promise.all([
      observeResult(env, "github.avkroken.organization.actions_permissions", unavailable),
      observeResult(env, "github.avkroken.custom_properties", unavailable),
      observeResult(env, "github.avkroken.security_configurations", unavailable),
    ]);
    return {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      organization: org,
      accountType: null,
      actions: {
        permissions: section(unavailable),
        selectedActions: section(unavailable),
        workflowPermissions: section(unavailable),
      },
      customProperties: {
        definitions: section(unavailable),
        assignments: section(unavailable),
      },
      securityConfigurations: {
        configurations: section(unavailable),
        defaults: section(unavailable),
      },
    };
  }
  if (installation.accountType?.toLowerCase() === "user") {
    const observation = {
      status: "not_supported" as const,
      permissionState: "not_required" as const,
      dataState: "not_supported" as const,
      httpStatus: null,
      error: "github-user-account-has-no-organization-scope",
      acceptedPermissions: null,
    };
    await Promise.all([
      recordCapabilityObservation(env, "github.avkroken.organization.actions_permissions", observation),
      recordCapabilityObservation(env, "github.avkroken.custom_properties", observation),
      recordCapabilityObservation(env, "github.avkroken.security_configurations", observation),
    ]);
    return {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      organization: org,
      accountType: installation.accountType,
      actions: {
        permissions: notSupportedSection(),
        selectedActions: notSupportedSection(),
        workflowPermissions: notSupportedSection(),
      },
      customProperties: {
        definitions: notSupportedSection(),
        assignments: notSupportedSection(),
      },
      securityConfigurations: {
        configurations: notSupportedSection(),
        defaults: notSupportedSection(),
      },
    };
  }
  const encoded = encodeURIComponent(org);
  const [
    actionsPermissions,
    selectedActions,
    workflowPermissions,
    propertySchema,
    propertyValues,
    securityConfigurations,
    securityDefaults,
  ] = await Promise.all([
    githubOptionalJson<UnknownRecord>(env, `/orgs/${encoded}/actions/permissions`),
    githubOptionalJson<UnknownRecord>(env, `/orgs/${encoded}/actions/permissions/selected-actions`),
    githubOptionalJson<UnknownRecord>(env, `/orgs/${encoded}/actions/permissions/workflow`),
    githubListAll<UnknownRecord>(env, `/orgs/${encoded}/properties/schema?per_page=100`, 5),
    githubListAll<UnknownRecord>(env, `/orgs/${encoded}/properties/values?per_page=100`, 20),
    githubListAll<UnknownRecord>(env, `/orgs/${encoded}/code-security/configurations?per_page=100`, 10),
    githubOptionalJson<unknown[]>(env, `/orgs/${encoded}/code-security/configurations/defaults`),
  ]);

  await Promise.all([
    observeResult(env, "github.avkroken.organization.actions_permissions", actionsPermissions),
    observeResult(env, "github.avkroken.custom_properties", propertySchema),
    observeResult(env, "github.avkroken.security_configurations", securityConfigurations),
  ]);

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    organization: org,
    actions: {
      permissions: section(actionsPermissions),
      selectedActions: section(selectedActions),
      workflowPermissions: section(workflowPermissions),
    },
    customProperties: {
      definitions: propertySchema.available
        ? { ...section(propertySchema), value: propertySchema.value.map(normalizeCustomPropertyDefinition) }
        : section(propertySchema),
      assignments: section(propertyValues),
    },
    securityConfigurations: {
      configurations: securityConfigurations.available
        ? { ...section(securityConfigurations), value: securityConfigurations.value.map(normalizeSecurityConfiguration) }
        : section(securityConfigurations),
      defaults: securityDefaults.available
        ? { ...section(securityDefaults), value: securityDefaults.value.map((item) => {
          const entry = record(item);
          return {
            defaultForNewRepos: text(entry?.default_for_new_repos),
            configuration: normalizeSecurityConfiguration(entry?.configuration),
          };
        }) }
        : section(securityDefaults),
    },
  };
}

export async function loadGitHubRepositoryEffectivePolicy(
  env: Env,
  repoName: string,
): Promise<{
  value: Record<string, unknown>;
  rulesetObservation: CapabilityScopeObservationInput;
}> {
  const org = organization(env);
  const scopeId = `${org}/${repoName}`;
  const encodedRepo = `${encodeURIComponent(org)}/${encodeURIComponent(repoName)}`;
  const retrievedAt = new Date().toISOString();
  let installation: Awaited<ReturnType<typeof getGitHubInstallationMetadataLive>>;
  try {
    installation = await getGitHubInstallationMetadataLive(env);
  } catch (error) {
    const unavailable = githubProviderFailure(error);
    const rulesetObservation = resultObservation(scopeId, unavailable);
    return {
      value: {
        schemaVersion: 2,
        generatedAt: retrievedAt,
        organization: org,
        repository: repoName,
        effectiveGovernance: {
          rulesets: section(unavailable),
          actions: {
            permissions: section(unavailable),
            selectedActions: section(unavailable),
            workflowPermissions: section(unavailable),
          },
          customProperties: section(unavailable),
          securityConfiguration: section(unavailable),
        },
      },
      rulesetObservation,
    };
  }
  const organizationOwned = installation.accountType?.toLowerCase() !== "user";
  const [rulesets, actions, selectedActions, workflowPermissions] = await Promise.all([
    githubListAll<UnknownRecord>(env, `/repos/${encodedRepo}/rulesets?includes_parents=true&per_page=100`, 5),
    githubOptionalJson<UnknownRecord>(env, `/repos/${encodedRepo}/actions/permissions`),
    githubOptionalJson<UnknownRecord>(env, `/repos/${encodedRepo}/actions/permissions/selected-actions`),
    githubOptionalJson<UnknownRecord>(env, `/repos/${encodedRepo}/actions/permissions/workflow`),
  ]);
  const [properties, securityConfiguration] = organizationOwned
    ? await Promise.all([
      githubOptionalJson<unknown[]>(env, `/repos/${encodedRepo}/properties/values`),
      githubOptionalJson<UnknownRecord>(env, `/repos/${encodedRepo}/code-security-configuration`),
    ])
    : [null, null];

  let rulesetObservation = resultObservation(scopeId, rulesets);
  let normalizedRulesets: Record<string, unknown>[] = [];
  const detailPermissions: Array<string | null> = [];

  if (rulesets.available) {
    const normalized = await mapLimit(rulesets.value, 3, async (summary) => {
      const id = integer(summary.id);
      if (!id) {
        return {
          value: normalizeRuleset(summary, retrievedAt),
          observation: null as CapabilityScopeObservationInput | null,
        };
      }
      const detail = await githubOptionalJson<UnknownRecord>(env, `/repos/${encodedRepo}/rulesets/${id}`);
      detailPermissions.push(detail.acceptedPermissions);
      return {
        value: normalizeRuleset(detail.available ? detail.value : summary, retrievedAt),
        observation: resultObservation(scopeId, detail),
      };
    });
    normalizedRulesets = normalized.map((item) => item.value);

    const detailFailure = normalized
      .map((item) => item.observation)
      .find((item): item is CapabilityScopeObservationInput => Boolean(item && item.status !== "available"));
    if (detailFailure) rulesetObservation = detailFailure;
    if (rulesets.truncated && rulesetObservation.status === "available") {
      rulesetObservation = {
        ...rulesetObservation,
        status: "unavailable",
        dataState: "unavailable",
        error: "github-rulesets-truncated",
      };
    }
    rulesetObservation = mergeObservationPermissions(
      rulesetObservation,
      [rulesets.acceptedPermissions, ...detailPermissions],
    );
  }

  const security = securityConfiguration
    ? securityConfiguration.available
      ? {
        ...section(securityConfiguration),
        value: {
          status: text(securityConfiguration.value.status),
          configuration: normalizeSecurityConfiguration(securityConfiguration.value.configuration),
        },
      }
      : section(securityConfiguration)
    : notSupportedSection();

  const value = {
    schemaVersion: 2,
    generatedAt: retrievedAt,
    organization: org,
    repository: repoName,
    effectiveGovernance: {
      rulesets: rulesets.available
        ? {
          status: rulesetObservation.status,
          direct: normalizedRulesets.filter((item) => record(item.provenance)?.direct === true),
          inherited: normalizedRulesets.filter((item) => record(item.provenance)?.inherited === true),
          effective: normalizedRulesets,
          truncated: rulesets.truncated,
          acceptedPermissions: rulesetObservation.acceptedPermissions,
        }
        : section(rulesets),
      actions: {
        permissions: section(actions),
        selectedActions: section(selectedActions),
        workflowPermissions: section(workflowPermissions),
      },
      customProperties: properties
        ? properties.available
          ? {
            ...section(properties),
            value: array(properties.value).map((propertyValue) => {
              const item = record(propertyValue) ?? {};
              return { property: text(item.property_name), value: safeObject(item.value), derived: false };
            }),
          }
          : section(properties)
        : notSupportedSection(),
      securityConfiguration: security,
    },
  };

  return { value, rulesetObservation };
}

export async function getGitHubRepositoryEffectivePolicy(
  env: Env,
  repoName: string,
): Promise<Record<string, unknown>> {
  const loaded = await loadGitHubRepositoryEffectivePolicy(env, repoName);
  await recordCapabilityScopeObservation(
    env,
    "github.avkroken.repositories.effective_rulesets",
    "repository",
    loaded.rulesetObservation,
  );
  return loaded.value;
}
