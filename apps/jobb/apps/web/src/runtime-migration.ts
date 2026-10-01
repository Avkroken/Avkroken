export const RUNTIME_CONFIGURATION_MIGRATION_NAME =
  "0006_runtime_configuration.sql";

const RUNTIME_CONFIGURATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS runtime_configuration (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
    updated_by_github_id INTEGER,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

export async function applyRuntimeConfigurationMigration(
  db: D1Database,
): Promise<void> {
  await db.batch([
    db.prepare(RUNTIME_CONFIGURATION_TABLE_SQL),
    db
      .prepare(
        "INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)",
      )
      .bind(RUNTIME_CONFIGURATION_MIGRATION_NAME),
  ]);

  if (!(await runtimeConfigurationMigrationReady(db))) {
    throw new Error(
      "Runtime configuration migration did not reach the expected schema state.",
    );
  }
}

export async function runtimeConfigurationMigrationReady(
  db: D1Database,
): Promise<boolean> {
  try {
    const state = await db
      .prepare(
        `SELECT
           EXISTS(
             SELECT 1
             FROM sqlite_schema
             WHERE type = 'table' AND name = 'runtime_configuration'
           ) AS schema_ready,
           EXISTS(
             SELECT 1
             FROM d1_migrations
             WHERE name = ?
           ) AS migration_tracked`,
      )
      .bind(RUNTIME_CONFIGURATION_MIGRATION_NAME)
      .first<{ schema_ready: number; migration_tracked: number }>();

    return (
      Number(state?.schema_ready ?? 0) === 1 &&
      Number(state?.migration_tracked ?? 0) === 1
    );
  } catch {
    return false;
  }
}
