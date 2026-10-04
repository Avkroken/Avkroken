import { isBlocked, isNullReversePath, parseList, senderDomain } from "./filter";

interface Env {
  MAIL_FORWARD_TO: string;
  MAIL_DOMAIN: string;
  BLOCKED_SENDERS?: string;
  BLOCKED_DOMAINS?: string;
  REJECT_MESSAGE: string;
}

export default {
  async email(message, env: Env): Promise<void> {
    const domain = senderDomain(message.from);
    const nullReversePath = isNullReversePath(message.from);
    const blocked =
      nullReversePath ||
      isBlocked(message.from, {
        blockedSenders: parseList(env.BLOCKED_SENDERS),
        blockedDomains: parseList(env.BLOCKED_DOMAINS),
      });

    if (blocked) {
      console.warn({
        event: "email_rejected",
        reason: nullReversePath ? "null_reverse_path" : "blocklist",
        sender_domain: domain || "unknown",
        receiving_domain: env.MAIL_DOMAIN,
      });
      message.setReject(env.REJECT_MESSAGE);
      return;
    }

    console.log({
      event: "email_forwarded",
      sender_domain: domain || "unknown",
      receiving_domain: env.MAIL_DOMAIN,
    });
    await message.forward(env.MAIL_FORWARD_TO);
  },
} satisfies ExportedHandler<Env>;
