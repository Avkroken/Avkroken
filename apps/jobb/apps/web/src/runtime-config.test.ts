import { describe, expect, it } from "vitest";
import {
  resolveRuntimeConfiguration,
  saveRuntimeConfiguration,
  type RuntimeConfigEnv,
} from "./runtime-config";

interface Row {
  ciphertext: string;
  iv: string;
  updated_at: string;
  updated_by_github_id: number | null;
}

function fakeDb(options: { missingTable?: boolean } = {}) {
  let row: Row | null = null;
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          values = args;
          return statement;
        },
        async first() {
          if (!sql.includes("FROM runtime_configuration")) return null;
          if (options.missingTable) {
            throw new Error(
              "D1_ERROR: no such table: runtime_configuration: SQLITE_ERROR",
            );
          }
          return row;
        },
        async run() {
          if (!sql.includes("INSERT INTO runtime_configuration")) {
            throw new Error("Unexpected SQL");
          }
          row = {
            ciphertext: String(values[1]),
            iv: String(values[2]),
            updated_at: "2026-09-30 22:00:00",
            updated_by_github_id: Number(values[4]),
          };
          return { success: true };
        },
      };
      return statement;
    },
  } as unknown as D1Database;

  return {
    db,
    storedRow: () => row,
  };
}

function env(db: D1Database): RuntimeConfigEnv {
  return {
    DB: db,
    EMAIL: {
      async send() {
        return { messageId: "test" };
      },
    },
    GITHUB_OAUTH_CLIENT_SECRET: {
      get: async () => "oauth-secret-used-only-for-key-derivation",
    },
  };
}

