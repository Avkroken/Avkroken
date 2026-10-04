export function publicAssetsCss() {
  return `
    .asset-box{margin:20px 0 22px;padding:18px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--panel) 90%,transparent)}
    .asset-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}
    .asset-head h3{margin:0;font-size:18px;font-weight:720;letter-spacing:-.02em;color:var(--text)}
    .asset-head p{margin:4px 0 0;color:var(--muted);font-size:13px;max-width:690px}
    .asset-upload{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--bg-deep)}
    .asset-upload input[type="file"]{min-width:0;max-width:100%;font:inherit;color:var(--text)}
    .asset-upload-options{grid-column:1/-1;display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px}
    .asset-upload-options input{width:18px;height:18px;accent-color:var(--green)}
    .asset-path-hint{grid-column:1/-1;color:var(--muted);font-size:11px;overflow-wrap:anywhere}
    .asset-path-hint code{color:var(--subtle)}
    .asset-nav{display:flex;align-items:center;gap:7px;min-height:36px;margin:16px 0 10px;color:var(--muted);font-size:12px;overflow-x:auto;white-space:nowrap}
    .asset-nav button{min-height:32px;padding:4px 9px;background:transparent;color:var(--text);border-color:var(--line);font-size:12px}
    .asset-nav-sep{color:var(--muted)}
    .asset-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:10px 0 4px}
    .asset-filter{display:grid;gap:5px;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
    .asset-filter select{width:100%;min-height:42px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:10px;background:var(--bg-deep);color:var(--text);font:inherit;text-transform:none;letter-spacing:normal}
    .asset-status{min-height:22px;margin:8px 0 0;color:var(--muted);font-size:12px}
    .asset-app-grid,.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%;max-width:720px;margin-top:12px}
    .asset-app{position:relative;min-width:0;aspect-ratio:1/1;padding:0;border:1px solid var(--line);border-radius:13px;overflow:hidden;background:var(--bg-deep);color:var(--text);text-align:left}
    .asset-app:hover,.asset-app:focus-visible{border-color:var(--line-strong);filter:none}
    .asset-app img{width:100%;height:100%;display:block;object-fit:cover}
    .asset-app-shade{position:absolute;inset:auto 0 0;padding:30px 8px 8px;background:linear-gradient(transparent,rgba(0,0,0,.86));pointer-events:none}
    .asset-app-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:760}
    .asset-app-count{display:block;margin-top:2px;color:#dce7f8;font-size:10px;font-weight:500}
    .asset-card{min-width:0;border:1px solid var(--line);border-radius:13px;background:var(--bg-deep);overflow:hidden}
    .asset-preview{position:relative;aspect-ratio:1/1;display:block;background:#050805;border-bottom:1px solid var(--line);overflow:hidden}
    .asset-preview img{display:block;width:100%;height:100%;object-fit:cover}
    .asset-card-caption{padding:7px 8px 8px;min-width:0}
    .asset-card-title{display:flex;align-items:center;justify-content:space-between;gap:5px}
    .asset-card-title strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:720}
    .asset-size{flex:0 0 auto;color:var(--muted);font-size:9px}
    .asset-card-sub{margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:9px}
    .asset-card-actions{display:flex;gap:5px;margin-top:6px}
    .asset-card-actions button,.asset-card-actions a{flex:1;min-width:0;min-height:28px;padding:3px 5px;border-radius:7px;font-size:9px;text-align:center}
    .asset-card-actions a{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line-strong);color:var(--text);text-decoration:none}
    .asset-files{margin-top:16px}
    .asset-files details{border-top:1px solid var(--line);padding-top:12px}
    .asset-files summary{cursor:pointer;color:var(--muted);font-size:12px}
    .asset-file-list{display:grid;gap:8px;margin-top:10px}
    .asset-file{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:var(--bg-deep)}
    .asset-file .asset-actions{display:flex;gap:6px}
    .asset-file .asset-actions button,.asset-file .asset-actions a{min-height:30px;padding:4px 7px;font-size:10px}
    .asset-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:12px}
    .asset-facts{margin-top:2px;color:var(--muted);font-size:10px}
    .asset-empty{margin-top:14px;padding:18px;border:1px dashed var(--line);border-radius:12px;color:var(--muted);font-size:12px;text-align:center}
    .asset-app-grid[hidden],.gallery[hidden],.asset-files[hidden],.asset-empty[hidden]{display:none}
    @media(max-width:680px){
      .asset-box{margin-inline:-10px;padding:12px;border-radius:14px}
      .asset-head{align-items:flex-start;flex-direction:column;gap:7px}
      .asset-upload{grid-template-columns:1fr}
      .asset-upload button{width:100%}
      .asset-filters{grid-template-columns:1fr 1fr 1fr;gap:6px}
      .asset-filter{font-size:9px}
      .asset-filter select{min-height:40px;padding:6px;font-size:12px}
      .asset-app-grid,.gallery{gap:5px}
      .asset-app,.asset-card{border-radius:10px}
      .asset-card-caption{padding:5px}
      .asset-card-actions{gap:3px}
      .asset-card-actions button,.asset-card-actions a{min-height:27px;padding:2px 3px;font-size:8px}
    }
  `;
}

