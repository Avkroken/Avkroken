import type { KrosaMajaAuth } from "./auth.ts";

interface RedirectPayload {
  redirect?: boolean;
  url?: string;
}

interface AuthPostResult {
  internal: Response;
  payload: RedirectPayload | null;
}

async function runAuthPost(
  auth: KrosaMajaAuth,
  request: Request,
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<AuthPostResult> {
  const headers = new Headers(request.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("Origin", new URL(baseUrl).origin);

  const internal = await auth.handler(
    new Request(`${baseUrl}/api/auth${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );

  if (!internal.ok) return { internal, payload: null };

  try {
    return {
      internal,
      payload: (await internal.clone().json()) as RedirectPayload,
    };
  } catch {
    return { internal, payload: null };
  }
}

function logRedirect(payload: RedirectPayload, baseUrl: string): void {
  if (!payload.url) return;
  try {
    const target = new URL(payload.url, baseUrl);
    console.info("Krösa-Maja auth redirect", {
      origin: target.origin,
      path: target.pathname,
      external: target.origin !== new URL(baseUrl).origin,
    });
  } catch {
    console.warn("Krösa-Maja auth redirect returned an invalid URL");
  }
}

export async function runAuthPostForRedirect(
  auth: KrosaMajaAuth,
  request: Request,
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const { internal, payload } = await runAuthPost(
    auth,
    request,
    baseUrl,
    path,
    body,
  );
  if (!internal.ok || !payload?.url) return internal;

  logRedirect(payload, baseUrl);
  const responseHeaders = new Headers(internal.headers);
  responseHeaders.set("Location", payload.url);
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(null, { status: 303, headers: responseHeaders });
}

export async function runAuthPostForJsonRedirect(
  auth: KrosaMajaAuth,
  request: Request,
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const { internal, payload } = await runAuthPost(
    auth,
    request,
    baseUrl,
    path,
    body,
  );
  if (!internal.ok || !payload?.url) return internal;

  logRedirect(payload, baseUrl);
  const responseHeaders = new Headers(internal.headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.delete("Location");
  return new Response(JSON.stringify({ url: payload.url }), {
    status: 200,
    headers: responseHeaders,
  });
}
