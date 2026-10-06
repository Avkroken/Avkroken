
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

export function publicAssetsCss() {
  return [
    ".asset-box{position:relative;margin:24px 0 28px;padding:clamp(16px,2.4vw,28px);border:1px solid var(--line);border-radius:24px;background:linear-gradient(180deg,color-mix(in srgb,var(--panel) 96%,transparent),color-mix(in srgb,var(--bg-deep) 96%,transparent));box-shadow:var(--shadow-lg);overflow:hidden}.asset-box::before{content:\"\";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--green) 55%,transparent),transparent);pointer-events:none}",
    ".asset-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px}.asset-head h3{margin:0;font-size:clamp(1.35rem,2.4vw,1.8rem);font-weight:760;letter-spacing:-.035em}.asset-head p{margin:6px 0 0;color:var(--muted);font-size:14px;line-height:1.6;max-width:780px}",
    ".asset-dropzone{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.72fr);gap:18px;align-items:center;padding:20px;border:1px solid var(--line-strong);border-radius:18px;background:color-mix(in srgb,var(--panel-2) 72%,var(--bg-deep));transition:border-color .15s,background .15s,transform .15s}.asset-dropzone[data-drag=true]{border-color:var(--green);background:color-mix(in srgb,var(--green) 7%,var(--panel-2));transform:translateY(-1px)}.asset-drop-copy{display:flex;align-items:center;gap:14px;min-width:0}.asset-drop-icon{display:grid;place-items:center;width:44px;height:44px;flex:0 0 auto;border:1px solid color-mix(in srgb,var(--green) 40%,var(--line));border-radius:13px;background:color-mix(in srgb,var(--green) 8%,var(--bg-deep));color:var(--green);font-size:22px;font-weight:500}.asset-dropzone strong{display:block;font-size:15px;letter-spacing:-.01em}.asset-dropzone p{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:1.45}",
    ".asset-picker-row{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}.asset-picker{position:relative;display:flex;min-width:0;min-height:54px;flex-direction:column;justify-content:center;padding:10px 14px;border:1px solid var(--line-strong);border-radius:13px;background:var(--surface-raised);color:var(--text);cursor:pointer;overflow:hidden;isolation:isolate}.asset-picker-primary{border-color:color-mix(in srgb,var(--green) 45%,var(--line-strong));background:color-mix(in srgb,var(--green) 8%,var(--surface-raised))}.asset-picker span{font-size:13px;font-weight:760}.asset-picker small{margin-top:2px;color:var(--muted);font-size:10px}.asset-picker input[type=file]{position:absolute;inset:0;z-index:2;width:100%;height:100%;opacity:0;cursor:pointer;font-size:40px}.asset-picker:focus-within{outline:2px solid var(--green);outline-offset:2px}",
    ".asset-upload-config{display:grid;grid-template-columns:minmax(220px,320px) minmax(0,1fr);gap:10px;margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--bg-deep) 62%,transparent)}.asset-upload-config label,.asset-filter{display:grid;gap:6px;color:var(--muted);font-size:10px;font-weight:720;letter-spacing:.055em;text-transform:uppercase}.asset-upload-config select,.asset-filter select,.asset-search input{width:100%;min-height:44px;padding:9px 11px;border:1px solid var(--line);border-radius:11px;background:var(--surface-control);color:var(--text);font-family:inherit;font-size:14px;text-transform:none;letter-spacing:normal;outline:none}.asset-upload-config select:focus,.asset-filter select:focus,.asset-search input:focus{border-color:color-mix(in srgb,var(--green) 55%,var(--line-strong));box-shadow:0 0 0 3px color-mix(in srgb,var(--green) 10%,transparent)}.asset-upload-hint{align-self:end;margin:0 0 4px;color:var(--muted);font-size:12px;line-height:1.45}.asset-theme-config{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding-top:12px;border-top:1px solid var(--line)}.asset-theme-config[hidden]{display:none}.asset-upload-options{display:flex!important;justify-content:flex-start;align-items:center;align-self:end;min-height:44px;padding:0 4px;gap:9px!important;text-transform:none!important;letter-spacing:normal!important}.asset-upload-options input{width:19px;height:19px;accent-color:var(--green)}",
    ".asset-queue-panel{margin-top:12px;padding:12px;border:1px solid var(--line-strong);border-radius:16px;background:color-mix(in srgb,var(--surface-raised) 78%,var(--bg-deep))}.asset-queue-panel[hidden]{display:none}.asset-queue-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.asset-queue-title{display:flex;align-items:baseline;gap:8px}.asset-queue-title strong{font-size:13px}.asset-queue-count{color:var(--muted);font-size:11px}.asset-queue-primary{min-width:118px}.asset-queue-toolbar{display:flex;gap:8px;align-items:center}.asset-queue-toolbar button{min-height:40px}.asset-queue{display:grid;gap:9px}.asset-queue[hidden]{display:none}.asset-queue-item{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:14px;background:var(--surface-raised)}.asset-queue-thumb{width:54px;height:54px;border-radius:11px;object-fit:cover;background:#050805}.asset-queue-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:750}.asset-queue-meta{margin-top:3px;color:var(--muted);font-size:10px}.asset-progress{height:5px;margin-top:7px;border-radius:99px;background:var(--panel-2);overflow:hidden}.asset-progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--green),var(--secondary));transition:width .15s}.asset-queue-actions{display:flex;gap:6px}.asset-queue-actions button{min-height:36px;padding:6px 9px;font-size:11px}",
    ".asset-toolbar{display:grid;grid-template-columns:minmax(220px,1.8fr) repeat(5,minmax(115px,1fr));gap:10px;margin:20px 0 10px;padding-top:18px;border-top:1px solid var(--line)}.asset-search{display:grid;gap:6px;color:var(--muted);font-size:10px;font-weight:720;letter-spacing:.055em;text-transform:uppercase}",
    ".asset-nav{display:flex;align-items:center;gap:8px;min-height:38px;margin:8px 0;color:var(--muted);font-size:12px;overflow-x:auto;white-space:nowrap}.asset-nav button{min-height:34px;padding:5px 10px;background:transparent;color:var(--text);border-color:var(--line);font-size:12px}.asset-nav-sep{color:var(--muted)}.asset-status{min-height:24px;margin:5px 0 2px;color:var(--muted);font-size:12px}",
    ".asset-app-grid,.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;width:100%;margin-top:12px}.asset-app{position:relative;min-width:0;aspect-ratio:1/1;padding:0;border:1px solid var(--line);border-radius:17px;overflow:hidden;background:var(--surface-raised);color:var(--text);text-align:left;box-shadow:var(--shadow-sm);transition:transform .16s,border-color .16s,box-shadow .16s}.asset-app:hover,.asset-app:focus-visible{border-color:color-mix(in srgb,var(--green) 35%,var(--line-strong));filter:none;transform:translateY(-2px);box-shadow:var(--shadow-md)}.asset-app img{width:100%;height:100%;display:block;object-fit:cover}.asset-app-shade{position:absolute;inset:auto 0 0;padding:48px 12px 12px;background:linear-gradient(transparent,rgba(2,6,4,.94));pointer-events:none}.asset-app-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:780}.asset-app-count{display:block;margin-top:3px;color:#dce7df;font-size:10px}",
    ".asset-card{min-width:0;border:1px solid var(--line);border-radius:17px;background:var(--surface-raised);overflow:hidden;box-shadow:var(--shadow-sm);transition:transform .16s,border-color .16s,box-shadow .16s}.asset-card:hover{border-color:var(--line-strong);transform:translateY(-2px);box-shadow:var(--shadow-md)}.asset-preview{position:relative;aspect-ratio:1/1;display:block;width:100%;padding:0;border:0;border-radius:0;background:#050805;overflow:hidden}.asset-preview img{display:block;width:100%;height:100%;object-fit:cover}.asset-card-caption{padding:11px;min-width:0}.asset-card-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.asset-card-title strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.asset-size{flex:0 0 auto;color:var(--muted);font-size:10px}.asset-card-sub{margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:10px}.asset-card-actions{display:flex;gap:7px;margin-top:9px}.asset-card-actions button,.asset-card-actions a{flex:1;min-width:0;min-height:38px;padding:6px 8px;border-radius:10px;font-size:11px;text-align:center}.asset-card-actions a{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line-strong);color:var(--text);text-decoration:none}",
    ".asset-files{margin-top:18px}.asset-files details{border-top:1px solid var(--line);padding-top:12px}.asset-files summary{cursor:pointer;color:var(--muted);font-size:12px}.asset-file-list{display:grid;gap:8px;margin-top:10px}.asset-file{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-raised)}.asset-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.asset-facts{margin-top:2px;color:var(--muted);font-size:10px}",
    ".asset-empty{margin-top:14px;padding:24px;border:1px dashed var(--line-strong);border-radius:16px;color:var(--muted);font-size:12px;text-align:center;background:color-mix(in srgb,var(--surface-raised) 70%,transparent)}.asset-app-grid[hidden],.gallery[hidden],.asset-files[hidden],.asset-empty[hidden]{display:none}",
    ".asset-dialog{width:min(880px,calc(100% - 32px));max-height:90vh;padding:0;border:1px solid var(--line-strong);border-radius:22px;background:var(--panel);color:var(--text);box-shadow:0 32px 110px rgba(0,0,0,.68)}.asset-dialog::backdrop{background:rgba(0,0,0,.76);backdrop-filter:blur(8px)}.asset-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}.asset-dialog-head h4{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px}.asset-dialog-close{min-height:40px;padding:6px 10px}.asset-dialog-body{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:20px;padding:18px}.asset-dialog-preview{aspect-ratio:1/1;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#050805}.asset-dialog-preview img{width:100%;height:100%;display:block;object-fit:contain}.asset-dialog-info{min-width:0}.asset-dialog-facts{display:grid;gap:9px;margin:0}.asset-dialog-facts div{padding-bottom:8px;border-bottom:1px solid var(--line)}.asset-dialog-facts dt{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.05em}.asset-dialog-facts dd{margin:3px 0 0;overflow-wrap:anywhere;font-size:12px}.asset-dialog-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.asset-dialog-actions .danger{color:var(--danger)}.asset-dialog-file-action{position:relative;display:flex;align-items:center;justify-content:center;min-height:42px;padding:8px 10px;border:1px solid var(--line-strong);border-radius:10px;background:var(--control-bg);color:var(--control-text);font-weight:700;cursor:pointer;overflow:hidden}.asset-dialog-file-action[aria-disabled=true]{opacity:.45;pointer-events:none}.asset-dialog-file-action input[type=file]{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:40px}",
    "@media(max-width:980px){.asset-toolbar{grid-template-columns:repeat(3,minmax(0,1fr))}.asset-search{grid-column:1/-1}.asset-upload-config{grid-template-columns:1fr}.asset-theme-config{grid-template-columns:repeat(2,minmax(0,1fr))}.asset-upload-options{grid-column:1/-1}.asset-dropzone{grid-template-columns:1fr}}",
    "@media(max-width:680px){.asset-box{margin-inline:-4px;padding:14px;border-radius:20px}.asset-head{align-items:flex-start;flex-direction:column;gap:7px}.asset-dropzone{padding:14px;gap:14px}.asset-drop-copy{align-items:flex-start}.asset-drop-icon{width:40px;height:40px}.asset-picker-row{grid-template-columns:1fr}.asset-picker{min-height:58px;padding:10px 12px}.asset-upload-config{grid-template-columns:1fr;padding:12px}.asset-theme-config{grid-template-columns:1fr 1fr}.asset-upload-config select,.asset-filter select,.asset-search input{font-size:16px;min-height:48px}.asset-upload-options{grid-column:1/-1;min-height:48px}.asset-queue-head{align-items:stretch;flex-direction:column}.asset-queue-toolbar{display:grid;grid-template-columns:1fr 1.35fr}.asset-queue-toolbar button{min-height:46px}.asset-toolbar{grid-template-columns:1fr 1fr;gap:9px}.asset-search{grid-column:1/-1}.asset-app-grid,.gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.asset-dialog{width:100%;max-width:none;max-height:92dvh;margin:auto 0 0;border-radius:22px 22px 0 0;border-left:0;border-right:0;border-bottom:0}.asset-dialog-body{grid-template-columns:1fr;padding:14px 14px calc(14px + env(safe-area-inset-bottom))}.asset-dialog-preview{max-height:42vh}.asset-dialog-actions{grid-template-columns:1fr 1fr}.asset-queue-item{grid-template-columns:46px minmax(0,1fr)}.asset-queue-thumb{width:46px;height:46px}.asset-queue-actions{grid-column:1/-1;justify-content:flex-end}.asset-queue-actions button,.asset-card-actions button,.asset-card-actions a{min-height:44px}.asset-status{font-size:11px}}",
    "@media(max-width:390px){.asset-picker-row,.asset-upload-config,.asset-toolbar{grid-template-columns:1fr}.asset-upload-options,.asset-search{grid-column:auto}.asset-app-grid,.gallery{gap:7px}}"
  ].join("");
}