export function publicAssetsMarkup() {
  return `
      <div class="asset-box">
        <div class="asset-head">
          <div>
            <h3>Bilder <span id="asset-badge" class="badge"></span></h3>
            <p>Appbilder kategoriseras automatiskt från filnamnet. Galleriet använder små previews men öppnar alltid originalfilen bakom.</p>
          </div>
        </div>
        <div class="asset-upload">
          <input id="asset-files" type="file" multiple accept="image/*,.pdf,.txt,.json,.css">
          <button id="upload-assets" type="button">Ladda upp</button>
          <label class="asset-upload-options"><input id="replace-app-assets" type="checkbox"> Ersätt befintliga appbilder</label>
          <div class="asset-path-hint">Appformat: <code>&lt;app&gt;-t&lt;tema&gt;-1254x1254.png</code>, <code>512x512</code> eller <code>256x256</code>. Övriga filer sparas som generiska uploads.</div>
        </div>
        <nav id="asset-nav" class="asset-nav" aria-label="Bildkategorier">
          <button id="asset-home" type="button">Bilder</button><span class="asset-nav-sep">›</span><span id="asset-nav-current">Apps</span>
        </nav>
        <div class="asset-filters" role="group" aria-label="Filtrera appbilder">
          <label class="asset-filter">App
            <select id="asset-filter-app"><option value="">Alla appar</option></select>
          </label>
          <label class="asset-filter">Tema
            <select id="asset-filter-theme"><option value="">Alla teman</option></select>
          </label>
          <label class="asset-filter">Storlek
            <select id="asset-filter-size">
              <option value="">Original 1254</option>
              <option value="512">512</option>
              <option value="256">256</option>
              <option value="all">Alla</option>
            </select>
          </label>
        </div>
        <div id="asset-status" class="asset-status" role="status" aria-live="polite" aria-atomic="true"></div>
        <div id="asset-empty" class="asset-empty" hidden>Inga bilder matchar filtret.</div>
        <div id="asset-app-grid" class="asset-app-grid" aria-label="Applikationer"></div>
        <div id="asset-gallery" class="gallery" hidden aria-label="Bilder"></div>
        <div id="asset-files" class="asset-files" hidden>
          <details><summary id="asset-file-summary">Övriga filer</summary><div id="asset-file-list" class="asset-file-list"></div></details>
        </div>
      </div>
  `;
}

export function resolveAssetFilter({ app = "", size = "", theme = "" } = {}) {
  const browseApps = !app && !size && !theme;
  const effectiveSize = size === "all" ? "" : (size || (browseApps ? "" : "1254"));
  return { app, size, theme, browseApps, effectiveSize };
}

export function filterAssetRecords(assets, filters = {}) {
  const resolved = resolveAssetFilter(filters);
  if (resolved.browseApps) return [];
  return assets.filter((asset) => {
    const pixel = asset.pixelSize ? String(asset.pixelSize) : "";
    return (!resolved.app || asset.appCategory === resolved.app)
      && (!resolved.theme || asset.theme === resolved.theme)
      && (!resolved.effectiveSize || pixel === resolved.effectiveSize);
  });
}

