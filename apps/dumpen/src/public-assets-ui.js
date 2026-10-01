export function publicAssetsCss() {
  return `
    .asset-box{margin:18px 0 22px;padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
    .asset-box h3{margin:0 0 8px;font-size:16px;font-weight:500;color:var(--text)}
    .asset-box p{margin:0 0 14px}
    .asset-upload{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .asset-upload input{max-width:100%;font:inherit;color:var(--text)}
    .asset-status{min-height:22px;margin-top:8px;color:var(--muted);font-size:13px}
    .gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin-top:18px}
    .asset-card{min-width:0;border:1px solid var(--line);border-radius:8px;background:var(--bg-deep);overflow:hidden}
    .asset-preview{aspect-ratio:1/1;display:grid;place-items:center;background:#050805;border-bottom:1px solid var(--line)}
    .asset-preview img{display:block;max-width:100%;max-height:100%;object-fit:contain}
    .asset-meta{padding:10px 11px}.asset-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
    .asset-facts{margin-top:4px;color:var(--muted);font-size:12px}
    .asset-actions{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}
    .asset-actions button,.asset-actions a{min-height:32px;padding:5px 9px;font:inherit;font-size:12px;border-radius:5px}
    .asset-actions a{display:inline-flex;align-items:center;color:var(--green);border:1px solid var(--green2);text-decoration:none}
    .asset-files{margin-top:16px;display:grid;gap:8px}
    .asset-file{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 11px;border:1px solid var(--line);border-radius:7px;background:var(--bg-deep)}
    .asset-empty{margin-top:14px;color:var(--muted);font-size:13px}
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
function renderAssets(assets,state='available'){
  const gallery=$('#asset-gallery'),files=$('#asset-file-list'),empty=$('#asset-empty'),badge=$('#asset-badge'),status=$('#asset-status');
  gallery.replaceChildren();files.replaceChildren();
  if(state!=='available'){
    const message=state==='not_configured'?'Assetlagret är inte konfigurerat.':'Assetlagret är tillfälligt otillgängligt.';
    empty.textContent=message;empty.hidden=false;badge.textContent=state==='not_configured'?'ej konfigurerat':'otillgängligt';status.textContent=message;
    return;
  }
  empty.textContent='Inga publika filer uppladdade ännu.';empty.hidden=assets.length!==0;
  badge.textContent=assets.length+' objekt';
  for(const asset of assets){
    if(asset.image){
      const card=document.createElement('article');card.className='asset-card';
      const preview=document.createElement('div');preview.className='asset-preview';
      const img=document.createElement('img');img.src=asset.directUrl;img.alt=asset.name;img.loading='lazy';
      preview.append(img);card.append(preview);
      const meta=document.createElement('div');meta.className='asset-meta';
      const name=document.createElement('div');name.className='asset-name';name.textContent=asset.name;name.title=asset.name;meta.append(name);
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
    $('#asset-status').textContent=done+' fil'+(done===1?'':'er')+' uppladdad'+(done===1?'':'e')+'.';
    await loadObjects();
  }catch(err){$('#asset-status').textContent=err.message||'Uppladdningen misslyckades.'}
  finally{$('#upload-assets').disabled=false}
});
  `;
}
