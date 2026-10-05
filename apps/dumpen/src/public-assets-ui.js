const APP_OPTIONS = [
  ["dozzle", "Dozzle"],
  ["maintainerr", "Maintainerr"],
  ["plex", "Plex"],
  ["prowlarr", "Prowlarr"],
  ["qbittorrent", "qBittorrent"],
  ["radarr", "Radarr"],
  ["sonarr", "Sonarr"],
  ["tautulli", "Tautulli"],
];

const THEME_OPTIONS = [
  ["1", "Neon Glass"],
  ["2", "Cyan Blueprint"],
  ["3", "Isometric Console"],
  ["4", "Illustrated Scene"],
  ["5", "Emerald Radar"],
  ["6", "Emerald Core"],
  ["7", "Azure Orbit"],
];

export function publicAssetsCss() {
  return `
    .asset-box{margin:20px 0 22px;padding:18px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--panel) 90%,transparent)}
    .asset-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}.asset-head h3{margin:0;font-size:18px;font-weight:760;letter-spacing:-.02em}.asset-head p{margin:4px 0 0;color:var(--muted);font-size:13px;max-width:760px}
    .asset-drop{display:grid;place-items:center;min-height:150px;padding:18px;border:1px dashed var(--line-strong);border-radius:14px;background:var(--bg-deep);text-align:center;transition:.15s border-color,.15s background}
    .asset-drop.is-over{border-color:var(--green);background:color-mix(in srgb,var(--green) 7%,var(--bg-deep))}.asset-drop strong{display:block;font-size:15px}.asset-drop span{display:block;margin-top:5px;color:var(--muted);font-size:12px}.asset-drop-actions{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
    .asset-upload-options{display:flex;align-items:center;gap:8px;margin-top:10px;color:var(--muted);font-size:12px}.asset-upload-options input{width:18px;height:18px;accent-color:var(--green)}
    .asset-queue{display:grid;gap:8px;margin-top:10px}.asset-queue[hidden]{display:none}.asset-queue-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.asset-queue-head strong{font-size:12px}.asset-queue-actions{display:flex;gap:6px}
    .asset-queue-item{display:grid;grid-template-columns:48px minmax(120px,1fr) repeat(3,minmax(90px,.55fr)) 96px;gap:8px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:11px;background:var(--bg-deep)}
    .asset-queue-thumb{width:48px;height:48px;border-radius:8px;object-fit:cover;background:#050805}.asset-queue-meta{min-width:0}.asset-queue-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:700}.asset-queue-state{margin-top:2px;color:var(--muted);font-size:10px}.asset-queue-item select{width:100%;min-height:34px;padding:4px 6px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font-size:10px}
    .asset-progress{height:5px;margin-top:6px;border-radius:99px;background:var(--panel-2);overflow:hidden}.asset-progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--green),var(--purple))}
    .asset-queue-control{display:flex;gap:5px;justify-content:flex-end}.asset-queue-control button{min-height:30px;padding:3px 7px;font-size:9px}
    .asset-tools{display:grid;grid-template-columns:minmax(160px,1.4fr) repeat(4,minmax(120px,.7fr));gap:8px;margin-top:18px}.asset-tools input,.asset-tools select{width:100%;min-height:40px;padding:7px 9px;border:1px solid var(--line-strong);border-radius:9px;background:var(--bg-deep);color:var(--text);font:inherit;font-size:12px}
    .asset-status{min-height:22px;margin:8px 0 0;color:var(--muted);font-size:12px}
    .asset-app-grid,.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:9px;width:100%;margin-top:12px}.asset-app{position:relative;aspect-ratio:1;padding:0;border:1px solid var(--line);border-radius:13px;overflow:hidden;background:var(--bg-deep);text-align:left}.asset-app:hover,.asset-app:focus-visible{border-color:var(--line-strong);filter:none}.asset-app img{width:100%;height:100%;display:block;object-fit:cover}
    .asset-app-shade{position:absolute;inset:auto 0 0;padding:34px 9px 9px;background:linear-gradient(transparent,rgba(0,0,0,.88));pointer-events:none}.asset-app-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:760}.asset-app-count{display:block;margin-top:2px;color:#dce7f8;font-size:10px}
    .asset-card{min-width:0;border:1px solid var(--line);border-radius:13px;background:var(--bg-deep);overflow:hidden}.asset-preview{position:relative;aspect-ratio:1;display:block;width:100%;padding:0;border:0;border-radius:0;background:#050805;overflow:hidden}.asset-preview img{display:block;width:100%;height:100%;object-fit:cover}
    .asset-card-caption{padding:8px;min-width:0}.asset-card-title{display:flex;align-items:center;justify-content:space-between;gap:6px}.asset-card-title strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.asset-size{flex:0 0 auto;color:var(--muted);font-size:9px}.asset-card-sub{margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:9px}.asset-card-actions{display:flex;gap:5px;margin-top:7px}.asset-card-actions button,.asset-card-actions a{flex:1;min-height:28px;padding:3px 5px;border-radius:7px;font-size:9px;text-align:center}.asset-card-actions a{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line-strong);text-decoration:none}
    .asset-files{margin-top:16px}.asset-files details{border-top:1px solid var(--line);padding-top:12px}.asset-files summary{cursor:pointer;color:var(--muted);font-size:12px}.asset-file-list{display:grid;gap:8px;margin-top:10px}.asset-file{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--bg-deep)}.asset-actions{display:flex;gap:5px}.asset-actions button,.asset-actions a{min-height:30px;padding:4px 7px;font-size:10px}.asset-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.asset-facts{margin-top:2px;color:var(--muted);font-size:10px}
    .asset-empty{margin-top:14px;padding:18px;border:1px dashed var(--line);border-radius:12px;color:var(--muted);font-size:12px;text-align:center}.asset-app-grid[hidden],.gallery[hidden],.asset-files[hidden],.asset-empty[hidden]{display:none}
    .asset-dialog{width:min(760px,calc(100% - 24px));max-height:calc(100vh - 32px);padding:0;border:1px solid var(--line-strong);border-radius:16px;background:var(--panel);color:var(--text);box-shadow:0 30px 90px rgba(0,0,0,.55)}.asset-dialog::backdrop{background:rgba(0,0,0,.72);backdrop-filter:blur(4px)}.asset-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line)}.asset-dialog-head strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.asset-dialog-head button{min-height:32px;padding:4px 9px}.asset-dialog-body{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(220px,.9fr);gap:14px;padding:14px}.asset-dialog-preview{min-width:0;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#050805}.asset-dialog-preview img{width:100%;height:100%;object-fit:contain}.asset-detail-list{display:grid;gap:7px;margin:0}.asset-detail-list div{padding:8px;border:1px solid var(--line);border-radius:9px;background:var(--bg-deep)}.asset-detail-list dt{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.05em}.asset-detail-list dd{margin:2px 0 0;overflow-wrap:anywhere;font-size:11px}.asset-dialog-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.asset-dialog-actions button,.asset-dialog-actions a{min-height:34px;padding:5px 9px;font-size:10px}.asset-danger{color:var(--danger)!important}
    @media(max-width:900px){.asset-tools{grid-template-columns:1fr 1fr 1fr}.asset-search{grid-column:1/-1}.asset-queue-item{grid-template-columns:44px minmax(110px,1fr) 90px}.asset-queue-item select:nth-of-type(2),.asset-queue-item select:nth-of-type(3){display:none}}
    @media(max-width:680px){.asset-box{margin-inline:-10px;padding:12px;border-radius:14px}.asset-head{align-items:flex-start;flex-direction:column}.asset-tools{grid-template-columns:1fr 1fr}.asset-search{grid-column:1/-1}.asset-app-grid,.gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.asset-queue-item{grid-template-columns:40px minmax(0,1fr) 76px}.asset-queue-thumb{width:40px;height:40px}.asset-queue-item select{display:none!important}.asset-dialog-body{grid-template-columns:1fr}.asset-dialog-preview{max-height:48vh}}
  `;
}