export function publicAssetsMarkup() {
  const appOptions = APP_OPTIONS.map(function(entry) {
    return "<option value=\"" + entry[0] + "\">" + entry[1] + "</option>";
  }).join("");
  return [
    "<section id=\"asset-library\" class=\"asset-box\" data-media-library-version=\"3\" data-deployment-contract=\"provider-version\">",
    "<div class=\"asset-head\"><div><h3>Mediebibliotek <span id=\"asset-badge\" class=\"badge\"></span></h3><p>Bläddra, sök och hantera publika assets. Launcher-loggor och temabilder visas som separata roller. Temabilder kan klassificeras explicit; filnamnstolkning finns kvar som kompatibilitetsfallback.</p></div></div>",
    "<div id=\"asset-dropzone\" class=\"asset-dropzone\"><div class=\"asset-drop-copy\"><span class=\"asset-drop-icon\" aria-hidden=\"true\">↑</span><div><strong>Lägg till media</strong><p>Välj från iPhone, dra & släpp på dator eller klistra in från urklipp.</p></div></div><div class=\"asset-picker-row\"><label class=\"asset-picker asset-picker-primary\"><input id=\"asset-files\" type=\"file\" multiple accept=\"image/*,.pdf,.txt,.json,.css\"><span>Välj filer</span><small>Bilder, kamera och iCloud Drive</small></label></div></div>",
    "<section id=\"asset-queue-panel\" class=\"asset-queue-panel\" hidden aria-label=\"Valda filer\"><div class=\"asset-queue-head\"><div class=\"asset-queue-title\"><strong>Valda filer</strong><span id=\"asset-queue-count\" class=\"asset-queue-count\"></span></div><div class=\"asset-queue-toolbar\"><button id=\"asset-clear-button\" type=\"button\">Rensa</button><button id=\"asset-upload-button\" class=\"asset-queue-primary\" type=\"button\">Ladda upp</button></div></div><div id=\"asset-queue\" class=\"asset-queue\"></div></section>",
    "<div class=\"asset-upload-config\">",
    "<label>Uppladdning<select id=\"asset-upload-kind\"><option value=\"auto\">Automatisk</option><option value=\"app\">Manuell temabild</option></select></label>",
    "<p class=\"asset-upload-hint\">Automatisk behåller filen som vald asset. Manuell temabild låter dig välja canonical app, tema och storlek.</p>",
    "<div id=\"asset-theme-config\" class=\"asset-theme-config\" hidden>",
    "<label>App<select id=\"asset-upload-app\"><option value=\"\">Välj app</option>" + appOptions + "</select></label>",
    "<label>Tema<select id=\"asset-upload-theme\"><option value=\"\">Välj tema</option><option value=\"1\">1 · Neon Glass</option><option value=\"2\">2 · Cyan Blueprint</option><option value=\"3\">3 · Isometric Console</option><option value=\"4\">4 · Illustrated Scene</option><option value=\"5\">5 · Emerald Radar</option><option value=\"6\">6 · Emerald Core</option><option value=\"7\">7 · Azure Orbit</option></select></label>",
    "<label>Storlek<select id=\"asset-upload-size\"><option value=\"auto\">Från bildmått</option><option value=\"1254\">1254</option><option value=\"512\">512</option><option value=\"256\">256</option></select></label>",
    "<label class=\"asset-upload-options\"><input id=\"replace-app-assets\" type=\"checkbox\"> Ersätt befintlig temabild</label>",
    "</div>",
    "</div>",
    
    "<div class=\"asset-toolbar\">",
    "<label class=\"asset-search\">Sök<input id=\"asset-search\" type=\"search\" placeholder=\"Namn, app, tema…\" autocomplete=\"off\"></label>",
    "<label class=\"asset-filter\">App<select id=\"asset-filter-app\"><option value=\"\">Alla appar</option></select></label>",
    "<label class=\"asset-filter\">Tema<select id=\"asset-filter-theme\"><option value=\"\">Alla teman</option></select></label>",
    "<label class=\"asset-filter\">Storlek<select id=\"asset-filter-size\"><option value=\"\">Original 1254</option><option value=\"512\">512</option><option value=\"256\">256</option><option value=\"all\">Alla</option></select></label>",
    "<label class=\"asset-filter\">Typ<select id=\"asset-filter-type\"><option value=\"\">Alla typer</option><option value=\"launcher\">Launcher-loggor</option><option value=\"app\">Temabilder</option><option value=\"image\">Övriga bilder</option><option value=\"file\">Övriga filer</option></select></label>",
    "<label class=\"asset-filter\">Sortera<select id=\"asset-sort\"><option value=\"app\">App / tema</option><option value=\"newest\">Nyast</option><option value=\"oldest\">Äldst</option><option value=\"name\">Namn</option></select></label>",
    "</div>",
    "<nav id=\"asset-nav\" class=\"asset-nav\" aria-label=\"Bildkategorier\"><button id=\"asset-home\" type=\"button\">Mediebibliotek</button><span class=\"asset-nav-sep\">›</span><button id=\"asset-apps\" type=\"button\">Appar</button><span id=\"asset-nav-current\" class=\"asset-nav-current\" hidden></span></nav>",
    "<div id=\"asset-status\" class=\"asset-status\" role=\"status\" aria-live=\"polite\" aria-atomic=\"true\">Laddar mediebibliotek…</div>",
    "<div id=\"asset-empty\" class=\"asset-empty\">Laddar mediebibliotek…</div>",
    "<div id=\"asset-app-grid\" class=\"asset-app-grid\" aria-label=\"Applikationer\"></div>",
    "<div id=\"asset-gallery\" class=\"gallery\" hidden aria-label=\"Bilder\"></div>",
    "<div id=\"asset-other-files\" class=\"asset-files\" hidden><details><summary id=\"asset-file-summary\">Övriga filer</summary><div id=\"asset-file-list\" class=\"asset-file-list\"></div></details></div>",
    "<dialog id=\"asset-dialog\" class=\"asset-dialog\"><div class=\"asset-dialog-head\"><h4 id=\"asset-dialog-title\">Asset</h4><button id=\"asset-dialog-close\" class=\"asset-dialog-close\" type=\"button\">Stäng</button></div><div class=\"asset-dialog-body\"><div id=\"asset-dialog-preview\" class=\"asset-dialog-preview\"><img id=\"asset-dialog-image\" alt=\"\"></div><div class=\"asset-dialog-info\"><dl id=\"asset-dialog-facts\" class=\"asset-dialog-facts\"></dl><div class=\"asset-dialog-actions\"><button id=\"asset-dialog-copy\" type=\"button\">Kopiera URL</button><button id=\"asset-dialog-open\" type=\"button\">Öppna original</button><button id=\"asset-dialog-download\" type=\"button\">Ladda ned</button><label id=\"asset-dialog-replace\" class=\"asset-dialog-file-action\"><input id=\"asset-replace-file\" type=\"file\"><span>Ersätt</span></label><button id=\"asset-dialog-delete\" class=\"danger\" type=\"button\">Ta bort</button></div></div></div></dialog>",
    "</section>"
  ].join("");
}

