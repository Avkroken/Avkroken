export interface FilterConfig {
  blockedSenders: ReadonlySet<string>;
  blockedDomains: ReadonlySet<string>;
}

export function parseList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[\n,]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function senderDomain(sender: string): string {
  const normalized = sender.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return at >= 0 ? normalized.slice(at + 1) : "";
}

export function isNullReversePath(sender: string): boolean {
  const normalized = sender.trim();
  return normalized === "" || normalized === "<>";
}

export function isBlocked(sender: string, config: FilterConfig): boolean {
  const normalizedSender = sender.trim().toLowerCase();
  if (config.blockedSenders.has(normalizedSender)) {
    return true;
  }

  const domain = senderDomain(normalizedSender);
  if (!domain) {
    return false;
  }

  for (const blockedDomain of config.blockedDomains) {
    if (domain === blockedDomain || domain.endsWith(`.${blockedDomain}`)) {
      return true;
    }
  }

  return false;
}
