import {
  MONTHLY_APPLICATION_TARGET,
  type JobCandidate,
} from "../../../packages/core/src/types";
import type { ReportApplicationRow } from "./report-storage";

export interface ActivityReportExportRow {
  report_month: string;
  target_count: number;
  item_count: number;
  content_text: string;
  ready_at: string;
  created_at: string;
}

export function activityScope(
  rawJson: string | null,
  title: string,
): string {
  if (rawJson) {
    try {
      const job = JSON.parse(rawJson) as JobCandidate;
      const scope = job.scope?.trim();
      if (scope) return scope;
    } catch {
      // Old rows may contain malformed/legacy payloads. Fall through to title inference.
    }
  }

  const normalized = title.toLocaleLowerCase("sv-SE");
  if (/(^|[^a-zåäö])heltid([^a-zåäö]|$)/u.test(normalized)) return "Heltid";
  if (/(^|[^a-zåäö])deltid([^a-zåäö]|$)/u.test(normalized)) return "Deltid";
  return "Kontrollera annonsen";
}

export function buildActivityReportText(
  applications: readonly ReportApplicationRow[],
): string {
  return applications
    .map((application) =>
      [
        `Jobbsök-ID: ${application.externalId}`,
        `Yrkesroll: ${application.title}`,
        `Stad: ${application.location ?? ""}`,
        `Omfattning: ${activityScope(application.rawJson, application.title)}`,
      ].join("\n"),
    )
    .join("\n\n")
    .concat("\n");
}

export async function ensureMonthlyActivityExport(
  db: D1Database,
  reportMonth: string,
  applications: readonly ReportApplicationRow[],
): Promise<ActivityReportExportRow | null> {
  const existing = await getMonthlyActivityExport(db, reportMonth);
  if (existing) return existing;
  if (applications.length < MONTHLY_APPLICATION_TARGET) return null;

  const selected = applications.slice(0, MONTHLY_APPLICATION_TARGET);
  const readyAt = selected.reduce((latest, application) => {
    const value = application.verifiedAt ?? application.appliedAt;
    return Date.parse(value) > Date.parse(latest) ? value : latest;
  }, selected[0].verifiedAt ?? selected[0].appliedAt);

  await db
    .prepare(
      `INSERT OR IGNORE INTO activity_report_exports
       (report_month, target_count, item_count, content_text, ready_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      reportMonth,
      MONTHLY_APPLICATION_TARGET,
      selected.length,
      buildActivityReportText(selected),
      readyAt,
    )
    .run();

  return getMonthlyActivityExport(db, reportMonth);
}

export async function getMonthlyActivityExport(
  db: D1Database,
  reportMonth: string,
): Promise<ActivityReportExportRow | null> {
  return db
    .prepare(
      `SELECT report_month, target_count, item_count, content_text, ready_at, created_at
       FROM activity_report_exports
       WHERE report_month = ?`,
    )
    .bind(reportMonth)
    .first<ActivityReportExportRow>();
}
