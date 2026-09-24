import { MONTHLY_APPLICATION_TARGET } from "../../../packages/core/src/types";
import { suitabilityConfigured, type SuitabilityEnv } from "./policy";
import {
  currentMonthKey,
  isApplicationAutomationWindow,
  previousMonthKey,
} from "./time";

export interface DashboardEnv extends SuitabilityEnv {
  STUDENTCONSULTING_EMAIL?: string;
  STUDENTCONSULTING_PASSWORD?: string;
  STUDENTCONSULTING_AUTOSUBMIT?: string;
  NOTIFY_EMAIL_TO?: string;
  NOTIFY_WEBHOOK_URL?: string;
}

interface QuotaSlotRow {
  slot_no: number;
  application_id: string | null;
  state: "free" | "reserved" | "submitted" | "verified" | "uncertain";
  updated_at: string | null;
}

export async function getDashboardData(db: D1Database, env: DashboardEnv) {
  const applicationMonth = currentMonthKey();
  const reportMonth = previousMonthKey();

  const [
    progress,
    quota,
    quotaRows,
    report,
    reportItems,
    runs,
    applications,
    notifications,
    reportActivities,
    failedRuns,
    failedNotifications,
    ambiguousReportItems,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS verified
         FROM applications
         WHERE report_month = ? AND status = 'verified'`,
      )
      .bind(applicationMonth)
      .first<{ verified: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS occupied
         FROM monthly_application_slots
         WHERE report_month = ? AND state <> 'free'`,
      )
      .bind(applicationMonth)
      .first<{ occupied: number }>(),
    db
      .prepare(
        `SELECT slot_no, application_id, state, updated_at
         FROM monthly_application_slots
         WHERE report_month = ?
         ORDER BY slot_no`,
      )
      .bind(applicationMonth)
      .all<QuotaSlotRow>(),
    db
      .prepare(
        `SELECT report_month, target_count, status, submitted_at, last_error, updated_at
         FROM reports WHERE report_month = ?`,
      )
      .bind(reportMonth)
      .first(),
    db
      .prepare(
        `SELECT
           SUM(CASE WHEN state = 'saved' THEN 1 ELSE 0 END) AS saved,
           COUNT(*) AS total
         FROM report_activity_items
         WHERE report_month = ?`,
      )
      .bind(reportMonth)
      .first<{ saved: number | null; total: number }>(),
    db
      .prepare(
        `SELECT r.id, r.mode, r.application_month, r.report_month, r.status,
                r.target_count, r.verified_count, r.auth_live_view_url,
                r.auth_expires_at, r.last_error, r.started_at, r.completed_at,
                r.updated_at,
                (SELECT p.status FROM integration_probes p
                 WHERE p.automation_run_id = r.id
                 LIMIT 1) AS probe_status,
                (SELECT p.error_message FROM integration_probes p
                 WHERE p.automation_run_id = r.id
                 LIMIT 1) AS probe_error
         FROM automation_runs r
         ORDER BY r.started_at DESC
         LIMIT 50`,
      )
      .all(),
    db
      .prepare(
        `SELECT a.id, a.automation_run_id, a.status, a.applied_at, a.verified_at,
                a.report_month, a.created_at, a.updated_at,
                j.external_id, j.title, j.employer, j.location, j.country_code,
                j.is_international, j.source_url,
                aa.error_code, aa.error_message,
                (SELECT COUNT(*) FROM evidence e WHERE e.application_id = a.id) AS evidence_count
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         LEFT JOIN application_attempts aa ON aa.id = (
           SELECT aa2.id FROM application_attempts aa2
           WHERE aa2.application_id = a.id
           ORDER BY aa2.attempt_no DESC LIMIT 1
         )
         ORDER BY COALESCE(a.verified_at, a.applied_at, a.created_at) DESC
         LIMIT 100`,
      )
      .all(),
    db
      .prepare(
        `SELECT id, automation_run_id, kind, channel, status, error_message, created_at
         FROM notifications
         ORDER BY created_at DESC
         LIMIT 50`,
      )
      .all(),
    db
      .prepare(
        `SELECT rai.application_id, rai.external_id, rai.state, rai.last_error, rai.updated_at,
                a.applied_at, a.verified_at,
                j.title, j.employer, j.location, j.country_code
         FROM report_activity_items rai
         JOIN applications a ON a.id = rai.application_id
         JOIN jobs j ON j.id = a.job_id
         WHERE rai.report_month = ?
         ORDER BY COALESCE(a.applied_at, a.created_at), rai.application_id`,
      )
      .bind(reportMonth)
      .all(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM automation_runs
         WHERE application_month = ? AND status = 'failed'`,
      )
      .bind(applicationMonth)
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM notifications
         WHERE status = 'failed'
           AND created_at >= datetime('now', '-30 days')`,
      )
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM report_activity_items
         WHERE report_month = ? AND state = 'save_attempted'`,
      )
      .bind(reportMonth)
      .first<{ count: number }>(),
  ]);

  const quotaSlots = Array.from({ length: MONTHLY_APPLICATION_TARGET }, (_, index) => {
    const slotNo = index + 1;
    return (
      quotaRows.results.find((slot) => Number(slot.slot_no) === slotNo) ?? {
        slot_no: slotNo,
        application_id: null,
        state: "free" as const,
        updated_at: null,
      }
    );
  });

  const uncertainSlots = quotaSlots.filter((slot) => slot.state === "uncertain").length;
  const activeRun = runs.results.find(
    (run) =>
      run &&
      typeof run === "object" &&
      "status" in run &&
      (run.status === "running" || run.status === "needs_user_auth"),
  );

  return {
    generatedAt: new Date().toISOString(),
    applicationMonth,
    reportMonth,
    target: MONTHLY_APPLICATION_TARGET,
    verified: Number(progress?.verified ?? 0),
    quotaUsed: Number(quota?.occupied ?? 0),
    quotaSlots,
    applicationWindowOpen: isApplicationAutomationWindow(),
    report: report ?? null,
    reportSaved: Number(reportItems?.saved ?? 0),
    reportItems: Number(reportItems?.total ?? 0),
    reportActivities: reportActivities.results,
    runs: runs.results,
    applications: applications.results,
    notifications: notifications.results,
    attention: {
      uncertainSlots,
      failedRuns: Number(failedRuns?.count ?? 0),
      failedNotifications: Number(failedNotifications?.count ?? 0),
      ambiguousReportItems: Number(ambiguousReportItems?.count ?? 0),
      activeRun: activeRun ?? null,
    },
    configuration: {
      studentConsultingCredentials: Boolean(
        env.STUDENTCONSULTING_EMAIL && env.STUDENTCONSULTING_PASSWORD,
      ),
      studentConsultingAutoSubmit:
        env.STUDENTCONSULTING_AUTOSUBMIT === "true",
      suitabilityPolicy: suitabilityConfigured(env),
      bankIdNotification: Boolean(
        env.NOTIFY_EMAIL_TO || env.NOTIFY_WEBHOOK_URL,
      ),
    },
    automaticMode: {
      enabled: true,
      schedule:
        "10–13:e varje månad, en gång per dag mellan 10:00–20:00 Europe/Stockholm",
      applicationWindow: "1–14:e varje månad",
    },
  };
}

export async function getRunDetail(db: D1Database, runId: string) {
  const run = await db
    .prepare(
      `SELECT id, mode, application_month, report_month, status, target_count,
              verified_count, workflow_instance_id, auth_live_view_url,
              auth_expires_at, last_notified_at, last_error, started_at,
              completed_at, updated_at
       FROM automation_runs
       WHERE id = ?`,
    )
    .bind(runId)
    .first();

  if (!run) return null;

  const [applications, attempts, evidence, notifications, probe] = await Promise.all([
    db
      .prepare(
        `SELECT a.id, a.status, a.applied_at, a.verified_at, a.report_month,
                a.created_at, a.updated_at,
                j.external_id, j.title, j.employer, j.location, j.country_code,
                j.is_international, j.source_url
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         WHERE a.automation_run_id = ?
         ORDER BY a.created_at, a.id`,
      )
      .bind(runId)
      .all(),
    db
      .prepare(
        `SELECT aa.id, aa.application_id, aa.attempt_no, aa.status,
                aa.error_code, aa.error_message, aa.started_at, aa.finished_at
         FROM application_attempts aa
         JOIN applications a ON a.id = aa.application_id
         WHERE a.automation_run_id = ?
         ORDER BY aa.started_at, aa.attempt_no`,
      )
      .bind(runId)
      .all(),
    db
      .prepare(
        `SELECT e.id, e.application_id, e.kind, e.object_key, e.sha256, e.created_at
         FROM evidence e
         JOIN applications a ON a.id = e.application_id
         WHERE a.automation_run_id = ?
         ORDER BY e.created_at`,
      )
      .bind(runId)
      .all(),
    db
      .prepare(
        `SELECT id, kind, channel, status, error_message, created_at
         FROM notifications
         WHERE automation_run_id = ?
         ORDER BY created_at`,
      )
      .bind(runId)
      .all(),
    db
      .prepare(
        `SELECT id, integration, status, page_url, object_key, summary_json,
                error_message, created_at, updated_at
         FROM integration_probes
         WHERE automation_run_id = ?
         LIMIT 1`,
      )
      .bind(runId)
      .first(),
  ]);

  return {
    run,
    applications: applications.results,
    attempts: attempts.results,
    evidence: evidence.results,
    notifications: notifications.results,
    probe: probe ?? null,
  };
}
