import { themeControl, themeCss, themeScript } from "./theme.js";

export function publicPage() {
  return `<!doctype html>
<html lang="sv" data-theme="legacy">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#04070e">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>dumpen.denied.se</title>
  <style>
    ${themeCss()}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(180deg,var(--bg),var(--bg-deep));color:var(--text);font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace}
    main{width:min(760px,calc(100% - 32px));margin:auto;padding:40px 0 64px}.theme-row{display:flex;justify-content:flex-end;margin-bottom:26px}h1{font-size:clamp(30px,6vw,46px);font-weight:500;letter-spacing:-.04em;margin:0 0 18px}h1 span{color:var(--accent)}p{color:var(--muted)}.panel{margin-top:28px;padding:20px;border:1px solid var(--line);border-radius:9px;background:var(--panel)}a{display:inline-block;margin-top:10px;padding:10px 14px;border:1px solid var(--accent);border-radius:7px;color:var(--accent);text-decoration:none}
  </style>
</head>
<body><main>
  <div class="theme-row">${themeControl()}</div>
  <h1>dumpen.<span>denied</span>.se</h1>
  <p>Privat och tillfällig filöverföring. Uppladdning sker med kortlivade engångstickets och nedladdning kräver inloggning.</p>
  <section class="panel">
    <strong>Ingen driftmetadata visas publikt.</strong>
    <p>Objektlista, lagringsstatus, nedladdning och skapande av upload-tickets finns i den privata kontrollpanelen.</p>
    <a href="/admin">Öppna privat kontrollpanel</a>
  </section>
</main>${themeScript()}</body>
</html>`;
}
