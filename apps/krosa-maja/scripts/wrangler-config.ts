import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const WRANGLER_CONFIG_PATH = resolve("wrangler.jsonc");
export const GENERATED_WRANGLER_CONFIG_PATH = resolve(".wrangler.generated.jsonc");
export const D1_BINDING = "AUTH_DB";
export const D1_DATABASE_NAME = "krosa-maja-auth";
export const VALIDATION_DATABASE_ID = "00000000-0000-0000-0000-000000000000";

interface D1ListItem {
  name: string;
  id: string;
}

interface D1Binding {
  binding?: unknown;
  database_name?: unknown;
  database_id?: unknown;
  [key: string]: unknown;
}

interface WranglerConfig {
  d1_databases?: D1Binding[];
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of ["result", "databases", "d1_databases"]) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export function parseD1ListJson(value: string): D1ListItem[] {
  const parsed = JSON.parse(value) as unknown;
  return extractRows(parsed).flatMap((row) => {
    if (!isRecord(row) || typeof row.name !== "string") return [];
    const rawId = row.uuid ?? row.id ?? row.database_id;
    if (typeof rawId !== "string" || rawId.length === 0) return [];
    return [{ name: row.name, id: rawId }];
  });
}

export function selectDatabaseId(databases: readonly D1ListItem[], name = D1_DATABASE_NAME): string | null {
  const matches = databases.filter((database) => database.name === name);
  if (matches.length > 1) {
    throw new Error(`More than one D1 database is named ${name}; refusing an ambiguous deployment`);
  }
  return matches[0]?.id ?? null;
}

export function loadBaseWranglerConfig(path = WRANGLER_CONFIG_PATH): WranglerConfig {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isRecord(parsed)) throw new Error("wrangler.jsonc must contain a JSON object");
  return parsed as WranglerConfig;
}

export function renderWranglerConfig(databaseId: string, config = loadBaseWranglerConfig()): string {
  if (!databaseId.trim()) throw new Error("A D1 database ID is required");
  const bindings = config.d1_databases;
  if (!Array.isArray(bindings)) throw new Error("wrangler.jsonc must declare d1_databases");

  let found = 0;
  const renderedBindings = bindings.map((binding) => {
    if (binding.binding !== D1_BINDING) return binding;
    found += 1;
    if (binding.database_name !== D1_DATABASE_NAME) {
      throw new Error(`${D1_BINDING} must target ${D1_DATABASE_NAME}`);
    }
    if (binding.database_id !== undefined) {
      throw new Error("Do not commit an account-specific D1 database_id to wrangler.jsonc");
    }
    return { ...binding, database_id: databaseId };
  });

  if (found !== 1) {
    throw new Error(`wrangler.jsonc must declare exactly one ${D1_BINDING} D1 binding`);
  }

  return `${JSON.stringify({ ...config, d1_databases: renderedBindings }, null, 2)}\n`;
}

export function writeGeneratedWranglerConfig(databaseId: string): string {
  writeFileSync(GENERATED_WRANGLER_CONFIG_PATH, renderWranglerConfig(databaseId), {
    encoding: "utf8",
    mode: 0o600,
  });
  return GENERATED_WRANGLER_CONFIG_PATH;
}

export function removeGeneratedWranglerConfig(): void {
  rmSync(GENERATED_WRANGLER_CONFIG_PATH, { force: true });
}
