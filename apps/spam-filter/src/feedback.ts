import PostalMime from "postal-mime";
import type { Email } from "postal-mime";

export type FeedbackLabel = "spam" | "legitimate";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function feedbackLabelForRecipient(
  recipient: string,
  mailDomain: string,
  spamLocalpart: string,
  legitimateLocalpart: string,
): FeedbackLabel | null {
  const normalizedRecipient = normalize(recipient);
  const domain = normalize(mailDomain);

  if (normalizedRecipient === normalize(spamLocalpart) + "@" + domain) {
    return "spam";
  }

  if (normalizedRecipient === normalize(legitimateLocalpart) + "@" + domain) {
    return "legitimate";
  }

  return null;
}

export function isAuthorizedFeedbackSender(
  sender: string,
  forwardDestination: string,
): boolean {
  return normalize(sender) === normalize(forwardDestination);
}

export async function extractAttachedOriginal(
  feedbackEmail: Email,
): Promise<Email | null> {
  for (const attachment of feedbackEmail.attachments) {
    const filename = (attachment.filename ?? "").toLowerCase();
    const mimeType = attachment.mimeType.toLowerCase();

    if (mimeType !== "message/rfc822" && !filename.endsWith(".eml")) {
      continue;
    }

    try {
      return await PostalMime.parse(attachment.content, {
        maxNestingDepth: 64,
        maxHeadersSize: 512 * 1024,
        maxRfc822NestingDepth: 3,
      });
    } catch {
      continue;
    }
  }

  return null;
}


const FORWARDED_MARKERS = [
  "begin forwarded message",
  "forwarded message",
  "vidarebefordrat meddelande",
  "vidarebefordrat brev",
];

export function extractInlineForwardedSender(
  text: string | undefined,
): string | null {
  if (!text) {
    return null;
  }

  const normalized = text.replace(/\r\n/g, "\n");
  const lower = normalized.toLowerCase();
  const markerPositions = FORWARDED_MARKERS
    .map((marker) => lower.indexOf(marker))
    .filter((position) => position >= 0);
  const start = markerPositions.length > 0 ? Math.min(...markerPositions) : 0;
  const candidate = normalized.slice(start, start + 4000);

  const match = candidate.match(
    /^(?:from|från):\s*.*?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/im,
  );

  return match?.[1]?.toLowerCase() ?? null;
}
