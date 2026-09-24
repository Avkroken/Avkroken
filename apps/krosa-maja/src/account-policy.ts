export interface AccountLike {
  providerId?: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  refreshTokenExpiresAt?: Date | null;
  [key: string]: unknown;
}

/**
 * GitHub is the root identity proof, not a delegated API integration.
 * Do not persist its bearer token after the callback has established identity.
 * Cloudflare tokens are intentionally retained (encrypted by Better Auth) so
 * Krösa-Maja can perform explicitly granted Cloudflare API operations.
 */
export function scrubRootIdentityTokens<T extends AccountLike>(account: T): T {
  if (account.providerId !== "github") return account;
  return {
    ...account,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  };
}
