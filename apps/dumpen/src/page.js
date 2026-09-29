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
    *{box-sizing:border-box}html{background:var(--bg)}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -15%,var(--glow) 0,var(--bg) 36%,var(--bg-deep) 100%);color:var(--text);font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace}
    main{width:min(1040px,calc(100% - 32px));margin:auto;padding:34px 0 42px}.theme-row{display:flex;justify-content:flex-end;margin-bottom:22px}header{padding-bottom:30px;border-bottom:1px solid var(--line)}h1,h2,p{margin-top:0}h1{font-size:clamp(30px,5vw,44px);line-height:1;letter-spacing:-.04em;margin-bottom:16px;font-weight:500}h1 span,.accent{color:var(--green)}h2{font-size:21px;font-weight:500;margin:0}.lead{color:var(--subtle);max-width:760px;margin:0}.section{padding-top:34px}.title{display:flex;align-items:center;gap:12px;margin-bottom:22px}.icon{width:25px;height:25px;color:var(--green);flex:0 0 auto}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 24px}.label{color:var(--subtle);margin-bottom:7px;font-size:13px}pre{font:inherit}.code{margin:0;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--bg-deep);border:1px solid var(--line);border-radius:7px;color:var(--text)}.notice{margin-top:20px;padding:12px 15px;border:1px solid var(--line);border-radius:7px;color:var(--muted);background:var(--panel)}
    .panel{margin-top:26px;background:linear-gradient(180deg,var(--panel),var(--bg-deep));border:1px solid var(--line);border-radius:9px;overflow:hidden}.panel-head{display:flex;align-items:center;gap:12px;padding:18px 20px}.stats{display:grid;grid-template-columns:repeat(4,1fr);padding:4px 20px 20px}.stat{min-width:0;padding:13px 20px;border-right:1px solid var(--line)}.stat:first-child{padding-left:6px}.stat:last-child{border-right:0}.stat small{color:var(--muted);display:block;margin-bottom:4px}.stat strong{display:block;color:var(--green);font-size:25px;line-height:1.35;font-weight:500}.stat em{display:block;color:var(--muted);font-style:normal;margin-top:5px;font-size:13px}.bar{height:7px;background:var(--panel-2);border-radius:99px;overflow:hidden;margin-top:12px}.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--green),var(--green2));border-radius:inherit}.limits{border-top:1px solid var(--line);color:var(--muted);padding:13px 20px;text-align:center;font-size:13px}
    .admin{padding:0 20px 20px}.admin p{color:var(--muted);margin-bottom:13px}button{font:inherit;border-radius:6px;min-height:43px;cursor:pointer;padding:0 16px;color:var(--green);background:var(--bg-deep);border:1px solid var(--green2)}button:hover{background:var(--panel-2)}.logout{color:#c29aff;border-color:#6e48a1;min-height:34px}.auth-state{margin-top:14px;padding:14px 16px;border:1px solid #31501f;background:#080b07;border-radius:7px;color:#b6dca1}.error{color:var(--danger)!important;min-height:23px;margin:8px 0 0}.objects{margin-top:14px;border:1px solid var(--line);border-radius:7px;overflow:hidden}.objects-head{min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;background:var(--panel);border-bottom:1px solid var(--line)}.badge{display:inline-block;margin-left:7px;color:var(--green);background:#13210c;border-radius:999px;padding:1px 8px;font-size:12px}.ticket{margin-top:14px;padding:16px;border:1px solid #31501f;border-radius:7px;background:#080b07}.ticket-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ticket .code{margin-top:12px}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:720px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:13px}th{color:var(--muted);background:var(--panel-2);font-weight:500}td{color:var(--text)}tr:last-child td{border-bottom:0}.dl{color:var(--green);text-decoration:none;font-size:18px;background:none;border:0;min-height:0;padding:0}.dl:hover{color:#97ff4c}footer{padding-top:34px;text-align:center;color:var(--muted);font-size:12px}
    @media(max-width:760px){main{padding-top:34px}.grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}.stat:nth-child(2){border-right:0}.stat:nth-child(3){border-top:1px solid var(--line);padding-left:6px}.stat:nth-child(4){border-top:1px solid var(--line)}}
  </style>
