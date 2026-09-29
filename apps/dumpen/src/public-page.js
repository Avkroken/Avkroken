export function publicPage() {
  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>dumpen.denied.se</title>
  <style>
    :root{color-scheme:dark;--bg:#050505;--panel:#0b0b0d;--line:#252529;--text:#f4f4f5;--muted:#a1a1aa;--accent:#6ee71e}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace}
    main{width:min(760px,calc(100% - 32px));margin:auto;padding:64px 0}h1{font-size:clamp(30px,6vw,46px);font-weight:500;letter-spacing:-.04em;margin:0 0 18px}h1 span{color:var(--accent)}p{color:var(--muted)}.panel{margin-top:28px;padding:20px;border:1px solid var(--line);border-radius:9px;background:var(--panel)}a{display:inline-block;margin-top:10px;padding:10px 14px;border:1px solid var(--accent);border-radius:7px;color:var(--accent);text-decoration:none}
  </style>
</head>
<body><main>
  <h1>dumpen.<span>denied</span>.se</h1>
  <p>Privat och tillfällig filöverföring. Uppladdning sker med kortlivade engångstickets och nedladdning kräver inloggning.</p>
  <section class="panel">
    <strong>Ingen driftmetadata visas publikt.</strong>
    <p>Objektlista, lagringsstatus, nedladdning och skapande av upload-tickets finns i den privata kontrollpanelen.</p>
    <a href="/admin">Öppna privat kontrollpanel</a>
  </section>
</main></body>
</html>`;
}
