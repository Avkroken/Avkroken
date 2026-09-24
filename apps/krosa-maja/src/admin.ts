import type { KrosaMajaAuth } from "./auth.ts";
import type { RuntimeConfig } from "./config.ts";

interface AccountView {
  id?: string;
  providerId?: string;
  accountId?: string;
  scopes?: readonly string[];
}

export async function listAccounts(auth: KrosaMajaAuth, request: Request): Promise<AccountView[]> {
  const accounts = await auth.api.listUserAccounts({ headers: request.headers });
  return accounts as AccountView[];
}

export async function requireAdmin(
  auth: KrosaMajaAuth,
  request: Request,
  config: RuntimeConfig,
): Promise<{ accounts: AccountView[] } | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const accounts = await listAccounts(auth, request);
  const github = accounts.find((account) => account.providerId === "github");
  if (!github?.accountId || !config.adminGitHubIds.has(String(github.accountId))) return null;
  return { accounts };
}

export function splitUris(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((uri) => uri.trim())
    .filter(Boolean);
}