describe("dashboard-managed runtime configuration", () => {
  it("stores sensitive values encrypted and resolves them for automation", async () => {
    const state = fakeDb();
    const runtimeEnv = env(state.db);
    await saveRuntimeConfiguration(
      runtimeEnv,
      {
        studentConsulting: {
          email: "user@example.test",
          password: "example-password",
        },
        studentConsultingAutoSubmit: true,
        jobIncludeTerms: "supporttekniker, helpdesk",
        jobAllowedCountries: "se",
        notifyEmailTo: "user@example.test",
        notifyEmailFrom: "jobb@example.test",
        notifyWebhookUrl: "https://hooks.example.test/bankid",
        turnstileSecret: "turnstile-example-secret",
      },
      123,
    );

    const stored = state.storedRow();
    expect(stored).not.toBeNull();
    expect(stored?.ciphertext).not.toContain("example-password");
    expect(stored?.ciphertext).not.toContain("user@example.test");
    expect(stored?.updated_by_github_id).toBe(123);

    const resolved = await resolveRuntimeConfiguration(runtimeEnv);
    expect(resolved.env.STUDENTCONSULTING_EMAIL).toBe("user@example.test");
    expect(resolved.env.STUDENTCONSULTING_PASSWORD).toBe("example-password");
    expect(resolved.env.STUDENTCONSULTING_AUTOSUBMIT).toBe("true");
    expect(resolved.env.JOB_ALLOWED_COUNTRIES).toBe("SE");
    expect(resolved.env.TURNSTILE_SECRET).toBe("turnstile-example-secret");
    expect(resolved.view).toMatchObject({
      studentConsultingCredentials: true,
      studentConsultingCredentialsSource: "dashboard",
      studentConsultingAutoSubmit: true,
      suitabilityPolicy: true,
      bankIdNotification: true,
      notifyWebhookConfigured: true,
      turnstileConfigured: true,
      managedConfigurationStored: true,
    });
    expect(JSON.stringify(resolved.view)).not.toContain("example-password");
    expect(JSON.stringify(resolved.view)).not.toContain("turnstile-example-secret");
    expect(JSON.stringify(resolved.view)).not.toContain(
      "https://hooks.example.test/bankid",
    );
  });

  it("reports any configured extra suitability filter as active", async () => {
    const state = fakeDb();
    const runtimeEnv = env(state.db);

    await saveRuntimeConfiguration(
      runtimeEnv,
      { jobExcludeTerms: "senior" },
      123,
    );

    const resolved = await resolveRuntimeConfiguration(runtimeEnv);
    expect(resolved.view.suitabilityPolicy).toBe(true);
    expect(resolved.view.suitabilityPolicySource).toBe("dashboard");
  });

  it("keeps deployment values authoritative over dashboard values", async () => {
    const state = fakeDb();
    const runtimeEnv = env(state.db);

    await saveRuntimeConfiguration(
      runtimeEnv,
      {
        studentConsulting: {
          email: "managed@example.test",
          password: "managed-password",
        },
        studentConsultingAutoSubmit: true,
        jobIncludeTerms: "support",
      },
      123,
    );
    const resolved = await resolveRuntimeConfiguration({
      ...runtimeEnv,
      STUDENTCONSULTING_EMAIL: "deployment@example.test",
      STUDENTCONSULTING_PASSWORD: "deployment-password",
      STUDENTCONSULTING_AUTOSUBMIT: "false",
      JOB_INCLUDE_TERMS: "deployment-rule",
    });

    expect(resolved.env.STUDENTCONSULTING_EMAIL).toBe(
      "deployment@example.test",
    );
    expect(resolved.env.STUDENTCONSULTING_PASSWORD).toBe(
      "deployment-password",
    );
    expect(resolved.env.STUDENTCONSULTING_AUTOSUBMIT).toBe("false");
    expect(resolved.env.JOB_INCLUDE_TERMS).toBe("deployment-rule");
    expect(resolved.view.studentConsultingCredentialsSource).toBe(
      "deployment",
    );
    expect(resolved.view.studentConsultingAutoSubmitSource).toBe(
      "deployment",
    );
    expect(resolved.view.suitabilityPolicySource).toBe("deployment");
  });

  it("keeps the dashboard fail-closed when migration 0006 is unavailable", async () => {
    const state = fakeDb({ missingTable: true });
    const runtimeEnv = env(state.db);

    const resolved = await resolveRuntimeConfiguration(runtimeEnv);
    expect(resolved.view.managedConfigurationStorageReady).toBe(false);
    expect(resolved.view.studentConsultingCredentials).toBe(false);
    expect(resolved.env.STUDENTCONSULTING_PASSWORD).toBeUndefined();

    await expect(
      saveRuntimeConfiguration(
        runtimeEnv,
        {
          studentConsulting: {
            email: "user@example.test",
            password: "example-password",
          },
          jobIncludeTerms: "support",
        },
        123,
      ),
    ).rejects.toThrow(/0006_runtime_configuration/);
  });

  it("fails closed when autosubmit lacks StudentConsulting credentials", async () => {
    const state = fakeDb();
    await expect(
      saveRuntimeConfiguration(
        env(state.db),
        { studentConsultingAutoSubmit: true },
        123,
      ),
    ).rejects.toThrow(/Autosubmit/);
  });

  it("allows autosubmit without include terms when credentials are configured", async () => {
    const state = fakeDb();
    const runtimeEnv = env(state.db);

    await saveRuntimeConfiguration(
      runtimeEnv,
      {
        studentConsulting: {
          email: "user@example.test",
          password: "example-password",
        },
        studentConsultingAutoSubmit: true,
      },
      123,
    );

    const resolved = await resolveRuntimeConfiguration(runtimeEnv);
    expect(resolved.env.STUDENTCONSULTING_AUTOSUBMIT).toBe("true");
    expect(resolved.env.JOB_INCLUDE_TERMS).toBeUndefined();
    expect(resolved.view.studentConsultingCredentials).toBe(true);
    expect(resolved.view.suitabilityPolicy).toBe(false);
  });

  it("can recover safely after the OAuth encryption key rotates", async () => {
    const state = fakeDb();
    const original = env(state.db);

    await saveRuntimeConfiguration(
      original,
      {
        studentConsulting: {
          email: "old@example.test",
          password: "old-password",
        },
        studentConsultingAutoSubmit: true,
        jobIncludeTerms: "support",
      },
      123,
    );

    const rotated: RuntimeConfigEnv = {
      ...original,
      GITHUB_OAUTH_CLIENT_SECRET: {
        get: async () => "rotated-oauth-secret",
      },
    };
    const unreadable = await resolveRuntimeConfiguration(rotated);
    expect(unreadable.view.managedConfigurationUnreadable).toBe(true);
    expect(unreadable.view.studentConsultingCredentials).toBe(false);
    expect(unreadable.env.STUDENTCONSULTING_PASSWORD).toBeUndefined();

    await saveRuntimeConfiguration(
      rotated,
      {
        studentConsulting: {
          email: "new@example.test",
          password: "new-password",
        },
        studentConsultingAutoSubmit: true,
        jobIncludeTerms: "helpdesk",
      },
      456,
    );

    const recovered = await resolveRuntimeConfiguration(rotated);
    expect(recovered.view.managedConfigurationUnreadable).toBe(false);
    expect(recovered.view.studentConsultingCredentials).toBe(true);
    expect(recovered.env.STUDENTCONSULTING_EMAIL).toBe("new@example.test");
    expect(recovered.env.STUDENTCONSULTING_PASSWORD).toBe("new-password");
  });
});
