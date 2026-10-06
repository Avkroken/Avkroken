
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
    ".asset-box{margin:20px 0 22px;padding:18px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--panel) 90%,transparent)}",
    ".asset-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}.asset-head h3{margin:0;font-size:18px;font-weight:720;letter-spacing:-.02em}.asset-head p{margin:4px 0 0;color:var(--muted);font-size:13px;max-width:760px}",
    ".asset-dropzone{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:18px;border:1px dashed var(--line-strong);border-radius:14px;background:var(--bg-deep);transition:border-color .15s,background .15s}.asset-dropzone[data-drag=true]{border-color:var(--green);background:color-mix(in srgb,var(--green) 7%,var(--bg-deep))}.asset-dropzone strong{display:block;font-size:14px}.asset-dropzone p{margin:3px 0 0;color:var(--muted);font-size:11px}.asset-dropzone input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}",
    ".asset-upload-config{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:10px}.asset-upload-config label,.asset-filter{display:grid;gap:5px;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}.asset-upload-config select,.asset-filter select,.asset-search input{width:100%;min-height:40px;padding:7px 9px;border:1px solid var(--line-strong);border-radius:9px;background:var(--bg-deep);color:var(--text);font:inherit;text-transform:none;letter-spacing:normal}.asset-upload-options{display:flex!important;grid-auto-flow:column;justify-content:start;align-items:center;gap:7px!important;text-transform:none!important;letter-spacing:normal!important}.asset-upload-options input{width:17px;height:17px;accent-color:var(--green)}",
    ".asset-queue{display:grid;gap:7px;margin-top:10px}.asset-queue[hidden]{display:none}.asset-queue-item{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--bg-deep)}.asset-queue-thumb{width:44px;height:44px;border-radius:8px;object-fit:cover;background:#050805}.asset-queue-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:700}.asset-queue-meta{margin-top:2px;color:var(--muted);font-size:9px}.asset-progress{height:4px;margin-top:5px;border-radius:99px;background:var(--panel-2);overflow:hidden}.asset-progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--green),var(--purple))}.asset-queue-actions{display:flex;gap:4px}.asset-queue-actions button{min-height:28px;padding:3px 6px;font-size:9px}",
    ".asset-toolbar{display:grid;grid-template-columns:minmax(180px,1.5fr) repeat(5,minmax(105px,1fr));gap:8px;margin:16px 0 8px}.asset-search{display:grid;gap:5px;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}",
    ".asset-nav{display:flex;align-items:center;gap:7px;min-height:34px;margin:8px 0;color:var(--muted);font-size:11px;overflow-x:auto;white-space:nowrap}.asset-nav button{min-height:30px;padding:4px 8px;background:transparent;color:var(--text);border-color:var(--line);font-size:11px}.asset-nav-sep{color:var(--muted)}.asset-status{min-height:22px;margin:5px 0;color:var(--muted);font-size:11px}",
    ".asset-app-grid,.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:9px;width:100%;margin-top:10px}.asset-app{position:relative;min-width:0;aspect-ratio:1/1;padding:0;border:1px solid var(--line);border-radius:13px;overflow:hidden;background:var(--bg-deep);color:var(--text);text-align:left}.asset-app:hover,.asset-app:focus-visible{border-color:var(--line-strong);filter:none}.asset-app img{width:100%;height:100%;display:block;object-fit:cover}.asset-app-shade{position:absolute;inset:auto 0 0;padding:34px 9px 9px;background:linear-gradient(transparent,rgba(0,0,0,.88));pointer-events:none}.asset-app-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:760}.asset-app-count{display:block;margin-top:2px;color:#dce7f8;font-size:9px}",
    ".asset-card{min-width:0;border:1px solid var(--line);border-radius:13px;background:var(--bg-deep);overflow:hidden}.asset-preview{position:relative;aspect-ratio:1/1;display:block;width:100%;padding:0;border:0;border-radius:0;background:#050805;overflow:hidden}.asset-preview img{display:block;width:100%;height:100%;object-fit:cover}.asset-card-caption{padding:8px;min-width:0}.asset-card-title{display:flex;align-items:center;justify-content:space-between;gap:5px}.asset-card-title strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.asset-size{flex:0 0 auto;color:var(--muted);font-size:9px}.asset-card-sub{margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:9px}.asset-card-actions{display:flex;gap:5px;margin-top:7px}.asset-card-actions button,.asset-card-actions a{flex:1;min-width:0;min-height:28px;padding:3px 5px;border-radius:7px;font-size:9px;text-align:center}.asset-card-actions a{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line-strong);color:var(--text);text-decoration:none}",
    ".asset-files{margin-top:14px}.asset-files details{border-top:1px solid var(--line);padding-top:10px}.asset-files summary{cursor:pointer;color:var(--muted);font-size:11px}.asset-file-list{display:grid;gap:7px;margin-top:9px}.asset-file{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px;border:1px solid var(--line);border-radius:9px;background:var(--bg-deep)}.asset-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.asset-facts{margin-top:2px;color:var(--muted);font-size:9px}",
    ".asset-empty{margin-top:12px;padding:18px;border:1px dashed var(--line);border-radius:12px;color:var(--muted);font-size:11px;text-align:center}.asset-app-grid[hidden],.gallery[hidden],.asset-files[hidden],.asset-empty[hidden]{display:none}",
    ".asset-dialog{width:min(760px,calc(100% - 24px));max-height:90vh;padding:0;border:1px solid var(--line-strong);border-radius:16px;background:var(--panel);color:var(--text);box-shadow:0 28px 90px rgba(0,0,0,.6)}.asset-dialog::backdrop{background:rgba(0,0,0,.72);backdrop-filter:blur(4px)}.asset-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;border-bottom:1px solid var(--line)}.asset-dialog-head h4{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.asset-dialog-close{min-height:30px;padding:3px 8px}.asset-dialog-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(240px,.85fr);gap:16px;padding:15px}.asset-dialog-preview{aspect-ratio:1/1;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#050805}.asset-dialog-preview img{width:100%;height:100%;display:block;object-fit:contain}.asset-dialog-info{min-width:0}.asset-dialog-facts{display:grid;gap:8px;margin:0}.asset-dialog-facts div{padding-bottom:7px;border-bottom:1px solid var(--line)}.asset-dialog-facts dt{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.05em}.asset-dialog-facts dd{margin:2px 0 0;overflow-wrap:anywhere;font-size:11px}.asset-dialog-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.asset-dialog-actions .danger{color:var(--danger)}",
    "@media(max-width:900px){.asset-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}.asset-search{grid-column:1/-1}.asset-upload-config{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    "@media(max-width:680px){.asset-box{margin-inline:-10px;padding:12px;border-radius:14px}.asset-head{align-items:flex-start;flex-direction:column;gap:7px}.asset-dropzone{grid-template-columns:1fr}.asset-dropzone button{width:100%}.asset-toolbar{grid-template-columns:1fr 1fr}.asset-app-grid,.gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.asset-dialog-body{grid-template-columns:1fr}.asset-dialog-preview{max-height:45vh}.asset-queue-item{grid-template-columns:38px minmax(0,1fr)}.asset-queue-thumb{width:38px;height:38px}.asset-queue-actions{grid-column:1/-1;justify-content:flex-end}}"
  ].join("");
}