export function resolveAssetFilter(options) {
  const value = options || {};
  const app = value.app || "";
  const size = value.size || "";
  const theme = value.theme || "";
  const type = value.type || "";
  const search = String(value.search || "").trim().toLocaleLowerCase("sv");
  const browseApps = !app && !size && !theme && !type && !search;
  const implicitOriginal = !search && !size && type !== "launcher" && (app || theme);
  const effectiveSize = size === "all" ? "" : (size || (implicitOriginal ? "1254" : ""));
  return { app: app, size: size, theme: theme, type: type, search: search, browseApps: browseApps, effectiveSize: effectiveSize };
}

export function resolveAppDrilldown(app, assets) {
  const hasLauncher = (assets || []).some(function(asset) {
    return asset.image && asset.appCategory === app && asset.assetRole === "launcher";
  });
  return {
    app: app || "",
    type: hasLauncher ? "launcher" : "app",
    size: hasLauncher ? "all" : "",
    theme: "",
    search: "",
  };
}

export function filterAssetRecords(assets, filters) {
  const resolved = resolveAssetFilter(filters || {});
  if (resolved.browseApps) return [];
  return assets.filter(function(asset) {
    const pixel = asset.pixelSize ? String(asset.pixelSize) : "";
    const appImage = Boolean(asset.image && asset.assetRole === "theme" && asset.appCategory && asset.theme && asset.pixelSize);
    const kind = asset.assetRole === "launcher" ? "launcher" : (appImage ? "app" : (asset.image ? "image" : "file"));
    const haystack = [
      asset.name, asset.key, asset.appLabel, asset.appCategory,
      asset.themeLabel, asset.theme, asset.pixelLabel, asset.contentType,
    ].filter(Boolean).join(" ").toLocaleLowerCase("sv");
    return (!resolved.app || asset.appCategory === resolved.app)
      && (!resolved.theme || asset.theme === resolved.theme)
      && (!resolved.effectiveSize || pixel === resolved.effectiveSize)
      && (!resolved.type || kind === resolved.type)
      && (!resolved.search || haystack.includes(resolved.search));
  });
}

