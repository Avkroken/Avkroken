export function publicAssetsCss() {
  return `
    .asset-box{margin:18px 0 22px;padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
    .asset-box h3{margin:0 0 8px;font-size:16px;font-weight:500;color:var(--text)}
    .asset-box p{margin:0 0 14px}
    .asset-upload{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .asset-upload input{max-width:100%;font:inherit;color:var(--text)}
    .asset-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0 2px}
    .asset-filter{display:grid;gap:5px;color:var(--muted);font-size:12px}
    .asset-filter select{width:100%;min-height:38px;padding:6px 9px;border:1px solid var(--line);border-radius:6px;background:var(--bg-deep);color:var(--text);font:inherit}
    .asset-status{min-height:22px;margin-top:8px;color:var(--muted);font-size:13px}
    .gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin-top:18px}
    .asset-card{min-width:0;border:1px solid var(--line);border-radius:8px;background:var(--bg-deep);overflow:hidden}
    .asset-preview{aspect-ratio:1/1;display:grid;place-items:center;background:#050805;border-bottom:1px solid var(--line)}
    .asset-preview img{display:block;max-width:100%;max-height:100%;object-fit:contain}
    .asset-meta{padding:10px 11px}.asset-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
    .asset-facts{margin-top:4px;color:var(--muted);font-size:12px}
    .asset-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.asset-tag{padding:2px 6px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:11px}
    .asset-actions{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}
    .asset-actions button,.asset-actions a{min-height:32px;padding:5px 9px;font:inherit;font-size:12px;border-radius:5px}
    .asset-actions a{display:inline-flex;align-items:center;color:var(--green);border:1px solid var(--green2);text-decoration:none}
    .asset-files{margin-top:16px;display:grid;gap:8px}
    .asset-file{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 11px;border:1px solid var(--line);border-radius:7px;background:var(--bg-deep)}
    .asset-empty{margin-top:14px;color:var(--muted);font-size:13px}
    .asset-card[hidden],.asset-file[hidden]{display:none}
    @media(max-width:680px){.asset-filters{grid-template-columns:1fr}}
  `;
}
export function publicAssetsMarkup() {
  return `
      <div class="asset-box">
        <h3>Publika filer och bilder <span id="asset-badge" class="badge"></span></h3>
        <p>Filerna kommer från R2-bucketen <code>avkroken-assets</code>. Varje objekt får en stabil direktlänk på <code>logos.denied.se</code> som kan användas i exempelvis Cloudflare App Launcher. Bucketen är inte publikt listbar.</p>
        <div class="asset-upload">
          <input id="asset-files" type="file" multiple>
          <button id="upload-assets" type="button">Ladda upp filer</button>
        </div>
        <div class="asset-filters" role="group" aria-label="Filtrera appbilder">
          <label class="asset-filter">Appkategori
            <select id="asset-filter-app"><option value="">Alla appar</option></select>
          </label>
          <label class="asset-filter">Pixelstorlek
            <select id="asset-filter-size"><option value="">Alla storlekar</option></select>
          </label>
          <label class="asset-filter">Tema
            <select id="asset-filter-theme"><option value="">Alla teman</option></select>
          </label>
        </div>
        <div id="asset-status" class="asset-status" role="status" aria-live="polite" aria-atomic="true"></div>
        <div id="asset-empty" class="asset-empty" hidden>Inga publika filer uppladdade ännu.</div>
        <div id="asset-gallery" class="gallery"></div>
        <div id="asset-file-list" class="asset-files"></div>
      </div>
  `;
}
export function publicAssetsScript() {
  return `
const formatLabel=(type,name)=>{
  const ext=(name.split('.').pop()||'').toUpperCase();
  const map={'image/jpeg':'JPEG','image/png':'PNG','image/webp':'WEBP','image/gif':'GIF','image/avif':'AVIF','image/svg+xml':'SVG','image/x-icon':'ICO','image/vnd.microsoft.icon':'ICO'};
  return map[type]||ext||type||'FIL';
};
const assetButton=(label,handler,cls='')=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(cls)b.className=cls;b.addEventListener('click',handler);return b};
async function copyAssetLink(url){
  try{await navigator.clipboard.writeText(url);$('#asset-status').textContent='Direktlänken är kopierad.'}
  catch{const input=document.createElement('textarea');input.value=url;document.body.append(input);input.select();document.execCommand('copy');input.remove();$('#asset-status').textContent='Direktlänken är kopierad.'}
}
function assetActions(asset){
  const wrap=document.createElement('div');wrap.className='asset-actions';
  wrap.append(assetButton('Kopiera länk',()=>copyAssetLink(asset.directUrl)));
  const open=document.createElement('a');open.href=asset.directUrl;open.target='_blank';open.rel='noopener';open.textContent='Öppna';wrap.append(open);
  return wrap;
}
function assetFilterValue(asset,kind){
  if(kind==='app')return asset.appCategory||'';
  if(kind==='size')return asset.pixelSize?String(asset.pixelSize):(asset.variant==='original'?'original':'');
  if(kind==='theme')return asset.theme||'';
  return '';
}
function fillAssetFilter(id,items,allLabel){
  const select=$(id),selected=select.value;
  select.replaceChildren(new Option(allLabel,''));
  for(const item of items)select.append(new Option(item.label,item.value));
  select.value=[...select.options].some((option)=>option.value===selected)?selected:'';
}
function rebuildAssetFilters(assets){
  const structured=assets.filter((asset)=>asset.image&&asset.appCategory&&asset.theme);
  const apps=[...new Map(structured.map((asset)=>[asset.appCategory,asset.appLabel||asset.appCategory])).entries()]
    .sort((a,b)=>a[1].localeCompare(b[1],'sv')).map(([value,label])=>({value,label}));
  const sizes=[...new Set(structured.map((asset)=>assetFilterValue(asset,'size')).filter(Boolean))]
    .sort((a,b)=>a==='original'?-1:b==='original'?1:Number(a)-Number(b))
    .map((value)=>({value,label:value==='original'?'Original':value+'×'+value}));
  const themes=[...new Set(structured.map((asset)=>asset.theme))]
    .sort((a,b)=>Number(a)-Number(b)).map((value)=>({value,label:'Tema '+value}));
  fillAssetFilter('#asset-filter-app',apps,'Alla appar');
  fillAssetFilter('#asset-filter-size',sizes,'Alla storlekar');
  fillAssetFilter('#asset-filter-theme',themes,'Alla teman');
}
function applyAssetFilters(){
  const app=$('#asset-filter-app').value,size=$('#asset-filter-size').value,theme=$('#asset-filter-theme').value;
  let visible=0;
  for(const card of document.querySelectorAll('#asset-gallery .asset-card')){
    const show=(!app||card.dataset.app===app)&&(!size||card.dataset.size===size)&&(!theme||card.dataset.theme===theme);
    card.hidden=!show;if(show)visible+=1;
  }
  const filtered=Boolean(app||size||theme);
  $('#asset-status').textContent=filtered?visible+' bild'+(visible===1?'':'er')+' matchar filtret.':'';
}
function assetTags(asset){
  const wrap=document.createElement('div');wrap.className='asset-tags';
  for(const label of [asset.appLabel,asset.themeLabel,asset.pixelLabel].filter(Boolean)){
    const tag=document.createElement('span');tag.className='asset-tag';tag.textContent=label;wrap.append(tag);
  }
  return wrap;
}
for(const id of ['#asset-filter-app','#asset-filter-size','#asset-filter-theme']){
  $(id)?.addEventListener('change',applyAssetFilters);
}
function renderAssets(assets,state='available'){
  const gallery=$('#asset-gallery'),files=$('#asset-file-list'),empty=$('#asset-empty'),badge=$('#asset-badge'),status=$('#asset-status');
  gallery.replaceChildren();files.replaceChildren();
  if(state!=='available'){
    const message=state==='not_configured'?'Assetlagret är inte konfigurerat.':'Assetlagret är tillfälligt otillgängligt.';
    empty.textContent=message;empty.hidden=false;badge.textContent=state==='not_configured'?'ej konfigurerat':'otillgängligt';status.textContent=message;
    return;
  }
  rebuildAssetFilters(assets);status.textContent='';
  empty.textContent='Inga publika filer uppladdade ännu.';empty.hidden=assets.length!==0;
  badge.textContent=assets.length+' objekt';
  for(const asset of assets){
    if(asset.image){
      const card=document.createElement('article');card.className='asset-card';
      card.dataset.app=assetFilterValue(asset,'app');
      card.dataset.size=assetFilterValue(asset,'size');
      card.dataset.theme=assetFilterValue(asset,'theme');
      const preview=document.createElement('div');preview.className='asset-preview';
      const img=document.createElement('img');img.src=asset.directUrl;img.alt=asset.name;img.loading='lazy';
      preview.append(img);card.append(preview);
      const meta=document.createElement('div');meta.className='asset-meta';
      const name=document.createElement('div');name.className='asset-name';name.textContent=asset.name;name.title=asset.name;meta.append(name);
      if(asset.appCategory)meta.append(assetTags(asset));
      const facts=document.createElement('div');facts.className='asset-facts';
      const base=bytes(asset.size)+' · '+formatLabel(asset.contentType,asset.name);
      facts.textContent=base+' · läser pixlar…';
      img.addEventListener('load',()=>{facts.textContent=bytes(asset.size)+' · '+img.naturalWidth+'×'+img.naturalHeight+' px · '+formatLabel(asset.contentType,asset.name)});
      img.addEventListener('error',()=>{facts.textContent=base+' · dimension okänd'});
      meta.append(facts,assetActions(asset));card.append(meta);gallery.append(card);
    }else{
      const row=document.createElement('div');row.className='asset-file';
      const meta=document.createElement('div');
      const name=document.createElement('div');name.className='asset-name';name.textContent=asset.name;name.title=asset.name;
      const facts=document.createElement('div');facts.className='asset-facts';facts.textContent=bytes(asset.size)+' · '+formatLabel(asset.contentType,asset.name);
      meta.append(name,facts);row.append(meta,assetActions(asset));files.append(row);
    }
  }
  applyAssetFilters();
}
$('#upload-assets')?.addEventListener('click',async()=>{
  const input=$('#asset-files'),selected=[...(input?.files||[])];
  if(!selected.length){$('#asset-status').textContent='Välj minst en fil först.';return}
  $('#upload-assets').disabled=true;
  try{
    let done=0;
    for(const file of selected){
      $('#asset-status').textContent='Laddar upp '+file.name+'…';
      const r=await fetch('/admin/api/assets/upload/'+encodeURIComponent(file.name),{
        method:'PUT',
        headers:{'content-type':file.type||'application/octet-stream'},
        body:file,
        credentials:'same-origin',
        cache:'no-store'
      });
      if(!r.ok)throw new Error('Uppladdning misslyckades för '+file.name+'.');
      done+=1;
    }
    input.value='';
    await loadObjects();
    $('#asset-status').textContent=done+' fil'+(done===1?'':'er')+' uppladdad'+(done===1?'':'e')+'.';
  }catch(err){$('#asset-status').textContent=err.message||'Uppladdningen misslyckades.'}
  finally{$('#upload-assets').disabled=false}
});
  `;
}
