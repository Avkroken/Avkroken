import type { KrosaMajaAuth } from "./auth.ts";

interface LinkedAccount {
  id?: string;
  providerId?: string;
}

export interface CloudflareUserSummary {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface CloudflareEnvelope {
  success?: boolean;
  result?: {
    id?: string;
    email?: string;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

export async function verifyCloudflareApiAccess(
  auth: KrosaMajaAuth,
  request: Request,
  accounts: readonly LinkedAccount[],
): Promise<CloudflareUserSummary> {
  const account = accounts.find((candidate) => candidate.providerId === "cloudflare");
  if (!account?.id) throw new Error("Cloudflare account is not linked");

  const token = await auth.api.getAccessToken({
    headers: request.headers,
    body: { accountId: account.id },
  });
  if (!token.accessToken) throw new Error("Cloudflare access token is unavailable");

  const response = await fetch("https://api.cloudflare.com/client/v4/user", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token.accessToken}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Cloudflare API returned ${response.status}`);

  const envelope = (await response.json()) as CloudflareEnvelope;
  const user = envelope.result;
  if (!envelope.success || !user?.id || !user.email) {
    throw new Error("Cloudflare API did not return a valid user profile");
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
  };
}
