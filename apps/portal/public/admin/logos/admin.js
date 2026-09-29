(() => {
  const state = { assets: [] };
  const list = document.querySelector("#asset-list");
  const count = document.querySelector("#asset-count");
  const status = document.querySelector("#admin-status");
  const filter = document.querySelector("#asset-filter");
  const sort = document.querySelector("#asset-sort");
  const previewPanel = document.querySelector("#preview-panel");
  const previewImage = document.querySelector("#logo-preview");
  const previewCaption = document.querySelector("#preview-caption");

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(error));
  }

  async function api(path = "", options = {}) {
    const response = await fetch(`/api/admin/logos${path}`, {
      ...options,
      headers: { ...(options.headers || {}) },
      cache: "no-store"
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({ error: "invalid_response" }));
    if (!response.ok) throw new Error(payload.error || `request_failed_${response.status}`);
    return payload;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  }

  function formatDate(value) {
    const date = new Date(value || "");
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(date)
      : "—";
  }

  function element(tag, attributes = {}, text = null) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === "className") node.className = value;
      else node.setAttribute(key, value);
    }
    if (text !== null) node.textContent = text;
    return node;
  }

  function metadataItem(label, value) {
    const wrapper = element("div");
    wrapper.append(element("dt", {}, label), element("dd", {}, value));
    return wrapper;
  }

  async function copyPublicUrl(asset) {
    const absolute = new URL(asset.publicUrl, location.origin).href;
    await navigator.clipboard.writeText(absolute);
    setStatus(`Publik URL kopierad för ${asset.originalName}.`);
  }

  function showPreview(asset) {
    previewImage.src = asset.publicUrl;
    previewImage.alt = `Förhandsvisning av ${asset.originalName}`;
    previewCaption.textContent = `${asset.originalName} · ${asset.contentType}`;
    previewPanel.hidden = false;
    document.querySelector("#preview-title").focus({ preventScroll: true });
    previewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function replaceAsset(asset, input) {
    const file = input.files?.[0];
    if (!file) {
      setStatus("Välj en fil att ersätta med.", true);
      return;
    }
    setStatus(`Ersätter ${asset.originalName}…`);
    await api(`/${asset.id}`, {
      method: "PUT",
      headers: { "Content-Type": file.type, "X-File-Name": file.name },
      body: file
    });
    await loadAssets();
    setStatus(`Logotypen ersattes. Publik URL och asset-id är oförändrade.`);
  }

  async function deleteAsset(asset) {
    if (!window.confirm(`Ta bort ${asset.originalName}? Den publika URL:en slutar fungera.`)) return;
    setStatus(`Tar bort ${asset.originalName}…`);
    await api(`/${asset.id}`, { method: "DELETE" });
    await loadAssets();
    setStatus(`${asset.originalName} togs bort.`);
  }

  function assetCard(asset) {
    const article = element("article", { className: "asset-card" });
    const thumbnail = element("div", { className: "asset-thumbnail" });
    thumbnail.append(element("img", { src: asset.publicUrl, alt: "" }));

    const details = element("div", { className: "asset-details" });
    details.append(element("h3", {}, asset.originalName));
    const meta = element("dl", { className: "asset-meta" });
    meta.append(
      metadataItem("Asset-id", asset.id),
      metadataItem("MIME", asset.contentType || "—"),
      metadataItem("Storlek", formatBytes(asset.size)),
      metadataItem("Skapad", formatDate(asset.createdAt)),
      metadataItem("Ändrad", formatDate(asset.updatedAt)),
      metadataItem("ETag", asset.etag || "—")
    );
    details.append(meta);

    const actions = element("div", { className: "asset-actions" });
    const preview = element("button", { type: "button", className: "secondary-button" }, "Förhandsvisa");
    preview.addEventListener("click", () => showPreview(asset));
    const copy = element("button", { type: "button", className: "secondary-button" }, "Kopiera publik URL");
    copy.addEventListener("click", () => copyPublicUrl(asset).catch(error => setStatus(error.message, true)));
    const download = element("a", { className: "download-link secondary-button", href: `/api/admin/logos/${asset.id}/download` }, "Ladda ner");

    const replaceControl = element("div", { className: "replace-control" });
    const replaceId = `replace-${asset.id}`;
    const replaceLabel = element("label", { for: replaceId }, "Ersätt fil");
    const replaceInput = element("input", {
      id: replaceId,
      type: "file",
      accept: "image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
    });
    const replaceButton = element("button", { type: "button", className: "secondary-button" }, "Ersätt");
    replaceButton.addEventListener("click", () => replaceAsset(asset, replaceInput).catch(error => setStatus(error.message, true)));
    replaceControl.append(replaceLabel, replaceInput, replaceButton);

    const remove = element("button", { type: "button", className: "danger-button" }, "Ta bort");
    remove.addEventListener("click", () => deleteAsset(asset).catch(error => setStatus(error.message, true)));
    actions.append(preview, copy, download, replaceControl, remove);
    details.append(actions);
    article.append(thumbnail, details);
    return article;
  }

  function visibleAssets() {
    const query = filter.value.trim().toLocaleLowerCase("sv");
    const assets = state.assets.filter(asset =>
      !query || [asset.originalName, asset.id, asset.contentType].some(value =>
        String(value || "").toLocaleLowerCase("sv").includes(query)
      )
    );
    const mode = sort.value;
    return assets.sort((left, right) => {
      if (mode === "name-asc") return left.originalName.localeCompare(right.originalName, "sv");
      if (mode === "size-desc") return right.size - left.size;
      if (mode === "created-desc") return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
      return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
  }

  function renderAssets() {
    const assets = visibleAssets();
    list.replaceChildren();
    count.textContent = `${assets.length} av ${state.assets.length} assets`;
    if (!assets.length) {
      list.append(element("div", { className: "admin-empty" }, state.assets.length ? "Inga matchande assets." : "Inga logotyper är uppladdade ännu."));
    } else {
      list.append(...assets.map(assetCard));
    }
    list.setAttribute("aria-busy", "false");
  }

  async function loadAssets() {
    list.setAttribute("aria-busy", "true");
    const payload = await api();
    state.assets = Array.isArray(payload.assets) ? payload.assets : [];
    renderAssets();
  }

  document.querySelector("#logo-upload-form").addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.querySelector("#logo-file");
    const file = input.files?.[0];
    if (!file) return;
    try {
      setStatus(`Laddar upp ${file.name}…`);
      await api("", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-File-Name": file.name },
        body: file
      });
      input.value = "";
      await loadAssets();
      setStatus(`${file.name} laddades upp.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.querySelector("#refresh-assets").addEventListener("click", () => {
    loadAssets().then(() => setStatus("Listan uppdaterades.")).catch(error => setStatus(error.message, true));
  });
  document.querySelector("#close-preview").addEventListener("click", () => {
    previewPanel.hidden = true;
    previewImage.removeAttribute("src");
    document.querySelector("#assets-title").focus({ preventScroll: true });
  });
  filter.addEventListener("input", renderAssets);
  sort.addEventListener("change", renderAssets);

  loadAssets().catch(error => {
    list.setAttribute("aria-busy", "false");
    list.replaceChildren(element("div", { className: "admin-empty" }, "Logotyperna kunde inte läsas."));
    setStatus(error.message, true);
  });
})();