</head>
<body><main>
  <div class="theme-row">${themeControl()}</div>
  <header>
    <h1>dumpen.<span>denied</span>.se</h1>
    <p class="lead">Privat och tillfällig filöverföring via HTTP.<br>AI-klienter laddar upp med en kortlivad <span class="accent">engångsticket</span>. Nedladdning kräver din inloggning.</p>
  </header>

  <section class="section">
    <div class="title"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V3m0 0 4 4m-4-4L8 7M5 14v5h14v-5"/></svg><h2>AI-upload med engångsticket</h2></div>
    <p class="lead" style="margin-bottom:20px">Logga in längre ned och skapa en upload-ticket. Ge endast den kortlivade URL:en till AI:n — aldrig GitHub-sessionen eller den permanenta legacy upload-tokenen.</p>
    <div class="grid">
      <div><div class="label">1. Skapa ticket efter inloggning</div><pre class="code">Ticketen gäller i ${limits.ticketTtlMinutes} minuter och kan användas en gång.</pre></div>
      <div><div class="label">2. AI:n laddar upp ZIP-filen</div><pre class="code">curl -s -X PUT \\
  --data-binary @fil.zip \\
  "$DUMPEN_UPLOAD_URL"</pre></div>
    </div>
    <div class="notice">ⓘ Ticketen kan bara ladda upp en fil, kan inte lista eller läsa befintliga filer och ger ingen kontoåtkomst. Vanlig GET är privat.</div>
  </section>

  <section class="panel">
    <div class="panel-head"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 20V10h3v10H5Zm6 0V4h3v16h-3Zm6 0v-7h3v7h-3Z"/></svg><h2>Status</h2></div>
    <div class="stats">
      <div class="stat"><small>Total lagring</small><strong id="storage">–</strong><em id="storage-sub">av 500 MB</em><div class="bar"><i id="storage-bar"></i></div></div>
      <div class="stat"><small>Antal objekt</small><strong id="count">–</strong><em>alla filversioner</em></div>
      <div class="stat"><small>Äldsta objekt</small><strong id="oldest">–</strong><em>sedan</em></div>
      <div class="stat"><small>Radering</small><strong>${limits.retentionDays} dagar</strong><em>automatiskt (lifecycle)</em></div>
    </div>
    <div class="limits">Gränser: max 20 MB per fil • max 500 MB totalt • filer raderas efter ${limits.retentionDays} dagar</div>
  </section>

  <section class="panel">
    <div class="panel-head"><svg class="icon" style="color:var(--purple)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><h2>Privat kontrollpanel <span style="color:var(--muted);font-size:14px">(inloggning krävs)</span></h2></div>
    <div class="admin">
      <p>GitHub-inloggningen används för objektlistan, privata downloads och för att skapa engångstickets. Provider-tokenen blir aldrig Dumpen-session.</p>
      ${limits.adminPage ? '<div class="auth-state">GitHub Auth verifierad · lokal signerad session aktiv</div>' : '<a href="/admin" style="display:inline-block;color:var(--green);padding:12px 16px;border:1px solid var(--green2);border-radius:6px">Logga in med GitHub</a>'}
      <p id="err" class="error"></p>
      <div id="ticket" class="ticket">
        <div class="ticket-actions"><button id="create-ticket" type="button">Skapa upload-ticket</button><span id="ticket-status" style="color:var(--muted)"></span></div>
        <pre id="ticket-output" class="code" hidden></pre>
      </div>
      <div id="objects" class="objects"><div class="objects-head"><span>Objekt i bucketen <span id="badge" class="badge"></span></span><button id="logout" class="logout" type="button">Logga ut</button></div><div class="table-wrap"><table><thead><tr><th>Namn</th><th>Storlek</th><th>Versioner</th><th>Äldsta version</th><th>Senast uppdaterad</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>
    </div>
  </section>
  <footer>dumpen.denied.se är ett privat och tillfälligt fil-dump-ställe.<br>Inget garanteras. Använd på egen risk.</footer>
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
async function loadObjects(){const r=await fetch('/admin/api/objects',{cache:'no-store',credentials:'same-origin'});if(r.status===401){location.assign('/login?return_to=%2Fadmin');return}if(r.status===503)throw new Error('GitHub-inloggningen är inte konfigurerad.');if(!r.ok)throw new Error('Kunde inte läsa objektlistan.');const data=await r.json();$('#rows').replaceChildren();for(const item of data.objects){const tr=document.createElement('tr');for(const value of [safe(item.name),bytes(item.latestSize),String(item.versions),age(item.oldestUploaded),age(item.latestUploaded)]){const td=document.createElement('td');td.textContent=value;tr.append(td)}const td=document.createElement('td'),button=document.createElement('button');button.className='dl';button.type='button';button.title='Hämta senaste';button.textContent='↓';button.addEventListener('click',()=>download(item.name));td.append(button);tr.append(td);$('#rows').append(tr)}$('#badge').textContent=data.objects.length+' namn'}
async function download(name){try{const r=await fetch('/admin/api/download/'+encodeURIComponent(name),{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('Kunde inte hämta filen.');const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=safe(name)+'.zip';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url)}catch(err){$('#err').textContent=err.message||'Nedladdningen misslyckades.'}}
$('#create-ticket')?.addEventListener('click',async()=>{$('#ticket-status').textContent='Skapar…';$('#ticket-output').hidden=true;try{const r=await fetch('/admin/api/tickets',{method:'POST',cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('Kunde inte skapa ticket.');const data=await r.json();$('#ticket-output').textContent=data.uploadUrl;$('#ticket-output').hidden=false;$('#ticket-status').textContent='Gäller till '+new Date(data.expiresAt).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})}catch(err){$('#ticket-status').textContent=err.message||'Ticket kunde inte skapas.'}});
$('#logout')?.addEventListener('click',async()=>{await fetch('/auth/logout',{method:'POST',credentials:'same-origin',cache:'no-store'});location.assign('/')});
</script></body></html>\n`;
}
