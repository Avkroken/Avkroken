import { oauthProvider } from "@better-auth/oauth-provider";
import { jwt } from "better-auth/plugins";

export const ACCOUNT_OPTIONS = {
  encryptOAuthTokens: true,
  storeStateStrategy: "database" as const,
  updateAccountOnSignIn: true,
  accountLinking: {
    enabled: true,
    disableImplicitLinking: true,
    trustedProviders: ["github", "cloudflare"],
    allowDifferentEmails: false,
  },
};

export const RATE_LIMIT_OPTIONS = {
  enabled: true,
  storage: "database" as const,
  window: 60,
  max: 100,
};

export const AUTH_IP_ADDRESS_HEADERS = [
  "cf-connecting-ip",
  "x-real-ip",
] as const;

export function createProtocolPlugins(
  issuer: string,
  clientPrivileges?: (context: { headers: Headers; action: string }) => Promise<boolean | undefined>,
) {
  const jwtPlugin = jwt({
    disableSettingJwtHeader: true,
    jwt: {
      issuer,
    },
    jwks: {
      keyPairConfig: { alg: "RS256" as const, modulusLength: 2048 },
    },
  });
  const providerPlugin = oauthProvider({
    loginPage: "/sign-in",
    consentPage: "/consent",
    scopes: ["openid", "profile", "email", "offline_access"],
    grantTypes: ["authorization_code", "refresh_token"],
    allowDynamicClientRegistration: false,
    allowUnauthenticatedClientRegistration: false,
    allowPublicClientPrelogin: false,
    clientRegistrationRequirePKCE: true,
    ...(clientPrivileges ? { clientPrivileges } : {}),
  });
  return [jwtPlugin, providerPlugin] as [typeof jwtPlugin, typeof providerPlugin];
}