export function filterAssetCards(cards, filters = {}) {
  const resolved = resolveAssetFilter(filters);
  let visible = 0;
  for (const card of cards) {
    const show = !resolved.browseApps
      && (!resolved.app || card.dataset.app === resolved.app)
      && (!resolved.theme || card.dataset.theme === resolved.theme)
      && (!resolved.effectiveSize || card.dataset.size === resolved.effectiveSize);
    card.hidden = !show;
    if (show) visible += 1;
  }
  const filtered = !resolved.browseApps;
  return {
    visible,
    filtered,
    browseApps: resolved.browseApps,
    effectiveSize: resolved.effectiveSize,
    message: filtered ? visible + " bild" + (visible === 1 ? "" : "er") + " visas." : "",
  };
}

export function bindAssetFilterChanges(selects, apply) {
  for (const select of selects) select?.addEventListener("change", apply);
}

export function publicAssetsScript() {
  return `
const resolveAssetFilter=${resolveAssetFilter.toString()};
const filterAssetRecords=${filterAssetRecords.toString()};
const bindAssetFilterChanges=${bindAssetFilterChanges.toString()};
let currentAssets=[];
const formatLabel=(type,name)=>{
  const ext=(name.split('.').pop()||'').toUpperCase();
  const map={'image/jpeg':'JPEG','image/png':'PNG','image/webp':'WEBP','image/gif':'GIF','image/avif':'AVIF','image/svg+xml':'SVG','image/x-icon':'ICO','image/vnd.microsoft.icon':'ICO'};
  return map[type]||ext||type||'FIL';
};
const assetButton=(label,handler)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',handler);return b};
async function copyAssetLink(url){
  try{await navigator.clipboard.writeText(url);$('#asset-status').textContent='Direktlänken är kopierad.'}
  catch{const input=document.createElement('textarea');input.value=url;document.body.append(input);input.select();document.execCommand('copy');input.remove();$('#asset-status').textContent='Direktlänken är kopierad.'}
}
function assetActions(asset,compact=false){
  const wrap=document.createElement('div');wrap.className=compact?'asset-card-actions':'asset-actions';
  wrap.append(assetButton('Kopiera',()=>copyAssetLink(asset.directUrl)));
  const open=document.createElement('a');open.href=asset.previewUrl||asset.directUrl;open.target='_blank';open.rel='noopener';open.textContent='Öppna';wrap.append(open);
  return wrap;
}
function appAssets(assets){return assets.filter((asset)=>asset.image&&asset.appCategory&&asset.theme&&asset.pixelSize)}
function findPreview(assets,asset){
  return assets.find((candidate)=>candidate.appCategory===asset.appCategory&&candidate.theme===asset.theme&&candidate.pixelSize===256)
    ||assets.find((candidate)=>candidate.appCategory===asset.appCategory&&candidate.theme===asset.theme&&candidate.pixelSize===512)
    ||asset;
}
function fillAssetFilter(id,items,allLabel){
  const select=$(id),selected=select.value;
  select.replaceChildren(new Option(allLabel,''));
  for(const item of items)select.append(new Option(item.label,item.value));
  select.value=[...select.options].some((option)=>option.value===selected)?selected:'';
}
function rebuildAssetFilters(assets){
  const structured=appAssets(assets);
  const apps=[...new Map(structured.map((asset)=>[asset.appCategory,asset.appLabel||asset.appCategory])).entries()]
    .sort((a,b)=>a[1].localeCompare(b[1],'sv')).map(([value,label])=>({value,label}));
  const themes=[...new Map(structured.map((asset)=>[asset.theme,asset.themeLabel||('Tema '+asset.theme)])).entries()]
    .sort((a,b)=>Number(a[0])-Number(b[0])).map(([value,label])=>({value,label}));
  fillAssetFilter('#asset-filter-app',apps,'Alla appar');
  fillAssetFilter('#asset-filter-theme',themes,'Alla teman');
}
function renderAppBrowser(assets){
  const grid=$('#asset-app-grid');grid.replaceChildren();
  const structured=appAssets(assets),groups=new Map();
  for(const asset of structured){
    if(!groups.has(asset.appCategory))groups.set(asset.appCategory,[]);
    groups.get(asset.appCategory).push(asset);
  }
  const entries=[...groups.entries()].sort((a,b)=>{
    const an=a[1][0]?.appLabel||a[0],bn=b[1][0]?.appLabel||b[0];
    return an.localeCompare(bn,'sv');
  });
  for(const [app,items] of entries){
    const representative=items.find((item)=>item.theme==='1'&&item.pixelSize===256)
      ||items.find((item)=>item.pixelSize===256)
      ||items.find((item)=>item.pixelSize===512)
      ||items[0];
    const button=document.createElement('button');button.type='button';button.className='asset-app';
    button.setAttribute('aria-label','Visa '+(representative.appLabel||app));
    const img=document.createElement('img');img.src=representative.previewUrl||representative.directUrl;img.alt='';img.loading='lazy';img.decoding='async';
    const shade=document.createElement('span');shade.className='asset-app-shade';
    const name=document.createElement('span');name.className='asset-app-name';name.textContent=representative.appLabel||app;
    const count=document.createElement('span');count.className='asset-app-count';count.textContent=new Set(items.map((item)=>item.theme)).size+' teman';
    shade.append(name,count);button.append(img,shade);
    button.addEventListener('click',()=>{$('#asset-filter-app').value=app;applyAssetFilters(true)});
    grid.append(button);
  }
}
function renderGallery(assets,filters){
  const gallery=$('#asset-gallery');gallery.replaceChildren();
  const structured=appAssets(assets),matches=filterAssetRecords(structured,filters);
  for(const asset of matches){
    const card=document.createElement('article');card.className='asset-card';
    const previewAsset=findPreview(structured,asset);
    const open=document.createElement('a');open.className='asset-preview';open.href=asset.previewUrl||asset.directUrl;open.target='_blank';open.rel='noopener';
    const img=document.createElement('img');img.src=previewAsset.previewUrl||previewAsset.directUrl;img.alt=(asset.appLabel||asset.appCategory)+' · '+(asset.themeLabel||('Tema '+asset.theme));img.loading='lazy';img.decoding='async';
    open.append(img);card.append(open);
    const caption=document.createElement('div');caption.className='asset-card-caption';
    const title=document.createElement('div');title.className='asset-card-title';
    const strong=document.createElement('strong');strong.textContent=asset.appLabel||asset.appCategory;
    const size=document.createElement('span');size.className='asset-size';size.textContent=asset.pixelLabel||'';
    title.append(strong,size);
    const sub=document.createElement('div');sub.className='asset-card-sub';sub.textContent=asset.themeLabel||('Tema '+asset.theme);
    caption.append(title,sub,assetActions(asset,true));card.append(caption);gallery.append(card);
  }
  return matches.length;
}
function renderOtherFiles(assets){
  const wrap=$('#asset-files'),list=$('#asset-file-list'),summary=$('#asset-file-summary');list.replaceChildren();
  const other=assets.filter((asset)=>!(asset.image&&asset.appCategory&&asset.theme&&asset.pixelSize));
  wrap.hidden=other.length===0;summary.textContent='Övriga filer · '+other.length;
  for(const asset of other){
    const row=document.createElement('div');row.className='asset-file';const meta=document.createElement('div');
    const name=document.createElement('div');name.className='asset-name';name.textContent=asset.name;name.title=asset.name;
    const facts=document.createElement('div');facts.className='asset-facts';facts.textContent=bytes(asset.size)+' · '+formatLabel(asset.contentType,asset.name);
    meta.append(name,facts);row.append(meta,assetActions(asset));list.append(row);
  }
}
function currentAssetFilters(){return {app:$('#asset-filter-app').value,theme:$('#asset-filter-theme').value,size:$('#asset-filter-size').value}}
function updateAssetNav(filters){
  const parts=[];
  if(filters.app){const option=[...$('#asset-filter-app').options].find((item)=>item.value===filters.app);if(option)parts.push(option.textContent)}
  if(filters.theme){const option=[...$('#asset-filter-theme').options].find((item)=>item.value===filters.theme);if(option)parts.push(option.textContent)}
  if(filters.size)parts.push(filters.size==='all'?'Alla storlekar':filters.size+'×'+filters.size);
  $('#asset-nav-current').textContent=parts.length?parts.join(' › '):'Apps';
}
function applyAssetFilters(scroll=false){
  const filters=currentAssetFilters(),resolved=resolveAssetFilter(filters);updateAssetNav(filters);
  $('#asset-app-grid').hidden=!resolved.browseApps;$('#asset-gallery').hidden=resolved.browseApps;
  let visible=0;if(resolved.browseApps)renderAppBrowser(currentAssets);else visible=renderGallery(currentAssets,filters);
  const empty=appAssets(currentAssets).length===0||(resolved.browseApps?false:visible===0);$('#asset-empty').hidden=!empty;
  $('#asset-status').textContent=resolved.browseApps
    ?'Välj en app eller kombinera tema och storlek.'
    :visible+' bild'+(visible===1?'':'er')+' visas'+(!filters.size?' · original 1254':'')+'.';
  if(scroll)$('#asset-nav').scrollIntoView({behavior:'smooth',block:'start'});
}
bindAssetFilterChanges(['#asset-filter-app','#asset-filter-size','#asset-filter-theme'].map((id)=>$(id)),()=>applyAssetFilters(false));
$('#asset-home')?.addEventListener('click',()=>{$('#asset-filter-app').value='';$('#asset-filter-theme').value='';$('#asset-filter-size').value='';applyAssetFilters(false)});
function renderAssets(assets,state='available'){
  currentAssets=assets||[];
  const empty=$('#asset-empty'),badge=$('#asset-badge'),status=$('#asset-status');
  if(state!=='available'){
    const message=state==='not_configured'?'Assetlagret är inte konfigurerat.':'Assetlagret är tillfälligt otillgängligt.';
    $('#asset-app-grid').replaceChildren();$('#asset-gallery').replaceChildren();empty.textContent=message;empty.hidden=false;
    badge.textContent=state==='not_configured'?'ej konfigurerat':'otillgängligt';status.textContent=message;return;
  }
  empty.textContent='Inga bilder matchar filtret.';rebuildAssetFilters(currentAssets);renderOtherFiles(currentAssets);
  const structured=appAssets(currentAssets);badge.textContent=structured.length+' appbilder';applyAssetFilters(false);
}
$('#upload-assets')?.addEventListener('click',async()=>{
  const input=$('#asset-files'),selected=[...(input?.files||[])];
  if(!selected.length){$('#asset-status').textContent='Välj minst en fil först.';return}
  $('#upload-assets').disabled=true;const replace=$('#replace-app-assets')?.checked===true;
  try{
    let done=0,categorized=0,replaced=0;
    for(const file of selected){
      $('#asset-status').textContent='Laddar upp '+file.name+'…';
      const suffix=replace?'?replace=1':'';
      const r=await fetch('/admin/api/assets/upload/'+encodeURIComponent(file.name)+suffix,{method:'PUT',headers:{'content-type':file.type||'application/octet-stream'},body:file,credentials:'same-origin',cache:'no-store'});
      if(!r.ok){let detail='';try{const data=await r.json();detail=data.error||''}catch{}throw new Error(detail||('Uppladdning misslyckades för '+file.name+'.'))}
      const data=await r.json();done+=1;if(data.categorized)categorized+=1;if(data.replaced)replaced+=1;
    }
    input.value='';await loadObjects();
    $('#asset-status').textContent=done+' filer uppladdade · '+categorized+' appbilder kategoriserade'+(replaced?' · '+replaced+' ersatta':'')+'.';
  }catch(err){$('#asset-status').textContent=err.message||'Uppladdningen misslyckades.'}
  finally{$('#upload-assets').disabled=false}
});
  `;
}
