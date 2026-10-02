import { describe, expect, it } from "vitest";
import {
  activityScope,
  buildActivityReportText,
} from "./activity-export";
import type { ReportApplicationRow } from "./report-storage";

function row(overrides: Partial<ReportApplicationRow> = {}): ReportApplicationRow {
  return {
    applicationId: "app-1",
    externalId: "87567",
    title: "Kundservicemedarbetare – heltid i Malmö",
    employer: "StudentConsulting",
    location: "Malmö",
    countryCode: "SE",
    isInternational: false,
    appliedAt: "2026-10-02T12:27:23.119Z",
    verifiedAt: "2026-10-02T13:03:40.204Z",
    rawJson: JSON.stringify({ scope: "Heltid" }),
    ...overrides,
  };
}

describe("monthly activity export", () => {
  it("uses stored scope before title inference", () => {
    expect(activityScope(JSON.stringify({ scope: "Deltid/Extra" }), "Heltid i Malmö")).toBe(
      "Deltid/Extra",
    );
  });

  it("falls back to explicit scope wording in the title", () => {
    expect(activityScope(null, "Kundservicemedarbetare – heltid i Malmö")).toBe("Heltid");
    expect(activityScope(null, "Digital marknadsförare på deltid")).toBe("Deltid");
    expect(activityScope(null, "Terminalarbetare sökes")).toBe("Kontrollera annonsen");
  });

  it("produces the compact four-field txt without application dates", () => {
    const text = buildActivityReportText([
      row(),
      row({
        applicationId: "app-2",
        externalId: "87551",
        title: "Terminalarbetare sökes till Luleå",
        location: "Luleå",
        rawJson: JSON.stringify({ scope: "Deltid/Extra" }),
      }),
    ]);

    expect(text).toBe(
      "Jobbsök-ID: 87567\n" +
        "Yrkesroll: Kundservicemedarbetare – heltid i Malmö\n" +
        "Stad: Malmö\n" +
        "Omfattning: Heltid\n\n" +
        "Jobbsök-ID: 87551\n" +
        "Yrkesroll: Terminalarbetare sökes till Luleå\n" +
        "Stad: Luleå\n" +
        "Omfattning: Deltid/Extra\n",
    );
    expect(text).not.toContain("2026-10-02");
  });
});
