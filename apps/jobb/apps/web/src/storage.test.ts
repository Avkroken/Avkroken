import { describe, expect, it } from "vitest";
import {
  claimRunStart,
  failOrphanedRunningRuns,
  type AutomationRunRow,
} from "./storage";

function runRow(overrides: Partial<AutomationRunRow> = {}): AutomationRunRow {
  return {
    id: "scheduled:2026-10",
    mode: "scheduled",
    application_month: "2026-10",
    report_month: "2026-09",
    status: "running",
    target_count: 10,
    verified_count: 0,
    workflow_instance_id: null,
    auth_session_id: null,
    auth_live_view_url: null,
    auth_expires_at: null,
    last_notified_at: null,
    last_error: null,
    started_at: "2026-10-01 16:00:00",
    completed_at: null,
    updated_at: "2026-10-01 16:00:00",
    ...overrides,
  };
}

function claimDb(changes: number, row = runRow()) {
  const sql: string[] = [];
  const binds: unknown[][] = [];

  const db = {
    prepare(statement: string) {
      sql.push(statement);
      return {
        bind(...values: unknown[]) {
          binds.push(values);
          return this;
        },
        async run() {
          return { meta: { changes } };
        },
        async first() {
          return row;
        },
      };
    },
  } as unknown as D1Database;

  return { db, sql, binds };
}

describe("automation run claims", () => {
  it("uses one atomic statement to reject overlapping active runs", async () => {
    const fake = claimDb(0);

    await expect(
      claimRunStart(fake.db, {
        id: "manual:2026-10:test",
        mode: "manual",
        applicationMonth: "2026-10",
        reportMonth: "2026-09",
        targetCount: 10,
      }),
    ).resolves.toBeNull();

    expect(fake.sql).toHaveLength(1);
    expect(fake.sql[0]).toContain("WHERE NOT EXISTS");
    expect(fake.sql[0]).toContain("active.status IN ('running', 'needs_user_auth')");
    expect(fake.binds[0]).toEqual([
      "manual:2026-10:test",
      "manual",
      "2026-10",
      "2026-09",
      10,
    ]);
  });

  it("resets a failed stable run to clean running state when the atomic claim succeeds", async () => {
    const claimedRow = runRow();
    const fake = claimDb(1, claimedRow);

    await expect(
      claimRunStart(fake.db, {
        id: "scheduled:2026-10",
        mode: "scheduled",
        applicationMonth: "2026-10",
        reportMonth: "2026-09",
        targetCount: 10,
      }),
    ).resolves.toEqual(claimedRow);

    expect(fake.sql[0]).toContain("ON CONFLICT(id) DO UPDATE SET");
    expect(fake.sql[0]).toContain("status = 'running'");
    expect(fake.sql[0]).toContain("verified_count = 0");
    expect(fake.sql[0]).toContain("workflow_instance_id = NULL");
    expect(fake.sql[0]).toContain("auth_session_id = NULL");
    expect(fake.sql[0]).toContain("last_error = NULL");
    expect(fake.sql[0]).toContain("completed_at = NULL");
    expect(fake.sql[0]).toContain("WHERE automation_runs.status = 'failed'");
    expect(fake.sql[1]).toBe("SELECT * FROM automation_runs WHERE id = ?");
  });

  it("reconciles orphaned unlinked runs globally before a new claim", async () => {
    let statement = "";
    let bindCalled = false;
    const db = {
      prepare(sql: string) {
        statement = sql;
        return {
          bind() {
            bindCalled = true;
            return this;
          },
          async run() {
            return { meta: { changes: 0 } };
          },
        };
      },
    } as unknown as D1Database;

    await failOrphanedRunningRuns(db);

    expect(statement).toContain("status = 'running'");
    expect(statement).toContain("workflow_instance_id IS NULL");
    expect(statement).toContain("datetime('now', '-5 minutes')");
    expect(statement).toContain("NOT EXISTS");
    expect(statement).not.toContain("application_month = ?");
    expect(bindCalled).toBe(false);
  });
});
