import { describe, expect, it } from "vitest";
import {
  applyRuntimeConfigurationMigration,
  RUNTIME_CONFIGURATION_MIGRATION_NAME,
  runtimeConfigurationMigrationReady,
} from "./runtime-migration";

interface FakeStatement {
  sql: string;
  values: unknown[];
  bind(...values: unknown[]): FakeStatement;
  first<T>(): Promise<T | null>;
}

function fakeDb(initial: { schema?: boolean; tracked?: boolean } = {}) {
  let schema = initial.schema ?? false;
  let tracked = initial.tracked ?? false;

  const db = {
    prepare(sql: string): FakeStatement {
      const statement: FakeStatement = {
        sql,
        values: [],
        bind(...values: unknown[]) {
          statement.values = values;
          return statement;
        },
        async first<T>() {
          if (sql.includes("schema_ready")) {
            return {
              schema_ready: schema ? 1 : 0,
              migration_tracked: tracked ? 1 : 0,
            } as T;
          }
          return null;
        },
      };
      return statement;
    },
    async batch(statements: FakeStatement[]) {
      for (const statement of statements) {
        if (statement.sql.includes("CREATE TABLE IF NOT EXISTS runtime_configuration")) {
          schema = true;
        }
        if (statement.sql.includes("INSERT OR IGNORE INTO d1_migrations")) {
          expect(statement.values).toEqual([
            RUNTIME_CONFIGURATION_MIGRATION_NAME,
          ]);
          tracked = true;
        }
      }
      return statements.map(() => ({ success: true }));
    },
  } as unknown as D1Database;

  return {
    db,
    state: () => ({ schema, tracked }),
  };
}

describe("runtime configuration migration", () => {
  it("reports not ready until both schema and migration tracking exist", async () => {
    const state = fakeDb();
    await expect(runtimeConfigurationMigrationReady(state.db)).resolves.toBe(
      false,
    );
  });

  it("applies schema and migration tracking atomically through D1 batch", async () => {
    const state = fakeDb();

    await applyRuntimeConfigurationMigration(state.db);

    expect(state.state()).toEqual({ schema: true, tracked: true });
    await expect(runtimeConfigurationMigrationReady(state.db)).resolves.toBe(
      true,
    );
  });

  it("is idempotent when the migration is already applied", async () => {
    const state = fakeDb({ schema: true, tracked: true });

    await applyRuntimeConfigurationMigration(state.db);

    expect(state.state()).toEqual({ schema: true, tracked: true });
  });
});