export function publicAssetsMarkup() {
  return `
      <div class="asset-box">
        <div class="asset-head"><div><h3>Media Library <span id="asset-badge" class="badge"></span></h3><p>Drag, klistra in eller välj filer. Appbilder får canonical nyckel server-side; övriga filer får stabila, oförutsägbara upload-nycklar.</p></div></div>
        <div id="asset-drop" class="asset-drop" tabindex="0">
          <div><strong>Släpp filer här</strong><span>Du kan också klistra in bilder från urklipp.</span><div class="asset-drop-actions"><button id="asset-pick" type="button">Välj filer</button><button id="asset-paste" type="button">Klistra in</button></div></div>
          <input id="asset-files" type="file" multiple accept="image/*,.pdf,.txt,.json,.css" hidden>
        </div>
        <label class="asset-upload-options"><input id="replace-app-assets" type="checkbox"> Tillåt ersättning när en canonical appbild redan finns</label>
        <section id="asset-queue" class="asset-queue" hidden aria-label="Uppladdningskö">
          <div class="asset-queue-head"><strong id="asset-queue-title">Uppladdningskö</strong><div class="asset-queue-actions"><button id="asset-clear-queue" type="button">Rensa</button><button id="upload-assets" type="button">Ladda upp</button></div></div>
          <div id="asset-queue-list"></div>
        </section>
        <div class="asset-tools" role="group" aria-label="Filtrera mediebibliotek">
          <input id="asset-search" class="asset-search" type="search" placeholder="Sök namn, app, tema eller nyckel">
          <select id="asset-filter-app"><option value="">Alla appar</option></select>
          <select id="asset-filter-theme"><option value="">Alla teman</option></select>
          <select id="asset-filter-size"><option value="">Original 1254</option><option value="512">512</option><option value="256">256</option><option value="all">Alla storlekar</option></select>
          <select id="asset-sort"><option value="app">App / tema</option><option value="newest">Nyast</option><option value="oldest">Äldst</option><option value="name">Namn</option><option value="size">Störst fil</option></select>
        </div>
        <div id="asset-status" class="asset-status" role="status" aria-live="polite" aria-atomic="true"></div>
        <div id="asset-empty" class="asset-empty" hidden>Inga assets matchar filtret.</div>
        <div id="asset-app-grid" class="asset-app-grid" aria-label="Applikationer"></div>
        <div id="asset-gallery" class="gallery" hidden aria-label="Bilder"></div>
        <div id="asset-other-files" class="asset-files" hidden><details><summary id="asset-file-summary">Övriga filer</summary><div id="asset-file-list" class="asset-file-list"></div></details></div>
        <input id="asset-replace-file" type="file" hidden>
        <dialog id="asset-dialog" class="asset-dialog"><div class="asset-dialog-head"><strong id="asset-dialog-title"></strong><button id="asset-dialog-close" type="button">Stäng</button></div><div class="asset-dialog-body"><div id="asset-dialog-preview" class="asset-dialog-preview"></div><div><dl id="asset-detail-list" class="asset-detail-list"></dl><div id="asset-dialog-actions" class="asset-dialog-actions"></div></div></div></dialog>
      </div>
  `;
}

