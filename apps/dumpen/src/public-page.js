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
  <title>Dumpen · Avkroken</title>
  <style>
    ${themeCss()}
    *{box-sizing:border-box}
    html{min-height:100%;background:var(--bg)}
    body{margin:0;min-height:100vh;overflow-x:hidden;color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55;background:radial-gradient(circle at top,var(--panel) 0,var(--bg) 34rem)}
    a{color:inherit}
    .shell{width:min(1180px,calc(100% - 36px));margin-inline:auto;padding:24px 0 72px}
    .topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;padding-bottom:8px}
    .brand-mini{display:flex;align-items:center;gap:10px;color:var(--subtle);font-size:.78rem;font-weight:750;letter-spacing:.18em;text-transform:uppercase}
    .brand-dot{width:11px;height:11px;border-radius:50%;background:linear-gradient(135deg,var(--green),var(--purple));box-shadow:0 0 20px color-mix(in srgb,var(--green) 58%,transparent)}
    .hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:clamp(30px,7vw,88px);align-items:center;padding:clamp(52px,10vw,118px) 0 70px}
    .eyebrow{display:flex;align-items:center;gap:10px;margin:0 0 16px;color:var(--muted);font:700 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.13em;text-transform:uppercase}
    .eyebrow::before{content:">_";color:var(--green)}
    h1{margin:0;font-size:clamp(3.4rem,10vw,7.4rem);line-height:.9;letter-spacing:.055em;font-weight:560}
    .gradient-text{background:linear-gradient(90deg,var(--green),#8edfff 46%,var(--purple));-webkit-background-clip:text;background-clip:text;color:transparent}
    .lead{max-width:720px;margin:24px 0 0;color:var(--muted);font-size:clamp(1rem,2vw,1.12rem);line-height:1.75}
    .manifesto{display:flex;flex-wrap:wrap;gap:9px;margin-top:26px}
    .manifesto span{padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:color-mix(in srgb,var(--panel) 72%,transparent);color:var(--subtle);font:650 .7rem/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em}
    .access-card{position:relative;overflow:hidden;padding:24px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(155deg,color-mix(in srgb,var(--panel) 94%,transparent),color-mix(in srgb,var(--bg-deep) 88%,transparent));box-shadow:0 28px 80px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.03)}
    .access-card::after{content:"";position:absolute;width:240px;height:240px;right:-110px;bottom:-140px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--green) 18%,transparent),transparent 68%);pointer-events:none}
    .access-card small{display:block;color:var(--green);font:700 .72rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}
    .access-card h2{margin:10px 0 12px;font-size:clamp(1.5rem,3vw,2.1rem);line-height:1.05;letter-spacing:-.035em}
    .access-card p{margin:0;color:var(--muted);line-height:1.7}
    .button-link{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:22px;padding:10px 15px;border:1px solid var(--line-strong);border-radius:10px;background:var(--control-bg);color:var(--control-text);font-weight:750;text-decoration:none}
    .button-link:hover{filter:brightness(1.06)}
    .section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;border-top:1px solid var(--line);padding-top:28px}
    .section-head h2{margin:0;font-size:clamp(1.35rem,3vw,2rem);letter-spacing:-.025em}
    .section-head p{max-width:650px;margin:6px 0 0;color:var(--muted)}
    .info-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding-top:18px}
    .info-card{padding:18px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--panel) 86%,transparent);box-shadow:0 18px 50px rgba(0,0,0,.15)}
    .info-card strong{display:block;margin-bottom:7px;font-size:.95rem}
    .info-card span{display:block;color:var(--muted);font-size:.82rem;line-height:1.6}
    .theme-control select{border-color:var(--line-strong)!important;border-radius:9px!important}
    footer{padding-top:46px;color:var(--muted);font-size:.76rem;text-align:center}
    a:focus-visible,select:focus-visible{outline:2px solid var(--green);outline-offset:2px}
    @media(max-width:800px){
      .hero{grid-template-columns:1fr;padding-top:54px}
      .access-card{max-width:560px}
      .info-grid{grid-template-columns:1fr}
    }
    @media(max-width:680px){
      .shell{width:min(100% - 20px,1180px);padding-top:18px}
      .brand-mini{font-size:.7rem}
      .hero{padding:40px 0 50px}
      h1{font-size:clamp(3rem,18vw,5.2rem)}
      .section-head{align-items:flex-start;flex-direction:column;gap:6px}
    }
  </style>
</head>
<body><main class="shell">
  <header class="topbar">
    <div class="brand-mini"><span class="brand-dot" aria-hidden="true"></span><span>Avkroken / Dumpen</span></div>
    ${themeControl()}
  </header>

  <section class="hero">
    <div>
      <p class="eyebrow">R2 · Transferer · Assets</p>
      <h1><span class="gradient-text">DUMPEN</span></h1>
      <p class="lead">Privat fil- och assetlager för Avkroken. Tillfälliga transferer hålls privata medan App Launcher-bilder och andra publika assets levereras via exakta <strong>logos.denied.se</strong>-länkar.</p>
      <div class="manifesto" aria-label="Dumpens egenskaper">
        <span>PRIVAT INVENTORY</span>
        <span>PUBLIKA ASSETS</span>
        <span>GITHUB-AUTH</span>
      </div>
    </div>
    <aside class="access-card">
      <small>Privat kontrollplan</small>
      <h2>Galleri, uppladdning och transferer bakom GitHub-inloggning.</h2>
      <p>Bucket-listor och driftmetadata exponeras inte publikt. Direktlänkar till kända asset-objekt fortsätter däremot fungera utan att inventoryt öppnas.</p>
      <a class="button-link" href="/admin">Öppna kontrollpanelen</a>
    </aside>
  </section>

  <section>
    <div class="section-head">
      <div><h2>Två lager, ett gränssnitt</h2><p>Dumpen håller transferflödet och det publika assetbiblioteket separerade men administrerar båda från samma privata vy.</p></div>
    </div>
    <div class="info-grid">
      <article class="info-card"><strong>Privata transferer</strong><span>Kortlivade upload-tickets och GitHub-skyddad objektåtkomst i <code>dumpen</code>.</span></article>
      <article class="info-card"><strong>Publika assets</strong><span>Beständiga appbilder och övriga assets i <code>avkroken-assets</code>.</span></article>
      <article class="info-card"><strong>Direktleverans</strong><span>Kända objekt kan nås via exakt <code>logos.denied.se/&lt;object-key&gt;</code> utan publik listning.</span></article>
    </div>
  </section>

  <footer>Avkroken · Dumpen · privat kontrollplan, publik assetleverans</footer>
</main>${themeScript()}</body>
</html>`;
}
