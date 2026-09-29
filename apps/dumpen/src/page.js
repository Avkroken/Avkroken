export function homePage(stats, limits) {
  const data = JSON.stringify({ stats, limits }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>dumpen.denied.se</title>
  <style>
    :root{--bg:#050505;--panel:#09090b;--line:#252529;--text:#f4f4f5;--muted:#a1a1aa;--green:#6ee71e;--green2:#42b80f;--purple:#a66cff;--danger:#ff6b6b}
    *{box-sizing:border-box}html{background:var(--bg)}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -15%,#111 0,#050505 36%,#030303 100%);color:var(--text);font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace}
    main{width:min(1040px,calc(100% - 32px));margin:auto;padding:54px 0 42px}header{padding-bottom:30px;border-bottom:1px solid var(--line)}h1,h2,p{margin-top:0}h1{font-size:clamp(30px,5vw,44px);line-height:1;letter-spacing:-.04em;margin-bottom:16px;font-weight:500}h1 span,.accent{color:var(--green)}h2{font-size:21px;font-weight:500;margin:0}.lead{color:#c6c6cb;max-width:760px;margin:0}.section{padding-top:34px}.title{display:flex;align-items:center;gap:12px;margin-bottom:22px}.icon{width:25px;height:25px;color:var(--green);flex:0 0 auto}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 24px}.label{color:#d4d4d8;margin-bottom:7px;font-size:13px}pre{font:inherit}.code{margin:0;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere;background:#050506;border:1px solid var(--line);border-radius:7px;color:#f0f0f2}.notice{margin-top:20px;padding:12px 15px;border:1px solid var(--line);border-radius:7px;color:var(--muted);background:#090a09}
    .panel{margin-top:26px;background:linear-gradient(180deg,rgba(11,11,12,.98),rgba(6,6,7,.98));border:1px solid var(--line);border-radius:9px;overflow:hidden}.panel-head{display:flex;align-items:center;gap:12px;padding:18px 20px}.stats{display:grid;grid-template-columns:repeat(4,1fr);padding:4px 20px 20px}.stat{min-width:0;padding:13px 20px;border-right:1px solid var(--line)}.stat:first-child{padding-left:6px}.stat:last-child{border-right:0}.stat small{color:var(--muted);display:block;margin-bottom:4px}.stat strong{display:block;color:var(--green);font-size:25px;line-height:1.35;font-weight:500}.stat em{display:block;color:#c0c0c5;font-style:normal;margin-top:5px;font-size:13px}.bar{height:7px;background:#222226;border-radius:99px;overflow:hidden;margin-top:12px}.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--green),var(--green2));border-radius:inherit}.limits{border-top:1px solid var(--line);color:var(--muted);padding:13px 20px;text-align:center;font-size:13px}
    .admin{padding:0 20px 20px}.admin p{color:var(--muted);margin-bottom:13px}.login{display:grid;grid-template-columns:1fr 1fr 170px;gap:12px}input,button{font:inherit;border-radius:6px;min-height:43px}input{width:100%;border:1px solid var(--line);background:#0b0b0d;color:var(--text);padding:0 13px;outline:none}input:focus{border-color:#4a4a50;box-shadow:0 0 0 2px rgba(110,231,30,.08)}button{cursor:pointer;padding:0 16px;color:var(--green);background:#070807;border:1px solid var(--green2)}button:hover{background:#0c1109}.logout{color:#c29aff;border-color:#6e48a1;min-height:34px}.locked{margin-top:14px;padding:25px;text-align:center;color:#babac1;border:1px solid #50346e;background:linear-gradient(100deg,#100c16,#0c0b0f);border-radius:7px}.locked b{display:block;color:var(--purple);font-size:22px;margin-bottom:5px}.error{color:var(--danger)!important;min-height:23px;margin:8px 0 0}.objects{display:none;margin-top:14px;border:1px solid var(--line);border-radius:7px;overflow:hidden}.objects.visible{display:block}.objects-head{min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;background:#09090a;border-bottom:1px solid var(--line)}.badge{display:inline-block;margin-left:7px;color:var(--green);background:#13210c;border-radius:999px;padding:1px 8px;font-size:12px}.ticket{display:none;margin-top:14px;padding:16px;border:1px solid #31501f;border-radius:7px;background:#080b07}.ticket.visible{display:block}.ticket-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ticket .code{margin-top:12px}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:720px}th,td{padding:10px 12px;border-bottom:1px solid #1d1d20;text-align:left;font-size:13px}th{color:#aeadb5;background:#101012;font-weight:500}td{color:#d7d7db}tr:last-child td{border-bottom:0}.dl{color:var(--green);text-decoration:none;font-size:18px;background:none;border:0;min-height:0;padding:0}.dl:hover{color:#97ff4c}footer{padding-top:34px;text-align:center;color:#68686f;font-size:12px}
    @media(max-width:760px){main{padding-top:34px}.grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}.stat:nth-child(2){border-right:0}.stat:nth-child(3){border-top:1px solid var(--line);padding-left:6px}.stat:nth-child(4){border-top:1px solid var(--line)}.login{grid-template-columns:1fr}.login button{width:100%}}
  </style>
</head>
<body><main>
  <header>
    <h1>dumpen.<span>denied</span>.se</h1>
    <p class="lead">Privat och tillfällig filöverföring via HTTP.<br>AI-klienter laddar upp med en kortlivad <span class="accent">engångsticket</span>. Nedladdning kräver din inloggning.</p>
  </header>

  <section class="section">
    <div class="title"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V3m0 0 4 4m-4-4L8 7M5 14v5h14v-5"/></svg><h2>AI-upload med engångsticket</h2></div>
    <p class="lead" style="margin-bottom:20px">Logga in längre ned och skapa en upload-ticket. Ge endast den kortlivade URL:en till AI:n — aldrig ditt permanenta konto- eller upload-lösenord.</p>
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
      <p>Inloggningen används för objektlistan, privata downloads och för att skapa engångstickets. Uppgifterna sparas inte av sidan.</p>
      ${limits.adminPage ? '<form id="login" class="login"><input id="user" autocomplete="username" placeholder="Användarnamn" required><input id="pass" type="password" autocomplete="current-password" placeholder="Lösenord" required><button>Logga in</button></form>' : '<a href="/admin" style="display:inline-block;color:var(--green);padding:12px 16px;border:1px solid var(--green2);border-radius:6px">Öppna admin med säker inloggning</a>'}
      <p id="err" class="error"></p>
      <div id="locked" class="locked"><b>▣</b>Inloggning krävs.</div>
      <div id="ticket" class="ticket">
        <div class="ticket-actions"><button id="create-ticket" type="button">Skapa upload-ticket</button><span id="ticket-status" style="color:var(--muted)"></span></div>
        <pre id="ticket-output" class="code" hidden></pre>
      </div>
      <div id="objects" class="objects"><div class="objects-head"><span>Objekt i bucketen <span id="badge" class="badge"></span></span><button id="logout" class="logout" type="button">Logga ut</button></div><div class="table-wrap"><table><thead><tr><th>Namn</th><th>Storlek</th><th>Versioner</th><th>Äldsta version</th><th>Senast uppdaterad</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>
    </div>
  </section>
  <footer>dumpen.denied.se är ett privat och tillfälligt fil-dump-ställe.<br>Inget garanteras. Använd på egen risk.</footer>
</main>
<script>
const cfg=${data},stats=cfg.stats,limits=cfg.limits;
const $=s=>document.querySelector(s);
const bytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(n<10240?1:0)+' KB':(n/1048576).toFixed(n<10485760?1:0)+' MB';
const age=iso=>{const m=Math.max(0,Math.floor((Date.now()-new Date(iso))/60000));if(m<2)return'nyss';if(m<60)return m+' minuter sedan';const h=Math.floor(m/60);if(h<24)return h+(h===1?' timme sedan':' timmar sedan');const d=Math.floor(h/24);return d+(d===1?' dag sedan':' dagar sedan')};
const safe=n=>{try{return decodeURIComponent(n)}catch{return n}};
let adminAuth='';
$('#storage').textContent=bytes(stats.totalBytes);const pct=Math.min(100,Math.round(stats.totalBytes/limits.maxBucketBytes*100));$('#storage-sub').textContent='av 500 MB ('+pct+'%)';$('#storage-bar').style.width=pct+'%';$('#count').textContent=stats.objectCount;$('#oldest').textContent=stats.oldestDays==null?'–':stats.oldestDays+(stats.oldestDays===1?' dag':' dagar');
async function loadObjects(){const r=await fetch('/api/objects',{headers:{Authorization:adminAuth},cache:'no-store'});if(r.status===503)throw new Error('Admininloggning är inte konfigurerad.');if(!r.ok)throw new Error('Fel användarnamn eller lösenord.');const data=await r.json();$('#rows').replaceChildren();for(const item of data.objects){const tr=document.createElement('tr');for(const value of [safe(item.name),bytes(item.latestSize),String(item.versions),age(item.oldestUploaded),age(item.latestUploaded)]){const td=document.createElement('td');td.textContent=value;tr.append(td)}const td=document.createElement('td'),button=document.createElement('button');button.className='dl';button.type='button';button.title='Hämta senaste';button.textContent='↓';button.addEventListener('click',()=>download(item.name));td.append(button);tr.append(td);$('#rows').append(tr)}$('#badge').textContent=data.objects.length+' namn'}
async function download(name){try{const r=await fetch('/api/download/'+encodeURIComponent(name),{headers:{Authorization:adminAuth},cache:'no-store'});if(!r.ok)throw new Error('Kunde inte hämta filen.');const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=safe(name)+'.zip';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url)}catch(err){$('#err').textContent=err.message||'Nedladdningen misslyckades.'}}
$('#login')?.addEventListener('submit',async e=>{e.preventDefault();$('#err').textContent='';const raw=$('#user').value+':'+$('#pass').value;const token=btoa(unescape(encodeURIComponent(raw)));const candidate='Basic '+token;try{adminAuth=candidate;await loadObjects();$('#locked').style.display='none';$('#objects').classList.add('visible');$('#ticket').classList.add('visible');$('#pass').value=''}catch(err){adminAuth='';$('#err').textContent=err.message||'Inloggningen misslyckades.';$('#objects').classList.remove('visible');$('#ticket').classList.remove('visible');$('#locked').style.display='block'}});
$('#create-ticket').addEventListener('click',async()=>{if(!adminAuth)return;$('#ticket-status').textContent='Skapar…';$('#ticket-output').hidden=true;try{const r=await fetch('/api/tickets',{method:'POST',headers:{Authorization:adminAuth},cache:'no-store'});if(!r.ok)throw new Error('Kunde inte skapa ticket.');const data=await r.json();$('#ticket-output').textContent=data.uploadUrl;$('#ticket-output').hidden=false;$('#ticket-status').textContent='Gäller till '+new Date(data.expiresAt).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})}catch(err){$('#ticket-status').textContent=err.message||'Ticket kunde inte skapas.'}});
$('#logout').addEventListener('click',()=>{adminAuth='';$('#rows').replaceChildren();$('#objects').classList.remove('visible');$('#ticket').classList.remove('visible');$('#ticket-output').hidden=true;$('#ticket-output').textContent='';$('#ticket-status').textContent='';$('#locked').style.display='block';$('#user').value='';$('#pass').value='';$('#err').textContent=''});
</script></body></html>\n`;
}
