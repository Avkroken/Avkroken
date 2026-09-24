import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { ACCOUNT_OPTIONS, createProtocolPlugins, RATE_LIMIT_OPTIONS } from "../src/auth-shared.ts";

/**
 * Schema-only config for Better Auth CLI.
 *
 * D1 is SQLite-compatible, but D1 bindings exist only inside Workers. The CLI
 * therefore uses Node's built-in SQLite solely to compile the schema. Runtime
 * configuration remains src/auth.ts. Schema-relevant account/plugin options are
 * imported from auth-shared.ts so they cannot silently diverge.
 */
export const auth = betterAuth({
  appName: "Krösa-Maja",
  baseURL: "https://schema.invalid",
  basePath: "/api/auth",
  secret: "schema-generation-only-secret-not-used-at-runtime",
  database: new DatabaseSync(":memory:"),
  emailAndPassword: { enabled: false },
  account: ACCOUNT_OPTIONS,
  rateLimit: RATE_LIMIT_OPTIONS,
  socialProviders: {
    github: {
      clientId: "schema-only",
      clientSecret: "schema-only",
    },
  },
  plugins: createProtocolPlugins(),
});

export default auth;
