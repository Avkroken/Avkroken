import { betterAuth } from "better-auth";
import {
  ACCOUNT_OPTIONS,
  AUTH_IP_ADDRESS_HEADERS,
  createProtocolPlugins,
  RATE_LIMIT_OPTIONS,
} from "./auth-shared.ts";
import { scrubRootIdentityTokens } from "./account-policy.ts";
import type { RuntimeConfig } from "./config.ts";
import type { Env, RuntimeSecrets } from "./env.ts";
import { getAllowedGitHubUserInfo } from "./github.ts";

function safeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return diff === 0;
}

export function createAuth(env: Env, config: RuntimeConfig, secrets: RuntimeSecrets) {
  const socialProviders = {
    github: {
      clientId: env.KROSA_MAJA_GITHUB_CLIENT_ID,
      clientSecret: secrets.githubClientSecret,
      getUserInfo: async (token: { accessToken?: string }) =>
        getAllowedGitHubUserInfo(token.accessToken, config.allowedGitHubIds),
    },
    ...(config.cloudflare.enabled
      ? {
          cloudflare: {
            clientId: config.cloudflare.clientId,
            clientSecret: config.cloudflare.clientSecret,
            scope: [...config.cloudflare.scopes],
            disableSignUp: true,
          },
        }
      : {}),
  };

  return betterAuth({
    appName: "Krösa-Maja",
    baseURL: config.baseUrl,
    basePath: "/api/auth",
    secret: secrets.authSecret,
    database: env.AUTH_DB,
    emailAndPassword: { enabled: false },
    account: ACCOUNT_OPTIONS,
    rateLimit: RATE_LIMIT_OPTIONS,
    advanced: {
      ipAddress: {
        ipAddressHeaders: [...AUTH_IP_ADDRESS_HEADERS],
      },
    },
    databaseHooks: {
      account: {
        create: {
          before: async (account) => ({ data: scrubRootIdentityTokens(account) }),
        },
        update: {
          before: async (account) => ({ data: scrubRootIdentityTokens(account) }),
        },
      },
    },
    socialProviders,
    plugins: createProtocolPlugins(config.baseUrl, async ({ headers }) => {
      const marker = headers.get("x-krosa-maja-internal-admin") ?? "";
      return safeEqual(marker, secrets.internalAdminSecret);
    }),
  });
}

export type KrosaMajaAuth = ReturnType<typeof createAuth>;
