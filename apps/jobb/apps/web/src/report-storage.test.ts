import { describe, expect, it, vi } from "vitest";
import {
  ensureReportActivityItems,
  loadVerifiedReportApplications,
} from "./report-storage";

describe("activity report storage", () => {
  it("allows a report month with no locally verified applications", async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return this;
          },
          async all() {
            return { results: [] };
          },
        };
      },
    } as unknown as D1Database;

    await expect(loadVerifiedReportApplications(db, "2026-09")).resolves.toEqual([]);
  });

  it("does not call D1 batch for an empty activity list", async () => {
    const batch = vi.fn();
    const db = { batch } as unknown as D1Database;

    await ensureReportActivityItems(db, "2026-09", []);
    expect(batch).not.toHaveBeenCalled();
  });
});
