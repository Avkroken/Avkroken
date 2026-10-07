const encoder = new TextEncoder();
const SIGNATURE_PREFIX = "sha256=";

function bytesFromHex(value: string): Uint8Array | null {
  if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function verifyGitHubSignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature?.startsWith(SIGNATURE_PREFIX) || !secret) return false;
  const provided = bytesFromHex(signature.slice(SIGNATURE_PREFIX.length));
  if (!provided) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, provided, encoder.encode(body));
}

export function secureEqual(left: string | null, right: string): boolean {
  if (!left || !right) return false;
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const max = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < max; index += 1) {
    mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return mismatch === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