export function resolveAssetFilter({ app = "", size = "", theme = "", search = "" } = {}) {
  const normalizedSearch = String(search || "").trim().toLocaleLowerCase("sv");
  const browseApps = !app && !size && !theme && !normalizedSearch;
  const effectiveSize = size === "all" ? "" : (size || (browseApps ? "" : "1254"));
  return { app, size, theme, search: normalizedSearch, browseApps, effectiveSize };
}

export function filterAssetRecords(assets, filters = {}) {
  const resolved = resolveAssetFilter(filters);
  if (resolved.browseApps) return [];
  return assets.filter((asset) => {
    const pixel = asset.pixelSize ? String(asset.pixelSize) : "";
    const haystack = [asset.name, asset.key, asset.appLabel, asset.appCategory, asset.themeLabel, asset.theme]
      .filter(Boolean).join(" ").toLocaleLowerCase("sv");
    return (!resolved.app || asset.appCategory === resolved.app)
      && (!resolved.theme || asset.theme === resolved.theme)
      && (!resolved.effectiveSize || pixel === resolved.effectiveSize)
      && (!resolved.search || haystack.includes(resolved.search));
  });
}

export function sortAssetRecords(assets, sort = "app") {
  return [...assets].sort((a, b) => {
    if (sort === "newest") return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    if (sort === "oldest") return new Date(a.uploadedAt) - new Date(b.uploadedAt);
    if (sort === "name") return String(a.name || a.key).localeCompare(String(b.name || b.key), "sv");
    if (sort === "size") return Number(b.size || 0) - Number(a.size || 0);
    return String(a.appLabel || a.appCategory || a.name || "").localeCompare(String(b.appLabel || b.appCategory || b.name || ""), "sv")
      || Number(a.theme || 0) - Number(b.theme || 0)
      || Number(b.pixelSize || 0) - Number(a.pixelSize || 0);
  });
}