export function publicAssetsMarkup() {
  const appOptions = APP_OPTIONS.map(function(entry) {
    return "<option value=\"" + entry[0] + "\">" + entry[1] + "</option>";
  }).join("");
  return [
    "<section id=\"asset-library\" class=\"asset-box\" data-media-library-version=\"2\" data-deployment-contract=\"provider-version\">",
    "<div class=\"asset-head\"><div><h3>Mediebibliotek <span id=\"asset-badge\" class=\"badge\"></span></h3><p>Bläddra, sök och hantera publika assets. Appbilder kan klassificeras explicit; filnamnstolkning finns kvar som kompatibilitetsfallback.</p></div></div>",
    "<div id=\"asset-dropzone\" class=\"asset-dropzone\"><div><strong>Släpp filer här</strong><p>Drag & drop, klistra in från urklipp eller välj flera filer. Max 20 MB per fil.</p></div><div><input id=\"asset-files\" type=\"file\" multiple accept=\"image/*,.pdf,.txt,.json,.css\"><button id=\"choose-assets\" type=\"button\">Välj filer</button></div></div>",
    "<div class=\"asset-upload-config\">",
    "<label>Uppladdning<select id=\"asset-upload-kind\"><option value=\"auto\">Automatisk</option><option value=\"app\">Appbild</option></select></label>",
    "<label>App<select id=\"asset-upload-app\" disabled><option value=\"\">Välj app</option>" + appOptions + "</select></label>",
    "<label>Tema<select id=\"asset-upload-theme\" disabled><option value=\"\">Välj tema</option><option value=\"1\">1 · Neon Glass</option><option value=\"2\">2 · Cyan Blueprint</option><option value=\"3\">3 · Isometric Console</option><option value=\"4\">4 · Illustrated Scene</option><option value=\"5\">5 · Emerald Radar</option><option value=\"6\">6 · Emerald Core</option><option value=\"7\">7 · Azure Orbit</option></select></label>",
    "<label>Storlek<select id=\"asset-upload-size\" disabled><option value=\"auto\">Från bildmått</option><option value=\"1254\">1254</option><option value=\"512\">512</option><option value=\"256\">256</option></select></label>",
    "<label class=\"asset-upload-options\"><input id=\"replace-app-assets\" type=\"checkbox\"> Ersätt befintlig appbild</label>",
    "</div>",
    "<div id=\"asset-queue\" class=\"asset-queue\" hidden></div>",
    "<div class=\"asset-toolbar\">",
    "<label class=\"asset-search\">Sök<input id=\"asset-search\" type=\"search\" placeholder=\"Namn, app, tema…\" autocomplete=\"off\"></label>",
    "<label class=\"asset-filter\">App<select id=\"asset-filter-app\"><option value=\"\">Alla appar</option></select></label>",
    "<label class=\"asset-filter\">Tema<select id=\"asset-filter-theme\"><option value=\"\">Alla teman</option></select></label>",
    "<label class=\"asset-filter\">Storlek<select id=\"asset-filter-size\"><option value=\"\">Original 1254</option><option value=\"512\">512</option><option value=\"256\">256</option><option value=\"all\">Alla</option></select></label>",
    "<label class=\"asset-filter\">Typ<select id=\"asset-filter-type\"><option value=\"\">Alla typer</option><option value=\"app\">Appbilder</option><option value=\"image\">Övriga bilder</option><option value=\"file\">Övriga filer</option></select></label>",
    "<label class=\"asset-filter\">Sortera<select id=\"asset-sort\"><option value=\"app\">App / tema</option><option value=\"newest\">Nyast</option><option value=\"oldest\">Äldst</option><option value=\"name\">Namn</option></select></label>",
    "</div>",
    "<nav id=\"asset-nav\" class=\"asset-nav\" aria-label=\"Bildkategorier\"><button id=\"asset-home\" type=\"button\">Mediebibliotek</button><span class=\"asset-nav-sep\">›</span><span id=\"asset-nav-current\">Apps</span></nav>",
    "<div id=\"asset-status\" class=\"asset-status\" role=\"status\" aria-live=\"polite\" aria-atomic=\"true\"></div>",
    "<div id=\"asset-empty\" class=\"asset-empty\" hidden>Inga assets matchar filtret.</div>",
    "<div id=\"asset-app-grid\" class=\"asset-app-grid\" aria-label=\"Applikationer\"></div>",
    "<div id=\"asset-gallery\" class=\"gallery\" hidden aria-label=\"Bilder\"></div>",
    "<div id=\"asset-other-files\" class=\"asset-files\" hidden><details><summary id=\"asset-file-summary\">Övriga filer</summary><div id=\"asset-file-list\" class=\"asset-file-list\"></div></details></div>",
    "<dialog id=\"asset-dialog\" class=\"asset-dialog\"><div class=\"asset-dialog-head\"><h4 id=\"asset-dialog-title\">Asset</h4><button id=\"asset-dialog-close\" class=\"asset-dialog-close\" type=\"button\">Stäng</button></div><div class=\"asset-dialog-body\"><div id=\"asset-dialog-preview\" class=\"asset-dialog-preview\"><img id=\"asset-dialog-image\" alt=\"\"></div><div class=\"asset-dialog-info\"><dl id=\"asset-dialog-facts\" class=\"asset-dialog-facts\"></dl><div class=\"asset-dialog-actions\"><button id=\"asset-dialog-copy\" type=\"button\">Kopiera URL</button><button id=\"asset-dialog-open\" type=\"button\">Öppna original</button><button id=\"asset-dialog-download\" type=\"button\">Ladda ned</button><button id=\"asset-dialog-replace\" type=\"button\">Ersätt</button><button id=\"asset-dialog-delete\" class=\"danger\" type=\"button\">Ta bort</button></div><input id=\"asset-replace-file\" type=\"file\" hidden></div></div></dialog>",
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
  const implicitOriginal = !search && !size && (app || theme);
  const effectiveSize = size === "all" ? "" : (size || (implicitOriginal ? "1254" : ""));
  return { app: app, size: size, theme: theme, type: type, search: search, browseApps: browseApps, effectiveSize: effectiveSize };
}

export function filterAssetRecords(assets, filters) {
  const resolved = resolveAssetFilter(filters || {});
  if (resolved.browseApps) return [];
  return assets.filter(function(asset) {
    const pixel = asset.pixelSize ? String(asset.pixelSize) : "";
    const appImage = Boolean(asset.image && asset.appCategory && asset.theme && asset.pixelSize);
    const kind = appImage ? "app" : (asset.image ? "image" : "file");
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
    return assets.filter(function(asset) { return asset.image && asset.appCategory && asset.theme && asset.pixelSize; });
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
    const apps = Array.from(new Map(structured.map(function(asset) { return [asset.appCategory, asset.appLabel || asset.appCategory]; })).entries())
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
    appAssets(assets).forEach(function(asset) {
      if (!groups.has(asset.appCategory)) groups.set(asset.appCategory, []);
      groups.get(asset.appCategory).push(asset);
    });
    Array.from(groups.entries()).sort(function(a,b) {
      return String(a[1][0].appLabel || a[0]).localeCompare(String(b[1][0].appLabel || b[0]), "sv");
    }).forEach(function(entry) {
      const app = entry[0], items = entry[1];
      const representative = items.find(function(item) { return item.theme === "1" && item.pixelSize === 256; })
        || items.find(function(item) { return item.pixelSize === 256; })
        || items.find(function(item) { return item.pixelSize === 512; })
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
      count.textContent = new Set(items.map(function(item) { return item.theme; })).size + " teman · " + items.length + " varianter";
      shade.append(name, count);
      button.append(img, shade);
      button.addEventListener("click", function() {
        q("#asset-filter-app").value = app;
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
      const previewAsset = asset.appCategory ? findPreview(appAssets(assets), asset) : asset;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "asset-preview";
      open.addEventListener("click", function() { openDetail(asset); });
      const img = document.createElement("img");
      img.src = previewAsset.previewUrl || previewAsset.directUrl;
      img.alt = asset.appCategory
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
      sub.textContent = asset.themeLabel || (asset.theme ? ("Tema " + asset.theme) : formatLabel(asset.contentType, asset.name));
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
      const appImage = Boolean(asset.image && asset.appCategory && asset.theme && asset.pixelSize);
      return !asset.image || (resolved.browseApps && !appImage);
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
    q("#asset-nav-current").textContent = parts.length ? parts.join(" › ") : "Apps";
  }

  function applyFilters(scroll) {
    const filters = currentFilters();
    const resolved = resolveAssetFilter(filters);
    const browse = resolved.browseApps && !filters.search;
    updateNav(filters);
    q("#asset-app-grid").hidden = !browse;
    q("#asset-gallery").hidden = browse;
    if (browse) renderAppBrowser(currentAssets);
    const visible = browse ? appAssets(currentAssets).length : renderGallery(currentAssets, filters);
    const fileCount = renderOtherFiles(currentAssets, filters);
    const empty = currentAssets.length === 0 || (!browse && visible === 0 && fileCount === 0);
    q("#asset-empty").hidden = !empty;
    q("#asset-status").textContent = browse
      ? appAssets(currentAssets).length + " appbilder · välj en app eller använd sök/filter."
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
    const response = await fetch("/admin/api/assets", { cache:"no-store", credentials:"same-origin" });
    if (response.status === 401) {
      location.assign("/login?return_to=%2Fadmin");
      return;
    }
    if (!response.ok) throw new Error("Kunde inte läsa mediebiblioteket.");
    const data = await response.json();
    renderAssets(data.assets || [], data.assetState || "available");
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
    q("#asset-dialog-replace").disabled = !mutable;
    q("#asset-dialog-delete").disabled = !mutable;
    q("#asset-dialog-download").title = mutable ? "" : "Detta asset är read-only i Dumpen.";
    q("#asset-dialog-replace").title = mutable ? "" : "Detta asset är read-only i Dumpen.";
    q("#asset-dialog-delete").title = mutable ? "" : "Detta asset är read-only i Dumpen.";
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

  async function addFiles(files) {
    for (const file of Array.from(files || [])) {
      const dims = await inspectImage(file);
      const item = {
        id: ++queueId,
        file:file,
        width:dims.width,
        height:dims.height,
        state:"pending",
        progress:0,
        error:"",
        preview:String(file.type || "").startsWith("image/") ? URL.createObjectURL(file) : "",
      };
      queue.push(item);
    }
    renderQueue();
    runQueue();
  }

  function queueMeta(item) {
    const bits = [formatBytes(item.file.size)];
    if (item.width && item.height) bits.push(item.width + "×" + item.height);
    if (item.state === "uploading") bits.push(item.progress + "%");
    if (item.state === "waiting") bits.push("väntar på lagringslås");
    if (item.state === "done") bits.push("klar");
    if (item.state === "error") bits.push(item.error || "fel");
    return bits.join(" · ");
  }

  function renderQueue() {
    const wrap = q("#asset-queue");
    wrap.hidden = queue.length === 0;
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
        retry.textContent = "Försök igen";
        retry.addEventListener("click", function() { item.state = "pending"; item.error = ""; item.progress = 0; renderQueue(); runQueue(); });
        actions.append(retry);
      }
      if (item.state === "pending" || item.state === "error" || item.state === "done") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Ta bort";
        remove.addEventListener("click", function() {
          if (item.preview) URL.revokeObjectURL(item.preview);
          queue = queue.filter(function(candidate) { return candidate.id !== item.id; });
          renderQueue();
        });
        actions.append(remove);
      }
      row.append(thumb, meta, actions);
      wrap.append(row);
    });
  }

  function uploadUrl(item) {
    const params = new URLSearchParams({ name:item.file.name });
    if (q("#replace-app-assets").checked) params.set("replace", "1");
    if (q("#asset-upload-kind").value === "app") {
      const app = q("#asset-upload-app").value, theme = q("#asset-upload-theme").value;
      let size = q("#asset-upload-size").value;
      if (size === "auto") size = item.width === item.height && [1254,512,256].includes(item.width) ? String(item.width) : "";
      if (!app || !theme || !size) throw new Error("App, tema och giltig storlek krävs för appbilder.");
      if (item.file.type !== "image/png") throw new Error("Appbilder måste vara PNG.");
      if (item.width && item.height && (String(item.width) !== size || String(item.height) !== size)) throw new Error("Bildmåttet matchar inte vald storlek.");
      params.set("app", app);
      params.set("theme", theme);
      params.set("size", size);
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
    try {
      while (queue.some(function(item) { return item.state === "pending"; })) {
        const pending = queue.filter(function(item) { return item.state === "pending"; });
        const appMode = q("#asset-upload-kind").value === "app";
        if (appMode && pending.length > 1) {
          pending.slice(1).forEach(function(item) {
            item.state = "error";
            item.error = "Explicit Appbild-läge använder en canonical slot åt gången. Ladda upp en fil eller använd Automatisk för batch.";
          });
          renderQueue();
        }
        const batch = queue.filter(function(item) { return item.state === "pending"; }).slice(0, appMode ? 1 : maxConcurrent);
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
      if (queue.some(function(item) { return item.state === "pending"; })) {
        setTimeout(runQueue, 0);
      }
    }
  }

  bindAssetFilterChanges(["#asset-filter-app","#asset-filter-size","#asset-filter-theme","#asset-filter-type","#asset-sort"].map(q), function() { applyFilters(false); });
  q("#asset-search").addEventListener("input", function() { applyFilters(false); });
  q("#asset-home").addEventListener("click", function() {
    q("#asset-filter-app").value = "";
    q("#asset-filter-theme").value = "";
    q("#asset-filter-size").value = "";
    q("#asset-filter-type").value = "";
    q("#asset-search").value = "";
    applyFilters(false);
  });

  q("#asset-upload-kind").addEventListener("change", function() {
    const appMode = q("#asset-upload-kind").value === "app";
    q("#asset-upload-app").disabled = !appMode;
    q("#asset-upload-theme").disabled = !appMode;
    q("#asset-upload-size").disabled = !appMode;
  });

  q("#choose-assets").addEventListener("click", function() { q("#asset-files").click(); });
  q("#asset-files").addEventListener("change", function() { addFiles(q("#asset-files").files); q("#asset-files").value = ""; });
  const dropzone = q("#asset-dropzone");
  ["dragenter","dragover"].forEach(function(type) {
    dropzone.addEventListener(type, function(event) { event.preventDefault(); dropzone.dataset.drag = "true"; });
  });
  ["dragleave","drop"].forEach(function(type) {
    dropzone.addEventListener(type, function(event) { event.preventDefault(); dropzone.dataset.drag = "false"; });
  });
  dropzone.addEventListener("drop", function(event) { addFiles(event.dataTransfer.files); });
  document.addEventListener("paste", function(event) {
    const files = Array.from(event.clipboardData && event.clipboardData.files || []);
    if (files.length) addFiles(files);
  });

  q("#asset-dialog-close").addEventListener("click", function() { q("#asset-dialog").close(); });
  q("#asset-dialog").addEventListener("click", function(event) { if (event.target === q("#asset-dialog")) q("#asset-dialog").close(); });
  q("#asset-dialog-copy").addEventListener("click", async function() { if (detailAsset) { await copyText(detailAsset.directUrl); q("#asset-status").textContent = "Direktlänken är kopierad."; } });
  q("#asset-dialog-open").addEventListener("click", function() { if (detailAsset) window.open(detailAsset.directUrl, "_blank", "noopener"); });
  q("#asset-dialog-download").addEventListener("click", function() { downloadDetail().catch(function(error) { q("#asset-status").textContent = error.message; }); });
  q("#asset-dialog-delete").addEventListener("click", function() { deleteDetail().catch(function(error) { q("#asset-status").textContent = error.message; }); });
  q("#asset-dialog-replace").addEventListener("click", function() {
    const input = q("#asset-replace-file");
    input.accept = detailAsset && detailAsset.contentType ? detailAsset.contentType : "";
    input.click();
  });
  q("#asset-replace-file").addEventListener("change", function() {
    const file = q("#asset-replace-file").files[0];
    q("#asset-replace-file").value = "";
    replaceDetail(file).catch(function(error) { q("#asset-status").textContent = error.message; });
  });

  window.loadAssets = loadAssets;
  window.renderAssets = renderAssets;
}

export function publicAssetsScript() {
  return [
    "const resolveAssetFilter=", resolveAssetFilter.toString(), ";",
    "const filterAssetRecords=", filterAssetRecords.toString(), ";",
    "const sortAssetRecords=", sortAssetRecords.toString(), ";",
    "const bindAssetFilterChanges=", bindAssetFilterChanges.toString(), ";",
    "(", assetClient.toString(), ")();"
  ].join("");
}
