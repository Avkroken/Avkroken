export function securityHeaders(contentType = "text/html; charset=utf-8"): Headers {
  return new Headers({
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
}

export function htmlHeaders(): Headers {
  const headers = securityHeaders();
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data: https://avatars.githubusercontent.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
  return headers;
}

export function jsonResponse(value: unknown, status = 200): Response {
  const headers = securityHeaders("application/json; charset=utf-8");
  return new Response(JSON.stringify(value), { status, headers });
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