export function filterAssetCards(cards, filters = {}) {
  const resolved = resolveAssetFilter(filters);
  let visible = 0;
  for (const card of cards) {
    const haystack = [card.dataset.app, card.dataset.theme, card.dataset.name, card.dataset.key].filter(Boolean).join(" ").toLocaleLowerCase("sv");
    const show = !resolved.browseApps
      && (!resolved.app || card.dataset.app === resolved.app)
      && (!resolved.theme || card.dataset.theme === resolved.theme)
      && (!resolved.effectiveSize || card.dataset.size === resolved.effectiveSize)
      && (!resolved.search || haystack.includes(resolved.search));
    card.hidden = !show;
    if (show) visible += 1;
  }
  return { visible, filtered: !resolved.browseApps, browseApps: resolved.browseApps, effectiveSize: resolved.effectiveSize, message: resolved.browseApps ? "" : visible + " bild" + (visible === 1 ? "" : "er") + " visas." };
}

export function bindAssetFilterChanges(selects, apply) {
  for (const select of selects) select?.addEventListener("change", apply);
}

export function publicAssetsScript() {
  const appOptions = JSON.stringify(APP_OPTIONS);
  const themeOptions = JSON.stringify(THEME_OPTIONS);
  return `
const resolveAssetFilter=${resolveAssetFilter.toString()};
const filterAssetRecords=${filterAssetRecords.toString()};
const sortAssetRecords=${sortAssetRecords.toString()};
const bindAssetFilterChanges=${bindAssetFilterChanges.toString()};
const assetApps=${appOptions},assetThemes=${themeOptions},assetSizes=[['1254','1254'],['512','512'],['256','256']];
let currentAssets=[],assetQueue=[],activeAsset=null,queueRunning=false;
const assetFormat=(type,name)=>{const ext=(String(name||'').split('.').pop()||'').toUpperCase();const map={'image/jpeg':'JPEG','image/png':'PNG','image/webp':'WEBP','image/gif':'GIF','image/avif':'AVIF','image/svg+xml':'SVG','image/x-icon':'ICO','image/vnd.microsoft.icon':'ICO'};return map[type]||ext||type||'FIL'};
const assetButton=(label,handler,className='')=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(className)b.className=className;b.addEventListener('click',handler);return b};
const assetSelect=(items,value,blank)=>{const s=document.createElement('select');s.append(new Option(blank,''));for(const item of items)s.append(new Option(item[1],item[0]));s.value=value||'';return s};
function inferAssetTarget(name){
  const value=String(name||'').toLowerCase();
  let m=value.match(/^([a-z0-9-]+)-(?:t)?([1-7])-(1254|512|256)x\\3\\.png$/i);
  if(m)return {app:m[1],theme:m[2],size:m[3]};
  m=value.match(/^([a-z0-9-]+)-([1-7])(?:-(256|512))?\\.png$/i);
  return m?{app:m[1],theme:m[2],size:m[3]||'1254'}:{app:'',theme:'',size:''};
}
async function copyAssetLink(url){try{await navigator.clipboard.writeText(url)}catch{const input=document.createElement('textarea');input.value=url;document.body.append(input);input.select();document.execCommand('copy');input.remove()}$('#asset-status').textContent='Direktlänken är kopierad.'}
function appAssets(assets){return assets.filter((a)=>a.image&&a.appCategory&&a.theme&&a.pixelSize)}
function findPreview(assets,asset){return assets.find((a)=>a.appCategory===asset.appCategory&&a.theme===asset.theme&&a.pixelSize===256)||assets.find((a)=>a.appCategory===asset.appCategory&&a.theme===asset.theme&&a.pixelSize===512)||asset}
function fillAssetFilter(id,items,label){const s=$(id),selected=s.value;s.replaceChildren(new Option(label,''));for(const item of items)s.append(new Option(item.label,item.value));s.value=[...s.options].some((o)=>o.value===selected)?selected:''}
function rebuildAssetFilters(assets){const structured=appAssets(assets);const apps=[...new Map(structured.map((a)=>[a.appCategory,a.appLabel||a.appCategory])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'sv')).map(([value,label])=>({value,label}));const themes=[...new Map(structured.map((a)=>[a.theme,a.themeLabel||('Tema '+a.theme)])).entries()].sort((a,b)=>Number(a[0])-Number(b[0])).map(([value,label])=>({value,label}));fillAssetFilter('#asset-filter-app',apps,'Alla appar');fillAssetFilter('#asset-filter-theme',themes,'Alla teman')}
function currentAssetFilters(){return {app:$('#asset-filter-app').value,theme:$('#asset-filter-theme').value,size:$('#asset-filter-size').value,search:$('#asset-search').value}}
function assetActions(asset,compact=false){const wrap=document.createElement('div');wrap.className=compact?'asset-card-actions':'asset-actions';wrap.append(assetButton('Detaljer',()=>openAsset(asset)),assetButton('Kopiera',()=>copyAssetLink(asset.directUrl)));const a=document.createElement('a');a.href=asset.previewUrl||asset.directUrl;a.target='_blank';a.rel='noopener';a.textContent='Öppna';wrap.append(a);return wrap}
function renderAppBrowser(assets){const grid=$('#asset-app-grid');grid.replaceChildren();const groups=new Map();for(const a of appAssets(assets)){if(!groups.has(a.appCategory))groups.set(a.appCategory,[]);groups.get(a.appCategory).push(a)}for(const [app,items] of [...groups.entries()].sort((a,b)=>(a[1][0]?.appLabel||a[0]).localeCompare(b[1][0]?.appLabel||b[0],'sv'))){const representative=items.find((x)=>x.theme==='1'&&x.pixelSize===256)||items.find((x)=>x.pixelSize===256)||items.find((x)=>x.pixelSize===512)||items[0];const b=document.createElement('button');b.type='button';b.className='asset-app';b.setAttribute('aria-label','Visa '+(representative.appLabel||app));const img=document.createElement('img');img.src=representative.previewUrl||representative.directUrl;img.alt='';img.loading='lazy';const shade=document.createElement('span');shade.className='asset-app-shade';const n=document.createElement('span');n.className='asset-app-name';n.textContent=representative.appLabel||app;const c=document.createElement('span');c.className='asset-app-count';c.textContent=new Set(items.map((x)=>x.theme)).size+' teman · '+items.length+' filer';shade.append(n,c);b.append(img,shade);b.onclick=()=>{$('#asset-filter-app').value=app;applyAssetFilters()};grid.append(b)}}
function renderGallery(assets,filters){const gallery=$('#asset-gallery');gallery.replaceChildren();const structured=appAssets(assets);const matches=sortAssetRecords(filterAssetRecords(structured,filters),$('#asset-sort').value);for(const asset of matches){const card=document.createElement('article');card.className='asset-card';const preview=findPreview(structured,asset);const open=document.createElement('button');open.type='button';open.className='asset-preview';open.onclick=()=>openAsset(asset);const img=document.createElement('img');img.src=preview.previewUrl||preview.directUrl;img.alt=(asset.appLabel||asset.appCategory)+' · '+(asset.themeLabel||('Tema '+asset.theme));img.loading='lazy';open.append(img);const caption=document.createElement('div');caption.className='asset-card-caption';const title=document.createElement('div');title.className='asset-card-title';const strong=document.createElement('strong');strong.textContent=asset.appLabel||asset.appCategory;const size=document.createElement('span');size.className='asset-size';size.textContent=asset.pixelLabel||'';title.append(strong,size);const sub=document.createElement('div');sub.className='asset-card-sub';sub.textContent=asset.themeLabel||('Tema '+asset.theme);caption.append(title,sub,assetActions(asset,true));card.append(open,caption);gallery.append(card)}return matches.length}
function renderOtherFiles(assets){const wrap=$('#asset-other-files'),list=$('#asset-file-list'),summary=$('#asset-file-summary');list.replaceChildren();const search=currentAssetFilters().search.trim().toLocaleLowerCase('sv');let other=assets.filter((a)=>!(a.image&&a.appCategory&&a.theme&&a.pixelSize));if(search)other=other.filter((a)=>[a.name,a.key,a.contentType].filter(Boolean).join(' ').toLocaleLowerCase('sv').includes(search));other=sortAssetRecords(other,$('#asset-sort').value);wrap.hidden=other.length===0;summary.textContent='Övriga filer · '+other.length;for(const asset of other){const row=document.createElement('div');row.className='asset-file';const meta=document.createElement('div');const n=document.createElement('div');n.className='asset-name';n.textContent=asset.name;n.title=asset.name;const facts=document.createElement('div');facts.className='asset-facts';facts.textContent=bytes(asset.size)+' · '+assetFormat(asset.contentType,asset.name);meta.append(n,facts);row.append(meta,assetActions(asset));list.append(row)}}
function applyAssetFilters(){const filters=currentAssetFilters(),resolved=resolveAssetFilter(filters);$('#asset-app-grid').hidden=!resolved.browseApps;$('#asset-gallery').hidden=resolved.browseApps;let visible=0;if(resolved.browseApps)renderAppBrowser(currentAssets);else visible=renderGallery(currentAssets,filters);renderOtherFiles(currentAssets);const empty=appAssets(currentAssets).length===0||(!resolved.browseApps&&visible===0&&$('#asset-other-files').hidden);$('#asset-empty').hidden=!empty;$('#asset-status').textContent=resolved.browseApps?'Välj en app eller använd sökning och filter.':visible+' appbild'+(visible===1?'':'er')+' visas.'}
function renderAssets(assets,state='available'){currentAssets=assets||[];const empty=$('#asset-empty'),badge=$('#asset-badge');if(state!=='available'){const message=state==='not_configured'?'Assetlagret är inte konfigurerat.':'Assetlagret är tillfälligt otillgängligt.';$('#asset-app-grid').replaceChildren();$('#asset-gallery').replaceChildren();empty.textContent=message;empty.hidden=false;badge.textContent=state==='not_configured'?'ej konfigurerat':'otillgängligt';$('#asset-status').textContent=message;return}empty.textContent='Inga assets matchar filtret.';rebuildAssetFilters(currentAssets);badge.textContent=currentAssets.length+' assets';applyAssetFilters()}
async function loadAssets(){const r=await fetch('/admin/api/assets',{cache:'no-store',credentials:'same-origin'});if(r.status===401){location.assign('/login?return_to=%2Fadmin');return}if(!r.ok)throw new Error('Kunde inte läsa mediebiblioteket.');const data=await r.json();renderAssets(data.assets||[],data.assetState||'available')}
function detailRow(term,value){const d=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=term;dd.textContent=value||'–';d.append(dt,dd);return d}
function openAsset(asset){activeAsset=asset;$('#asset-dialog-title').textContent=asset.name||asset.key;const preview=$('#asset-dialog-preview');preview.replaceChildren();if(asset.image){const img=document.createElement('img');img.src=asset.previewUrl||asset.directUrl;img.alt=asset.name||'';preview.append(img)}const dl=$('#asset-detail-list');dl.replaceChildren(detailRow('App',asset.appLabel||asset.appCategory),detailRow('Tema',asset.themeLabel||asset.theme),detailRow('Dimension',asset.pixelLabel),detailRow('Storlek',bytes(asset.size)),detailRow('MIME',asset.contentType),detailRow('Uppladdad',asset.uploadedAt?new Date(asset.uploadedAt).toLocaleString('sv-SE'):'–'),detailRow('R2-nyckel',asset.key),detailRow('Canonical URL',asset.directUrl));const actions=$('#asset-dialog-actions');actions.replaceChildren();actions.append(assetButton('Kopiera URL',()=>copyAssetLink(asset.directUrl)),assetButton('Ersätt',()=>$('#asset-replace-file').click()),assetButton('Ta bort',()=>removeAsset(asset),'asset-danger'));const a=document.createElement('a');a.href=asset.directUrl;a.target='_blank';a.rel='noopener';a.textContent='Öppna original';actions.prepend(a);$('#asset-dialog').showModal()}
async function removeAsset(asset){if(!confirm('Ta bort '+asset.name+'? Den publika URL:en slutar fungera.'))return;const r=await fetch('/admin/api/assets/item?key='+encodeURIComponent(asset.key),{method:'DELETE',credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('Kunde inte ta bort asseten.');$('#asset-dialog').close();activeAsset=null;await loadAssets();$('#asset-status').textContent='Asseten togs bort.'}
async function replaceSelectedAsset(file){if(!activeAsset||!file)return;const r=await fetch('/admin/api/assets/item?key='+encodeURIComponent(activeAsset.key),{method:'PUT',headers:{'content-type':file.type||'application/octet-stream'},body:file,credentials:'same-origin',cache:'no-store'});if(!r.ok){let data={};try{data=await r.json()}catch{}throw new Error(data.error||'Kunde inte ersätta asseten.')}$('#asset-dialog').close();activeAsset=null;await loadAssets();$('#asset-status').textContent='Asseten ersattes.'}
function queuePreview(file){return file.type.startsWith('image/')?URL.createObjectURL(file):''}
function addFiles(files){for(const file of files){if(assetQueue.some((x)=>x.file===file))continue;assetQueue.push({id:crypto.randomUUID(),file,target:inferAssetTarget(file.name),state:'ready',progress:0,error:'',preview:queuePreview(file)})}renderQueue()}
function clearQueue(){for(const item of assetQueue)if(item.preview)URL.revokeObjectURL(item.preview);assetQueue=[];renderQueue()}
function renderQueue(){const wrap=$('#asset-queue'),list=$('#asset-queue-list');wrap.hidden=assetQueue.length===0;list.replaceChildren();$('#asset-queue-title').textContent='Uppladdningskö · '+assetQueue.length;for(const item of assetQueue){const row=document.createElement('div');row.className='asset-queue-item';const img=document.createElement('img');img.className='asset-queue-thumb';if(item.preview)img.src=item.preview;img.alt='';const meta=document.createElement('div');meta.className='asset-queue-meta';const name=document.createElement('div');name.className='asset-queue-name';name.textContent=item.file.name;const state=document.createElement('div');state.className='asset-queue-state';state.textContent=item.error||({ready:'Klar för uppladdning',uploading:'Laddar upp…',done:'Klar',error:'Fel'}[item.state]||item.state);const progress=document.createElement('div');progress.className='asset-progress';const bar=document.createElement('i');bar.style.width=item.progress+'%';progress.append(bar);meta.append(name,state,progress);const app=assetSelect(assetApps,item.target.app,'Generisk');const theme=assetSelect(assetThemes,item.target.theme,'Tema');const size=assetSelect(assetSizes,item.target.size,'Storlek');app.onchange=()=>item.target.app=app.value;theme.onchange=()=>item.target.theme=theme.value;size.onchange=()=>item.target.size=size.value;const controls=document.createElement('div');controls.className='asset-queue-control';if(item.state==='error')controls.append(assetButton('Försök igen',()=>{item.state='ready';item.error='';uploadQueue()}));controls.append(assetButton('×',()=>{assetQueue=assetQueue.filter((x)=>x!==item);if(item.preview)URL.revokeObjectURL(item.preview);renderQueue()}));row.append(img,meta,app,theme,size,controls);list.append(row)}}
function uploadOne(item){return new Promise((resolve)=>{item.state='uploading';item.error='';renderQueue();const q=new URLSearchParams({name:item.file.name});if(item.target.app||item.target.theme||item.target.size){q.set('app',item.target.app);q.set('theme',item.target.theme);q.set('size',item.target.size)}if($('#replace-app-assets').checked)q.set('replace','1');const xhr=new XMLHttpRequest();xhr.open('POST','/admin/api/assets/uploads?'+q.toString());xhr.withCredentials=true;xhr.setRequestHeader('content-type',item.file.type||'application/octet-stream');xhr.upload.onprogress=(e)=>{if(e.lengthComputable){item.progress=Math.round(e.loaded/e.total*100);renderQueue()}};xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300){item.state='done';item.progress=100}else{item.state='error';try{item.error=JSON.parse(xhr.responseText).error||'Uppladdningen misslyckades.'}catch{item.error='Uppladdningen misslyckades.'}}renderQueue();resolve()};xhr.onerror=()=>{item.state='error';item.error='Nätverksfel.';renderQueue();resolve()};xhr.send(item.file)})}
async function uploadQueue(){if(queueRunning)return;queueRunning=true;$('#upload-assets').disabled=true;try{const pending=assetQueue.filter((x)=>x.state==='ready'||x.state==='error');let cursor=0;const workers=Array.from({length:Math.min(3,pending.length)},async()=>{while(cursor<pending.length){const item=pending[cursor++];await uploadOne(item)}});await Promise.all(workers);await loadAssets();const done=assetQueue.filter((x)=>x.state==='done').length,failed=assetQueue.filter((x)=>x.state==='error').length;$('#asset-status').textContent=done+' filer uppladdade'+(failed?' · '+failed+' misslyckades':'')+'.'}finally{queueRunning=false;$('#upload-assets').disabled=false}}
bindAssetFilterChanges(['#asset-filter-app','#asset-filter-size','#asset-filter-theme','#asset-sort'].map((id)=>$(id)),applyAssetFilters);$('#asset-search')?.addEventListener('input',applyAssetFilters);
$('#asset-pick')?.addEventListener('click',()=>$('#asset-files').click());$('#asset-files')?.addEventListener('change',(e)=>{addFiles([...(e.target.files||[])]);e.target.value=''});$('#asset-clear-queue')?.addEventListener('click',clearQueue);$('#upload-assets')?.addEventListener('click',uploadQueue);
const drop=$('#asset-drop');for(const type of ['dragenter','dragover'])drop?.addEventListener(type,(e)=>{e.preventDefault();drop.classList.add('is-over')});for(const type of ['dragleave','drop'])drop?.addEventListener(type,(e)=>{e.preventDefault();drop.classList.remove('is-over')});drop?.addEventListener('drop',(e)=>addFiles([...(e.dataTransfer?.files||[])]));
async function pasteAssets(){try{const items=await navigator.clipboard.read();const files=[];for(const item of items){const type=item.types.find((x)=>x.startsWith('image/'));if(type){const blob=await item.getType(type);files.push(new File([blob],'clipboard-'+Date.now()+'.'+(type.split('/')[1]||'png'),{type}))}}addFiles(files)}catch{$('#asset-status').textContent='Urklipp kunde inte läsas. Använd Ctrl/Cmd+V eller filväljaren.'}}
$('#asset-paste')?.addEventListener('click',pasteAssets);document.addEventListener('paste',(e)=>{const files=[...(e.clipboardData?.files||[])];if(files.length)addFiles(files)});
$('#asset-dialog-close')?.addEventListener('click',()=>$('#asset-dialog').close());$('#asset-replace-file')?.addEventListener('change',async(e)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{await replaceSelectedAsset(file)}catch(err){$('#asset-status').textContent=err.message||'Ersättningen misslyckades.'}});
  `;
}