export function sortAssetRecords(assets, sort = "app") {
  return assets.slice().sort(function(a, b) {
    if (sort === "newest") return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    if (sort === "oldest") return new Date(a.uploadedAt) - new Date(b.uploadedAt);
    if (sort === "name") return String(a.name || a.key || "").localeCompare(String(b.name || b.key || ""), "sv");
    if (sort === "size") return Number(b.size || 0) - Number(a.size || 0);
    const appOrder = String(a.appLabel || a.appCategory || "").localeCompare(String(b.appLabel || b.appCategory || ""), "sv");
    if (appOrder) return appOrder;
    const themeOrder = Number(a.theme || 0) - Number(b.theme || 0);
    if (themeOrder) return themeOrder;
    return Number(b.pixelSize || 0) - Number(a.pixelSize || 0);
  });
}

export function filterAssetCards(cards, filters) {
  const resolved = resolveAssetFilter(filters || {});
  let visible = 0;
  for (const card of cards) {
    const show = !resolved.browseApps
      && (!resolved.app || card.dataset.app === resolved.app)
      && (!resolved.theme || card.dataset.theme === resolved.theme)
      && (!resolved.effectiveSize || card.dataset.size === resolved.effectiveSize)
      && (!resolved.type || resolved.type === "app");
    card.hidden = !show;
    if (show) visible += 1;
  }
  return {
    visible: visible,
    filtered: !resolved.browseApps,
    browseApps: resolved.browseApps,
    effectiveSize: resolved.effectiveSize,
    message: resolved.browseApps ? "" : visible + " bild" + (visible === 1 ? "" : "er") + " visas.",
  };
}

export function bindAssetFilterChanges(selects, apply) {
  for (const select of selects) if (select) select.addEventListener("change", apply);
}

