import { publicAssetsCss, publicAssetsMarkup, publicAssetsScript } from "./public-assets-ui.js";
import { themeControl, themeCss, themeScript } from "./theme.js";

export function homePage(stats, limits) {
  const data = JSON.stringify({ stats, limits }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="sv" data-theme="legacy">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#04070e">
  <title>dumpen.denied.se</title>
  <style>
    ${themeCss()}
    ${publicAssetsCss()}
    *{box-sizing:border-box}
    html{min-height:100%;background:var(--bg)}
    body{margin:0;min-height:100vh;overflow-x:hidden;color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55;background:radial-gradient(circle at top,var(--panel) 0,var(--bg) 34rem)}
    a{color:inherit}
    main.shell{width:min(1180px,calc(100% - 36px));margin-inline:auto;padding:24px 0 72px}
    h1,h2,h3,p{margin-top:0}
    h2{margin:0;font-size:clamp(1.35rem,3vw,2rem);letter-spacing:-.025em}
    h3{margin-bottom:10px}
    code,.code,pre,th{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .accent{color:var(--green)}

    .topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 0 8px}
    .brand-mini{display:flex;align-items:center;gap:10px;color:var(--subtle);font-size:.78rem;font-weight:750;letter-spacing:.18em;text-transform:uppercase}
    .brand-dot{width:11px;height:11px;border-radius:50%;background:linear-gradient(135deg,var(--green),var(--purple));box-shadow:0 0 20px color-mix(in srgb,var(--green) 58%,transparent)}
    .topbar-actions{display:flex;align-items:center;gap:12px}
    .privacy-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:color-mix(in srgb,var(--bg-deep) 72%,transparent);font-size:.78rem;backdrop-filter:blur(12px)}
    .privacy-pill::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 12px color-mix(in srgb,var(--green) 72%,transparent)}

    .hero{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:clamp(28px,6vw,72px);align-items:end;padding:clamp(38px,7vw,86px) 0 54px}
    .eyebrow{display:flex;align-items:center;gap:10px;margin:0 0 15px;color:var(--muted);font:700 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.13em;text-transform:uppercase}
    .eyebrow::before{content:">_";color:var(--green)}
    .hero h1{margin:0;font-size:clamp(3.4rem,9vw,7rem);line-height:.9;letter-spacing:.055em;font-weight:560}
    .gradient-text{background:linear-gradient(90deg,var(--green),#8edfff 46%,var(--purple));-webkit-background-clip:text;background-clip:text;color:transparent}
    .hero-lead{max-width:720px;margin:22px 0 0;color:var(--muted);font-size:clamp(1rem,2vw,1.12rem);line-height:1.75}
    .manifesto{display:flex;flex-wrap:wrap;gap:9px;margin-top:24px}
    .manifesto span{padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:color-mix(in srgb,var(--panel) 72%,transparent);color:var(--subtle);font:650 .7rem/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em}
    .hero-card{padding:20px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(155deg,color-mix(in srgb,var(--panel) 92%,transparent),color-mix(in srgb,var(--bg-deep) 88%,transparent));box-shadow:0 24px 68px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.03)}
    .hero-card small{display:block;color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.08em}
    .hero-card strong{display:block;margin-top:7px;font-size:1.55rem;line-height:1.15;letter-spacing:-.03em}
    .hero-card p{margin:10px 0 0;color:var(--muted);font-size:.86rem;line-height:1.6}

    .section{padding-top:8px}
    .section-heading{display:flex;align-items:end;justify-content:space-between;gap:18px;border-top:1px solid var(--line);padding-top:28px;margin-top:8px;margin-bottom:18px}
    .section-heading p{margin:6px 0 0;color:var(--muted);max-width:680px}
    .section-kicker{color:var(--green);font:700 .72rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .step-card{padding:18px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--panel) 82%,transparent);box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
    .label{color:var(--muted);margin-bottom:9px;font-size:.8rem}
    .code{margin:0;padding:14px 15px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--bg-deep);border:1px solid var(--line);border-radius:11px;color:var(--text)}
    .notice{margin-top:14px;padding:13px 15px;border:1px solid var(--line);border-radius:12px;color:var(--muted);background:color-mix(in srgb,var(--panel) 78%,transparent)}

    .status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .stat{min-width:0;padding:16px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--panel) 88%,transparent);box-shadow:0 18px 50px rgba(0,0,0,.16)}
    .stat small{color:var(--muted);display:block;margin-bottom:9px;font-size:.8rem}
    .stat strong{display:block;color:var(--text);font-size:1.75rem;line-height:1.2;font-weight:760;letter-spacing:-.04em;overflow-wrap:anywhere}
    .stat:first-child strong{color:var(--green)}
    .stat em{display:block;color:var(--muted);font-style:normal;margin-top:7px;font-size:.76rem}
    .bar{height:6px;background:var(--panel-2);border-radius:99px;overflow:hidden;margin-top:12px}
    .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--green),var(--purple));border-radius:inherit}
    .limits{margin-top:12px;color:var(--muted);font-size:.78rem;text-align:center}

    .panel{margin-top:28px;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:color-mix(in srgb,var(--panel) 88%,transparent);box-shadow:0 18px 50px rgba(0,0,0,.2)}
    .panel-head{display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid var(--line)}
    .icon{width:23px;height:23px;color:var(--green);flex:0 0 auto}
    .admin{padding:18px 20px 20px}.admin>p{color:var(--muted);margin-bottom:13px}
    button,.button-link{font:inherit;border:1px solid var(--line-strong);background:var(--control-bg);color:var(--control-text);border-radius:10px;min-height:42px;padding:9px 13px;font-weight:700;cursor:pointer}
    button:hover,.button-link:hover{filter:brightness(1.06)}
    .button-link{display:inline-flex;align-items:center;text-decoration:none}
    .logout{background:transparent;color:var(--text);border-color:var(--line-strong);min-height:34px}
    .auth-state{margin-top:14px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--green) 30%,var(--line));background:color-mix(in srgb,var(--green) 7%,var(--bg-deep));border-radius:12px;color:var(--subtle)}
    .error{color:var(--danger)!important;min-height:23px;margin:8px 0 0}
    .objects{margin-top:14px;border:1px solid var(--line);border-radius:12px;overflow:hidden}
    .objects-head{min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;background:var(--panel);border-bottom:1px solid var(--line)}
    .badge{display:inline-block;margin-left:7px;border:1px solid var(--line-strong);border-radius:999px;padding:1px 8px;color:var(--text);background:transparent;font-size:12px;font-weight:650}
    .ticket{margin-top:14px;padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--bg-deep)}
    .ticket-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ticket .code{margin-top:12px}
    .table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:720px}th,td{padding:11px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:13px}th{color:var(--muted);background:var(--panel-2);font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em}td{color:var(--text)}tr:last-child td{border-bottom:0}
    .dl{color:var(--green);text-decoration:none;font-size:18px;background:none;border:0;min-height:0;padding:0}.dl:hover{color:var(--subtle)}
    .theme-control select{border-color:var(--line-strong)!important;border-radius:9px!important}
    footer{padding-top:42px;text-align:center;color:var(--muted);font-size:12px}
    a:focus-visible,button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--green);outline-offset:2px}

    @media(max-width:900px){
      .hero{grid-template-columns:1fr}
      .hero-card{max-width:560px}
      .status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media(max-width:680px){
      main.shell{width:min(100% - 20px,1180px);padding-top:18px}
      .topbar{align-items:flex-start}
      .brand-mini{font-size:.7rem}
      .privacy-pill{display:none}
      .topbar-actions{margin-left:auto}
      .hero{padding:38px 0 44px}
      .hero h1{font-size:clamp(3rem,17vw,5rem)}
      .grid{grid-template-columns:1fr}
      .section-heading{align-items:flex-start;flex-direction:column;gap:6px}
      .status-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .stat{padding:13px}
      .stat strong{font-size:1.45rem}
      .panel{margin-inline:-2px}
      .panel-head,.admin{padding-inline:14px}
    }
  </style>
</head>
<body><main class="shell">
  <header class="topbar">
    <div class="brand-mini"><span class="brand-dot" aria-hidden="true"></span><span>Avkroken / Dumpen</span></div>
    <div class="topbar-actions"><span class="privacy-pill">Privat fil- och assetlager</span>${themeControl()}</div>
  </header>

  <section class="hero">
    <div>
      <p class="eyebrow">R2 · Transferer · Assets</p>
      <h1><span class="gradient-text">DUMPEN</span></h1>
      <p class="hero-lead">Privat kontrollplan för transferer och publika assets på <span class="accent">denied.se</span>. Samma mörka Avkroken-formspråk som övriga tjänster, med Dumpens gröna produktaccent.</p>
      <div class="manifesto" aria-label="Dumpens huvudfunktioner">
        <span>ENGÅNGSTICKETS</span>
        <span>GITHUB-AUTH</span>
        <span>R2-ASSETS</span>
      </div>
    </div>
    <aside class="hero-card" aria-label="Åtkomstmodell">
      <small>Åtkomstmodell</small>
      <strong>Privat kontrollplan.<br>Publika assets.</strong>
      <p>Transferer hålls privata. Appbilder och andra publika assets levereras via exakta <span class="accent">logos.denied.se</span>-länkar utan publik bucket-listning.</p>
    </aside>
  </section>

  <section class="section">
    <div class="section-heading">
      <div><div class="section-kicker">Snabbflöde</div><h2>AI-upload med engångsticket</h2></div>
      <p>Logga in längre ned och skapa en kortlivad ticket. Dela bara upload-URL:en med AI:n — aldrig GitHub-sessionen eller den permanenta legacy-tokenen.</p>
    </div>
    <div class="grid">
      <div class="step-card"><div class="label">1. Skapa ticket efter inloggning</div><pre class="code">Ticketen gäller i ${limits.ticketTtlMinutes} minuter och kan användas en gång.</pre></div>
      <div class="step-card"><div class="label">2. AI:n laddar upp ZIP-filen</div><pre class="code">curl -s -X PUT \\
  --data-binary @fil.zip \\
  "$DUMPEN_UPLOAD_URL"</pre></div>
    </div>
    <div class="notice">ⓘ Ticket-upload förblir privat i <span class="accent">dumpen</span>. Publika filer och App Launcher-bilder hämtas från <span class="accent">avkroken-assets</span> och direktlänkas via <span class="accent">logos.denied.se</span>; bucketens inventory kan inte listas publikt.</div>
  </section>

  <section class="section">
    <div class="section-heading">
      <div><div class="section-kicker">Överblick</div><h2>Status</h2></div>
      <p>Aktuell användning av det privata transferlagret. Publika asset-filer hanteras separat och påverkar inte dessa siffror.</p>
    </div>
    <div class="status-grid">
      <div class="stat"><small>Privat transferlagring</small><strong id="storage">–</strong><em id="storage-sub">av 500 MB</em><div class="bar"><i id="storage-bar"></i></div></div>
      <div class="stat"><small>Privata objekt</small><strong id="count">–</strong><em>alla transfer-versioner</em></div>
      <div class="stat"><small>Äldsta privata objekt</small><strong id="oldest">–</strong><em>sedan</em></div>
      <div class="stat"><small>Radering</small><strong>Manuell</strong><em>ingen appstyrd auto-radering</em></div>
    </div>
    <div class="limits">Gränser: max 20 MB per fil • 500 MB appgräns per storageflöde • asset-direktlänkar är beständiga tills objektet ersätts eller tas bort</div>
  </section>

  <section class="panel">
    <div class="panel-head"><svg class="icon" style="color:var(--purple)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><h2>Privat kontrollpanel <span style="color:var(--muted);font-size:14px">(inloggning krävs)</span></h2></div>
    <div class="admin">
      <p>GitHub-inloggningen används för objektlistan, privata downloads, publika asset-uppladdningar och engångstickets. Provider-tokenen blir aldrig Dumpen-session.</p>
      ${limits.adminPage ? '<div class="auth-state">GitHub Auth verifierad · lokal signerad session aktiv</div>' : '<a class="button-link" href="/admin">Logga in med GitHub</a>'}
      <p id="err" class="error"></p>
      ${publicAssetsMarkup()}
      <div id="ticket" class="ticket">
        <div class="ticket-actions"><button id="create-ticket" type="button">Skapa upload-ticket</button><span id="ticket-status" style="color:var(--muted)"></span></div>
        <pre id="ticket-output" class="code" hidden></pre>
      </div>
      <div id="objects" class="objects"><div class="objects-head"><span>Privata transferer <span id="badge" class="badge"></span></span><button id="logout" class="logout" type="button">Logga ut</button></div><div class="table-wrap"><table><thead><tr><th>Namn</th><th>Storlek</th><th>Versioner</th><th>Äldsta version</th><th>Senast uppdaterad</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>
    </div>
  </section>
  <footer>Dumpen administrerar privata transferer i <code>dumpen</code> och publika assets i <code>avkroken-assets</code>. Asset-objekt kan läsas via sin exakta <code>logos.denied.se</code>-URL, men inventoryt är inte publikt.<br>Inget garanteras. Använd på egen risk.</footer>
</main>
${themeScript()}
<script>
const cfg=${data},stats=cfg.stats,limits=cfg.limits;
const $=s=>document.querySelector(s);
const bytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(n<10240?1:0)+' KB':(n/1048576).toFixed(n<10485760?1:0)+' MB';
const age=iso=>{const m=Math.max(0,Math.floor((Date.now()-new Date(iso))/60000));if(m<2)return'nyss';if(m<60)return m+' minuter sedan';const h=Math.floor(m/60);if(h<24)return h+(h===1?' timme sedan':' timmar sedan');const d=Math.floor(h/24);return d+(d===1?' dag sedan':' dagar sedan')};
const safe=n=>{try{return decodeURIComponent(n)}catch{return n}};
$('#storage').textContent=bytes(stats.totalBytes);const pct=Math.min(100,Math.round(stats.totalBytes/limits.maxBucketBytes*100));$('#storage-sub').textContent='av 500 MB ('+pct+'%)';$('#storage-bar').style.width=pct+'%';$('#count').textContent=stats.objectCount;$('#oldest').textContent=stats.oldestDays==null?'–':stats.oldestDays+(stats.oldestDays===1?' dag':' dagar');
if(limits.adminPage)loadObjects().catch(err=>{$('#err').textContent=err.message||'Kunde inte läsa kontrollpanelen.'});
async function loadObjects(){const r=await fetch('/admin/api/objects',{cache:'no-store',credentials:'same-origin'});if(r.status===401){location.assign('/login?return_to=%2Fadmin');return}if(r.status===503)throw new Error('GitHub-inloggningen är inte konfigurerad.');if(!r.ok)throw new Error('Kunde inte läsa objektlistan.');const data=await r.json();renderAssets(data.assets||[],data.assetState||'available');$('#rows').replaceChildren();for(const item of data.objects){const tr=document.createElement('tr');for(const value of [safe(item.name),bytes(item.latestSize),String(item.versions),age(item.oldestUploaded),age(item.latestUploaded)]){const td=document.createElement('td');td.textContent=value;tr.append(td)}const td=document.createElement('td'),button=document.createElement('button');button.className='dl';button.type='button';button.title='Hämta senaste';button.textContent='↓';button.addEventListener('click',()=>download(item.name));td.append(button);tr.append(td);$('#rows').append(tr)}$('#badge').textContent=data.objects.length+' namn'}
async function download(name){try{const r=await fetch('/admin/api/download/'+encodeURIComponent(name),{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('Kunde inte hämta filen.');const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=safe(name)+'.zip';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url)}catch(err){$('#err').textContent=err.message||'Nedladdningen misslyckades.'}}
${publicAssetsScript()}
$('#create-ticket')?.addEventListener('click',async()=>{$('#ticket-status').textContent='Skapar…';$('#ticket-output').hidden=true;try{const r=await fetch('/admin/api/tickets',{method:'POST',cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('Kunde inte skapa ticket.');const data=await r.json();$('#ticket-output').textContent=data.uploadUrl;$('#ticket-output').hidden=false;$('#ticket-status').textContent='Gäller till '+new Date(data.expiresAt).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})}catch(err){$('#ticket-status').textContent=err.message||'Ticket kunde inte skapas.'}});
$('#logout')?.addEventListener('click',async()=>{await fetch('/auth/logout',{method:'POST',credentials:'same-origin',cache:'no-store'});location.assign('/')});
</script></body></html>\n`;
}
