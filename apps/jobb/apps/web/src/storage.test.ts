import { describe, expect, it } from "vitest";
import {
  claimRunStart,
  deleteRunRecords,
  failExpiredBankIdRuns,
  failOrphanedRunningRuns,
  isRetryablePreSubmitFailure,
  requeueFailedPreSubmitApplication,
  type ApplicationForJobRow,
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

function applicationRow(
  overrides: Partial<ApplicationForJobRow> = {},
): ApplicationForJobRow {
  return {
    id: "application:studentconsulting:87544",
    status: "failed",
    applied_at: null,
    verified_at: null,
    automation_run_id: "manual:old",
    report_month: "2026-10",
    ...overrides,
  };
}

describe("application retry state", () => {
  it("retries only definite pre-submit failures", () => {
    expect(
      isRetryablePreSubmitFailure(
        applicationRow({ automation_run_id: "manual:new" }),
        "manual:new",
      ),
    ).toBe(true);
    expect(
      isRetryablePreSubmitFailure(
        applicationRow({
          automation_run_id: "manual:new",
          applied_at: "2026-10-02T12:00:00Z",
        }),
        "manual:new",
      ),
    ).toBe(false);
    expect(
      isRetryablePreSubmitFailure(
        applicationRow({
          automation_run_id: "manual:new",
          verified_at: "2026-10-02T12:01:00Z",
        }),
        "manual:new",
      ),
    ).toBe(false);

    for (const status of [
      "queued",
      "applying",
      "submitted",
      "verified",
      "needs_user_action",
    ]) {
      expect(
        isRetryablePreSubmitFailure(
          applicationRow({
            automation_run_id: "manual:new",
            status,
          }),
          "manual:new",
        ),
      ).toBe(false);
    }

    expect(
      isRetryablePreSubmitFailure(
        applicationRow({ automation_run_id: "manual:other" }),
        "manual:new",
      ),
    ).toBe(false);
  });

  it("atomically requeues only one definite pre-submit failed application", async () => {
    const fake = claimDb(1);

    await expect(
      requeueFailedPreSubmitApplication(fake.db, {
        id: "application:studentconsulting:87544",
        runId: "manual:new",
        reportMonth: "2026-10",
      }),
    ).resolves.toBe(true);

    expect(fake.sql).toHaveLength(1);
    expect(fake.sql[0]).toContain("SET status = 'queued'");
    expect(fake.sql[0]).toContain("automation_run_id = ?");
    expect(fake.sql[0]).toContain("report_month = ?");
    expect(fake.sql[0]).toContain("status = 'failed'");
    expect(fake.sql[0]).toContain("applied_at IS NULL");
    expect(fake.sql[0]).toContain("verified_at IS NULL");
    expect(fake.binds[0]).toEqual([
      "2026-10",
      "application:studentconsulting:87544",
      "manual:new",
    ]);
  });

  it("rejects a lost retry race when no failed row was changed", async () => {
    const fake = claimDb(0);

    await expect(
      requeueFailedPreSubmitApplication(fake.db, {
        id: "application:studentconsulting:87544",
        runId: "manual:new",
        reportMonth: "2026-10",
      }),
    ).resolves.toBe(false);
  });
});

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

  it("expires stale BankID handoffs before a new claim", async () => {
    let statement = "";
    const db = {
      prepare(sql: string) {
        statement = sql;
        return {
          async run() {
            return { meta: { changes: 1 } };
          },
        };
      },
    } as unknown as D1Database;

    await failExpiredBankIdRuns(db);

    expect(statement).toContain("status = 'needs_user_auth'");
    expect(statement).toContain("auth_expires_at IS NULL");
    expect(statement).toContain("datetime(auth_expires_at) IS NULL");
    expect(statement).toContain("datetime(auth_expires_at) <= datetime('now')");
    expect(statement).toContain("status = 'failed'");
    expect(statement).toContain("auth_session_id = NULL");
    expect(statement).toContain("auth_live_view_url = NULL");
  });

  it("deletes only run-scoped auxiliary records and the run row", async () => {
    const statements: string[] = [];
    const binds: unknown[][] = [];
    let batchSize = 0;
    const db = {
      prepare(sql: string) {
        statements.push(sql);
        return {
          bind(...values: unknown[]) {
            binds.push(values);
            return this;
          },
        };
      },
      async batch(items: unknown[]) {
        batchSize = items.length;
        return [];
      },
    } as unknown as D1Database;

    await deleteRunRecords(db, "manual:test");

    expect(batchSize).toBe(3);
    expect(statements).toEqual([
      "DELETE FROM notifications WHERE automation_run_id = ?",
      "DELETE FROM integration_probes WHERE automation_run_id = ?",
      "DELETE FROM automation_runs WHERE id = ?",
    ]);
    expect(binds).toEqual([["manual:test"], ["manual:test"], ["manual:test"]]);
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