function assetClient() {
  const q = function(selector) { return document.querySelector(selector); };
  const formatBytes = function(n) {
    n = Number(n || 0);
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
    return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB";
  };
  const formatLabel = function(type, name) {
    const ext = (String(name || "").split(".").pop() || "").toUpperCase();
    const map = {"image/jpeg":"JPEG","image/png":"PNG","image/webp":"WEBP","image/gif":"GIF","image/avif":"AVIF","image/svg+xml":"SVG","image/x-icon":"ICO","image/vnd.microsoft.icon":"ICO"};
    return map[type] || ext || type || "FIL";
  };

  let currentAssets = [];
  let detailAsset = null;
  let queue = [];
  let queueId = 0;
  const maxConcurrent = 3;

  function appAssets(assets) {
    return assets.filter(function(asset) { return asset.image && asset.assetRole === "theme" && asset.appCategory && asset.theme && asset.pixelSize; });
  }

  function launcherAssets(assets) {
    return assets.filter(function(asset) { return asset.image && asset.assetRole === "launcher" && asset.appCategory; });
  }

  function appMediaAssets(assets) {
    return assets.filter(function(asset) { return asset.image && asset.appCategory && (asset.assetRole === "theme" || asset.assetRole === "launcher"); });
  }

  function findPreview(assets, asset) {
    return assets.find(function(candidate) { return candidate.appCategory === asset.appCategory && candidate.theme === asset.theme && candidate.pixelSize === 256; })
      || assets.find(function(candidate) { return candidate.appCategory === asset.appCategory && candidate.theme === asset.theme && candidate.pixelSize === 512; })
      || asset;
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
  }

  function fillFilter(id, items, allLabel) {
    const select = q(id);
    const selected = select.value;
    select.replaceChildren(new Option(allLabel, ""));
    items.forEach(function(item) { select.append(new Option(item.label, item.value)); });
    select.value = Array.from(select.options).some(function(option) { return option.value === selected; }) ? selected : "";
  }

  function rebuildFilters(assets) {
    const structured = appAssets(assets);
    const appMedia = appMediaAssets(assets);
    const apps = Array.from(new Map(appMedia.map(function(asset) { return [asset.appCategory, asset.appLabel || asset.appCategory]; })).entries())
      .sort(function(a,b) { return a[1].localeCompare(b[1], "sv"); })
      .map(function(entry) { return { value: entry[0], label: entry[1] }; });
    const themes = Array.from(new Map(structured.map(function(asset) { return [asset.theme, asset.themeLabel || ("Tema " + asset.theme)]; })).entries())
      .sort(function(a,b) { return Number(a[0]) - Number(b[0]); })
      .map(function(entry) { return { value: entry[0], label: entry[1] }; });
    fillFilter("#asset-filter-app", apps, "Alla appar");
    fillFilter("#asset-filter-theme", themes, "Alla teman");
  }

  function currentFilters() {
    return {
      app: q("#asset-filter-app").value,
      theme: q("#asset-filter-theme").value,
      size: q("#asset-filter-size").value,
      type: q("#asset-filter-type").value,
      search: q("#asset-search").value.trim().toLocaleLowerCase("sv"),
      sort: q("#asset-sort").value,
    };
  }

  function sortAssets(assets, sort) { return sortAssetRecords(assets, sort); }

  function searchedAssets(assets, search) {
    if (!search) return assets;
    return assets.filter(function(asset) {
      return [asset.name,asset.key,asset.appLabel,asset.appCategory,asset.themeLabel,asset.theme,asset.pixelLabel,asset.contentType]
        .filter(Boolean).join(" ").toLocaleLowerCase("sv").includes(search);
    });
  }

  function assetActions(asset, compact) {
    const wrap = document.createElement("div");
    wrap.className = compact ? "asset-card-actions" : "asset-actions";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Kopiera";
    copy.addEventListener("click", async function(event) {
      event.stopPropagation();
      await copyText(asset.directUrl);
      q("#asset-status").textContent = "Direktlänken är kopierad.";
    });
    const details = document.createElement("button");
    details.type = "button";
    details.textContent = "Detaljer";
    details.addEventListener("click", function(event) {
      event.stopPropagation();
      openDetail(asset);
    });
    wrap.append(copy, details);
    return wrap;
  }

  function renderAppBrowser(assets) {
    const grid = q("#asset-app-grid");
    grid.replaceChildren();
    const groups = new Map();
    appMediaAssets(assets).forEach(function(asset) {
      if (!groups.has(asset.appCategory)) groups.set(asset.appCategory, []);
      groups.get(asset.appCategory).push(asset);
    });
    Array.from(groups.entries()).sort(function(a,b) {
      return String(a[1][0].appLabel || a[0]).localeCompare(String(b[1][0].appLabel || b[0]), "sv");
    }).forEach(function(entry) {
      const app = entry[0], items = entry[1];
      const themes = items.filter(function(item) { return item.assetRole === "theme"; });
      const launcher = items.find(function(item) { return item.assetRole === "launcher"; });
      const representative = launcher
        || themes.find(function(item) { return item.theme === "1" && item.pixelSize === 256; })
        || themes.find(function(item) { return item.pixelSize === 256; })
        || themes.find(function(item) { return item.pixelSize === 512; })
        || themes[0]
        || items[0];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "asset-app";
      button.setAttribute("aria-label", "Visa " + (representative.appLabel || app));
      const img = document.createElement("img");
      img.src = representative.previewUrl || representative.directUrl;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      const shade = document.createElement("span");
      shade.className = "asset-app-shade";
      const name = document.createElement("span");
      name.className = "asset-app-name";
      name.textContent = representative.appLabel || app;
      const count = document.createElement("span");
      count.className = "asset-app-count";
      const themeCount = new Set(themes.map(function(item) { return item.theme; })).size;
      count.textContent = (launcher ? "Launcher · " : "") + themeCount + " teman · " + items.length + " objekt";
      shade.append(name, count);
      button.append(img, shade);
      button.addEventListener("click", function() {
        const drilldown = resolveAppDrilldown(app, items);
        q("#asset-filter-app").value = drilldown.app;
        q("#asset-filter-theme").value = drilldown.theme;
        q("#asset-filter-size").value = drilldown.size;
        q("#asset-filter-type").value = drilldown.type;
        q("#asset-search").value = drilldown.search;
        applyFilters(true);
      });
      grid.append(button);
    });
  }

  function renderGallery(assets, filters) {
    const gallery = q("#asset-gallery");
    gallery.replaceChildren();
    const resolved = resolveAssetFilter(filters);
    let matches = assets.filter(function(asset) { return asset.image; });
    if (!resolved.browseApps) matches = filterAssetRecords(matches, filters);
    matches = sortAssets(matches, filters.sort);
    matches.forEach(function(asset) {
      const card = document.createElement("article");
      card.className = "asset-card";
      const previewAsset = asset.assetRole === "theme" ? findPreview(appAssets(assets), asset) : asset;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "asset-preview";
      open.addEventListener("click", function() { openDetail(asset); });
      const img = document.createElement("img");
      img.src = previewAsset.previewUrl || previewAsset.directUrl;
      img.alt = asset.assetRole === "launcher"
        ? (asset.appLabel || asset.appCategory || "App") + " · Launcher-logo"
        : asset.appCategory
          ? (asset.appLabel || asset.appCategory) + " · " + (asset.themeLabel || ("Tema " + asset.theme))
          : (asset.name || "Bild");
      img.loading = "lazy";
      img.decoding = "async";
      open.append(img);
      const caption = document.createElement("div");
      caption.className = "asset-card-caption";
      const title = document.createElement("div");
      title.className = "asset-card-title";
      const strong = document.createElement("strong");
      strong.textContent = asset.appLabel || asset.appCategory || asset.name || "Bild";
      const size = document.createElement("span");
      size.className = "asset-size";
      size.textContent = asset.pixelLabel || formatBytes(asset.size);
      title.append(strong, size);
      const sub = document.createElement("div");
      sub.className = "asset-card-sub";
      sub.textContent = asset.assetRole === "launcher"
        ? "Launcher-logo · legacy"
        : (asset.themeLabel || (asset.theme ? ("Tema " + asset.theme) : formatLabel(asset.contentType, asset.name)));
      caption.append(title, sub, assetActions(asset, true));
      card.append(open, caption);
      gallery.append(card);
    });
    return matches.length;
  }

  function renderOtherFiles(assets, filters) {
    const wrap = q("#asset-other-files"), list = q("#asset-file-list"), summary = q("#asset-file-summary");
    list.replaceChildren();
    const resolved = resolveAssetFilter(filters);
    let other = assets.filter(function(asset) {
      const structuredAppImage = Boolean(asset.image && asset.appCategory && (asset.assetRole === "theme" || asset.assetRole === "launcher"));
      return !asset.image || (resolved.browseApps && !structuredAppImage);
    });
    if (!resolved.browseApps) other = filterAssetRecords(other, filters);
    other = sortAssets(other, filters.sort);
    wrap.hidden = other.length === 0;
    summary.textContent = (resolved.browseApps ? "Övrigt" : "Övriga filer") + " · " + other.length;
    other.forEach(function(asset) {
      const row = document.createElement("div");
      row.className = "asset-file";
      const meta = document.createElement("div");
      const name = document.createElement("div");
      name.className = "asset-name";
      name.textContent = asset.name;
      name.title = asset.name;
      const facts = document.createElement("div");
      facts.className = "asset-facts";
      facts.textContent = formatBytes(asset.size) + " · " + formatLabel(asset.contentType, asset.name);
      meta.append(name, facts);
      row.append(meta, assetActions(asset, false));
      list.append(row);
    });
    return other.length;
  }

  function updateNav(filters) {
    const parts = [];
    if (filters.app) {
      const option = Array.from(q("#asset-filter-app").options).find(function(item) { return item.value === filters.app; });
      if (option) parts.push(option.textContent);
    }
    if (filters.theme) {
      const option = Array.from(q("#asset-filter-theme").options).find(function(item) { return item.value === filters.theme; });
      if (option) parts.push(option.textContent);
    }
    if (filters.size) parts.push(filters.size === "all" ? "Alla storlekar" : filters.size + "×" + filters.size);
    if (filters.type) {
      const option = Array.from(q("#asset-filter-type").options).find(function(item) { return item.value === filters.type; });
      if (option) parts.push(option.textContent);
    }
    if (filters.search) parts.push("Sök: " + filters.search);
    const current = q("#asset-nav-current");
    current.textContent = parts.length ? "› " + parts.join(" › ") : "";
    current.hidden = parts.length === 0;
  }

  function applyFilters(scroll) {
    const filters = currentFilters();
    const resolved = resolveAssetFilter(filters);
    const browse = resolved.browseApps && !filters.search;
    updateNav(filters);
    q("#asset-app-grid").hidden = !browse;
    q("#asset-gallery").hidden = browse;
    if (browse) renderAppBrowser(currentAssets);
    const visible = browse ? appMediaAssets(currentAssets).length : renderGallery(currentAssets, filters);
    const fileCount = renderOtherFiles(currentAssets, filters);
    const empty = currentAssets.length === 0 || (!browse && visible === 0 && fileCount === 0);
    q("#asset-empty").hidden = !empty;
    q("#asset-status").textContent = browse
      ? appMediaAssets(currentAssets).length + " appobjekt · välj en app eller använd sök/filter."
      : visible + " bild" + (visible === 1 ? "" : "er") + " · " + fileCount + " fil" + (fileCount === 1 ? "" : "er") + " visas.";
    if (scroll) q("#asset-nav").scrollIntoView({ behavior:"smooth", block:"start" });
  }

  function renderAssets(assets, state) {
    currentAssets = assets || [];
    const badge = q("#asset-badge"), empty = q("#asset-empty"), status = q("#asset-status");
    if (state !== "available") {
      const message = state === "not_configured" ? "Assetlagret är inte konfigurerat." : "Assetlagret är tillfälligt otillgängligt.";
      q("#asset-app-grid").replaceChildren();
      q("#asset-gallery").replaceChildren();
      q("#asset-file-list").replaceChildren();
      q("#asset-other-files").hidden = true;
      empty.textContent = message;
      empty.hidden = false;
      badge.textContent = state === "not_configured" ? "ej konfigurerat" : "otillgängligt";
      status.textContent = message;
      return;
    }
    empty.textContent = "Inga assets matchar filtret.";
    rebuildFilters(currentAssets);
    badge.textContent = currentAssets.length + " assets";
    applyFilters(false);
  }

  async function loadAssets() {
    const status = q("#asset-status");
    if (status) status.textContent = "Laddar mediebibliotek…";
    try {
      const response = await fetch("/admin/api/assets", { cache:"no-store", credentials:"same-origin" });
      if (response.status === 401) {
        location.assign("/login?return_to=%2Fadmin");
        return;
      }
      if (!response.ok) throw new Error("Kunde inte läsa mediebiblioteket.");
      const data = await response.json();
      renderAssets(data.assets || [], data.assetState || "available");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kunde inte läsa mediebiblioteket.";
      const empty = q("#asset-empty");
      if (status) status.textContent = message;
      if (empty) {
        empty.textContent = message;
        empty.hidden = false;
      }
      if (typeof window.dumpenClientError === "function") window.dumpenClientError(error, "media-library-load");
      throw error;
    }
  }

  function fact(label, value) {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value || "–";
    wrap.append(dt, dd);
    return wrap;
  }

  function openDetail(asset) {
    detailAsset = asset;
    const dialog = q("#asset-dialog");
    q("#asset-dialog-title").textContent = asset.name || asset.key;
    const image = q("#asset-dialog-image");
    const preview = q("#asset-dialog-preview");
    preview.hidden = !asset.image;
    if (asset.image) {
      image.src = asset.previewUrl || asset.directUrl;
      image.alt = asset.name || "";
    } else {
      image.removeAttribute("src");
    }
    const facts = q("#asset-dialog-facts");
    facts.replaceChildren(
      fact("Typ", formatLabel(asset.contentType, asset.name)),
      fact("Roll", asset.assetRole === "launcher" ? "Launcher-logo (legacy)" : (asset.assetRole === "theme" ? "Temabild" : "Övrig asset")),
      fact("App", asset.appLabel || asset.appCategory),
      fact("Tema", asset.themeLabel || asset.theme),
      fact("Dimension", asset.pixelLabel),
      fact("Storlek", formatBytes(asset.size)),
      fact("Uppladdad", asset.uploadedAt ? new Date(asset.uploadedAt).toLocaleString("sv-SE") : "–"),
      fact("Object key", asset.key),
      fact("Canonical URL", asset.directUrl)
    );
    const mutable = asset.mutable === true;
    q("#asset-dialog-download").disabled = !mutable;
    q("#asset-dialog-delete").disabled = !mutable;
    q("#asset-dialog-download").title = mutable ? "" : "Detta asset är read-only i Dumpen.";
    q("#asset-dialog-delete").title = mutable ? "" : "Detta asset är read-only i Dumpen.";
    const replaceControl = q("#asset-dialog-replace");
    const replaceInput = q("#asset-replace-file");
    replaceControl.setAttribute("aria-disabled", mutable ? "false" : "true");
    replaceControl.title = mutable ? "" : "Detta asset är read-only i Dumpen.";
    replaceInput.disabled = !mutable;
    replaceInput.accept = asset.contentType || "";
    dialog.showModal();
  }

  async function downloadDetail() {
    if (!detailAsset) return;
    const response = await fetch("/admin/api/assets/item?key=" + encodeURIComponent(detailAsset.key) + "&download=1", { cache:"no-store", credentials:"same-origin" });
    if (!response.ok) throw new Error("Kunde inte ladda ned asseten.");
    const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url;
    link.download = detailAsset.name || "asset";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function deleteDetail() {
    if (!detailAsset) return;
    if (!confirm("Ta bort " + (detailAsset.name || detailAsset.key) + "? Den publika URL:en slutar fungera.")) return;
    const response = await fetch("/admin/api/assets/item?key=" + encodeURIComponent(detailAsset.key), { method:"DELETE", cache:"no-store", credentials:"same-origin" });
    if (!response.ok) throw new Error("Kunde inte ta bort asseten.");
    q("#asset-dialog").close();
    q("#asset-status").textContent = "Asseten togs bort.";
    await loadAssets();
  }

  async function replaceDetail(file) {
    if (!detailAsset || !file) return;
    const response = await fetch("/admin/api/assets/item?key=" + encodeURIComponent(detailAsset.key), {
      method:"PUT",
      headers:{ "content-type":file.type || "application/octet-stream" },
      body:file,
      cache:"no-store",
      credentials:"same-origin"
    });
    if (!response.ok) {
      let message = "Kunde inte ersätta asseten.";
      try { message = (await response.json()).error || message; } catch {}
      throw new Error(message);
    }
    q("#asset-dialog").close();
    q("#asset-status").textContent = "Asseten ersattes.";
    await loadAssets();
  }

  function inspectImage(file) {
    if (!String(file.type || "").startsWith("image/")) return Promise.resolve({ width:null, height:null });
    return new Promise(function(resolve) {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = function() { const result = { width:img.naturalWidth, height:img.naturalHeight }; URL.revokeObjectURL(url); resolve(result); };
      img.onerror = function() { URL.revokeObjectURL(url); resolve({ width:null, height:null }); };
      img.src = url;
    });
  }

  function addFiles(files) {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const added = [];
    for (const file of selected) {
      const item = {
        id: ++queueId,
        file:file,
        width:null,
        height:null,
        inspecting:String(file.type || "").startsWith("image/"),
        state:"staged",
        progress:0,
        error:"",
        preview:"",
        uploadConfig:null,
      };
      queue.push(item);
      added.push(item);
    }

    renderQueue();
    const status = q("#asset-status");
    if (status) status.textContent = selected.length + " fil" + (selected.length === 1 ? "" : "er") + " vald" + (selected.length === 1 ? "" : "a") + " · tryck Ladda upp.";

    added.forEach(function(item) {
      if (!String(item.file.type || "").startsWith("image/")) return;
      try {
        item.preview = URL.createObjectURL(item.file);
        renderQueue();
      } catch {
        item.preview = "";
      }
      inspectImage(item.file).then(function(dims) {
        if (!queue.some(function(candidate) { return candidate.id === item.id; })) return;
        item.width = dims.width;
        item.height = dims.height;
        item.inspecting = false;
        renderQueue();
      }).catch(function() {
        if (!queue.some(function(candidate) { return candidate.id === item.id; })) return;
        item.inspecting = false;
        renderQueue();
      });
    });
  }

  function queueMeta(item) {
    const bits = [formatBytes(item.file.size)];
    if (item.width && item.height) bits.push(item.width + "×" + item.height);
    if (item.state === "staged") bits.push(item.inspecting ? "vald · läser bildmått…" : "vald");
    if (item.state === "pending") bits.push("redo för uppladdning");
    if (item.state === "uploading") bits.push(item.progress + "%");
    if (item.state === "waiting") bits.push("väntar på lagringslås");
    if (item.state === "done") bits.push("uppladdad");
    if (item.state === "error") bits.push(item.error || "fel");
    return bits.join(" · ");
  }

  function removeQueueItem(item) {
    if (item.preview) URL.revokeObjectURL(item.preview);
    queue = queue.filter(function(candidate) { return candidate.id !== item.id; });
    renderQueue();
  }

  function renderQueue() {
    const panel = q("#asset-queue-panel");
    const wrap = q("#asset-queue");
    const count = q("#asset-queue-count");
    const uploadButton = q("#asset-upload-button");
    const clearButton = q("#asset-clear-button");
    const staged = queue.filter(function(item) { return item.state === "staged"; }).length;
    const active = queue.some(function(item) { return item.state === "pending" || item.state === "uploading" || item.state === "waiting"; });

    panel.hidden = queue.length === 0;
    count.textContent = queue.length ? (queue.length + " fil" + (queue.length === 1 ? "" : "er")) : "";
    uploadButton.disabled = staged === 0 || queueRunning;
    uploadButton.textContent = staged ? ("Ladda upp " + staged) : "Ladda upp";
    clearButton.disabled = queue.length === 0 || active;
    wrap.replaceChildren();

    queue.forEach(function(item) {
      const row = document.createElement("div");
      row.className = "asset-queue-item";
      const thumb = document.createElement("img");
      thumb.className = "asset-queue-thumb";
      if (item.preview) thumb.src = item.preview;
      thumb.alt = "";
      const meta = document.createElement("div");
      const name = document.createElement("div");
      name.className = "asset-queue-name";
      name.textContent = item.file.name;
      const facts = document.createElement("div");
      facts.className = "asset-queue-meta";
      facts.textContent = queueMeta(item);
      const progress = document.createElement("div");
      progress.className = "asset-progress";
      const bar = document.createElement("i");
      bar.style.width = item.progress + "%";
      progress.append(bar);
      meta.append(name, facts, progress);
      const actions = document.createElement("div");
      actions.className = "asset-queue-actions";
      if (item.state === "error") {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "Välj igen";
        retry.addEventListener("click", function() {
          item.state = "staged";
          item.error = "";
          item.progress = 0;
          item.uploadConfig = null;
          renderQueue();
        });
        actions.append(retry);
      }
      if (item.state === "staged" || item.state === "error" || item.state === "done") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Ta bort";
        remove.addEventListener("click", function() { removeQueueItem(item); });
        actions.append(remove);
      }
      row.append(thumb, meta, actions);
      wrap.append(row);
    });
  }

  function currentUploadConfig() {
    const kind = q("#asset-upload-kind").value;
    if (kind !== "app") return { kind:"auto", replace:false };
    return {
      kind:"app",
      app:q("#asset-upload-app").value,
      theme:q("#asset-upload-theme").value,
      size:q("#asset-upload-size").value,
      replace:q("#replace-app-assets").checked === true,
    };
  }

  function startSelectedUpload() {
    const staged = queue.filter(function(item) { return item.state === "staged"; });
    if (!staged.length || queueRunning) return;

    const config = currentUploadConfig();
    if (config.kind === "app") {
      if (staged.length !== 1) {
        q("#asset-status").textContent = "Manuell temabild kräver exakt en vald fil.";
        return;
      }
      const item = staged[0];
      let size = config.size;
      if (!config.app || !config.theme) {
        q("#asset-status").textContent = "Välj app och tema innan uppladdning.";
        return;
      }
      if (size === "auto") {
        if (item.inspecting) {
          q("#asset-status").textContent = "Bildmåttet läses fortfarande. Vänta ett ögonblick eller välj storlek manuellt.";
          return;
        }
        size = item.width === item.height && [1254,512,256].includes(item.width) ? String(item.width) : "";
      }
      if (!size) {
        q("#asset-status").textContent = "Välj 1254, 512 eller 256 för temabilden.";
        return;
      }
      if (item.file.type !== "image/png") {
        q("#asset-status").textContent = "Temabilder måste vara PNG.";
        return;
      }
      if (item.width && item.height && (String(item.width) !== size || String(item.height) !== size)) {
        q("#asset-status").textContent = "Bildmåttet matchar inte vald storlek.";
        return;
      }
      item.uploadConfig = { ...config, size:size };
    } else {
      staged.forEach(function(item) { item.uploadConfig = config; });
    }

    staged.forEach(function(item) {
      item.state = "pending";
      item.error = "";
      item.progress = 0;
    });
    q("#asset-status").textContent = staged.length + " fil" + (staged.length === 1 ? "" : "er") + " köad" + (staged.length === 1 ? "" : "e") + " för uppladdning.";
    renderQueue();
    runQueue();
  }

  function uploadUrl(item) {
    const config = item.uploadConfig || { kind:"auto", replace:false };
    const params = new URLSearchParams({ name:item.file.name });
    if (config.replace) params.set("replace", "1");
    if (config.kind === "app") {
      params.set("app", config.app);
      params.set("theme", config.theme);
      params.set("size", config.size);
    }
    return "/admin/api/assets/uploads?" + params.toString();
  }

  function uploadItem(item) {
    return new Promise(function(resolve) {
      let url;
      try { url = uploadUrl(item); } catch (error) {
        item.state = "error";
        item.error = error.message;
        renderQueue();
        resolve();
        return;
      }
      item.state = "uploading";
      item.progress = 0;
      renderQueue();
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");
      xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
          item.progress = Math.max(1, Math.min(99, Math.round(event.loaded / event.total * 100)));
          renderQueue();
        }
      };
      xhr.onload = function() {
        let payload = null;
        try { payload = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status >= 200 && xhr.status < 300) {
          item.state = "done";
          item.progress = 100;
          item.lockRetries = 0;
        } else if (xhr.status === 409 && payload && payload.error === "asset_upload_busy" && (item.lockRetries || 0) < 20) {
          item.lockRetries = (item.lockRetries || 0) + 1;
          item.state = "waiting";
          item.progress = 0;
          item.error = "Väntar på lagringslås";
          renderQueue();
          setTimeout(function() {
            uploadItem(item).then(resolve);
          }, Number(payload.retryAfterMs) || 250);
          return;
        } else {
          item.state = "error";
          item.error = (payload && payload.error) || ("HTTP " + xhr.status);
        }
        renderQueue();
        resolve();
      };
      xhr.onerror = function() { item.state = "error"; item.error = "Nätverksfel"; renderQueue(); resolve(); };
      xhr.send(item.file);
    });
  }

  let queueRunning = false;
  async function runQueue() {
    if (queueRunning) return;
    queueRunning = true;
    renderQueue();
    try {
      while (queue.some(function(item) { return item.state === "pending"; })) {
        const batch = queue.filter(function(item) { return item.state === "pending"; }).slice(0, maxConcurrent);
        await Promise.all(batch.map(uploadItem));
      }
      const completed = queue.filter(function(item) { return item.state === "done"; }).length;
      const failed = queue.filter(function(item) { return item.state === "error"; }).length;
      if (completed || failed) {
        q("#asset-status").textContent = completed + " uppladdade" + (failed ? " · " + failed + " misslyckades" : "") + ".";
        if (completed) await loadAssets();
      }
    } finally {
      queueRunning = false;
      renderQueue();
      if (queue.some(function(item) { return item.state === "pending"; })) {
        setTimeout(runQueue, 0);
      }
    }
  }

  window.loadAssets=loadAssets;
  window.renderAssets=renderAssets;

  function reportBootstrap(error) {
    if (typeof window.dumpenClientError === "function") window.dumpenClientError(error, "media-library-bootstrap");
  }
  function on(selector, type, handler) {
    const element = q(selector);
    if (!element) {
      reportBootstrap(new Error("Saknat admin-element: " + selector));
      return null;
    }
    element.addEventListener(type, handler);
    return element;
  }
  function resetLibrary() {
    const app = q("#asset-filter-app"), theme = q("#asset-filter-theme"), size = q("#asset-filter-size");
    const type = q("#asset-filter-type"), search = q("#asset-search");
    if (app) app.value = "";
    if (theme) theme.value = "";
    if (size) size.value = "";
    if (type) type.value = "";
    if (search) search.value = "";
    applyFilters(false);
  }

  try {
    bindAssetFilterChanges(["#asset-filter-app","#asset-filter-size","#asset-filter-theme","#asset-filter-type","#asset-sort"].map(q), function() { applyFilters(false); });
    on("#asset-search", "input", function() { applyFilters(false); });
    on("#asset-home", "click", resetLibrary);
    on("#asset-apps", "click", resetLibrary);

    function syncUploadMode() {
      const config = q("#asset-theme-config"), kind = q("#asset-upload-kind");
      if (config && kind) config.hidden = kind.value !== "app";
    }
    on("#asset-upload-kind", "change", syncUploadMode);
    syncUploadMode();

    let lastFileSelection = "";
    function handleFileSelection(event) {
      const input = event.currentTarget;
      const files = Array.from(input && input.files || []);
      if (!files.length) return;
      const signature = files.map(function(file) {
        return [file.name, file.size, file.lastModified, file.type].join(":");
      }).join("|");
      if (signature === lastFileSelection) return;
      lastFileSelection = signature;
      addFiles(files);
      input.value = "";
      setTimeout(function() { lastFileSelection = ""; }, 0);
    }
    on("#asset-files", "input", handleFileSelection);
    on("#asset-files", "change", handleFileSelection);
    on("#asset-upload-button", "click", startSelectedUpload);
    on("#asset-clear-button", "click", function() {
      if (queueRunning) return;
      queue.forEach(function(item) { if (item.preview) URL.revokeObjectURL(item.preview); });
      queue = [];
      renderQueue();
    });
    const dropzone = q("#asset-dropzone");
    if (dropzone) {
      ["dragenter","dragover"].forEach(function(type) {
        dropzone.addEventListener(type, function(event) { event.preventDefault(); dropzone.dataset.drag = "true"; });
      });
      ["dragleave","drop"].forEach(function(type) {
        dropzone.addEventListener(type, function(event) { event.preventDefault(); dropzone.dataset.drag = "false"; });
      });
      dropzone.addEventListener("drop", function(event) { addFiles(event.dataTransfer.files); });
    } else {
      reportBootstrap(new Error("Saknat admin-element: #asset-dropzone"));
    }
    document.addEventListener("paste", function(event) {
      const files = Array.from(event.clipboardData && event.clipboardData.files || []);
      if (files.length) addFiles(files);
    });

    on("#asset-dialog-close", "click", function() { const dialog=q("#asset-dialog"); if (dialog) dialog.close(); });
    on("#asset-dialog", "click", function(event) { const dialog=q("#asset-dialog"); if (dialog && event.target === dialog) dialog.close(); });
    on("#asset-dialog-copy", "click", async function() { if (detailAsset) { await copyText(detailAsset.directUrl); q("#asset-status").textContent = "Direktlänken är kopierad."; } });
    on("#asset-dialog-open", "click", function() { if (detailAsset) window.open(detailAsset.directUrl, "_blank", "noopener"); });
    on("#asset-dialog-download", "click", function() { downloadDetail().catch(function(error) { q("#asset-status").textContent = error.message; }); });
    on("#asset-dialog-delete", "click", function() { deleteDetail().catch(function(error) { q("#asset-status").textContent = error.message; }); });
    on("#asset-replace-file", "change", function() {
      const input = q("#asset-replace-file");
      const file = input && input.files ? input.files[0] : null;
      if (input) input.value = "";
      replaceDetail(file).catch(function(error) { q("#asset-status").textContent = error.message; });
    });
  } catch (error) {
    reportBootstrap(error);
  }
}

export function publicAssetsScript() {
  return [
    "const __name=(target)=>target;",
    "const resolveAssetFilter=", resolveAssetFilter.toString(), ";",
    "const resolveAppDrilldown=", resolveAppDrilldown.toString(), ";",
    "const filterAssetRecords=", filterAssetRecords.toString(), ";",
    "const sortAssetRecords=", sortAssetRecords.toString(), ";",
    "const bindAssetFilterChanges=", bindAssetFilterChanges.toString(), ";",
    "(", assetClient.toString(), ")();"
  ].join("");
}
