const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const bytes = Uint8Array.from(encoder.encode(value));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.buffer));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function canonicalEventIdForKey(idempotencyKey: string): Promise<string> {
  return `evt_${await sha256Hex(idempotencyKey)}`;
}

export async function canonicalContentHash(fingerprint: string): Promise<string> {
  return sha256Hex(fingerprint);
}
